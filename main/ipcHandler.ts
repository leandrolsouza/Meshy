import { ipcMain, dialog, BrowserWindow } from 'electron';
import type { DownloadManager } from './downloadManager';
import type { SettingsManager } from './settingsManager';
import type { TorrentEngine } from './torrentEngine';
import type {
    DownloadItem,
    AppSettings,
    IPCResponse,
    TorrentFileInfo,
    TrackerInfo,
} from '../shared/types';
import { isValidSpeedLimit } from './validators';
import { isValidTrackerUrl } from '../shared/validators';
import { ErrorCodes } from '../shared/errorCodes';
import { logger } from './logger';
import {
    validatePayload,
    infoHashSchema,
    infoHashUrlSchema,
    urlSchema,
} from './payloadValidator';
import { validateSettingsPayload } from './settingsValidator';

export type { IPCResponse } from '../shared/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok<T>(data: T): IPCResponse<T> {
    return { success: true, data };
}

function fail(error: string): IPCResponse<never> {
    return { success: false, error };
}

function failWithLog(channel: string, err: unknown): IPCResponse<never> {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[IPC] ${channel} failed:`, message);
    return { success: false, error: message };
}

// ─── Handler registration ─────────────────────────────────────────────────────

/**
 * Sets up per-window resources: the 1-second progress interval and
 * error forwarding from the TorrentEngine to the renderer.
 *
 * Call this for each new BrowserWindow. The interval is automatically
 * cleared when the window is closed.
 */
export function attachWindowEvents(
    downloadManager: DownloadManager,
    torrentEngine: TorrentEngine,
    mainWindow: BrowserWindow,
): void {
    // ── Progress interval (1 s) ───────────────────────────────────────────────
    const progressInterval = setInterval(() => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('torrent:progress', downloadManager.getAll());
        }
    }, 1000);

    mainWindow.on('closed', () => {
        clearInterval(progressInterval);
    });

    // ── TorrentEngine error forwarding ────────────────────────────────────────
    const errorListener = (infoHash: string, err: Error) => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('torrent:error', { infoHash, message: err.message });
        }
    };
    torrentEngine.on('error', errorListener);

    mainWindow.on('closed', () => {
        torrentEngine.removeListener('error', errorListener);
    });
}

/**
 * Registers all IPC handlers for the Meshy application.
 *
 * IMPORTANT: Call this only ONCE during the app lifecycle. IPC handlers
 * registered via `ipcMain.handle` are global — calling this a second time
 * will throw because the channels are already registered.
 *
 * For per-window setup (progress interval, error forwarding), use
 * `attachWindowEvents` instead.
 *
 * Each handler:
 * - Validates its input payload via `validatePayload` and returns `{ success: false, error }` for invalid payloads.
 * - Wraps all logic in try/catch, never throwing an unhandled exception.
 * - Returns a typed `IPCResponse<T>`.
 */
export function registerIpcHandlers(
    downloadManager: DownloadManager,
    settingsManager: SettingsManager,
    torrentEngine?: TorrentEngine,
): void {
    // ── torrent:add-file ──────────────────────────────────────────────────────
    ipcMain.handle(
        'torrent:add-file',
        async (_event, payload: unknown): Promise<IPCResponse<DownloadItem>> => {
            try {
                if (torrentEngine?.isRestarting()) {
                    return fail(ErrorCodes.ENGINE_RESTARTING);
                }

                const result = validatePayload<{ filePath: string }>(payload, {
                    filePath: { type: 'string', nonEmpty: true },
                });
                if (!result.valid) return fail(ErrorCodes.INVALID_FILE_PATH);

                const item = await downloadManager.addTorrentFile(result.data.filePath);
                return ok(item);
            } catch (err) {
                return failWithLog('torrent:add-file', err);
            }
        },
    );

    // ── torrent:add-magnet ────────────────────────────────────────────────────
    ipcMain.handle(
        'torrent:add-magnet',
        async (_event, payload: unknown): Promise<IPCResponse<DownloadItem>> => {
            try {
                if (torrentEngine?.isRestarting()) {
                    return fail(ErrorCodes.ENGINE_RESTARTING);
                }

                const result = validatePayload<{ magnetUri: string }>(payload, {
                    magnetUri: { type: 'string', nonEmpty: true },
                });
                if (!result.valid) return fail(ErrorCodes.INVALID_MAGNET_URI);

                const item = await downloadManager.addMagnetLink(result.data.magnetUri);
                return ok(item);
            } catch (err) {
                return failWithLog('torrent:add-magnet', err);
            }
        },
    );

    // ── torrent:pause ─────────────────────────────────────────────────────────
    ipcMain.handle(
        'torrent:pause',
        async (_event, payload: unknown): Promise<IPCResponse<void>> => {
            try {
                if (torrentEngine?.isRestarting()) {
                    return fail(ErrorCodes.ENGINE_RESTARTING);
                }

                const result = validatePayload<{ infoHash: string }>(payload, infoHashSchema);
                if (!result.valid) return fail(ErrorCodes.INVALID_PARAMS);

                await downloadManager.pause(result.data.infoHash);
                return ok(undefined);
            } catch (err) {
                return failWithLog('torrent:pause', err);
            }
        },
    );

    // ── torrent:resume ────────────────────────────────────────────────────────
    ipcMain.handle(
        'torrent:resume',
        async (_event, payload: unknown): Promise<IPCResponse<void>> => {
            try {
                if (torrentEngine?.isRestarting()) {
                    return fail(ErrorCodes.ENGINE_RESTARTING);
                }

                const result = validatePayload<{ infoHash: string }>(payload, infoHashSchema);
                if (!result.valid) return fail(ErrorCodes.INVALID_PARAMS);

                await downloadManager.resume(result.data.infoHash);
                return ok(undefined);
            } catch (err) {
                return failWithLog('torrent:resume', err);
            }
        },
    );

    // ── torrent:remove ────────────────────────────────────────────────────────
    ipcMain.handle(
        'torrent:remove',
        async (_event, payload: unknown): Promise<IPCResponse<void>> => {
            try {
                if (torrentEngine?.isRestarting()) {
                    return fail(ErrorCodes.ENGINE_RESTARTING);
                }

                const result = validatePayload<{ infoHash: string; deleteFiles: boolean }>(
                    payload,
                    {
                        infoHash: { type: 'string', nonEmpty: true },
                        deleteFiles: { type: 'boolean' },
                    },
                );
                if (!result.valid) return fail(ErrorCodes.INVALID_PARAMS);

                await downloadManager.remove(result.data.infoHash, result.data.deleteFiles);
                return ok(undefined);
            } catch (err) {
                return failWithLog('torrent:remove', err);
            }
        },
    );

    // ── torrent:get-all ───────────────────────────────────────────────────────
    ipcMain.handle('torrent:get-all', async (_event): Promise<IPCResponse<DownloadItem[]>> => {
        try {
            const items = downloadManager.getAll();
            return ok(items);
        } catch (err) {
            return failWithLog('torrent:get-all', err);
        }
    });

    // ── settings:get ──────────────────────────────────────────────────────────
    ipcMain.handle('settings:get', async (_event): Promise<IPCResponse<AppSettings>> => {
        try {
            const settings = settingsManager.get();
            return ok(settings);
        } catch (err) {
            return failWithLog('settings:get', err);
        }
    });

    // ── settings:set ──────────────────────────────────────────────────────────
    ipcMain.handle(
        'settings:set',
        async (_event, payload: unknown): Promise<IPCResponse<AppSettings>> => {
            try {
                if (typeof payload !== 'object' || payload === null) {
                    return fail(ErrorCodes.INVALID_SETTINGS_PAYLOAD);
                }

                const partial = payload as Partial<AppSettings>;

                // Validação declarativa de todos os campos
                const validationError = validateSettingsPayload(partial);
                if (validationError) {
                    return fail(validationError);
                }

                // Capturar configurações anteriores ANTES de persistir (para detecção de mudança)
                const previousSettings = settingsManager.get();

                settingsManager.set(partial);

                // Notificar o downloadManager sobre a mudança no limite de downloads simultâneos
                if (partial.maxConcurrentDownloads !== undefined) {
                    downloadManager.setMaxConcurrentDownloads(partial.maxConcurrentDownloads);
                }

                // Recalcular limites efetivos ao alterar limites globais de velocidade
                if (
                    partial.downloadSpeedLimit !== undefined ||
                    partial.uploadSpeedLimit !== undefined
                ) {
                    downloadManager.onGlobalSpeedLimitChanged();
                }

                // Verificar se configurações de rede mudaram e acionar restart
                const networkChanged =
                    (partial.dhtEnabled !== undefined &&
                        partial.dhtEnabled !== previousSettings.dhtEnabled) ||
                    (partial.pexEnabled !== undefined &&
                        partial.pexEnabled !== previousSettings.pexEnabled) ||
                    (partial.utpEnabled !== undefined &&
                        partial.utpEnabled !== previousSettings.utpEnabled);

                if (networkChanged && torrentEngine) {
                    const currentSettings = settingsManager.get();
                    await torrentEngine.restart({
                        downloadPath: currentSettings.destinationFolder,
                        downloadSpeedLimit: currentSettings.downloadSpeedLimit,
                        uploadSpeedLimit: currentSettings.uploadSpeedLimit,
                        dhtEnabled: currentSettings.dhtEnabled,
                        pexEnabled: currentSettings.pexEnabled,
                        utpEnabled: currentSettings.utpEnabled,
                    });
                }

                const updated = settingsManager.get();
                return ok(updated);
            } catch (err) {
                return failWithLog('settings:set', err);
            }
        },
    );

    // ── settings:select-folder ────────────────────────────────────────────────
    ipcMain.handle('settings:select-folder', async (_event): Promise<IPCResponse<string>> => {
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory'],
            });

            if (result.canceled || result.filePaths.length === 0) {
                return fail(ErrorCodes.NO_FOLDER_SELECTED);
            }

            return ok(result.filePaths[0]);
        } catch (err) {
            return failWithLog('settings:select-folder', err);
        }
    });

    // ── torrent:get-files ─────────────────────────────────────────────────────
    ipcMain.handle(
        'torrent:get-files',
        async (_event, payload: unknown): Promise<IPCResponse<TorrentFileInfo[]>> => {
            try {
                const result = validatePayload<{ infoHash: string }>(payload, infoHashSchema);
                if (!result.valid) return fail(ErrorCodes.INVALID_PARAMS);

                const { infoHash } = result.data;

                // Check if torrent exists in the download manager
                const allItems = downloadManager.getAll();
                const item = allItems.find((i) => i.infoHash === infoHash);

                if (!item) {
                    return fail(ErrorCodes.TORRENT_NOT_FOUND);
                }

                // If torrent is resolving metadata, return empty array
                if (item.status === 'resolving-metadata') {
                    return ok([]);
                }

                if (!torrentEngine) {
                    return fail(ErrorCodes.ENGINE_NOT_AVAILABLE);
                }

                const files = torrentEngine.getFiles(infoHash);
                return ok(files);
            } catch (err) {
                return failWithLog('torrent:get-files', err);
            }
        },
    );

    // ── torrent:set-file-selection ────────────────────────────────────────────
    ipcMain.handle(
        'torrent:set-file-selection',
        async (_event, payload: unknown): Promise<IPCResponse<TorrentFileInfo[]>> => {
            try {
                const result = validatePayload<{ infoHash: string }>(payload, infoHashSchema);
                if (!result.valid) return fail(ErrorCodes.INVALID_PARAMS);

                const { infoHash } = result.data;
                const rawIndices = (payload as Record<string, unknown>).selectedIndices;

                // Validate selectedIndices is a non-empty array of non-negative integers
                if (!Array.isArray(rawIndices) || rawIndices.length === 0) {
                    return fail(ErrorCodes.FILE_SELECTION_EMPTY);
                }

                for (const idx of rawIndices) {
                    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0) {
                        return fail(ErrorCodes.FILE_INDEX_INVALID);
                    }
                }

                const selectedIndices = rawIndices as number[];

                // Check if torrent exists
                const allItems = downloadManager.getAll();
                const item = allItems.find((i) => i.infoHash === infoHash);

                if (!item) {
                    return fail(ErrorCodes.TORRENT_NOT_FOUND);
                }

                if (!torrentEngine) {
                    return fail(ErrorCodes.ENGINE_NOT_AVAILABLE);
                }

                // Validate indices are within range by getting file count first
                const currentFiles = torrentEngine.getFiles(infoHash);
                const totalFiles = currentFiles.length;

                for (const idx of selectedIndices) {
                    if (idx >= totalFiles) {
                        return fail(ErrorCodes.FILE_INDEX_INVALID);
                    }
                }

                const updatedFiles = torrentEngine.setFileSelection(infoHash, selectedIndices);
                return ok(updatedFiles);
            } catch (err) {
                return failWithLog('torrent:set-file-selection', err);
            }
        },
    );

    // ── torrent:set-speed-limits ──────────────────────────────────────────────
    ipcMain.handle(
        'torrent:set-speed-limits',
        async (_event, payload: unknown): Promise<IPCResponse<DownloadItem>> => {
            try {
                const result = validatePayload<{
                    infoHash: string;
                    downloadLimit: number;
                    uploadLimit: number;
                }>(payload, {
                    infoHash: { type: 'string', nonEmpty: true },
                    downloadLimit: { type: 'number' },
                    uploadLimit: { type: 'number' },
                });
                if (!result.valid) return fail(ErrorCodes.INVALID_PARAMS);

                const { infoHash, downloadLimit, uploadLimit } = result.data;

                // Validação específica de speed limits com código de erro dedicado
                if (!isValidSpeedLimit(downloadLimit)) {
                    return fail(ErrorCodes.INVALID_SPEED_LIMIT);
                }
                if (!isValidSpeedLimit(uploadLimit)) {
                    return fail(ErrorCodes.INVALID_SPEED_LIMIT);
                }

                const item = downloadManager.setTorrentSpeedLimits(
                    infoHash,
                    downloadLimit,
                    uploadLimit,
                );
                return ok(item);
            } catch (err) {
                return failWithLog('torrent:set-speed-limits', err);
            }
        },
    );

    // ── torrent:get-speed-limits ──────────────────────────────────────────────
    ipcMain.handle(
        'torrent:get-speed-limits',
        async (
            _event,
            payload: unknown,
        ): Promise<
            IPCResponse<{ downloadSpeedLimitKBps: number; uploadSpeedLimitKBps: number }>
        > => {
            try {
                const result = validatePayload<{ infoHash: string }>(payload, infoHashSchema);
                if (!result.valid) return fail(ErrorCodes.INVALID_PARAMS);

                const limits = downloadManager.getTorrentSpeedLimits(result.data.infoHash);
                return ok(limits);
            } catch (err) {
                return failWithLog('torrent:get-speed-limits', err);
            }
        },
    );

    // ── tracker:get ───────────────────────────────────────────────────────────
    ipcMain.handle(
        'tracker:get',
        async (_event, payload: unknown): Promise<IPCResponse<TrackerInfo[]>> => {
            try {
                const result = validatePayload<{ infoHash: string }>(payload, infoHashSchema);
                if (!result.valid) return fail(ErrorCodes.INVALID_PARAMS);

                if (!torrentEngine) {
                    return fail(ErrorCodes.ENGINE_NOT_AVAILABLE);
                }

                const trackers = torrentEngine.getTrackers(result.data.infoHash);
                return ok(trackers);
            } catch (err) {
                return failWithLog('tracker:get', err);
            }
        },
    );

    // ── tracker:add ───────────────────────────────────────────────────────────
    ipcMain.handle(
        'tracker:add',
        async (_event, payload: unknown): Promise<IPCResponse<TrackerInfo[]>> => {
            try {
                const result = validatePayload<{ infoHash: string; url: string }>(
                    payload,
                    infoHashUrlSchema,
                );
                if (!result.valid) return fail(ErrorCodes.INVALID_PARAMS);

                if (!torrentEngine) {
                    return fail(ErrorCodes.ENGINE_NOT_AVAILABLE);
                }

                const { infoHash, url } = result.data;

                if (!isValidTrackerUrl(url)) {
                    return fail(ErrorCodes.INVALID_TRACKER_URL);
                }

                torrentEngine.addTracker(infoHash, url);
                const trackers = torrentEngine.getTrackers(infoHash);
                return ok(trackers);
            } catch (err) {
                return failWithLog('tracker:add', err);
            }
        },
    );

    // ── tracker:remove ────────────────────────────────────────────────────────
    ipcMain.handle(
        'tracker:remove',
        async (_event, payload: unknown): Promise<IPCResponse<TrackerInfo[]>> => {
            try {
                const result = validatePayload<{ infoHash: string; url: string }>(
                    payload,
                    infoHashUrlSchema,
                );
                if (!result.valid) return fail(ErrorCodes.INVALID_PARAMS);

                if (!torrentEngine) {
                    return fail(ErrorCodes.ENGINE_NOT_AVAILABLE);
                }

                const { infoHash, url } = result.data;
                torrentEngine.removeTracker(infoHash, url);
                const trackers = torrentEngine.getTrackers(infoHash);
                return ok(trackers);
            } catch (err) {
                return failWithLog('tracker:remove', err);
            }
        },
    );

    // ── tracker:apply-global ──────────────────────────────────────────────────
    ipcMain.handle(
        'tracker:apply-global',
        async (_event, payload: unknown): Promise<IPCResponse<TrackerInfo[]>> => {
            try {
                const result = validatePayload<{ infoHash: string }>(payload, infoHashSchema);
                if (!result.valid) return fail(ErrorCodes.INVALID_PARAMS);

                if (!torrentEngine) {
                    return fail(ErrorCodes.ENGINE_NOT_AVAILABLE);
                }

                const { infoHash } = result.data;
                const globalTrackers = settingsManager.getGlobalTrackers();

                for (const url of globalTrackers) {
                    try {
                        torrentEngine.addTracker(infoHash, url);
                    } catch {
                        // Silenciosamente ignora erros individuais (ex: duplicatas)
                    }
                }

                const trackers = torrentEngine.getTrackers(infoHash);
                return ok(trackers);
            } catch (err) {
                return failWithLog('tracker:apply-global', err);
            }
        },
    );

    // ── tracker:get-global ────────────────────────────────────────────────────
    ipcMain.handle('tracker:get-global', async (_event): Promise<IPCResponse<string[]>> => {
        try {
            const trackers = settingsManager.getGlobalTrackers();
            return ok(trackers);
        } catch (err) {
            return failWithLog('tracker:get-global', err);
        }
    });

    // ── tracker:add-global ────────────────────────────────────────────────────
    ipcMain.handle(
        'tracker:add-global',
        async (_event, payload: unknown): Promise<IPCResponse<string[]>> => {
            try {
                const result = validatePayload<{ url: string }>(payload, urlSchema);
                if (!result.valid) return fail(ErrorCodes.INVALID_PARAMS);

                const { url } = result.data;

                if (!isValidTrackerUrl(url)) {
                    return fail(ErrorCodes.INVALID_TRACKER_URL);
                }

                settingsManager.addGlobalTracker(url);
                const trackers = settingsManager.getGlobalTrackers();
                return ok(trackers);
            } catch (err) {
                return failWithLog('tracker:add-global', err);
            }
        },
    );

    // ── tracker:remove-global ─────────────────────────────────────────────────
    ipcMain.handle(
        'tracker:remove-global',
        async (_event, payload: unknown): Promise<IPCResponse<string[]>> => {
            try {
                const result = validatePayload<{ url: string }>(payload, urlSchema);
                if (!result.valid) return fail(ErrorCodes.INVALID_PARAMS);

                const { url } = result.data;
                settingsManager.removeGlobalTracker(url);
                const trackers = settingsManager.getGlobalTrackers();
                return ok(trackers);
            } catch (err) {
                return failWithLog('tracker:remove-global', err);
            }
        },
    );
}
