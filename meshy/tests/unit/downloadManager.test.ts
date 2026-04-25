/**
 * Example-based tests for DownloadManager — metadata timeout logic.
 *
 * Covers:
 *   - Requirement 2.2: Magnet link added with status resolving-metadata
 *   - Requirement 2.3: name + totalSize updated when metadata resolves → status downloading
 *   - Requirement 2.5: After 60s without resolution → status metadata-failed
 */

import { EventEmitter } from 'events';
import { createDownloadManager } from '../../main/downloadManager';
import type { TorrentEngine, TorrentInfo, TorrentStatus } from '../../main/torrentEngine';
import type { SettingsManager } from '../../main/settingsManager';
import type { DownloadItem } from '../../main/downloadManager';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_MAGNET = 'magnet:?xt=urn:btih:' + 'a'.repeat(40);
const INFO_HASH = 'a'.repeat(40);

function makeTorrentInfo(overrides: Partial<TorrentInfo> = {}): TorrentInfo {
    return {
        infoHash: INFO_HASH,
        name: INFO_HASH, // before metadata: name is the infoHash
        totalSize: 0,
        progress: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        numPeers: 0,
        numSeeders: 0,
        timeRemaining: Infinity,
        downloaded: 0,
        status: 'resolving-metadata' as TorrentStatus,
        ...overrides,
    };
}

/**
 * Creates a mock TorrentEngine that is also an EventEmitter so tests can
 * manually emit 'progress', 'done', and 'error' events.
 */
function makeMockEngine(magnetInfo: TorrentInfo = makeTorrentInfo()): TorrentEngine & EventEmitter {
    const emitter = new EventEmitter();

    const engine: TorrentEngine & EventEmitter = Object.assign(emitter, {
        addTorrentFile: jest.fn(),
        addMagnetLink: jest.fn().mockResolvedValue(magnetInfo),
        pause: jest.fn().mockResolvedValue(undefined),
        resume: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
        setDownloadSpeedLimit: jest.fn(),
        setUploadSpeedLimit: jest.fn(),
        getAll: jest.fn().mockReturnValue([]),
    });

    return engine;
}

function makeMockSettings(folder = '/downloads'): SettingsManager {
    return {
        get: jest.fn().mockReturnValue({
            destinationFolder: folder,
            downloadSpeedLimit: 0,
            uploadSpeedLimit: 0,
        }),
        set: jest.fn(),
        getDefaultDownloadFolder: jest.fn().mockReturnValue(folder),
    } as unknown as SettingsManager;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DownloadManager — metadata timeout (Requirement 2.5)', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('sets initial status to resolving-metadata when adding a magnet link', async () => {
        const engine = makeMockEngine();
        const settings = makeMockSettings();
        const manager = createDownloadManager(engine, settings);

        const item = await manager.addMagnetLink(VALID_MAGNET);

        expect(item.status).toBe('resolving-metadata');
    });

    it('transitions to metadata-failed after 60s without metadata resolution', async () => {
        jest.useFakeTimers();

        const engine = makeMockEngine();
        const settings = makeMockSettings();
        const manager = createDownloadManager(engine, settings);

        const updates: DownloadItem[] = [];
        manager.on('update', (item) => updates.push({ ...item }));

        await manager.addMagnetLink(VALID_MAGNET);

        // Advance 60 seconds — the timeout should fire
        jest.advanceTimersByTime(60_000);

        const lastUpdate = updates[updates.length - 1];
        expect(lastUpdate.status).toBe('metadata-failed');
        expect(lastUpdate.infoHash).toBe(INFO_HASH);
    });

    it('does NOT transition to metadata-failed if metadata resolves before 60s', async () => {
        jest.useFakeTimers();

        const engine = makeMockEngine();
        const settings = makeMockSettings();
        const manager = createDownloadManager(engine, settings);

        const updates: DownloadItem[] = [];
        manager.on('update', (item) => updates.push({ ...item }));

        await manager.addMagnetLink(VALID_MAGNET);

        // Simulate metadata resolution via a progress event at 30s
        jest.advanceTimersByTime(30_000);
        engine.emit('progress', makeTorrentInfo({
            name: 'My Torrent',
            totalSize: 1_000_000,
            status: 'downloading',
        }));

        // Advance past the 60s mark — timer should have been cleared
        jest.advanceTimersByTime(31_000);

        const statuses = updates.map((u) => u.status);
        expect(statuses).not.toContain('metadata-failed');
        expect(statuses[statuses.length - 1]).toBe('downloading');
    });

    it('updates name and totalSize when metadata resolves (resolving-metadata → downloading)', async () => {
        jest.useFakeTimers();

        const engine = makeMockEngine();
        const settings = makeMockSettings();
        const manager = createDownloadManager(engine, settings);

        const updates: DownloadItem[] = [];
        manager.on('update', (item) => updates.push({ ...item }));

        await manager.addMagnetLink(VALID_MAGNET);

        // Emit progress with resolved metadata
        engine.emit('progress', makeTorrentInfo({
            name: 'Resolved Torrent Name',
            totalSize: 5_000_000,
            status: 'downloading',
        }));

        const downloadingUpdate = updates.find((u) => u.status === 'downloading');
        expect(downloadingUpdate).toBeDefined();
        expect(downloadingUpdate!.name).toBe('Resolved Torrent Name');
        expect(downloadingUpdate!.totalSize).toBe(5_000_000);
    });

    it('does not set metadata-failed if item was already removed before 60s', async () => {
        jest.useFakeTimers();

        const engine = makeMockEngine();
        const settings = makeMockSettings();
        const manager = createDownloadManager(engine, settings);

        const updates: DownloadItem[] = [];
        manager.on('update', (item) => updates.push({ ...item }));

        await manager.addMagnetLink(VALID_MAGNET);

        // Remove the item before the timeout fires
        await manager.remove(INFO_HASH, false);

        // Advance past 60s
        jest.advanceTimersByTime(60_000);

        // No metadata-failed update should have been emitted after removal
        const postRemovalUpdates = updates.filter((u) => u.status === 'metadata-failed');
        expect(postRemovalUpdates).toHaveLength(0);
    });

    it('emits update event with metadata-failed status when timeout fires', async () => {
        jest.useFakeTimers();

        const engine = makeMockEngine();
        const settings = makeMockSettings();
        const manager = createDownloadManager(engine, settings);

        const updateListener = jest.fn();
        manager.on('update', updateListener);

        await manager.addMagnetLink(VALID_MAGNET);
        const callCountBeforeTimeout = updateListener.mock.calls.length;

        jest.advanceTimersByTime(60_000);

        // Should have been called once more with metadata-failed
        expect(updateListener).toHaveBeenCalledTimes(callCountBeforeTimeout + 1);
        const lastCall = updateListener.mock.calls[updateListener.mock.calls.length - 1][0];
        expect(lastCall.status).toBe('metadata-failed');
    });

    it('getAll reflects metadata-failed status after timeout', async () => {
        jest.useFakeTimers();

        const engine = makeMockEngine();
        const settings = makeMockSettings();
        const manager = createDownloadManager(engine, settings);

        await manager.addMagnetLink(VALID_MAGNET);
        jest.advanceTimersByTime(60_000);

        const all = manager.getAll();
        expect(all).toHaveLength(1);
        expect(all[0].status).toBe('metadata-failed');
    });
});

// ─── restoreSession / persistSession ─────────────────────────────────────────

import { existsSync } from 'fs';
import type { PersistedDownloadItem, PersistedStore } from '../../main/downloadManager';

jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn(),
}));

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

function makePersistedItem(overrides: Partial<PersistedDownloadItem> = {}): PersistedDownloadItem {
    return {
        infoHash: 'b'.repeat(40),
        name: 'Test Torrent',
        totalSize: 1_000_000,
        downloadedSize: 500_000,
        progress: 0.5,
        status: 'paused',
        destinationFolder: '/downloads',
        addedAt: 1_000_000,
        ...overrides,
    };
}

function makeMockStore(initial: PersistedDownloadItem[] = []): PersistedStore {
    let data: PersistedDownloadItem[] | undefined = initial.length > 0 ? initial : undefined;
    return {
        get: jest.fn().mockImplementation(() => data),
        set: jest.fn().mockImplementation((_key: string, value: PersistedDownloadItem[]) => {
            data = value;
        }),
    };
}

describe('DownloadManager — restoreSession()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('restores items from the store into getAll()', async () => {
        const item = makePersistedItem({ status: 'paused' });
        const store = makeMockStore([item]);
        const engine = makeMockEngine();
        const settings = makeMockSettings();

        // Folder exists so no files-not-found override
        mockExistsSync.mockReturnValue(true);

        const manager = createDownloadManager(engine, settings, store);
        await manager.restoreSession();

        const all = manager.getAll();
        expect(all).toHaveLength(1);
        expect(all[0].infoHash).toBe(item.infoHash);
        expect(all[0].name).toBe(item.name);
        expect(all[0].totalSize).toBe(item.totalSize);
        expect(all[0].progress).toBe(item.progress);
        expect(all[0].destinationFolder).toBe(item.destinationFolder);
    });

    it('emits update event for each restored item', async () => {
        const items = [
            makePersistedItem({ infoHash: 'c'.repeat(40), status: 'paused' }),
            makePersistedItem({ infoHash: 'd'.repeat(40), status: 'completed' }),
        ];
        const store = makeMockStore(items);
        const engine = makeMockEngine();
        const settings = makeMockSettings();

        mockExistsSync.mockReturnValue(true);

        const manager = createDownloadManager(engine, settings, store);
        const updates: string[] = [];
        manager.on('update', (item) => updates.push(item.infoHash));

        await manager.restoreSession();

        expect(updates).toContain('c'.repeat(40));
        expect(updates).toContain('d'.repeat(40));
    });

    it('marks items with missing destination folder as files-not-found', async () => {
        const item = makePersistedItem({ status: 'paused', destinationFolder: '/missing/folder' });
        const store = makeMockStore([item]);
        const engine = makeMockEngine();
        const settings = makeMockSettings();

        // Folder does NOT exist
        mockExistsSync.mockReturnValue(false);

        const manager = createDownloadManager(engine, settings, store);
        await manager.restoreSession();

        const all = manager.getAll();
        expect(all).toHaveLength(1);
        expect(all[0].status).toBe('files-not-found');
    });

    it('does NOT mark completed items as files-not-found even if folder is missing', async () => {
        const item = makePersistedItem({ status: 'completed', destinationFolder: '/missing/folder' });
        const store = makeMockStore([item]);
        const engine = makeMockEngine();
        const settings = makeMockSettings();

        // Folder does NOT exist
        mockExistsSync.mockReturnValue(false);

        const manager = createDownloadManager(engine, settings, store);
        await manager.restoreSession();

        const all = manager.getAll();
        expect(all).toHaveLength(1);
        expect(all[0].status).toBe('completed');
    });

    it('auto-resumes items that were downloading (via magnetUri) when folder exists', async () => {
        const magnetUri = 'magnet:?xt=urn:btih:' + 'e'.repeat(40);
        const item = makePersistedItem({
            infoHash: 'e'.repeat(40),
            status: 'downloading',
            magnetUri,
            destinationFolder: '/downloads',
        });
        const store = makeMockStore([item]);

        const resumedInfo = makeTorrentInfo({
            infoHash: 'e'.repeat(40),
            status: 'downloading',
        });
        const engine = makeMockEngine(resumedInfo);
        const settings = makeMockSettings();

        // Folder exists
        mockExistsSync.mockReturnValue(true);

        const manager = createDownloadManager(engine, settings, store);
        await manager.restoreSession();

        expect(engine.addMagnetLink).toHaveBeenCalledWith(magnetUri);
    });

    it('auto-resumes items that were downloading (via torrentFilePath) when folder exists', async () => {
        const torrentFilePath = '/path/to/file.torrent';
        const item = makePersistedItem({
            infoHash: 'f'.repeat(40),
            status: 'downloading',
            torrentFilePath,
            destinationFolder: '/downloads',
        });
        const store = makeMockStore([item]);

        const resumedInfo = makeTorrentInfo({
            infoHash: 'f'.repeat(40),
            status: 'downloading',
        });
        const engine = makeMockEngine(resumedInfo);
        const settings = makeMockSettings();

        mockExistsSync.mockReturnValue(true);

        const manager = createDownloadManager(engine, settings, store);
        await manager.restoreSession();

        expect(engine.addTorrentFile).toHaveBeenCalledWith(torrentFilePath);
    });

    it('does NOT auto-resume items that were downloading when folder is missing', async () => {
        const item = makePersistedItem({
            infoHash: 'g'.repeat(40),
            status: 'downloading',
            magnetUri: 'magnet:?xt=urn:btih:' + 'g'.repeat(40),
            destinationFolder: '/missing',
        });
        const store = makeMockStore([item]);
        const engine = makeMockEngine();
        const settings = makeMockSettings();

        // Folder does NOT exist
        mockExistsSync.mockReturnValue(false);

        const manager = createDownloadManager(engine, settings, store);
        await manager.restoreSession();

        expect(engine.addMagnetLink).not.toHaveBeenCalled();
        const all = manager.getAll();
        expect(all[0].status).toBe('files-not-found');
    });

    it('does NOT auto-resume paused or completed items', async () => {
        const items = [
            makePersistedItem({ infoHash: 'h'.repeat(40), status: 'paused', magnetUri: 'magnet:?xt=urn:btih:' + 'h'.repeat(40) }),
            makePersistedItem({ infoHash: 'i'.repeat(40), status: 'completed', magnetUri: 'magnet:?xt=urn:btih:' + 'i'.repeat(40) }),
        ];
        const store = makeMockStore(items);
        const engine = makeMockEngine();
        const settings = makeMockSettings();

        mockExistsSync.mockReturnValue(true);

        const manager = createDownloadManager(engine, settings, store);
        await manager.restoreSession();

        expect(engine.addMagnetLink).not.toHaveBeenCalled();
        expect(engine.addTorrentFile).not.toHaveBeenCalled();
    });

    it('does nothing when store has no downloads', async () => {
        const store = makeMockStore([]);
        const engine = makeMockEngine();
        const settings = makeMockSettings();

        const manager = createDownloadManager(engine, settings, store);
        await manager.restoreSession();

        expect(manager.getAll()).toHaveLength(0);
    });

    it('does nothing when no store is provided', async () => {
        const engine = makeMockEngine();
        const settings = makeMockSettings();

        // No store passed
        const manager = createDownloadManager(engine, settings);
        await manager.restoreSession();

        expect(manager.getAll()).toHaveLength(0);
    });
});

describe('DownloadManager — persistSession()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('saves all current items to the store', async () => {
        const engine = makeMockEngine();
        const settings = makeMockSettings();
        const store = makeMockStore();

        const manager = createDownloadManager(engine, settings, store);

        // Add a magnet link so there's something to persist
        mockExistsSync.mockReturnValue(true);
        await manager.addMagnetLink(VALID_MAGNET);

        manager.persistSession();

        expect(store.set).toHaveBeenCalledWith(
            'downloads',
            expect.arrayContaining([
                expect.objectContaining({
                    infoHash: INFO_HASH,
                    name: expect.any(String),
                    status: 'resolving-metadata',
                }),
            ])
        );
    });

    it('saves an empty array when there are no items', () => {
        const engine = makeMockEngine();
        const settings = makeMockSettings();
        const store = makeMockStore();

        const manager = createDownloadManager(engine, settings, store);
        manager.persistSession();

        expect(store.set).toHaveBeenCalledWith('downloads', []);
    });

    it('does nothing when no store is provided', () => {
        const engine = makeMockEngine();
        const settings = makeMockSettings();

        // No store passed
        const manager = createDownloadManager(engine, settings);
        // Should not throw
        expect(() => manager.persistSession()).not.toThrow();
    });

    it('persists all required fields for each item', async () => {
        const engine = makeMockEngine();
        const settings = makeMockSettings('/my/folder');
        const store = makeMockStore();

        const manager = createDownloadManager(engine, settings, store);
        mockExistsSync.mockReturnValue(true);
        await manager.addMagnetLink(VALID_MAGNET);

        manager.persistSession();

        const savedItems = (store.set as jest.Mock).mock.calls[0][1] as PersistedDownloadItem[];
        expect(savedItems).toHaveLength(1);

        const saved = savedItems[0];
        expect(saved).toHaveProperty('infoHash');
        expect(saved).toHaveProperty('name');
        expect(saved).toHaveProperty('totalSize');
        expect(saved).toHaveProperty('downloadedSize');
        expect(saved).toHaveProperty('progress');
        expect(saved).toHaveProperty('status');
        expect(saved).toHaveProperty('destinationFolder');
        expect(saved).toHaveProperty('addedAt');
    });

    it('round-trips: items persisted by persistSession() are restored by restoreSession()', async () => {
        jest.useRealTimers();

        const engine = makeMockEngine();
        const settings = makeMockSettings('/downloads');
        const store = makeMockStore();

        mockExistsSync.mockReturnValue(true);

        const manager = createDownloadManager(engine, settings, store);
        await manager.addMagnetLink(VALID_MAGNET);

        // Persist current state
        manager.persistSession();

        // Create a fresh manager and restore
        const engine2 = makeMockEngine();
        const manager2 = createDownloadManager(engine2, settings, store);
        await manager2.restoreSession();

        const restored = manager2.getAll();
        expect(restored).toHaveLength(1);
        expect(restored[0].infoHash).toBe(INFO_HASH);
        expect(restored[0].status).toBe('resolving-metadata');
    });
});
