/**
 * Example-based tests for IPC Handler.
 *
 * Covers:
 *   - Requirement 8.1: All expected IPC channels are registered (smoke test)
 *   - Requirement 8.4: nodeIntegration: false and contextIsolation: true in BrowserWindow config
 *   - Requirement 8.5: Invalid payload returns structured error { success: false, error: string }
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { registerIpcHandlers } from '../../main/ipcHandler';
import type { DownloadManager } from '../../main/downloadManager';
import type { SettingsManager, AppSettings } from '../../main/settingsManager';
import type { DownloadItem } from '../../shared/types';

// ─── Mock electron ────────────────────────────────────────────────────────────
// jest.mock is hoisted before variable declarations, so we must define mocks
// inside the factory using jest.fn() and retrieve them via require() afterwards.

jest.mock('electron', () => ({
    ipcMain: {
        handle: jest.fn(),
    },
    dialog: {
        showOpenDialog: jest.fn(),
    },
    BrowserWindow: jest.fn().mockImplementation(() => ({
        webContents: { send: jest.fn() },
        isDestroyed: jest.fn().mockReturnValue(false),
        on: jest.fn(),
    })),
}));

// Retrieve the mocked references after jest.mock has run
const { ipcMain: mockIpcMain } = require('electron') as {
    ipcMain: { handle: jest.Mock };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockDownloadManager(): DownloadManager {
    return {
        addTorrentFile: jest.fn(),
        addMagnetLink: jest.fn(),
        pause: jest.fn().mockResolvedValue(undefined),
        resume: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
        getAll: jest.fn().mockReturnValue([]),
        restoreSession: jest.fn().mockResolvedValue(undefined),
        persistSession: jest.fn(),
        setMaxConcurrentDownloads: jest.fn(),
        on: jest.fn(),
    } as unknown as DownloadManager;
}

function makeMockSettingsManager(): SettingsManager {
    return {
        get: jest.fn().mockReturnValue({
            destinationFolder: '/downloads',
            downloadSpeedLimit: 0,
            uploadSpeedLimit: 0,
            maxConcurrentDownloads: 3,
            notificationsEnabled: true,
        } as AppSettings),
        set: jest.fn(),
        getDefaultDownloadFolder: jest.fn().mockReturnValue('/downloads'),
    } as unknown as SettingsManager;
}

// ─── Tests: Requirement 8.1 — All IPC channels are registered ────────────────

describe('registerIpcHandlers — IPC channel registration (Requirement 8.1)', () => {
    const EXPECTED_CHANNELS = [
        'torrent:add-file',
        'torrent:add-magnet',
        'torrent:pause',
        'torrent:resume',
        'torrent:remove',
        'torrent:get-all',
        'torrent:get-files',
        'torrent:set-file-selection',
        'settings:get',
        'settings:set',
        'settings:select-folder',
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('registers all 11 expected IPC channels', () => {
        const downloadManager = makeMockDownloadManager();
        const settingsManager = makeMockSettingsManager();

        registerIpcHandlers(downloadManager, settingsManager);

        const registeredChannels = mockIpcMain.handle.mock.calls.map(
            (call: unknown[]) => call[0] as string
        );

        for (const channel of EXPECTED_CHANNELS) {
            expect(registeredChannels).toContain(channel);
        }
    });

    it('registers exactly 11 IPC channels (no extra channels)', () => {
        const downloadManager = makeMockDownloadManager();
        const settingsManager = makeMockSettingsManager();

        registerIpcHandlers(downloadManager, settingsManager);

        expect(mockIpcMain.handle).toHaveBeenCalledTimes(EXPECTED_CHANNELS.length);
    });

    it.each(EXPECTED_CHANNELS)('registers channel "%s"', (channel) => {
        const downloadManager = makeMockDownloadManager();
        const settingsManager = makeMockSettingsManager();

        registerIpcHandlers(downloadManager, settingsManager);

        const registeredChannels = mockIpcMain.handle.mock.calls.map(
            (call: unknown[]) => call[0] as string
        );
        expect(registeredChannels).toContain(channel);
    });
});

// ─── Tests: Requirement 8.4 — nodeIntegration and contextIsolation ────────────

describe('main/index.ts — BrowserWindow security config (Requirement 8.4)', () => {
    const indexPath = join(__dirname, '../../main/index.ts');

    it('sets nodeIntegration: false in BrowserWindow webPreferences', () => {
        const source = readFileSync(indexPath, 'utf-8');
        expect(source).toContain('nodeIntegration: false');
    });

    it('sets contextIsolation: true in BrowserWindow webPreferences', () => {
        const source = readFileSync(indexPath, 'utf-8');
        expect(source).toContain('contextIsolation: true');
    });

    it('does not enable nodeIntegration anywhere', () => {
        const source = readFileSync(indexPath, 'utf-8');
        expect(source).not.toMatch(/nodeIntegration\s*:\s*true/);
    });

    it('does not disable contextIsolation anywhere', () => {
        const source = readFileSync(indexPath, 'utf-8');
        expect(source).not.toMatch(/contextIsolation\s*:\s*false/);
    });
});

// ─── Tests: Requirement 8.5 — Invalid payload returns structured error ────────

describe('registerIpcHandlers — invalid payload returns structured error (Requirement 8.5)', () => {
    /**
     * Helper: extract the handler function registered for a given channel.
     * ipcMain.handle is called as: ipcMain.handle(channel, handlerFn)
     */
    function getHandler(channel: string): ((_event: unknown, payload: unknown) => Promise<unknown>) | undefined {
        const call = mockIpcMain.handle.mock.calls.find(
            (c: unknown[]) => c[0] === channel
        );
        return call ? (call[1] as (_event: unknown, payload: unknown) => Promise<unknown>) : undefined;
    }

    beforeEach(() => {
        jest.clearAllMocks();

        const downloadManager = makeMockDownloadManager();
        const settingsManager = makeMockSettingsManager();

        registerIpcHandlers(downloadManager, settingsManager);
    });

    it('torrent:add-file with null payload returns { success: false, error: string }', async () => {
        const handler = getHandler('torrent:add-file');
        expect(handler).toBeDefined();

        const response = await handler!(null, null) as { success: boolean; error?: string };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
        expect(response.error!.length).toBeGreaterThan(0);
    });

    it('torrent:add-file with empty object payload returns { success: false, error: string }', async () => {
        const handler = getHandler('torrent:add-file');
        const response = await handler!(null, {}) as { success: boolean; error?: string };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('torrent:add-file with empty filePath returns { success: false, error: string }', async () => {
        const handler = getHandler('torrent:add-file');
        const response = await handler!(null, { filePath: '' }) as { success: boolean; error?: string };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('torrent:add-magnet with null payload returns { success: false, error: string }', async () => {
        const handler = getHandler('torrent:add-magnet');
        expect(handler).toBeDefined();

        const response = await handler!(null, null) as { success: boolean; error?: string };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('torrent:pause with null payload returns { success: false, error: string }', async () => {
        const handler = getHandler('torrent:pause');
        expect(handler).toBeDefined();

        const response = await handler!(null, null) as { success: boolean; error?: string };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('torrent:resume with null payload returns { success: false, error: string }', async () => {
        const handler = getHandler('torrent:resume');
        expect(handler).toBeDefined();

        const response = await handler!(null, null) as { success: boolean; error?: string };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('torrent:remove with null payload returns { success: false, error: string }', async () => {
        const handler = getHandler('torrent:remove');
        expect(handler).toBeDefined();

        const response = await handler!(null, null) as { success: boolean; error?: string };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('torrent:remove with missing deleteFiles field returns { success: false, error: string }', async () => {
        const handler = getHandler('torrent:remove');
        const response = await handler!(null, { infoHash: 'a'.repeat(40) }) as { success: boolean; error?: string };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('settings:set with null payload returns { success: false, error: string }', async () => {
        const handler = getHandler('settings:set');
        expect(handler).toBeDefined();

        const response = await handler!(null, null) as { success: boolean; error?: string };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('settings:set with invalid downloadSpeedLimit returns { success: false, error: string }', async () => {
        const handler = getHandler('settings:set');
        const response = await handler!(null, { downloadSpeedLimit: -1 }) as { success: boolean; error?: string };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('settings:set with invalid uploadSpeedLimit returns { success: false, error: string }', async () => {
        const handler = getHandler('settings:set');
        const response = await handler!(null, { uploadSpeedLimit: 1.5 }) as { success: boolean; error?: string };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });
});

// ─── Property-Based Tests ─────────────────────────────────────────────────────

import fc from 'fast-check';

// ─── Property 18 — Resposta IPC sempre estruturada ────────────────────────────
// Feature: meshy-torrent-client, Property 18: Resposta IPC sempre tem forma estruturada
// **Validates: Requirements 8.2, 8.5**

describe('Property 18: Resposta IPC sempre tem forma estruturada', () => {
    const ALL_CHANNELS = [
        'torrent:add-file',
        'torrent:add-magnet',
        'torrent:pause',
        'torrent:resume',
        'torrent:remove',
        'torrent:get-all',
        'settings:get',
        'settings:set',
        'settings:select-folder',
    ];

    /**
     * Helper: extract the handler function registered for a given channel.
     */
    function getHandler(channel: string): ((_event: unknown, payload: unknown) => Promise<unknown>) | undefined {
        const call = mockIpcMain.handle.mock.calls.find(
            (c: unknown[]) => c[0] === channel
        );
        return call ? (call[1] as (_event: unknown, payload: unknown) => Promise<unknown>) : undefined;
    }

    /**
     * Registers handlers with fresh mocks and returns the mock managers.
     */
    function setupHandlers() {
        jest.clearAllMocks();

        const downloadManager = makeMockDownloadManager();
        const settingsManager = makeMockSettingsManager();

        registerIpcHandlers(downloadManager, settingsManager);

        return { downloadManager, settingsManager };
    }

    it('any payload sent to any IPC channel always returns { success: boolean } and never throws', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...ALL_CHANNELS),
                fc.anything(),
                async (channel, payload) => {
                    setupHandlers();
                    const handler = getHandler(channel);
                    expect(handler).toBeDefined();

                    // The handler must never throw — it must always return a structured response
                    const response = await handler!(null, payload) as Record<string, unknown>;

                    expect(response).toBeDefined();
                    expect(typeof response).toBe('object');
                    expect(response).not.toBeNull();
                    expect(typeof response.success).toBe('boolean');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('invalid payloads to channels requiring parameters return { success: false, error: string }', async () => {
        // Channels that require specific payload shapes — any arbitrary value
        // that doesn't match the expected shape should yield { success: false, error: string }
        const CHANNELS_WITH_REQUIRED_PARAMS = [
            'torrent:add-file',
            'torrent:add-magnet',
            'torrent:pause',
            'torrent:resume',
            'torrent:remove',
        ];

        // Generator for payloads that are definitely NOT valid for any of these channels.
        // We exclude objects that happen to have the right shape by using primitives,
        // null, undefined, arrays, and objects without the required keys.
        const invalidPayloadArb = fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.boolean(),
            fc.integer(),
            fc.double(),
            fc.string(),
            fc.array(fc.anything()),
            // Objects with wrong keys
            fc.record({
                wrongKey: fc.anything(),
            }),
            // Empty object
            fc.constant({}),
        );

        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...CHANNELS_WITH_REQUIRED_PARAMS),
                invalidPayloadArb,
                async (channel, payload) => {
                    setupHandlers();
                    const handler = getHandler(channel);
                    expect(handler).toBeDefined();

                    const response = await handler!(null, payload) as Record<string, unknown>;

                    expect(response).toBeDefined();
                    expect(response.success).toBe(false);
                    expect(typeof response.error).toBe('string');
                    expect((response.error as string).length).toBeGreaterThan(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('settings:set with invalid speed limit values returns { success: false, error: string }', async () => {
        // Generate payloads where speed limits are invalid (negative, float, non-number)
        const invalidSpeedLimitArb = fc.oneof(
            fc.double().filter(v => v < 0 || !Number.isInteger(v)),
            fc.constant(-1),
            fc.constant(1.5),
            fc.constant(-0.1),
            fc.constant(NaN),
            fc.constant(Infinity),
            fc.constant(-Infinity),
        );

        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom('downloadSpeedLimit', 'uploadSpeedLimit'),
                invalidSpeedLimitArb,
                async (field, invalidValue) => {
                    setupHandlers();
                    const handler = getHandler('settings:set');
                    expect(handler).toBeDefined();

                    const payload = { [field]: invalidValue };
                    const response = await handler!(null, payload) as Record<string, unknown>;

                    expect(response).toBeDefined();
                    expect(response.success).toBe(false);
                    expect(typeof response.error).toBe('string');
                    expect((response.error as string).length).toBeGreaterThan(0);
                }
            ),
            { numRuns: 100 }
        );
    });
});


// ─── Property 19 — Evento de progresso IPC contém todos os itens ativos ───────
// Feature: meshy-torrent-client, Property 19: Evento de progresso IPC contém todos os itens ativos
// **Validates: Requirements 8.3**

describe('Property 19: Evento de progresso IPC contém todos os itens ativos', () => {
    // ── Arbitrary generators ──────────────────────────────────────────────────

    const ALL_STATUSES = [
        'queued',
        'resolving-metadata',
        'downloading',
        'paused',
        'completed',
        'error',
        'metadata-failed',
        'files-not-found',
    ] as const;

    const ACTIVE_STATUSES: ReadonlySet<string> = new Set(['downloading', 'resolving-metadata']);

    /** Generate a hex string of exactly 40 chars (simulates an infoHash). */
    const infoHashArb = fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => s.toLowerCase());

    /** Generate a single DownloadItem with a given infoHash. */
    const downloadItemArb = (hash: string) =>
        fc.record({
            infoHash: fc.constant(hash),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            totalSize: fc.nat({ max: 10_000_000_000 }),
            downloadedSize: fc.nat({ max: 10_000_000_000 }),
            progress: fc.double({ min: 0, max: 1, noNaN: true }),
            downloadSpeed: fc.nat({ max: 100_000_000 }),
            uploadSpeed: fc.nat({ max: 100_000_000 }),
            numPeers: fc.nat({ max: 500 }),
            numSeeders: fc.nat({ max: 500 }),
            timeRemaining: fc.nat({ max: 1_000_000_000 }),
            status: fc.constantFrom(...ALL_STATUSES),
            destinationFolder: fc.constant('/downloads'),
            addedAt: fc.nat({ max: Date.now() }),
        });

    /**
     * Generate an array of 0–10 DownloadItems with unique infoHashes.
     * Uses fc.uniqueArray to guarantee uniqueness of hashes, then maps
     * each hash to a full DownloadItem.
     */
    const downloadItemsArb = fc
        .uniqueArray(infoHashArb, { minLength: 0, maxLength: 10 })
        .chain(hashes =>
            hashes.length === 0
                ? fc.constant([])
                : fc.tuple(...hashes.map(h => downloadItemArb(h))).map(items => items as DownloadItem[])
        );

    // ── Helpers ───────────────────────────────────────────────────────────────

    function makeMockTorrentEngine() {
        return {
            on: jest.fn(),
            removeListener: jest.fn(),
        };
    }

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('progress event payload contains exactly the active items from downloadManager.getAll()', () => {
        fc.assert(
            fc.property(downloadItemsArb, (items) => {
                // ── Arrange ──────────────────────────────────────────────────
                const downloadManager = makeMockDownloadManager();
                (downloadManager.getAll as jest.Mock).mockReturnValue(items);

                const mockWebContents = { send: jest.fn() };
                const mockWindow = {
                    webContents: mockWebContents,
                    isDestroyed: jest.fn().mockReturnValue(false),
                    on: jest.fn(),
                };

                const { BrowserWindow } = require('electron');
                BrowserWindow.mockImplementation(() => mockWindow);

                const torrentEngine = makeMockTorrentEngine();

                // Import and call attachWindowEvents
                const { attachWindowEvents } = require('../../main/ipcHandler');
                attachWindowEvents(
                    downloadManager,
                    torrentEngine,
                    mockWindow,
                );

                // ── Act ──────────────────────────────────────────────────────
                // Advance the timer by 1 second to trigger the progress interval
                jest.advanceTimersByTime(1000);

                // ── Assert ───────────────────────────────────────────────────
                // The progress event should have been sent
                const sendCalls = mockWebContents.send.mock.calls.filter(
                    (call: unknown[]) => call[0] === 'torrent:progress'
                );
                expect(sendCalls.length).toBe(1);

                const payload = sendCalls[0][1] as DownloadItem[];

                // Extract active items from the original items array
                const expectedActiveHashes = new Set(
                    items
                        .filter(item => ACTIVE_STATUSES.has(item.status))
                        .map(item => item.infoHash)
                );

                // Extract active items from the payload
                const payloadActiveHashes = new Set(
                    payload
                        .filter(item => ACTIVE_STATUSES.has(item.status))
                        .map(item => item.infoHash)
                );

                // The active infoHashes in the payload must match exactly
                expect(payloadActiveHashes).toEqual(expectedActiveHashes);

                // Clean up: clear the interval by triggering the 'closed' callback
                const closedCallback = mockWindow.on.mock.calls.find(
                    (call: unknown[]) => call[0] === 'closed'
                );
                if (closedCallback) {
                    (closedCallback[1] as () => void)();
                }
            }),
            { numRuns: 100 }
        );
    });
});
