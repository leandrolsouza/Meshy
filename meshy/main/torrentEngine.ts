import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import WebTorrent from 'webtorrent';
import type { Torrent } from 'webtorrent';
import { isValidMagnetUri, hasTorrentMagicBytes } from './validators';
import type { TorrentStatus } from '../shared/types';

export type { TorrentStatus } from '../shared/types';

// The @types/webtorrent package doesn't include throttleDownload/throttleUpload,
// but they exist in the actual webtorrent@2.x library.
interface WebTorrentInstanceWithThrottle extends WebTorrent.Instance {
    throttleDownload(rate: number): void;
    throttleUpload(rate: number): void;
}

export interface TorrentEngineOptions {
    downloadPath: string;
    downloadSpeedLimit: number; // KB/s, 0 = sem limite
    uploadSpeedLimit: number;   // KB/s, 0 = sem limite
}

export interface TorrentInfo {
    infoHash: string;
    name: string;
    totalSize: number;       // bytes
    progress: number;        // 0.0 – 1.0
    downloadSpeed: number;   // bytes/s
    uploadSpeed: number;     // bytes/s
    numPeers: number;
    numSeeders: number;
    timeRemaining: number;   // ms, Infinity se desconhecido
    downloaded: number;      // bytes
    status: TorrentStatus;
}

export interface TorrentEngine {
    addTorrentFile(filePath: string): Promise<TorrentInfo>;
    addMagnetLink(magnetUri: string): Promise<TorrentInfo>;
    pause(infoHash: string): Promise<void>;
    resume(infoHash: string): Promise<void>;
    remove(infoHash: string, deleteFiles: boolean): Promise<void>;
    setDownloadSpeedLimit(kbps: number): void;
    setUploadSpeedLimit(kbps: number): void;
    getAll(): TorrentInfo[];
    on(event: 'progress', listener: (info: TorrentInfo) => void): void;
    on(event: 'done', listener: (infoHash: string) => void): void;
    on(event: 'error', listener: (infoHash: string, err: Error) => void): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    removeListener(event: string, listener: (...args: any[]) => void): void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAUSE_RESUME_TIMEOUT_MS = 5_000;

// ─── Helper ───────────────────────────────────────────────────────────────────

function torrentToInfo(torrent: Torrent, status: TorrentStatus): TorrentInfo {
    return {
        infoHash: torrent.infoHash,
        name: torrent.name ?? torrent.infoHash,
        totalSize: torrent.length ?? 0,
        progress: torrent.progress ?? 0,
        downloadSpeed: torrent.downloadSpeed ?? 0,
        uploadSpeed: torrent.uploadSpeed ?? 0,
        numPeers: torrent.numPeers ?? 0,
        numSeeders: (torrent as unknown as { numSeeders?: number }).numSeeders ?? 0,
        timeRemaining: torrent.timeRemaining ?? Infinity,
        downloaded: torrent.downloaded ?? 0,
        status,
    };
}

// ─── Implementation ───────────────────────────────────────────────────────────

class TorrentEngineImpl extends EventEmitter implements TorrentEngine {
    private readonly client: WebTorrentInstanceWithThrottle;
    private readonly downloadPath: string;
    /** Tracks the current status for each infoHash */
    private readonly statusMap = new Map<string, TorrentStatus>();

    constructor(options: TorrentEngineOptions, client?: WebTorrent.Instance) {
        super();
        this.downloadPath = options.downloadPath;

        this.client = (client ?? new WebTorrent()) as WebTorrentInstanceWithThrottle;

        // Apply initial speed limits
        if (options.downloadSpeedLimit > 0) {
            this.client.throttleDownload(options.downloadSpeedLimit * 1024);
        }
        if (options.uploadSpeedLimit > 0) {
            this.client.throttleUpload(options.uploadSpeedLimit * 1024);
        }
    }

    // ── addTorrentFile ──────────────────────────────────────────────────────────

    addTorrentFile(filePath: string): Promise<TorrentInfo> {
        return new Promise((resolve, reject) => {
            let buffer: Buffer;
            try {
                buffer = readFileSync(filePath);
            } catch (err) {
                return reject(new Error(`Não foi possível ler o arquivo: ${(err as Error).message}`));
            }

            if (!hasTorrentMagicBytes(buffer)) {
                return reject(new Error('Arquivo inválido: não é um arquivo .torrent válido (magic bytes incorretos)'));
            }

            this.client.add(buffer, { path: this.downloadPath }, (torrent) => {
                this.statusMap.set(torrent.infoHash, 'downloading');
                this._attachTorrentListeners(torrent);
                resolve(torrentToInfo(torrent, 'downloading'));
            });

            this.client.once('error', (err) => {
                reject(err instanceof Error ? err : new Error(String(err)));
            });
        });
    }

    // ── addMagnetLink ───────────────────────────────────────────────────────────

    addMagnetLink(magnetUri: string): Promise<TorrentInfo> {
        return new Promise((resolve, reject) => {
            if (!isValidMagnetUri(magnetUri)) {
                return reject(new Error('Formato inválido. Esperado: magnet:?xt=urn:btih:<40 hex chars>'));
            }

            this.client.add(magnetUri, { path: this.downloadPath }, (torrent) => {
                this.statusMap.set(torrent.infoHash, 'resolving-metadata');
                this._attachTorrentListeners(torrent);

                // Once metadata is ready the torrent name/length become available
                torrent.once('metadata', () => {
                    this.statusMap.set(torrent.infoHash, 'downloading');
                });

                resolve(torrentToInfo(torrent, 'resolving-metadata'));
            });

            this.client.once('error', (err) => {
                reject(err instanceof Error ? err : new Error(String(err)));
            });
        });
    }

    // ── pause ───────────────────────────────────────────────────────────────────

    pause(infoHash: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const torrent = this._getTorrent(infoHash);
            if (!torrent) {
                return reject(new Error(`Torrent não encontrado: ${infoHash}`));
            }

            const timer = setTimeout(() => {
                reject(new Error('Falha ao pausar: timeout'));
            }, PAUSE_RESUME_TIMEOUT_MS);

            try {
                torrent.pause();
                clearTimeout(timer);
                this.statusMap.set(infoHash, 'paused');
                resolve();
            } catch (err) {
                clearTimeout(timer);
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        });
    }

    // ── resume ──────────────────────────────────────────────────────────────────

    resume(infoHash: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const torrent = this._getTorrent(infoHash);
            if (!torrent) {
                return reject(new Error(`Torrent não encontrado: ${infoHash}`));
            }

            const timer = setTimeout(() => {
                reject(new Error('Falha ao retomar: timeout'));
            }, PAUSE_RESUME_TIMEOUT_MS);

            try {
                torrent.resume();
                clearTimeout(timer);
                this.statusMap.set(infoHash, 'downloading');
                resolve();
            } catch (err) {
                clearTimeout(timer);
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        });
    }

    // ── remove ──────────────────────────────────────────────────────────────────

    remove(infoHash: string, deleteFiles: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            const torrent = this._getTorrent(infoHash);
            if (!torrent) {
                // Already removed — treat as success
                this.statusMap.delete(infoHash);
                return resolve();
            }

            torrent.destroy({ destroyStore: deleteFiles }, (err) => {
                if (err) {
                    return reject(err instanceof Error ? err : new Error(String(err)));
                }
                this.statusMap.delete(infoHash);
                resolve();
            });
        });
    }

    // ── setDownloadSpeedLimit ───────────────────────────────────────────────────

    setDownloadSpeedLimit(kbps: number): void {
        // kbps === 0 means no limit; WebTorrent uses 0 to remove the limit as well
        this.client.throttleDownload(kbps * 1024);
    }

    // ── setUploadSpeedLimit ─────────────────────────────────────────────────────

    setUploadSpeedLimit(kbps: number): void {
        this.client.throttleUpload(kbps * 1024);
    }

    // ── getAll ──────────────────────────────────────────────────────────────────

    getAll(): TorrentInfo[] {
        return this.client.torrents.map((torrent) => {
            const status = this.statusMap.get(torrent.infoHash) ?? 'queued';
            return torrentToInfo(torrent, status);
        });
    }

    // ── EventEmitter overloads (type-safe) ──────────────────────────────────────

    on(event: 'progress', listener: (info: TorrentInfo) => void): this;
    on(event: 'done', listener: (infoHash: string) => void): this;
    on(event: 'error', listener: (infoHash: string, err: Error) => void): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    // ── Private helpers ─────────────────────────────────────────────────────────

    private _getTorrent(infoHash: string): Torrent | undefined {
        return this.client.torrents.find((t) => t.infoHash === infoHash);
    }

    private _attachTorrentListeners(torrent: Torrent): void {
        torrent.on('download', () => {
            const status = this.statusMap.get(torrent.infoHash) ?? 'downloading';
            this.emit('progress', torrentToInfo(torrent, status));
        });

        torrent.on('upload', () => {
            const status = this.statusMap.get(torrent.infoHash) ?? 'downloading';
            this.emit('progress', torrentToInfo(torrent, status));
        });

        torrent.on('done', () => {
            this.statusMap.set(torrent.infoHash, 'completed');
            this.emit('done', torrent.infoHash);
        });

        torrent.on('error', (err) => {
            this.statusMap.set(torrent.infoHash, 'error');
            const error = err instanceof Error ? err : new Error(String(err));
            this.emit('error', torrent.infoHash, error);
        });
    }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a new TorrentEngine instance.
 *
 * @param options  Engine configuration (download path, speed limits).
 * @param webTorrentClient  Optional WebTorrent client for dependency injection
 *                          (useful in tests to avoid real network activity).
 */
export function createTorrentEngine(
    options: TorrentEngineOptions,
    webTorrentClient?: WebTorrent.Instance,
): TorrentEngine {
    return new TorrentEngineImpl(options, webTorrentClient);
}
