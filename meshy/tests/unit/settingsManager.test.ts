import { createSettingsManager, SettingsStore } from '../../main/settingsManager';
import fc from 'fast-check';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates an in-memory store that satisfies the SettingsStore interface.
 * Avoids touching the file system or requiring a running Electron app.
 */
function createFakeStore(initial: Record<string, unknown> = {}): SettingsStore {
    const data = new Map<string, unknown>(Object.entries(initial));
    return {
        get: (key) => data.get(key) as any,
        set: (key, value) => { data.set(key, value); },
    };
}

const FAKE_DOWNLOADS_PATH = '/home/testuser/Downloads';

function makeManager(storeData: Record<string, unknown> = {}) {
    return createSettingsManager({
        store: createFakeStore(storeData),
        getDownloadsPath: () => FAKE_DOWNLOADS_PATH,
    });
}

// ─── get() ────────────────────────────────────────────────────────────────────

describe('SettingsManager.get()', () => {
    it('returns default speed limits of 0 when store is empty', () => {
        const manager = makeManager();
        const settings = manager.get();
        expect(settings.downloadSpeedLimit).toBe(0);
        expect(settings.uploadSpeedLimit).toBe(0);
    });

    it('returns the default downloads folder as destinationFolder when store is empty', () => {
        const manager = makeManager();
        const settings = manager.get();
        expect(settings.destinationFolder).toBe(FAKE_DOWNLOADS_PATH);
    });

    it('returns previously stored destinationFolder', () => {
        const manager = makeManager({ destinationFolder: '/custom/path' });
        expect(manager.get().destinationFolder).toBe('/custom/path');
    });

    it('returns previously stored speed limits', () => {
        const manager = makeManager({ downloadSpeedLimit: 512, uploadSpeedLimit: 256 });
        const settings = manager.get();
        expect(settings.downloadSpeedLimit).toBe(512);
        expect(settings.uploadSpeedLimit).toBe(256);
    });

    it('returns an object with exactly the expected keys', () => {
        const manager = makeManager();
        const settings = manager.get();
        expect(Object.keys(settings).sort()).toEqual(
            ['destinationFolder', 'downloadSpeedLimit', 'uploadSpeedLimit'].sort()
        );
    });
});

// ─── set() ────────────────────────────────────────────────────────────────────

describe('SettingsManager.set()', () => {
    it('persists a new destinationFolder', () => {
        const manager = makeManager();
        manager.set({ destinationFolder: '/new/path' });
        expect(manager.get().destinationFolder).toBe('/new/path');
    });

    it('persists a new downloadSpeedLimit', () => {
        const manager = makeManager();
        manager.set({ downloadSpeedLimit: 1024 });
        expect(manager.get().downloadSpeedLimit).toBe(1024);
    });

    it('persists a new uploadSpeedLimit', () => {
        const manager = makeManager();
        manager.set({ uploadSpeedLimit: 256 });
        expect(manager.get().uploadSpeedLimit).toBe(256);
    });

    it('performs a partial update without overwriting unrelated fields', () => {
        const manager = makeManager({ downloadSpeedLimit: 100, uploadSpeedLimit: 50 });
        manager.set({ downloadSpeedLimit: 200 });
        const settings = manager.get();
        expect(settings.downloadSpeedLimit).toBe(200);
        expect(settings.uploadSpeedLimit).toBe(50);
    });

    it('allows setting speed limits back to 0 (no limit)', () => {
        const manager = makeManager({ downloadSpeedLimit: 500 });
        manager.set({ downloadSpeedLimit: 0 });
        expect(manager.get().downloadSpeedLimit).toBe(0);
    });

    it('persists multiple fields in a single call', () => {
        const manager = makeManager();
        manager.set({ downloadSpeedLimit: 300, uploadSpeedLimit: 150 });
        const settings = manager.get();
        expect(settings.downloadSpeedLimit).toBe(300);
        expect(settings.uploadSpeedLimit).toBe(150);
    });
});

// ─── getDefaultDownloadFolder() ───────────────────────────────────────────────

describe('SettingsManager.getDefaultDownloadFolder()', () => {
    it('returns a non-empty string', () => {
        const manager = makeManager();
        const folder = manager.getDefaultDownloadFolder();
        expect(typeof folder).toBe('string');
        expect(folder.length).toBeGreaterThan(0);
    });

    it('returns the injected downloads path', () => {
        const manager = makeManager();
        expect(manager.getDefaultDownloadFolder()).toBe(FAKE_DOWNLOADS_PATH);
    });
});


// ─── Property-Based Tests ─────────────────────────────────────────────────────

// Feature: meshy-torrent-client, Property 10: Round-trip de persistência de configurações
describe('Property 10: Round-trip de persistência de configurações', () => {
    // **Validates: Requirements 5.1, 6.1**
    it('set(settings) followed by get() returns equivalent settings for any valid input', () => {
        fc.assert(
            fc.property(
                fc.record({
                    destinationFolder: fc.string({ minLength: 1 }),
                    downloadSpeedLimit: fc.nat(),
                    uploadSpeedLimit: fc.nat(),
                }),
                (settings) => {
                    const manager = makeManager();

                    manager.set(settings);
                    const result = manager.get();

                    expect(result.destinationFolder).toBe(settings.destinationFolder);
                    expect(result.downloadSpeedLimit).toBe(settings.downloadSpeedLimit);
                    expect(result.uploadSpeedLimit).toBe(settings.uploadSpeedLimit);
                }
            ),
            { numRuns: 100 }
        );
    });
});


// ─── Property 11 ──────────────────────────────────────────────────────────────

import { EventEmitter } from 'events';
import { createDownloadManager } from '../../main/downloadManager';
import type { TorrentEngine, TorrentInfo, TorrentStatus } from '../../main/torrentEngine';
import { existsSync, accessSync } from 'fs';

jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn(),
    accessSync: jest.fn(),
}));

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockAccessSync = accessSync as jest.MockedFunction<typeof accessSync>;

function makeMockTorrentInfo(infoHash: string): TorrentInfo {
    return {
        infoHash,
        name: infoHash,
        totalSize: 0,
        progress: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        numPeers: 0,
        numSeeders: 0,
        timeRemaining: Infinity,
        downloaded: 0,
        status: 'resolving-metadata' as TorrentStatus,
    };
}

function makeMockEngine(infoHash: string): TorrentEngine & EventEmitter {
    const emitter = new EventEmitter();
    const info = makeMockTorrentInfo(infoHash);

    const engine: TorrentEngine & EventEmitter = Object.assign(emitter, {
        addTorrentFile: jest.fn().mockResolvedValue(info),
        addMagnetLink: jest.fn().mockResolvedValue(info),
        pause: jest.fn().mockResolvedValue(undefined),
        resume: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
        setDownloadSpeedLimit: jest.fn(),
        setUploadSpeedLimit: jest.fn(),
        getAll: jest.fn().mockReturnValue([]),
    });

    return engine;
}

// Feature: meshy-torrent-client, Property 11: Novos downloads usam a pasta de destino atual
describe('Property 11: Novos downloads usam a pasta de destino atual', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        // Folder validation: simulate valid (existing + writable) folder
        mockExistsSync.mockReturnValue(true);
        mockAccessSync.mockReturnValue(undefined);
    });
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    // **Validates: Requirements 5.2**
    it('downloads iniciados após set({destinationFolder}) usam o valor configurado', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1 }).filter(s => !s.includes('\0')),
                async (folder) => {
                    const settingsManager = makeManager();
                    settingsManager.set({ destinationFolder: folder });

                    // Each iteration creates a fresh DownloadManager so no duplicate issues
                    const infoHash = 'a'.repeat(40);
                    const engine = makeMockEngine(infoHash);
                    const magnetUri = `magnet:?xt=urn:btih:${infoHash}`;

                    const silentLogger = {
                        info: () => { },
                        warn: () => { },
                        error: () => { },
                    };

                    const downloadManager = createDownloadManager(engine, settingsManager, undefined, silentLogger);
                    const item = await downloadManager.addMagnetLink(magnetUri);

                    expect(item.destinationFolder).toBe(folder);

                    // Clear metadata timeout to prevent open handles
                    jest.runAllTimers();
                }
            ),
            { numRuns: 100 }
        );
    });
});


// ─── Property 12 ──────────────────────────────────────────────────────────────

// Feature: meshy-torrent-client, Property 12: Pasta inválida resulta em erro antes de iniciar download
describe('Property 12: Pasta inválida resulta em erro antes de iniciar download', () => {
    beforeEach(() => { jest.useFakeTimers(); });
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    // **Validates: Requirements 5.4**
    it('pasta que não existe ou sem permissão de escrita resulta em erro sem iniciar transferência', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1 }).filter(s => !s.includes('\0')),
                fc.oneof(
                    fc.constant('non-existent' as const),
                    fc.constant('non-writable' as const),
                ),
                async (folder, failureMode) => {
                    // Configure fs mocks based on failure mode
                    if (failureMode === 'non-existent') {
                        mockExistsSync.mockReturnValue(false);
                        mockAccessSync.mockReturnValue(undefined);
                    } else {
                        // Folder exists but is not writable
                        mockExistsSync.mockReturnValue(true);
                        mockAccessSync.mockImplementation(() => {
                            throw new Error('EACCES: permission denied');
                        });
                    }

                    const settingsManager = makeManager();
                    settingsManager.set({ destinationFolder: folder });

                    const infoHash = 'a'.repeat(40);
                    const engine = makeMockEngine(infoHash);
                    const magnetUri = `magnet:?xt=urn:btih:${infoHash}`;

                    const silentLogger = {
                        info: () => { },
                        warn: () => { },
                        error: () => { },
                    };

                    const downloadManager = createDownloadManager(engine, settingsManager, undefined, silentLogger);

                    // Attempting to add a download with an invalid folder should throw
                    await expect(downloadManager.addMagnetLink(magnetUri)).rejects.toThrow(
                        'Pasta inválida ou sem permissão de escrita'
                    );

                    // The engine should NOT have been called — transfer was not started
                    expect(engine.addMagnetLink).not.toHaveBeenCalled();

                    // No items should be in the download list
                    expect(downloadManager.getAll()).toHaveLength(0);

                    // Clear any pending timers
                    jest.runAllTimers();
                }
            ),
            { numRuns: 100 }
        );
    });
});
