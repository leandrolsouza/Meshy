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
        on: jest.fn(),
    } as unknown as DownloadManager;
}

function makeMockSettingsManager(): SettingsManager {
    return {
        get: jest.fn().mockReturnValue({
            destinationFolder: '/downloads',
            downloadSpeedLimit: 0,
            uploadSpeedLimit: 0,
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
        'settings:get',
        'settings:set',
        'settings:select-folder',
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('registers all 9 expected IPC channels', () => {
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

    it('registers exactly 9 IPC channels (no extra channels)', () => {
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
