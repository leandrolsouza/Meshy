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
import { ErrorCodes } from '../../shared/errorCodes';
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
        setTorrentSpeedLimits: jest.fn(),
        getTorrentSpeedLimits: jest.fn().mockReturnValue({
            downloadSpeedLimitKBps: 0,
            uploadSpeedLimitKBps: 0,
        }),
        onGlobalSpeedLimitChanged: jest.fn(),
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
            theme: 'vs-code-dark',
            locale: 'pt-BR',
            globalTrackers: [],
            autoApplyGlobalTrackers: false,
            dhtEnabled: true,
            pexEnabled: true,
            utpEnabled: true,
        } as AppSettings),
        set: jest.fn(),
        getDefaultDownloadFolder: jest.fn().mockReturnValue('/downloads'),
        getGlobalTrackers: jest.fn().mockReturnValue([]),
        addGlobalTracker: jest.fn(),
        removeGlobalTracker: jest.fn(),
        setAutoApplyGlobalTrackers: jest.fn(),
    } as unknown as SettingsManager;
}

function makeMockTorrentEngine() {
    return {
        getTrackers: jest.fn().mockReturnValue([]),
        addTracker: jest.fn(),
        removeTracker: jest.fn(),
        setTorrentDownloadSpeedLimit: jest.fn(),
        setTorrentUploadSpeedLimit: jest.fn(),
        getFiles: jest.fn().mockReturnValue([]),
        setFileSelection: jest.fn().mockReturnValue([]),
        on: jest.fn(),
        removeListener: jest.fn(),
    };
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
        'torrent:set-speed-limits',
        'torrent:get-speed-limits',
        'torrent:retry',
        'settings:get',
        'settings:set',
        'settings:select-folder',
        'tracker:get',
        'tracker:add',
        'tracker:remove',
        'tracker:apply-global',
        'tracker:get-global',
        'tracker:add-global',
        'tracker:remove-global',
        'renderer:report-error',
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('registers all 22 expected IPC channels', () => {
        const downloadManager = makeMockDownloadManager();
        const settingsManager = makeMockSettingsManager();
        const torrentEngine = makeMockTorrentEngine();

        registerIpcHandlers(downloadManager, settingsManager, torrentEngine as any);

        const registeredChannels = mockIpcMain.handle.mock.calls.map(
            (call: unknown[]) => call[0] as string,
        );

        for (const channel of EXPECTED_CHANNELS) {
            expect(registeredChannels).toContain(channel);
        }
    });

    it('registers exactly 22 IPC channels (no extra channels)', () => {
        const downloadManager = makeMockDownloadManager();
        const settingsManager = makeMockSettingsManager();
        const torrentEngine = makeMockTorrentEngine();

        registerIpcHandlers(downloadManager, settingsManager, torrentEngine as any);

        expect(mockIpcMain.handle).toHaveBeenCalledTimes(EXPECTED_CHANNELS.length);
    });

    it.each(EXPECTED_CHANNELS)('registers channel "%s"', (channel) => {
        const downloadManager = makeMockDownloadManager();
        const settingsManager = makeMockSettingsManager();
        const torrentEngine = makeMockTorrentEngine();

        registerIpcHandlers(downloadManager, settingsManager, torrentEngine as any);

        const registeredChannels = mockIpcMain.handle.mock.calls.map(
            (call: unknown[]) => call[0] as string,
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
    function getHandler(
        channel: string,
    ): ((_event: unknown, payload: unknown) => Promise<unknown>) | undefined {
        const call = mockIpcMain.handle.mock.calls.find((c: unknown[]) => c[0] === channel);
        return call
            ? (call[1] as (_event: unknown, payload: unknown) => Promise<unknown>)
            : undefined;
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

        const response = (await handler!(null, null)) as { success: boolean; error?: string };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
        expect(response.error!.length).toBeGreaterThan(0);
    });

    it('torrent:add-file with empty object payload returns { success: false, error: string }', async () => {
        const handler = getHandler('torrent:add-file');
        const response = (await handler!(null, {})) as { success: boolean; error?: string };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('torrent:add-file with empty filePath returns { success: false, error: string }', async () => {
        const handler = getHandler('torrent:add-file');
        const response = (await handler!(null, { filePath: '' })) as {
            success: boolean;
            error?: string;
        };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('torrent:add-magnet with null payload returns { success: false, error: string }', async () => {
        const handler = getHandler('torrent:add-magnet');
        expect(handler).toBeDefined();

        const response = (await handler!(null, null)) as { success: boolean; error?: string };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('torrent:pause with null payload returns { success: false, error: string }', async () => {
        const handler = getHandler('torrent:pause');
        expect(handler).toBeDefined();

        const response = (await handler!(null, null)) as { success: boolean; error?: string };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('torrent:resume with null payload returns { success: false, error: string }', async () => {
        const handler = getHandler('torrent:resume');
        expect(handler).toBeDefined();

        const response = (await handler!(null, null)) as { success: boolean; error?: string };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('torrent:remove with null payload returns { success: false, error: string }', async () => {
        const handler = getHandler('torrent:remove');
        expect(handler).toBeDefined();

        const response = (await handler!(null, null)) as { success: boolean; error?: string };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('torrent:remove with missing deleteFiles field returns { success: false, error: string }', async () => {
        const handler = getHandler('torrent:remove');
        const response = (await handler!(null, { infoHash: 'a'.repeat(40) })) as {
            success: boolean;
            error?: string;
        };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('settings:set with null payload returns { success: false, error: string }', async () => {
        const handler = getHandler('settings:set');
        expect(handler).toBeDefined();

        const response = (await handler!(null, null)) as { success: boolean; error?: string };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('settings:set with invalid downloadSpeedLimit returns { success: false, error: string }', async () => {
        const handler = getHandler('settings:set');
        const response = (await handler!(null, { downloadSpeedLimit: -1 })) as {
            success: boolean;
            error?: string;
        };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('settings:set with invalid uploadSpeedLimit returns { success: false, error: string }', async () => {
        const handler = getHandler('settings:set');
        const response = (await handler!(null, { uploadSpeedLimit: 1.5 })) as {
            success: boolean;
            error?: string;
        };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
    });

    it('settings:set with empty string locale returns { success: false, error: string }', async () => {
        const handler = getHandler('settings:set');
        const response = (await handler!(null, { locale: '' })) as {
            success: boolean;
            error?: string;
        };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
        expect(response.error).toBe('error.settings.invalidLocale');
    });

    it('settings:set with whitespace-only locale returns { success: false, error: string }', async () => {
        const handler = getHandler('settings:set');
        const response = (await handler!(null, { locale: '   ' })) as {
            success: boolean;
            error?: string;
        };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
        expect(response.error).toBe('error.settings.invalidLocale');
    });

    it('settings:set with non-string locale (number) returns { success: false, error: string }', async () => {
        const handler = getHandler('settings:set');
        const response = (await handler!(null, { locale: 42 })) as {
            success: boolean;
            error?: string;
        };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
        expect(response.error).toBe('error.settings.invalidLocale');
    });

    it('settings:set with null locale returns { success: false, error: string }', async () => {
        const handler = getHandler('settings:set');
        const response = (await handler!(null, { locale: null })) as {
            success: boolean;
            error?: string;
        };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
        expect(response.error).toBe('error.settings.invalidLocale');
    });

    it('settings:set with valid locale string returns { success: true }', async () => {
        const handler = getHandler('settings:set');
        const response = (await handler!(null, { locale: 'en-US' })) as {
            success: boolean;
            data?: unknown;
        };

        expect(response.success).toBe(true);
    });
});

// ─── Tests: Tracker IPC handlers (Requirement 8.1, 8.2) ──────────────────────

describe('registerIpcHandlers — tracker handlers', () => {
    let mockTorrentEngine: ReturnType<typeof makeMockTorrentEngine>;
    let mockSettingsMgr: SettingsManager;

    function getHandler(
        channel: string,
    ): ((_event: unknown, payload: unknown) => Promise<unknown>) | undefined {
        const call = mockIpcMain.handle.mock.calls.find((c: unknown[]) => c[0] === channel);
        return call
            ? (call[1] as (_event: unknown, payload: unknown) => Promise<unknown>)
            : undefined;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        mockTorrentEngine = makeMockTorrentEngine();
        mockSettingsMgr = makeMockSettingsManager();
        const downloadManager = makeMockDownloadManager();
        registerIpcHandlers(downloadManager, mockSettingsMgr, mockTorrentEngine as any);
    });

    // ── tracker:get ───────────────────────────────────────────────────────────

    describe('tracker:get', () => {
        it('retorna trackers do torrent com sucesso', async () => {
            const trackers = [
                { url: 'udp://tracker.example.com:6969', status: 'connected' },
            ];
            (mockTorrentEngine.getTrackers as jest.Mock).mockReturnValue(trackers);

            const handler = getHandler('tracker:get')!;
            const response = (await handler(null, { infoHash: 'a'.repeat(40) })) as any;

            expect(response.success).toBe(true);
            expect(response.data).toEqual(trackers);
            expect(mockTorrentEngine.getTrackers).toHaveBeenCalledWith('a'.repeat(40));
        });

        it('retorna erro para payload inválido (null)', async () => {
            const handler = getHandler('tracker:get')!;
            const response = (await handler(null, null)) as any;

            expect(response.success).toBe(false);
            expect(typeof response.error).toBe('string');
        });

        it('retorna erro para infoHash vazio', async () => {
            const handler = getHandler('tracker:get')!;
            const response = (await handler(null, { infoHash: '' })) as any;

            expect(response.success).toBe(false);
            expect(typeof response.error).toBe('string');
        });

        it('retorna erro quando torrentEngine lança exceção', async () => {
            (mockTorrentEngine.getTrackers as jest.Mock).mockImplementation(() => {
                throw new Error('Torrent não encontrado');
            });

            const handler = getHandler('tracker:get')!;
            const response = (await handler(null, { infoHash: 'a'.repeat(40) })) as any;

            expect(response.success).toBe(false);
            expect(response.error).toContain('Torrent não encontrado');
        });
    });

    // ── tracker:add ───────────────────────────────────────────────────────────

    describe('tracker:add', () => {
        it('adiciona tracker e retorna lista atualizada', async () => {
            const trackers = [
                { url: 'udp://tracker.example.com:6969', status: 'pending' },
            ];
            (mockTorrentEngine.getTrackers as jest.Mock).mockReturnValue(trackers);

            const handler = getHandler('tracker:add')!;
            const response = (await handler(null, {
                infoHash: 'a'.repeat(40),
                url: 'udp://tracker.example.com:6969/announce',
            })) as any;

            expect(response.success).toBe(true);
            expect(response.data).toEqual(trackers);
            expect(mockTorrentEngine.addTracker).toHaveBeenCalledWith(
                'a'.repeat(40),
                'udp://tracker.example.com:6969/announce',
            );
        });

        it('retorna erro para payload sem url', async () => {
            const handler = getHandler('tracker:add')!;
            const response = (await handler(null, { infoHash: 'a'.repeat(40) })) as any;

            expect(response.success).toBe(false);
            expect(typeof response.error).toBe('string');
        });

        it('retorna erro para url inválida (protocolo ftp)', async () => {
            const handler = getHandler('tracker:add')!;
            const response = (await handler(null, {
                infoHash: 'a'.repeat(40),
                url: 'ftp://tracker.example.com:6969',
            })) as any;

            expect(response.success).toBe(false);
            expect(response.error).toBe(ErrorCodes.INVALID_TRACKER_URL);
        });

        it('retorna erro para payload null', async () => {
            const handler = getHandler('tracker:add')!;
            const response = (await handler(null, null)) as any;

            expect(response.success).toBe(false);
            expect(typeof response.error).toBe('string');
        });
    });

    // ── tracker:remove ────────────────────────────────────────────────────────

    describe('tracker:remove', () => {
        it('remove tracker e retorna lista atualizada', async () => {
            (mockTorrentEngine.getTrackers as jest.Mock).mockReturnValue([]);

            const handler = getHandler('tracker:remove')!;
            const response = (await handler(null, {
                infoHash: 'a'.repeat(40),
                url: 'udp://tracker.example.com:6969',
            })) as any;

            expect(response.success).toBe(true);
            expect(response.data).toEqual([]);
            expect(mockTorrentEngine.removeTracker).toHaveBeenCalledWith(
                'a'.repeat(40),
                'udp://tracker.example.com:6969',
            );
        });

        it('retorna erro para payload sem url', async () => {
            const handler = getHandler('tracker:remove')!;
            const response = (await handler(null, { infoHash: 'a'.repeat(40) })) as any;

            expect(response.success).toBe(false);
            expect(typeof response.error).toBe('string');
        });

        it('retorna erro quando removeTracker lança exceção', async () => {
            (mockTorrentEngine.removeTracker as jest.Mock).mockImplementation(() => {
                throw new Error('Tracker não encontrado');
            });

            const handler = getHandler('tracker:remove')!;
            const response = (await handler(null, {
                infoHash: 'a'.repeat(40),
                url: 'udp://tracker.example.com:6969',
            })) as any;

            expect(response.success).toBe(false);
            expect(response.error).toContain('Tracker não encontrado');
        });
    });

    // ── tracker:apply-global ──────────────────────────────────────────────────

    describe('tracker:apply-global', () => {
        it('aplica trackers globais e retorna lista atualizada', async () => {
            (mockSettingsMgr.getGlobalTrackers as jest.Mock).mockReturnValue([
                'udp://global1.example.com:6969',
                'udp://global2.example.com:6969',
            ]);
            const trackers = [
                { url: 'udp://global1.example.com:6969', status: 'pending' },
                { url: 'udp://global2.example.com:6969', status: 'pending' },
            ];
            (mockTorrentEngine.getTrackers as jest.Mock).mockReturnValue(trackers);

            const handler = getHandler('tracker:apply-global')!;
            const response = (await handler(null, { infoHash: 'a'.repeat(40) })) as any;

            expect(response.success).toBe(true);
            expect(response.data).toEqual(trackers);
            expect(mockTorrentEngine.addTracker).toHaveBeenCalledTimes(2);
        });

        it('ignora silenciosamente erros individuais ao aplicar trackers globais', async () => {
            (mockSettingsMgr.getGlobalTrackers as jest.Mock).mockReturnValue([
                'udp://ok.example.com:6969',
                'udp://fail.example.com:6969',
            ]);
            (mockTorrentEngine.addTracker as jest.Mock)
                .mockImplementationOnce(() => { }) // primeiro sucesso
                .mockImplementationOnce(() => {
                    throw new Error('Tracker já presente');
                }); // segundo falha
            (mockTorrentEngine.getTrackers as jest.Mock).mockReturnValue([
                { url: 'udp://ok.example.com:6969', status: 'pending' },
            ]);

            const handler = getHandler('tracker:apply-global')!;
            const response = (await handler(null, { infoHash: 'a'.repeat(40) })) as any;

            expect(response.success).toBe(true);
            expect(response.data).toHaveLength(1);
        });

        it('retorna erro para payload inválido', async () => {
            const handler = getHandler('tracker:apply-global')!;
            const response = (await handler(null, null)) as any;

            expect(response.success).toBe(false);
            expect(typeof response.error).toBe('string');
        });
    });

    // ── tracker:get-global ────────────────────────────────────────────────────

    describe('tracker:get-global', () => {
        it('retorna lista global de trackers', async () => {
            const globalTrackers = ['udp://global.example.com:6969'];
            (mockSettingsMgr.getGlobalTrackers as jest.Mock).mockReturnValue(globalTrackers);

            const handler = getHandler('tracker:get-global')!;
            const response = (await handler(null, undefined)) as any;

            expect(response.success).toBe(true);
            expect(response.data).toEqual(globalTrackers);
        });
    });

    // ── tracker:add-global ────────────────────────────────────────────────────

    describe('tracker:add-global', () => {
        it('adiciona tracker global e retorna lista atualizada', async () => {
            const updated = ['udp://global.example.com:6969'];
            (mockSettingsMgr.getGlobalTrackers as jest.Mock).mockReturnValue(updated);

            const handler = getHandler('tracker:add-global')!;
            const response = (await handler(null, {
                url: 'udp://global.example.com:6969',
            })) as any;

            expect(response.success).toBe(true);
            expect(response.data).toEqual(updated);
            expect(mockSettingsMgr.addGlobalTracker).toHaveBeenCalledWith(
                'udp://global.example.com:6969',
            );
        });

        it('retorna erro para url inválida', async () => {
            const handler = getHandler('tracker:add-global')!;
            const response = (await handler(null, {
                url: 'ftp://invalid.example.com',
            })) as any;

            expect(response.success).toBe(false);
            expect(response.error).toBe(ErrorCodes.INVALID_TRACKER_URL);
        });

        it('retorna erro para payload null', async () => {
            const handler = getHandler('tracker:add-global')!;
            const response = (await handler(null, null)) as any;

            expect(response.success).toBe(false);
            expect(typeof response.error).toBe('string');
        });

        it('retorna erro para url vazia', async () => {
            const handler = getHandler('tracker:add-global')!;
            const response = (await handler(null, { url: '' })) as any;

            expect(response.success).toBe(false);
            expect(typeof response.error).toBe('string');
        });

        it('retorna erro quando addGlobalTracker lança exceção (duplicata)', async () => {
            (mockSettingsMgr.addGlobalTracker as jest.Mock).mockImplementation(() => {
                throw new Error('Tracker já existe na lista global');
            });

            const handler = getHandler('tracker:add-global')!;
            const response = (await handler(null, {
                url: 'udp://global.example.com:6969',
            })) as any;

            expect(response.success).toBe(false);
            expect(response.error).toContain('Tracker já existe na lista global');
        });
    });

    // ── tracker:remove-global ─────────────────────────────────────────────────

    describe('tracker:remove-global', () => {
        it('remove tracker global e retorna lista atualizada', async () => {
            (mockSettingsMgr.getGlobalTrackers as jest.Mock).mockReturnValue([]);

            const handler = getHandler('tracker:remove-global')!;
            const response = (await handler(null, {
                url: 'udp://global.example.com:6969',
            })) as any;

            expect(response.success).toBe(true);
            expect(response.data).toEqual([]);
            expect(mockSettingsMgr.removeGlobalTracker).toHaveBeenCalledWith(
                'udp://global.example.com:6969',
            );
        });

        it('retorna erro para payload null', async () => {
            const handler = getHandler('tracker:remove-global')!;
            const response = (await handler(null, null)) as any;

            expect(response.success).toBe(false);
            expect(typeof response.error).toBe('string');
        });

        it('retorna erro para url vazia', async () => {
            const handler = getHandler('tracker:remove-global')!;
            const response = (await handler(null, { url: '' })) as any;

            expect(response.success).toBe(false);
            expect(typeof response.error).toBe('string');
        });
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
        'torrent:set-speed-limits',
        'torrent:get-speed-limits',
        'settings:get',
        'settings:set',
        'settings:select-folder',
        'tracker:get',
        'tracker:add',
        'tracker:remove',
        'tracker:apply-global',
        'tracker:get-global',
        'tracker:add-global',
        'tracker:remove-global',
    ];

    /**
     * Helper: extract the handler function registered for a given channel.
     */
    function getHandler(
        channel: string,
    ): ((_event: unknown, payload: unknown) => Promise<unknown>) | undefined {
        const call = mockIpcMain.handle.mock.calls.find((c: unknown[]) => c[0] === channel);
        return call
            ? (call[1] as (_event: unknown, payload: unknown) => Promise<unknown>)
            : undefined;
    }

    /**
     * Registers handlers with fresh mocks and returns the mock managers.
     */
    function setupHandlers() {
        jest.clearAllMocks();

        const downloadManager = makeMockDownloadManager();
        const settingsManager = makeMockSettingsManager();
        const torrentEngine = makeMockTorrentEngine();

        registerIpcHandlers(downloadManager, settingsManager, torrentEngine as any);

        return { downloadManager, settingsManager, torrentEngine };
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
                    const response = (await handler!(null, payload)) as Record<string, unknown>;

                    expect(response).toBeDefined();
                    expect(typeof response).toBe('object');
                    expect(response).not.toBeNull();
                    expect(typeof response.success).toBe('boolean');
                },
            ),
            { numRuns: 100 },
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
            'torrent:set-speed-limits',
            'torrent:get-speed-limits',
            'tracker:get',
            'tracker:add',
            'tracker:remove',
            'tracker:apply-global',
            'tracker:add-global',
            'tracker:remove-global',
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

                    const response = (await handler!(null, payload)) as Record<string, unknown>;

                    expect(response).toBeDefined();
                    expect(response.success).toBe(false);
                    expect(typeof response.error).toBe('string');
                    expect((response.error as string).length).toBeGreaterThan(0);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('settings:set with invalid speed limit values returns { success: false, error: string }', async () => {
        // Generate payloads where speed limits are invalid (negative, float, non-number)
        const invalidSpeedLimitArb = fc.oneof(
            fc.double().filter((v) => v < 0 || !Number.isInteger(v)),
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
                    const response = (await handler!(null, payload)) as Record<string, unknown>;

                    expect(response).toBeDefined();
                    expect(response.success).toBe(false);
                    expect(typeof response.error).toBe('string');
                    expect((response.error as string).length).toBeGreaterThan(0);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ─── Tests: torrent:set-speed-limits and torrent:get-speed-limits handlers ────

describe('registerIpcHandlers — torrent speed limit handlers', () => {
    let mockDownloadManager: DownloadManager;
    let mockSettingsMgr: SettingsManager;

    function getHandler(
        channel: string,
    ): ((_event: unknown, payload: unknown) => Promise<unknown>) | undefined {
        const call = mockIpcMain.handle.mock.calls.find((c: unknown[]) => c[0] === channel);
        return call
            ? (call[1] as (_event: unknown, payload: unknown) => Promise<unknown>)
            : undefined;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        mockDownloadManager = makeMockDownloadManager();
        mockSettingsMgr = makeMockSettingsManager();
        registerIpcHandlers(mockDownloadManager, mockSettingsMgr);
    });

    // ── torrent:set-speed-limits ──────────────────────────────────────────────

    describe('torrent:set-speed-limits', () => {
        it('define limites com sucesso e retorna DownloadItem', async () => {
            const fakeItem: DownloadItem = {
                infoHash: 'a'.repeat(40),
                name: 'test-torrent',
                totalSize: 1000,
                downloadedSize: 500,
                progress: 0.5,
                downloadSpeed: 100,
                uploadSpeed: 50,
                numPeers: 5,
                numSeeders: 3,
                timeRemaining: 60,
                status: 'downloading',
                destinationFolder: '/downloads',
                addedAt: Date.now(),
                downloadSpeedLimitKBps: 512,
                uploadSpeedLimitKBps: 256,
            };
            (mockDownloadManager.setTorrentSpeedLimits as jest.Mock).mockReturnValue(fakeItem);

            const handler = getHandler('torrent:set-speed-limits')!;
            const response = (await handler(null, {
                infoHash: 'a'.repeat(40),
                downloadLimit: 512,
                uploadLimit: 256,
            })) as any;

            expect(response.success).toBe(true);
            expect(response.data).toEqual(fakeItem);
            expect(mockDownloadManager.setTorrentSpeedLimits).toHaveBeenCalledWith(
                'a'.repeat(40),
                512,
                256,
            );
        });

        it('retorna erro para payload null', async () => {
            const handler = getHandler('torrent:set-speed-limits')!;
            const response = (await handler(null, null)) as any;

            expect(response.success).toBe(false);
            expect(typeof response.error).toBe('string');
        });

        it('retorna erro para infoHash vazio', async () => {
            const handler = getHandler('torrent:set-speed-limits')!;
            const response = (await handler(null, {
                infoHash: '',
                downloadLimit: 100,
                uploadLimit: 100,
            })) as any;

            expect(response.success).toBe(false);
            expect(response.error).toBe(ErrorCodes.INVALID_PARAMS);
        });

        it('retorna erro para downloadLimit negativo', async () => {
            const handler = getHandler('torrent:set-speed-limits')!;
            const response = (await handler(null, {
                infoHash: 'a'.repeat(40),
                downloadLimit: -1,
                uploadLimit: 100,
            })) as any;

            expect(response.success).toBe(false);
            expect(response.error).toBe(ErrorCodes.INVALID_SPEED_LIMIT);
        });

        it('retorna erro para uploadLimit float', async () => {
            const handler = getHandler('torrent:set-speed-limits')!;
            const response = (await handler(null, {
                infoHash: 'a'.repeat(40),
                downloadLimit: 100,
                uploadLimit: 1.5,
            })) as any;

            expect(response.success).toBe(false);
            expect(response.error).toBe(ErrorCodes.INVALID_SPEED_LIMIT);
        });

        it('retorna erro quando downloadManager lança exceção (torrent não encontrado)', async () => {
            (mockDownloadManager.setTorrentSpeedLimits as jest.Mock).mockImplementation(() => {
                throw new Error('Torrent não encontrado');
            });

            const handler = getHandler('torrent:set-speed-limits')!;
            const response = (await handler(null, {
                infoHash: 'a'.repeat(40),
                downloadLimit: 100,
                uploadLimit: 100,
            })) as any;

            expect(response.success).toBe(false);
            expect(response.error).toContain('Torrent não encontrado');
        });

        it('aceita limite 0 (sem limite individual)', async () => {
            const fakeItem = {
                infoHash: 'a'.repeat(40),
                downloadSpeedLimitKBps: 0,
                uploadSpeedLimitKBps: 0,
            } as DownloadItem;
            (mockDownloadManager.setTorrentSpeedLimits as jest.Mock).mockReturnValue(fakeItem);

            const handler = getHandler('torrent:set-speed-limits')!;
            const response = (await handler(null, {
                infoHash: 'a'.repeat(40),
                downloadLimit: 0,
                uploadLimit: 0,
            })) as any;

            expect(response.success).toBe(true);
            expect(response.data.downloadSpeedLimitKBps).toBe(0);
        });
    });

    // ── torrent:get-speed-limits ──────────────────────────────────────────────

    describe('torrent:get-speed-limits', () => {
        it('retorna limites do torrent com sucesso', async () => {
            const limits = { downloadSpeedLimitKBps: 512, uploadSpeedLimitKBps: 256 };
            (mockDownloadManager.getTorrentSpeedLimits as jest.Mock).mockReturnValue(limits);

            const handler = getHandler('torrent:get-speed-limits')!;
            const response = (await handler(null, { infoHash: 'a'.repeat(40) })) as any;

            expect(response.success).toBe(true);
            expect(response.data).toEqual(limits);
            expect(mockDownloadManager.getTorrentSpeedLimits).toHaveBeenCalledWith(
                'a'.repeat(40),
            );
        });

        it('retorna erro para payload null', async () => {
            const handler = getHandler('torrent:get-speed-limits')!;
            const response = (await handler(null, null)) as any;

            expect(response.success).toBe(false);
            expect(typeof response.error).toBe('string');
        });

        it('retorna erro para infoHash vazio', async () => {
            const handler = getHandler('torrent:get-speed-limits')!;
            const response = (await handler(null, { infoHash: '' })) as any;

            expect(response.success).toBe(false);
            expect(response.error).toBe(ErrorCodes.INVALID_PARAMS);
        });

        it('retorna erro quando downloadManager lança exceção', async () => {
            (mockDownloadManager.getTorrentSpeedLimits as jest.Mock).mockImplementation(() => {
                throw new Error('Torrent não encontrado');
            });

            const handler = getHandler('torrent:get-speed-limits')!;
            const response = (await handler(null, { infoHash: 'a'.repeat(40) })) as any;

            expect(response.success).toBe(false);
            expect(response.error).toContain('Torrent não encontrado');
        });
    });
});

// ─── Tests: settings:set calls onGlobalSpeedLimitChanged ──────────────────────

describe('registerIpcHandlers — settings:set chama onGlobalSpeedLimitChanged', () => {
    let mockDownloadManager: DownloadManager;
    let mockSettingsMgr: SettingsManager;

    function getHandler(
        channel: string,
    ): ((_event: unknown, payload: unknown) => Promise<unknown>) | undefined {
        const call = mockIpcMain.handle.mock.calls.find((c: unknown[]) => c[0] === channel);
        return call
            ? (call[1] as (_event: unknown, payload: unknown) => Promise<unknown>)
            : undefined;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        mockDownloadManager = makeMockDownloadManager();
        mockSettingsMgr = makeMockSettingsManager();
        registerIpcHandlers(mockDownloadManager, mockSettingsMgr);
    });

    it('chama onGlobalSpeedLimitChanged ao alterar downloadSpeedLimit', async () => {
        const handler = getHandler('settings:set')!;
        await handler(null, { downloadSpeedLimit: 500 });

        expect(mockDownloadManager.onGlobalSpeedLimitChanged).toHaveBeenCalledTimes(1);
    });

    it('chama onGlobalSpeedLimitChanged ao alterar uploadSpeedLimit', async () => {
        const handler = getHandler('settings:set')!;
        await handler(null, { uploadSpeedLimit: 300 });

        expect(mockDownloadManager.onGlobalSpeedLimitChanged).toHaveBeenCalledTimes(1);
    });

    it('chama onGlobalSpeedLimitChanged ao alterar ambos os limites', async () => {
        const handler = getHandler('settings:set')!;
        await handler(null, { downloadSpeedLimit: 500, uploadSpeedLimit: 300 });

        expect(mockDownloadManager.onGlobalSpeedLimitChanged).toHaveBeenCalledTimes(1);
    });

    it('não chama onGlobalSpeedLimitChanged ao alterar outras configurações', async () => {
        const handler = getHandler('settings:set')!;
        await handler(null, { notificationsEnabled: false });

        expect(mockDownloadManager.onGlobalSpeedLimitChanged).not.toHaveBeenCalled();
    });
});

// ─── Property 3 — Payloads inválidos para speed limits retornam { success: false } ──
// Feature: per-torrent-speed-limit, Property 3: Validação IPC rejeita payloads inválidos
// **Validates: Requirements 1.1, 2.1, 6.2, 6.3**

describe('Property 3: Payloads inválidos para speed limits retornam { success: false } sem exceção', () => {
    function getHandler(
        channel: string,
    ): ((_event: unknown, payload: unknown) => Promise<unknown>) | undefined {
        const call = mockIpcMain.handle.mock.calls.find((c: unknown[]) => c[0] === channel);
        return call
            ? (call[1] as (_event: unknown, payload: unknown) => Promise<unknown>)
            : undefined;
    }

    function setupHandlers() {
        jest.clearAllMocks();

        const downloadManager = makeMockDownloadManager();
        const settingsManager = makeMockSettingsManager();
        const torrentEngine = makeMockTorrentEngine();

        registerIpcHandlers(downloadManager, settingsManager, torrentEngine as any);

        return { downloadManager, settingsManager, torrentEngine };
    }

    it('torrent:set-speed-limits rejeita payloads não-objeto sem lançar exceção', async () => {
        // Gerador de payloads que não são objetos válidos
        const nonObjectPayloadArb = fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.boolean(),
            fc.integer(),
            fc.double(),
            fc.string(),
            fc.array(fc.anything()),
        );

        await fc.assert(
            fc.asyncProperty(nonObjectPayloadArb, async (payload) => {
                setupHandlers();
                const handler = getHandler('torrent:set-speed-limits');
                expect(handler).toBeDefined();

                const response = (await handler!(null, payload)) as Record<string, unknown>;

                expect(response).toBeDefined();
                expect(response.success).toBe(false);
                expect(typeof response.error).toBe('string');
                expect((response.error as string).length).toBeGreaterThan(0);
            }),
            { numRuns: 100 },
        );
    });

    it('torrent:set-speed-limits rejeita infoHash inválido sem lançar exceção', async () => {
        // Gerador de infoHash inválidos: vazio, não-string, ausente
        const invalidInfoHashPayloadArb = fc.oneof(
            fc.constant({ infoHash: '', downloadLimit: 100, uploadLimit: 100 }),
            fc.constant({ infoHash: 123, downloadLimit: 100, uploadLimit: 100 }),
            fc.constant({ infoHash: null, downloadLimit: 100, uploadLimit: 100 }),
            fc.constant({ infoHash: true, downloadLimit: 100, uploadLimit: 100 }),
            fc.constant({ infoHash: undefined, downloadLimit: 100, uploadLimit: 100 }),
            fc.constant({ downloadLimit: 100, uploadLimit: 100 }),
        );

        await fc.assert(
            fc.asyncProperty(invalidInfoHashPayloadArb, async (payload) => {
                setupHandlers();
                const handler = getHandler('torrent:set-speed-limits');
                expect(handler).toBeDefined();

                const response = (await handler!(null, payload)) as Record<string, unknown>;

                expect(response.success).toBe(false);
                expect(typeof response.error).toBe('string');
            }),
            { numRuns: 50 },
        );
    });

    it('torrent:set-speed-limits rejeita limites inválidos sem lançar exceção', async () => {
        // Gerador de valores de limite inválidos: negativos, floats, strings, null, undefined
        const invalidLimitArb = fc.oneof(
            fc.integer({ min: -1000, max: -1 }),
            fc.double().filter((v) => !Number.isInteger(v) || v < 0),
            fc.string(),
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(NaN),
            fc.constant(Infinity),
            fc.constant(-Infinity),
        );

        const validInfoHash = fc.hexaString({ minLength: 40, maxLength: 40 });

        await fc.assert(
            fc.asyncProperty(
                validInfoHash,
                invalidLimitArb,
                invalidLimitArb,
                async (infoHash, dlLimit, ulLimit) => {
                    setupHandlers();
                    const handler = getHandler('torrent:set-speed-limits');
                    expect(handler).toBeDefined();

                    // Pelo menos um dos limites é inválido
                    const response = (await handler!(null, {
                        infoHash,
                        downloadLimit: dlLimit,
                        uploadLimit: ulLimit,
                    })) as Record<string, unknown>;

                    expect(response).toBeDefined();
                    expect(response.success).toBe(false);
                    expect(typeof response.error).toBe('string');
                    expect((response.error as string).length).toBeGreaterThan(0);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('torrent:get-speed-limits rejeita payloads inválidos sem lançar exceção', async () => {
        const invalidPayloadArb = fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.boolean(),
            fc.integer(),
            fc.double(),
            fc.string(),
            fc.array(fc.anything()),
            fc.constant({}),
            fc.constant({ infoHash: '' }),
            fc.constant({ infoHash: 123 }),
            fc.constant({ infoHash: null }),
        );

        await fc.assert(
            fc.asyncProperty(invalidPayloadArb, async (payload) => {
                setupHandlers();
                const handler = getHandler('torrent:get-speed-limits');
                expect(handler).toBeDefined();

                const response = (await handler!(null, payload)) as Record<string, unknown>;

                expect(response).toBeDefined();
                expect(response.success).toBe(false);
                expect(typeof response.error).toBe('string');
                expect((response.error as string).length).toBeGreaterThan(0);
            }),
            { numRuns: 100 },
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
    const infoHashArb = fc.hexaString({ minLength: 40, maxLength: 40 }).map((s) => s.toLowerCase());

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
        .chain((hashes) =>
            hashes.length === 0
                ? fc.constant([])
                : fc
                    .tuple(...hashes.map((h) => downloadItemArb(h)))
                    .map((items) => items as DownloadItem[]),
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
                attachWindowEvents(downloadManager, torrentEngine, mockWindow);

                // ── Act ──────────────────────────────────────────────────────
                // Advance the timer by 1 second to trigger the progress interval
                jest.advanceTimersByTime(1000);

                // ── Assert ───────────────────────────────────────────────────
                // The progress event should have been sent
                const sendCalls = mockWebContents.send.mock.calls.filter(
                    (call: unknown[]) => call[0] === 'torrent:progress',
                );
                expect(sendCalls.length).toBe(1);

                const payload = sendCalls[0][1] as DownloadItem[];

                // Extract active items from the original items array
                const expectedActiveHashes = new Set(
                    items
                        .filter((item) => ACTIVE_STATUSES.has(item.status))
                        .map((item) => item.infoHash),
                );

                // Extract active items from the payload
                const payloadActiveHashes = new Set(
                    payload
                        .filter((item) => ACTIVE_STATUSES.has(item.status))
                        .map((item) => item.infoHash),
                );

                // The active infoHashes in the payload must match exactly
                expect(payloadActiveHashes).toEqual(expectedActiveHashes);

                // Clean up: clear the interval by triggering the 'closed' callback
                const closedCallback = mockWindow.on.mock.calls.find(
                    (call: unknown[]) => call[0] === 'closed',
                );
                if (closedCallback) {
                    (closedCallback[1] as () => void)();
                }
            }),
            { numRuns: 100 },
        );
    });
});

// ─── Property 8 — Payloads inválidos retornam { success: false } sem exceção ──
// Feature: tracker-management, Property 8: IPC retorna erro para payloads inválidos
// **Validates: Requirements 8.2**

describe('Property 8: payloads inválidos retornam { success: false } sem lançar exceção', () => {
    // Canais de tracker que exigem payload com campos específicos
    const TRACKER_CHANNELS_WITH_INFOHASH = [
        'tracker:get',
        'tracker:apply-global',
    ];

    const TRACKER_CHANNELS_WITH_INFOHASH_AND_URL = [
        'tracker:add',
        'tracker:remove',
    ];

    const TRACKER_CHANNELS_WITH_URL = [
        'tracker:add-global',
        'tracker:remove-global',
    ];

    const ALL_TRACKER_CHANNELS = [
        ...TRACKER_CHANNELS_WITH_INFOHASH,
        ...TRACKER_CHANNELS_WITH_INFOHASH_AND_URL,
        ...TRACKER_CHANNELS_WITH_URL,
    ];

    function getHandler(
        channel: string,
    ): ((_event: unknown, payload: unknown) => Promise<unknown>) | undefined {
        const call = mockIpcMain.handle.mock.calls.find((c: unknown[]) => c[0] === channel);
        return call
            ? (call[1] as (_event: unknown, payload: unknown) => Promise<unknown>)
            : undefined;
    }

    function setupHandlers() {
        jest.clearAllMocks();

        const downloadManager = makeMockDownloadManager();
        const settingsManager = makeMockSettingsManager();
        const torrentEngine = makeMockTorrentEngine();

        registerIpcHandlers(downloadManager, settingsManager, torrentEngine as any);

        return { downloadManager, settingsManager, torrentEngine };
    }

    // Gerador de payloads inválidos — primitivos, null, arrays, objetos sem campos esperados
    const invalidPayloadArb = fc.oneof(
        fc.constant(null),
        fc.constant(undefined),
        fc.boolean(),
        fc.integer(),
        fc.double(),
        fc.string(),
        fc.array(fc.anything()),
        fc.record({ wrongKey: fc.anything() }),
        fc.constant({}),
    );

    it('qualquer payload inválido enviado a canais de tracker retorna { success: false } sem lançar exceção', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...ALL_TRACKER_CHANNELS),
                invalidPayloadArb,
                async (channel, payload) => {
                    setupHandlers();
                    const handler = getHandler(channel);
                    expect(handler).toBeDefined();

                    // O handler nunca deve lançar exceção
                    const response = (await handler!(null, payload)) as Record<string, unknown>;

                    expect(response).toBeDefined();
                    expect(typeof response).toBe('object');
                    expect(response).not.toBeNull();
                    expect(response.success).toBe(false);
                    expect(typeof response.error).toBe('string');
                    expect((response.error as string).length).toBeGreaterThan(0);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('canais com infoHash rejeitam objetos com infoHash não-string ou vazio', async () => {
        const invalidInfoHashArb = fc.oneof(
            fc.constant({ infoHash: '' }),
            fc.constant({ infoHash: 123 }),
            fc.constant({ infoHash: null }),
            fc.constant({ infoHash: true }),
            fc.constant({ infoHash: undefined }),
            fc.constant({}),
        );

        const channelsWithInfoHash = [
            ...TRACKER_CHANNELS_WITH_INFOHASH,
            ...TRACKER_CHANNELS_WITH_INFOHASH_AND_URL,
        ];

        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...channelsWithInfoHash),
                invalidInfoHashArb,
                async (channel, payload) => {
                    setupHandlers();
                    const handler = getHandler(channel);
                    expect(handler).toBeDefined();

                    const response = (await handler!(null, payload)) as Record<string, unknown>;

                    expect(response.success).toBe(false);
                    expect(typeof response.error).toBe('string');
                },
            ),
            { numRuns: 50 },
        );
    });

    it('canais com url rejeitam objetos com url não-string ou vazia', async () => {
        const invalidUrlPayloadArb = fc.oneof(
            fc.constant({ url: '' }),
            fc.constant({ url: 123 }),
            fc.constant({ url: null }),
            fc.constant({ url: true }),
            fc.constant({ url: undefined }),
            fc.constant({}),
        );

        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...TRACKER_CHANNELS_WITH_URL),
                invalidUrlPayloadArb,
                async (channel, payload) => {
                    setupHandlers();
                    const handler = getHandler(channel);
                    expect(handler).toBeDefined();

                    const response = (await handler!(null, payload)) as Record<string, unknown>;

                    expect(response.success).toBe(false);
                    expect(typeof response.error).toBe('string');
                },
            ),
            { numRuns: 50 },
        );
    });
});

// ─── Tests: Validação de booleanos de rede no handler settings:set (Task 5.5) ─

describe('registerIpcHandlers — validação de dhtEnabled/pexEnabled/utpEnabled no settings:set', () => {
    function getHandler(
        channel: string,
    ): ((_event: unknown, payload: unknown) => Promise<unknown>) | undefined {
        const call = mockIpcMain.handle.mock.calls.find((c: unknown[]) => c[0] === channel);
        return call
            ? (call[1] as (_event: unknown, payload: unknown) => Promise<unknown>)
            : undefined;
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('rejeita dhtEnabled não-booleano (número)', async () => {
        const dm = makeMockDownloadManager();
        const sm = makeMockSettingsManager();
        registerIpcHandlers(dm, sm);

        const handler = getHandler('settings:set')!;
        const response = (await handler(null, { dhtEnabled: 1 })) as any;

        expect(response.success).toBe(false);
        expect(response.error).toBe(ErrorCodes.INVALID_PARAMS);
    });

    it('rejeita pexEnabled não-booleano (string)', async () => {
        const dm = makeMockDownloadManager();
        const sm = makeMockSettingsManager();
        registerIpcHandlers(dm, sm);

        const handler = getHandler('settings:set')!;
        const response = (await handler(null, { pexEnabled: 'true' })) as any;

        expect(response.success).toBe(false);
        expect(response.error).toBe(ErrorCodes.INVALID_PARAMS);
    });

    it('rejeita utpEnabled não-booleano (null)', async () => {
        const dm = makeMockDownloadManager();
        const sm = makeMockSettingsManager();
        registerIpcHandlers(dm, sm);

        const handler = getHandler('settings:set')!;
        const response = (await handler(null, { utpEnabled: null })) as any;

        expect(response.success).toBe(false);
        expect(response.error).toBe(ErrorCodes.INVALID_PARAMS);
    });

    it('aceita dhtEnabled booleano true', async () => {
        const dm = makeMockDownloadManager();
        const sm = makeMockSettingsManager();
        registerIpcHandlers(dm, sm);

        const handler = getHandler('settings:set')!;
        const response = (await handler(null, { dhtEnabled: true })) as any;

        expect(response.success).toBe(true);
    });

    it('aceita pexEnabled booleano false', async () => {
        const dm = makeMockDownloadManager();
        const sm = makeMockSettingsManager();
        registerIpcHandlers(dm, sm);

        const handler = getHandler('settings:set')!;
        const response = (await handler(null, { pexEnabled: false })) as any;

        expect(response.success).toBe(true);
    });

    it('aceita utpEnabled booleano false', async () => {
        const dm = makeMockDownloadManager();
        const sm = makeMockSettingsManager();
        registerIpcHandlers(dm, sm);

        const handler = getHandler('settings:set')!;
        const response = (await handler(null, { utpEnabled: false })) as any;

        expect(response.success).toBe(true);
    });

    it('não persiste configurações quando validação falha', async () => {
        const dm = makeMockDownloadManager();
        const sm = makeMockSettingsManager();
        registerIpcHandlers(dm, sm);

        const handler = getHandler('settings:set')!;
        await handler(null, { dhtEnabled: 'invalid' });

        expect(sm.set).not.toHaveBeenCalled();
    });
});

// ─── Tests: Detecção de mudança e acionamento de restart (Task 5.6) ───────────

describe('registerIpcHandlers — detecção de mudança de rede e restart', () => {
    function getHandler(
        channel: string,
    ): ((_event: unknown, payload: unknown) => Promise<unknown>) | undefined {
        const call = mockIpcMain.handle.mock.calls.find((c: unknown[]) => c[0] === channel);
        return call
            ? (call[1] as (_event: unknown, payload: unknown) => Promise<unknown>)
            : undefined;
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('aciona restart quando dhtEnabled muda de true para false', async () => {
        const dm = makeMockDownloadManager();
        const sm = makeMockSettingsManager();
        const te = makeMockTorrentEngine();
        (te as any).restart = jest.fn().mockResolvedValue(undefined);
        (te as any).isRestarting = jest.fn().mockReturnValue(false);

        // Configurações atuais: dhtEnabled = true
        (sm.get as jest.Mock).mockReturnValue({
            destinationFolder: '/downloads',
            downloadSpeedLimit: 0,
            uploadSpeedLimit: 0,
            maxConcurrentDownloads: 3,
            notificationsEnabled: true,
            theme: 'vs-code-dark',
            locale: 'pt-BR',
            globalTrackers: [],
            autoApplyGlobalTrackers: false,
            dhtEnabled: true,
            pexEnabled: true,
            utpEnabled: true,
        });

        registerIpcHandlers(dm, sm, te as any);

        const handler = getHandler('settings:set')!;
        await handler(null, { dhtEnabled: false });

        expect((te as any).restart).toHaveBeenCalledTimes(1);
    });

    it('aciona restart quando pexEnabled muda', async () => {
        const dm = makeMockDownloadManager();
        const sm = makeMockSettingsManager();
        const te = makeMockTorrentEngine();
        (te as any).restart = jest.fn().mockResolvedValue(undefined);
        (te as any).isRestarting = jest.fn().mockReturnValue(false);

        (sm.get as jest.Mock).mockReturnValue({
            destinationFolder: '/downloads',
            downloadSpeedLimit: 0,
            uploadSpeedLimit: 0,
            maxConcurrentDownloads: 3,
            notificationsEnabled: true,
            theme: 'vs-code-dark',
            locale: 'pt-BR',
            globalTrackers: [],
            autoApplyGlobalTrackers: false,
            dhtEnabled: true,
            pexEnabled: true,
            utpEnabled: true,
        });

        registerIpcHandlers(dm, sm, te as any);

        const handler = getHandler('settings:set')!;
        await handler(null, { pexEnabled: false });

        expect((te as any).restart).toHaveBeenCalledTimes(1);
    });

    it('aciona restart quando utpEnabled muda', async () => {
        const dm = makeMockDownloadManager();
        const sm = makeMockSettingsManager();
        const te = makeMockTorrentEngine();
        (te as any).restart = jest.fn().mockResolvedValue(undefined);
        (te as any).isRestarting = jest.fn().mockReturnValue(false);

        (sm.get as jest.Mock).mockReturnValue({
            destinationFolder: '/downloads',
            downloadSpeedLimit: 0,
            uploadSpeedLimit: 0,
            maxConcurrentDownloads: 3,
            notificationsEnabled: true,
            theme: 'vs-code-dark',
            locale: 'pt-BR',
            globalTrackers: [],
            autoApplyGlobalTrackers: false,
            dhtEnabled: true,
            pexEnabled: true,
            utpEnabled: true,
        });

        registerIpcHandlers(dm, sm, te as any);

        const handler = getHandler('settings:set')!;
        await handler(null, { utpEnabled: false });

        expect((te as any).restart).toHaveBeenCalledTimes(1);
    });

    it('NÃO aciona restart quando valores de rede não mudam', async () => {
        const dm = makeMockDownloadManager();
        const sm = makeMockSettingsManager();
        const te = makeMockTorrentEngine();
        (te as any).restart = jest.fn().mockResolvedValue(undefined);
        (te as any).isRestarting = jest.fn().mockReturnValue(false);

        // Configurações atuais: todos true
        (sm.get as jest.Mock).mockReturnValue({
            destinationFolder: '/downloads',
            downloadSpeedLimit: 0,
            uploadSpeedLimit: 0,
            maxConcurrentDownloads: 3,
            notificationsEnabled: true,
            theme: 'vs-code-dark',
            locale: 'pt-BR',
            globalTrackers: [],
            autoApplyGlobalTrackers: false,
            dhtEnabled: true,
            pexEnabled: true,
            utpEnabled: true,
        });

        registerIpcHandlers(dm, sm, te as any);

        const handler = getHandler('settings:set')!;
        // Enviar os mesmos valores — não deve acionar restart
        await handler(null, { dhtEnabled: true, pexEnabled: true, utpEnabled: true });

        expect((te as any).restart).not.toHaveBeenCalled();
    });

    it('NÃO aciona restart quando apenas configurações não-rede mudam', async () => {
        const dm = makeMockDownloadManager();
        const sm = makeMockSettingsManager();
        const te = makeMockTorrentEngine();
        (te as any).restart = jest.fn().mockResolvedValue(undefined);
        (te as any).isRestarting = jest.fn().mockReturnValue(false);

        (sm.get as jest.Mock).mockReturnValue({
            destinationFolder: '/downloads',
            downloadSpeedLimit: 0,
            uploadSpeedLimit: 0,
            maxConcurrentDownloads: 3,
            notificationsEnabled: true,
            theme: 'vs-code-dark',
            locale: 'pt-BR',
            globalTrackers: [],
            autoApplyGlobalTrackers: false,
            dhtEnabled: true,
            pexEnabled: true,
            utpEnabled: true,
        });

        registerIpcHandlers(dm, sm, te as any);

        const handler = getHandler('settings:set')!;
        await handler(null, { downloadSpeedLimit: 500 });

        expect((te as any).restart).not.toHaveBeenCalled();
    });

    it('passa configurações atualizadas ao restart', async () => {
        const dm = makeMockDownloadManager();
        const sm = makeMockSettingsManager();
        const te = makeMockTorrentEngine();
        (te as any).restart = jest.fn().mockResolvedValue(undefined);
        (te as any).isRestarting = jest.fn().mockReturnValue(false);

        // Primeira chamada a get() retorna valores anteriores (antes de set)
        // Segunda chamada retorna valores atualizados (após set)
        let callCount = 0;
        (sm.get as jest.Mock).mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                return {
                    destinationFolder: '/downloads',
                    downloadSpeedLimit: 0,
                    uploadSpeedLimit: 0,
                    maxConcurrentDownloads: 3,
                    notificationsEnabled: true,
                    theme: 'vs-code-dark',
                    locale: 'pt-BR',
                    globalTrackers: [],
                    autoApplyGlobalTrackers: false,
                    dhtEnabled: true,
                    pexEnabled: true,
                    utpEnabled: true,
                };
            }
            return {
                destinationFolder: '/downloads',
                downloadSpeedLimit: 0,
                uploadSpeedLimit: 0,
                maxConcurrentDownloads: 3,
                notificationsEnabled: true,
                theme: 'vs-code-dark',
                locale: 'pt-BR',
                globalTrackers: [],
                autoApplyGlobalTrackers: false,
                dhtEnabled: false,
                pexEnabled: true,
                utpEnabled: true,
            };
        });

        registerIpcHandlers(dm, sm, te as any);

        const handler = getHandler('settings:set')!;
        await handler(null, { dhtEnabled: false });

        expect((te as any).restart).toHaveBeenCalledWith({
            downloadPath: '/downloads',
            downloadSpeedLimit: 0,
            uploadSpeedLimit: 0,
            dhtEnabled: false,
            pexEnabled: true,
            utpEnabled: true,
        });
    });

    it('NÃO aciona restart quando torrentEngine não está disponível', async () => {
        const dm = makeMockDownloadManager();
        const sm = makeMockSettingsManager();

        (sm.get as jest.Mock).mockReturnValue({
            destinationFolder: '/downloads',
            downloadSpeedLimit: 0,
            uploadSpeedLimit: 0,
            maxConcurrentDownloads: 3,
            notificationsEnabled: true,
            theme: 'vs-code-dark',
            locale: 'pt-BR',
            globalTrackers: [],
            autoApplyGlobalTrackers: false,
            dhtEnabled: true,
            pexEnabled: true,
            utpEnabled: true,
        });

        // Registrar sem torrentEngine
        registerIpcHandlers(dm, sm);

        const handler = getHandler('settings:set')!;
        // Não deve lançar exceção mesmo sem torrentEngine
        const response = (await handler(null, { dhtEnabled: false })) as any;

        expect(response.success).toBe(true);
    });
});

// ─── Tests: Rejeição de operações durante restart (Task 5.7) ──────────────────

describe('registerIpcHandlers — rejeição de operações durante restart do motor', () => {
    function getHandler(
        channel: string,
    ): ((_event: unknown, payload: unknown) => Promise<unknown>) | undefined {
        const call = mockIpcMain.handle.mock.calls.find((c: unknown[]) => c[0] === channel);
        return call
            ? (call[1] as (_event: unknown, payload: unknown) => Promise<unknown>)
            : undefined;
    }

    const GUARDED_CHANNELS = [
        'torrent:add-file',
        'torrent:add-magnet',
        'torrent:pause',
        'torrent:resume',
        'torrent:remove',
    ];

    // Payloads válidos para cada canal (para garantir que a rejeição vem da guarda, não da validação)
    const VALID_PAYLOADS: Record<string, unknown> = {
        'torrent:add-file': { filePath: '/path/to/file.torrent' },
        'torrent:add-magnet': { magnetUri: 'magnet:?xt=urn:btih:' + 'a'.repeat(40) },
        'torrent:pause': { infoHash: 'a'.repeat(40) },
        'torrent:resume': { infoHash: 'a'.repeat(40) },
        'torrent:remove': { infoHash: 'a'.repeat(40), deleteFiles: false },
    };

    it.each(GUARDED_CHANNELS)(
        '%s retorna erro quando motor está reiniciando',
        async (channel) => {
            jest.clearAllMocks();

            const dm = makeMockDownloadManager();
            const sm = makeMockSettingsManager();
            const te = makeMockTorrentEngine();
            (te as any).restart = jest.fn().mockResolvedValue(undefined);
            (te as any).isRestarting = jest.fn().mockReturnValue(true);

            registerIpcHandlers(dm, sm, te as any);

            const handler = getHandler(channel)!;
            const response = (await handler(null, VALID_PAYLOADS[channel])) as any;

            expect(response.success).toBe(false);
            expect(response.error).toBe(ErrorCodes.ENGINE_RESTARTING);
        },
    );

    it.each(GUARDED_CHANNELS)(
        '%s permite operação quando motor NÃO está reiniciando',
        async (channel) => {
            jest.clearAllMocks();

            const dm = makeMockDownloadManager();
            const sm = makeMockSettingsManager();
            const te = makeMockTorrentEngine();
            (te as any).restart = jest.fn().mockResolvedValue(undefined);
            (te as any).isRestarting = jest.fn().mockReturnValue(false);

            // Configurar mocks para que as operações não falhem por outros motivos
            (dm.addTorrentFile as jest.Mock).mockResolvedValue({
                infoHash: 'a'.repeat(40),
                name: 'test',
                status: 'downloading',
            });
            (dm.addMagnetLink as jest.Mock).mockResolvedValue({
                infoHash: 'a'.repeat(40),
                name: 'test',
                status: 'resolving-metadata',
            });

            registerIpcHandlers(dm, sm, te as any);

            const handler = getHandler(channel)!;
            const response = (await handler(null, VALID_PAYLOADS[channel])) as any;

            // Não deve conter a mensagem de reinício
            if (!response.success) {
                expect(response.error).not.toContain('reiniciando');
            }
        },
    );

    it('torrent:get-all NÃO é bloqueado durante restart', async () => {
        jest.clearAllMocks();

        const dm = makeMockDownloadManager();
        const sm = makeMockSettingsManager();
        const te = makeMockTorrentEngine();
        (te as any).restart = jest.fn().mockResolvedValue(undefined);
        (te as any).isRestarting = jest.fn().mockReturnValue(true);

        registerIpcHandlers(dm, sm, te as any);

        const handler = getHandler('torrent:get-all')!;
        const response = (await handler(null, undefined)) as any;

        // get-all deve funcionar mesmo durante restart
        expect(response.success).toBe(true);
    });
});

// ─── PBT: Propriedade 2 — Reinício acionado somente quando valores de rede mudam (Task 5.8) ──
// Feature: dht-pex-settings, Property 2: Reinício acionado somente quando valores de rede mudam
// **Validates: Requirements 6.3**

describe('Property 2: Reinício acionado somente quando valores de rede mudam', () => {
    function getHandler(
        channel: string,
    ): ((_event: unknown, payload: unknown) => Promise<unknown>) | undefined {
        const call = mockIpcMain.handle.mock.calls.find((c: unknown[]) => c[0] === channel);
        return call
            ? (call[1] as (_event: unknown, payload: unknown) => Promise<unknown>)
            : undefined;
    }

    it('restart é acionado se e somente se pelo menos um campo de rede difere', async () => {
        const networkSettingsArb = fc.record({
            dhtEnabled: fc.boolean(),
            pexEnabled: fc.boolean(),
            utpEnabled: fc.boolean(),
        });

        await fc.assert(
            fc.asyncProperty(
                networkSettingsArb,
                networkSettingsArb,
                async (previous, next) => {
                    jest.clearAllMocks();

                    const dm = makeMockDownloadManager();
                    const sm = makeMockSettingsManager();
                    const te = makeMockTorrentEngine();
                    (te as any).restart = jest.fn().mockResolvedValue(undefined);
                    (te as any).isRestarting = jest.fn().mockReturnValue(false);

                    // Configurar settingsManager.get() para retornar os valores "anteriores"
                    (sm.get as jest.Mock).mockReturnValue({
                        destinationFolder: '/downloads',
                        downloadSpeedLimit: 0,
                        uploadSpeedLimit: 0,
                        maxConcurrentDownloads: 3,
                        notificationsEnabled: true,
                        theme: 'vs-code-dark',
                        locale: 'pt-BR',
                        globalTrackers: [],
                        autoApplyGlobalTrackers: false,
                        dhtEnabled: previous.dhtEnabled,
                        pexEnabled: previous.pexEnabled,
                        utpEnabled: previous.utpEnabled,
                    });

                    registerIpcHandlers(dm, sm, te as any);

                    const handler = getHandler('settings:set')!;
                    await handler(null, {
                        dhtEnabled: next.dhtEnabled,
                        pexEnabled: next.pexEnabled,
                        utpEnabled: next.utpEnabled,
                    });

                    // Calcular se pelo menos um campo de rede difere
                    const shouldRestart =
                        previous.dhtEnabled !== next.dhtEnabled ||
                        previous.pexEnabled !== next.pexEnabled ||
                        previous.utpEnabled !== next.utpEnabled;

                    if (shouldRestart) {
                        expect((te as any).restart).toHaveBeenCalledTimes(1);
                    } else {
                        expect((te as any).restart).not.toHaveBeenCalled();
                    }
                },
            ),
            { numRuns: 200 },
        );
    });
});
