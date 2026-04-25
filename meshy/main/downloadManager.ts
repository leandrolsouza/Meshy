import { EventEmitter } from 'events';
import { existsSync, accessSync, constants as fsConstants } from 'fs';
import type { TorrentEngine, TorrentInfo } from './torrentEngine';
import type { SettingsManager } from './settingsManager';
import type { DownloadItem, PersistedDownloadItem, TorrentStatus } from '../shared/types';
import { logger as defaultLogger } from './logger';
import type { Logger } from './logger';

export type { DownloadItem, PersistedDownloadItem } from '../shared/types';

export interface DownloadManager {
    addTorrentFile(filePath: string): Promise<DownloadItem>;
    addMagnetLink(magnetUri: string): Promise<DownloadItem>;
    pause(infoHash: string): Promise<void>;
    resume(infoHash: string): Promise<void>;
    remove(infoHash: string, deleteFiles: boolean): Promise<void>;
    getAll(): DownloadItem[];
    restoreSession(): Promise<void>;
    persistSession(): void;
    on(event: 'update', listener: (item: DownloadItem) => void): void;
}

// ─── Store interface (subset used by DownloadManager) ─────────────────────────

/**
 * Minimal interface for the persisted store, allowing injection of a mock in tests.
 */
export interface PersistedStore {
    get(key: 'downloads'): PersistedDownloadItem[] | undefined;
    set(key: 'downloads', value: PersistedDownloadItem[]): void;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function torrentInfoToDownloadItem(
    info: TorrentInfo,
    destinationFolder: string,
    addedAt: number,
): DownloadItem {
    return {
        infoHash: info.infoHash,
        name: info.name,
        totalSize: info.totalSize,
        downloadedSize: info.downloaded,
        progress: info.progress,
        downloadSpeed: info.downloadSpeed,
        uploadSpeed: info.uploadSpeed,
        numPeers: info.numPeers,
        numSeeders: info.numSeeders,
        timeRemaining: info.timeRemaining,
        status: info.status,
        destinationFolder,
        addedAt,
    };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const METADATA_TIMEOUT_MS = 60_000;

// ─── Folder validation ────────────────────────────────────────────────────────

/**
 * Validates that the given folder path exists and is writable.
 * Throws an Error with a descriptive message if validation fails.
 */
function validateDestinationFolder(folderPath: string): void {
    if (!existsSync(folderPath)) {
        throw new Error('Pasta inválida ou sem permissão de escrita');
    }
    try {
        accessSync(folderPath, fsConstants.W_OK);
    } catch {
        throw new Error('Pasta inválida ou sem permissão de escrita');
    }
}

// ─── Implementation ───────────────────────────────────────────────────────────

class DownloadManagerImpl extends EventEmitter implements DownloadManager {
    private readonly items = new Map<string, DownloadItem>();
    /** Pending metadata-resolution timers keyed by infoHash */
    private readonly metadataTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly engine: TorrentEngine;
    private readonly settings: SettingsManager;
    private readonly store: PersistedStore | undefined;
    private readonly log: Logger;

    constructor(engine: TorrentEngine, settings: SettingsManager, store?: PersistedStore, log?: Logger) {
        super();
        this.engine = engine;
        this.settings = settings;
        this.store = store;
        this.log = log ?? defaultLogger;

        // Subscribe to engine events
        this.engine.on('progress', (info: TorrentInfo) => {
            const existing = this.items.get(info.infoHash);
            if (!existing) return;

            // Detect metadata resolution: resolving-metadata → downloading
            // When this transition happens, clear the 60s timeout and update
            // name + totalSize from the now-resolved metadata.
            const wasResolvingMetadata = existing.status === 'resolving-metadata';
            const isNowDownloading = info.status === 'downloading';

            if (wasResolvingMetadata && isNowDownloading) {
                this._clearMetadataTimer(info.infoHash);
            }

            const updated: DownloadItem = {
                ...existing,
                // Update name and totalSize when metadata becomes available
                name: wasResolvingMetadata && isNowDownloading ? info.name : existing.name,
                totalSize: wasResolvingMetadata && isNowDownloading ? info.totalSize : existing.totalSize,
                downloadedSize: info.downloaded,
                progress: info.progress,
                downloadSpeed: info.downloadSpeed,
                uploadSpeed: info.uploadSpeed,
                numPeers: info.numPeers,
                numSeeders: info.numSeeders,
                timeRemaining: info.timeRemaining,
                status: info.status,
            };
            this.items.set(info.infoHash, updated);
            this.emit('update', updated);
        });

        this.engine.on('done', (infoHash: string) => {
            const existing = this.items.get(infoHash);
            if (!existing) return;

            this._clearMetadataTimer(infoHash);
            const completedAt = Date.now();
            const elapsedMs = completedAt - existing.addedAt;
            const updated: DownloadItem = {
                ...existing,
                status: 'completed',
                progress: 1,
                completedAt,
                elapsedMs,
            };
            this.items.set(infoHash, updated);
            this.emit('update', updated);
        });

        this.engine.on('error', (infoHash: string, err: Error) => {
            this.log.error('[DownloadManager] Torrent error:', infoHash, err.message);

            const existing = this.items.get(infoHash);
            if (!existing) return;

            this._clearMetadataTimer(infoHash);
            const updated: DownloadItem = {
                ...existing,
                status: 'error',
            };
            this.items.set(infoHash, updated);
            this.emit('update', updated);
        });
    }

    // ── addTorrentFile ──────────────────────────────────────────────────────────

    async addTorrentFile(filePath: string): Promise<DownloadItem> {
        const destinationFolder = this.settings.get().destinationFolder;
        validateDestinationFolder(destinationFolder);

        const info = await this.engine.addTorrentFile(filePath);

        // Duplicate detection: check if infoHash already exists
        const existing = this.items.get(info.infoHash);
        if (existing) {
            throw new Error('Torrent já existe na lista');
        }

        const addedAt = Date.now();
        const item = torrentInfoToDownloadItem(info, destinationFolder, addedAt);

        this.items.set(item.infoHash, item);
        this.emit('update', item);

        return item;
    }

    // ── addMagnetLink ───────────────────────────────────────────────────────────

    async addMagnetLink(magnetUri: string): Promise<DownloadItem> {
        // Validate destination folder before starting the transfer
        const destinationFolder = this.settings.get().destinationFolder;
        validateDestinationFolder(destinationFolder);

        // Extract infoHash from magnet URI for early duplicate detection
        const hashMatch = magnetUri.match(/xt=urn:btih:([a-fA-F0-9]{40})/i);
        if (hashMatch) {
            const infoHash = hashMatch[1].toLowerCase();
            if (this.items.has(infoHash)) {
                throw new Error('Torrent já existe na lista');
            }
        }

        const info = await this.engine.addMagnetLink(magnetUri);

        // Post-add duplicate check (in case infoHash wasn't extractable before)
        const existing = this.items.get(info.infoHash);
        if (existing) {
            throw new Error('Torrent já existe na lista');
        }

        const addedAt = Date.now();

        // Magnet links start with resolving-metadata status
        const item: DownloadItem = {
            ...torrentInfoToDownloadItem(info, destinationFolder, addedAt),
            status: 'resolving-metadata',
        };

        this.items.set(item.infoHash, item);
        this.emit('update', item);

        // Start 60s metadata-resolution timeout.
        // If the item is still resolving-metadata when the timer fires,
        // transition it to metadata-failed.
        const timer = setTimeout(() => {
            const current = this.items.get(item.infoHash);
            if (current && current.status === 'resolving-metadata') {
                const failed: DownloadItem = { ...current, status: 'metadata-failed' };
                this.items.set(item.infoHash, failed);
                this.metadataTimers.delete(item.infoHash);
                this.emit('update', failed);
            }
        }, METADATA_TIMEOUT_MS);
        this.metadataTimers.set(item.infoHash, timer);

        return item;
    }

    // ── pause ───────────────────────────────────────────────────────────────────

    async pause(infoHash: string): Promise<void> {
        await this.engine.pause(infoHash);

        const existing = this.items.get(infoHash);
        if (existing) {
            const updated: DownloadItem = { ...existing, status: 'paused' };
            this.items.set(infoHash, updated);
            this.emit('update', updated);
        }
    }

    // ── resume ──────────────────────────────────────────────────────────────────

    async resume(infoHash: string): Promise<void> {
        await this.engine.resume(infoHash);

        const existing = this.items.get(infoHash);
        if (existing) {
            const updated: DownloadItem = { ...existing, status: 'downloading' };
            this.items.set(infoHash, updated);
            this.emit('update', updated);
        }
    }

    // ── remove ──────────────────────────────────────────────────────────────────

    async remove(infoHash: string, deleteFiles: boolean): Promise<void> {
        await this.engine.remove(infoHash, deleteFiles);
        this._clearMetadataTimer(infoHash);
        this.items.delete(infoHash);
    }

    // ── getAll ──────────────────────────────────────────────────────────────────

    getAll(): DownloadItem[] {
        return Array.from(this.items.values());
    }

    // ── restoreSession ──────────────────────────────────────────────────────────

    async restoreSession(): Promise<void> {
        if (!this.store) return;

        const persisted = this.store.get('downloads') ?? [];

        for (const persistedItem of persisted) {
            // Check if destination folder exists
            const folderExists = existsSync(persistedItem.destinationFolder);

            let status: TorrentStatus = persistedItem.status;
            if (!folderExists && persistedItem.status !== 'completed') {
                status = 'files-not-found';
            }

            // Restore the item into the in-memory map
            const item: DownloadItem = {
                infoHash: persistedItem.infoHash,
                name: persistedItem.name,
                totalSize: persistedItem.totalSize,
                downloadedSize: persistedItem.downloadedSize,
                progress: persistedItem.progress,
                downloadSpeed: 0,
                uploadSpeed: 0,
                numPeers: 0,
                numSeeders: 0,
                timeRemaining: Infinity,
                status,
                destinationFolder: persistedItem.destinationFolder,
                addedAt: persistedItem.addedAt,
                completedAt: persistedItem.completedAt,
                elapsedMs: persistedItem.elapsedMs,
            };

            this.items.set(item.infoHash, item);
            this.emit('update', item);

            // Auto-resume items that were downloading
            if (persistedItem.status === 'downloading' && folderExists) {
                try {
                    // Re-add to engine using magnetUri or torrentFilePath
                    if (persistedItem.magnetUri) {
                        await this.engine.addMagnetLink(persistedItem.magnetUri);
                    } else if (persistedItem.torrentFilePath) {
                        await this.engine.addTorrentFile(persistedItem.torrentFilePath);
                    }
                    // Update status to downloading after successful re-add
                    const updated: DownloadItem = { ...item, status: 'downloading' };
                    this.items.set(item.infoHash, updated);
                    this.emit('update', updated);
                } catch {
                    // If re-add fails, mark as error
                    const errItem: DownloadItem = { ...item, status: 'error' };
                    this.items.set(item.infoHash, errItem);
                    this.emit('update', errItem);
                }
            }
        }
    }

    // ── persistSession ──────────────────────────────────────────────────────────

    persistSession(): void {
        if (!this.store) return;

        const items = Array.from(this.items.values());
        const persisted: PersistedDownloadItem[] = items.map(item => ({
            infoHash: item.infoHash,
            name: item.name,
            totalSize: item.totalSize,
            downloadedSize: item.downloadedSize,
            progress: item.progress,
            status: item.status,
            destinationFolder: item.destinationFolder,
            addedAt: item.addedAt,
            completedAt: item.completedAt,
            elapsedMs: item.elapsedMs,
        }));

        this.store.set('downloads', persisted);
    }

    // ── Private helpers ─────────────────────────────────────────────────────────

    /** Clears and removes the pending metadata-resolution timer for the given infoHash. */
    private _clearMetadataTimer(infoHash: string): void {
        const timer = this.metadataTimers.get(infoHash);
        if (timer !== undefined) {
            clearTimeout(timer);
            this.metadataTimers.delete(infoHash);
        }
    }

    // ── EventEmitter overloads (type-safe) ──────────────────────────────────────

    on(event: 'update', listener: (item: DownloadItem) => void): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a new DownloadManager instance.
 *
 * @param engine    TorrentEngine instance to delegate torrent operations to.
 * @param settings  SettingsManager instance to read configuration from.
 * @param store     Optional persisted store for session persistence (injectable for tests).
 * @param log       Optional logger instance (defaults to electron-log; injectable for tests).
 */
export function createDownloadManager(
    engine: TorrentEngine,
    settings: SettingsManager,
    store?: PersistedStore,
    log?: Logger,
): DownloadManager {
    return new DownloadManagerImpl(engine, settings, store, log);
}
