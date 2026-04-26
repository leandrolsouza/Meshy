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
import {
    isValidSpeedLimit,
    isValidMaxConcurrentDownloads,
    isValidThemeId,
    isValidNetworkToggle,
} from './validators';
import { isValidTrackerUrl } from '../shared/validators';
import { ErrorCodes } from '../shared/errorCodes';
import { logger } from './logger';

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
 * - Validates its input payload and returns `{ success: false, error }` for invalid payloads.
 * - Wraps all logic in try/catch, never throwing an unhandled exception.
 * - Returns a typed `IPCResponse<T>`.
 */
export function registerIpcHandlers(
    downloadManager: DownloadManager,
    settingsManager: SettingsManager,
    torrentEngine?: TorrentEngine,
): void {
    // ── torrent:add-file ──────────────────────────────────────────────────────
    // payload: { filePath: string }
    ipcMain.handle(
        'torrent:add-file',
        async (_event, payload: unknown): Promise<IPCResponse<DownloadItem>> => {
            try {
                // Guarda contra operações durante reinício do motor
                if (torrentEngine?.isRestarting()) {
                    return fail(ErrorCodes.ENGINE_RESTARTING);
                }

                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    typeof (payload as Record<string, unknown>).filePath !== 'string' ||
                    (payload as Record<string, unknown>).filePath === ''
                ) {
                    return fail(ErrorCodes.INVALID_FILE_PATH);
                }

                const { filePath } = payload as { filePath: string };
                const item = await downloadManager.addTorrentFile(filePath);
                return ok(item);
            } catch (err) {
                return failWithLog('torrent:add-file', err);
            }
        },
    );

    // ── torrent:add-magnet ────────────────────────────────────────────────────
    // payload: { magnetUri: string }
    ipcMain.handle(
        'torrent:add-magnet',
        async (_event, payload: unknown): Promise<IPCResponse<DownloadItem>> => {
            try {
                // Guarda contra operações durante reinício do motor
                if (torrentEngine?.isRestarting()) {
                    return fail(ErrorCodes.ENGINE_RESTARTING);
                }

                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    typeof (payload as Record<string, unknown>).magnetUri !== 'string' ||
                    (payload as Record<string, unknown>).magnetUri === ''
                ) {
                    return fail(ErrorCodes.INVALID_MAGNET_URI);
                }

                const { magnetUri } = payload as { magnetUri: string };
                const item = await downloadManager.addMagnetLink(magnetUri);
                return ok(item);
            } catch (err) {
                return failWithLog('torrent:add-magnet', err);
            }
        },
    );

    // ── torrent:pause ─────────────────────────────────────────────────────────
    // payload: { infoHash: string }
    ipcMain.handle(
        'torrent:pause',
        async (_event, payload: unknown): Promise<IPCResponse<void>> => {
            try {
                // Guarda contra operações durante reinício do motor
                if (torrentEngine?.isRestarting()) {
                    return fail(ErrorCodes.ENGINE_RESTARTING);
                }

                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    typeof (payload as Record<string, unknown>).infoHash !== 'string' ||
                    (payload as Record<string, unknown>).infoHash === ''
                ) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                const { infoHash } = payload as { infoHash: string };
                await downloadManager.pause(infoHash);
                return ok(undefined);
            } catch (err) {
                return failWithLog('torrent:pause', err);
            }
        },
    );

    // ── torrent:resume ────────────────────────────────────────────────────────
    // payload: { infoHash: string }
    ipcMain.handle(
        'torrent:resume',
        async (_event, payload: unknown): Promise<IPCResponse<void>> => {
            try {
                // Guarda contra operações durante reinício do motor
                if (torrentEngine?.isRestarting()) {
                    return fail(ErrorCodes.ENGINE_RESTARTING);
                }

                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    typeof (payload as Record<string, unknown>).infoHash !== 'string' ||
                    (payload as Record<string, unknown>).infoHash === ''
                ) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                const { infoHash } = payload as { infoHash: string };
                await downloadManager.resume(infoHash);
                return ok(undefined);
            } catch (err) {
                return failWithLog('torrent:resume', err);
            }
        },
    );

    // ── torrent:remove ────────────────────────────────────────────────────────
    // payload: { infoHash: string; deleteFiles: boolean }
    ipcMain.handle(
        'torrent:remove',
        async (_event, payload: unknown): Promise<IPCResponse<void>> => {
            try {
                // Guarda contra operações durante reinício do motor
                if (torrentEngine?.isRestarting()) {
                    return fail(ErrorCodes.ENGINE_RESTARTING);
                }

                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    typeof (payload as Record<string, unknown>).infoHash !== 'string' ||
                    (payload as Record<string, unknown>).infoHash === '' ||
                    typeof (payload as Record<string, unknown>).deleteFiles !== 'boolean'
                ) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                const { infoHash, deleteFiles } = payload as {
                    infoHash: string;
                    deleteFiles: boolean;
                };
                await downloadManager.remove(infoHash, deleteFiles);
                return ok(undefined);
            } catch (err) {
                return failWithLog('torrent:remove', err);
            }
        },
    );

    // ── torrent:get-all ───────────────────────────────────────────────────────
    // payload: void
    ipcMain.handle('torrent:get-all', async (_event): Promise<IPCResponse<DownloadItem[]>> => {
        try {
            const items = downloadManager.getAll();
            return ok(items);
        } catch (err) {
            return failWithLog('torrent:get-all', err);
        }
    });

    // ── settings:get ──────────────────────────────────────────────────────────
    // payload: void
    ipcMain.handle('settings:get', async (_event): Promise<IPCResponse<AppSettings>> => {
        try {
            const settings = settingsManager.get();
            return ok(settings);
        } catch (err) {
            return failWithLog('settings:get', err);
        }
    });

    // ── settings:set ──────────────────────────────────────────────────────────
    // payload: Partial<AppSettings>
    ipcMain.handle(
        'settings:set',
        async (_event, payload: unknown): Promise<IPCResponse<AppSettings>> => {
            try {
                if (typeof payload !== 'object' || payload === null) {
                    return fail(ErrorCodes.INVALID_SETTINGS_PAYLOAD);
                }

                const partial = payload as Partial<AppSettings>;

                // Validate downloadSpeedLimit if provided
                if (
                    partial.downloadSpeedLimit !== undefined &&
                    !isValidSpeedLimit(partial.downloadSpeedLimit)
                ) {
                    return fail(ErrorCodes.INVALID_SPEED_LIMIT);
                }

                // Validate uploadSpeedLimit if provided
                if (
                    partial.uploadSpeedLimit !== undefined &&
                    !isValidSpeedLimit(partial.uploadSpeedLimit)
                ) {
                    return fail(ErrorCodes.INVALID_SPEED_LIMIT);
                }

                // Validate destinationFolder if provided
                if (
                    partial.destinationFolder !== undefined &&
                    typeof partial.destinationFolder !== 'string'
                ) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                // Validate maxConcurrentDownloads if provided
                if (
                    partial.maxConcurrentDownloads !== undefined &&
                    !isValidMaxConcurrentDownloads(partial.maxConcurrentDownloads)
                ) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                // Validate notificationsEnabled if provided
                if (
                    partial.notificationsEnabled !== undefined &&
                    typeof partial.notificationsEnabled !== 'boolean'
                ) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                // Validate theme if provided
                if (partial.theme !== undefined && !isValidThemeId(partial.theme)) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                // Validate locale if provided
                if (
                    partial.locale !== undefined &&
                    (typeof partial.locale !== 'string' || partial.locale.trim() === '')
                ) {
                    return fail(ErrorCodes.INVALID_LOCALE);
                }

                // Validar dhtEnabled se fornecido
                if (
                    partial.dhtEnabled !== undefined &&
                    !isValidNetworkToggle(partial.dhtEnabled)
                ) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                // Validar pexEnabled se fornecido
                if (
                    partial.pexEnabled !== undefined &&
                    !isValidNetworkToggle(partial.pexEnabled)
                ) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                // Validar utpEnabled se fornecido
                if (
                    partial.utpEnabled !== undefined &&
                    !isValidNetworkToggle(partial.utpEnabled)
                ) {
                    return fail(ErrorCodes.INVALID_PARAMS);
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
    // payload: void
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
    // payload: { infoHash: string }
    ipcMain.handle(
        'torrent:get-files',
        async (_event, payload: unknown): Promise<IPCResponse<TorrentFileInfo[]>> => {
            try {
                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    typeof (payload as Record<string, unknown>).infoHash !== 'string' ||
                    (payload as Record<string, unknown>).infoHash === ''
                ) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                const { infoHash } = payload as { infoHash: string };

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
    // payload: { infoHash: string, selectedIndices: number[] }
    ipcMain.handle(
        'torrent:set-file-selection',
        async (_event, payload: unknown): Promise<IPCResponse<TorrentFileInfo[]>> => {
            try {
                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    typeof (payload as Record<string, unknown>).infoHash !== 'string' ||
                    (payload as Record<string, unknown>).infoHash === ''
                ) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                const { infoHash } = payload as { infoHash: string };
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
    // payload: { infoHash: string, downloadLimit: number, uploadLimit: number }
    ipcMain.handle(
        'torrent:set-speed-limits',
        async (_event, payload: unknown): Promise<IPCResponse<DownloadItem>> => {
            try {
                if (typeof payload !== 'object' || payload === null) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                const p = payload as Record<string, unknown>;

                if (typeof p.infoHash !== 'string' || p.infoHash === '') {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                if (!isValidSpeedLimit(p.downloadLimit)) {
                    return fail(ErrorCodes.INVALID_SPEED_LIMIT);
                }

                if (!isValidSpeedLimit(p.uploadLimit)) {
                    return fail(ErrorCodes.INVALID_SPEED_LIMIT);
                }

                const { infoHash, downloadLimit, uploadLimit } = payload as {
                    infoHash: string;
                    downloadLimit: number;
                    uploadLimit: number;
                };

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
    // payload: { infoHash: string }
    ipcMain.handle(
        'torrent:get-speed-limits',
        async (
            _event,
            payload: unknown,
        ): Promise<
            IPCResponse<{ downloadSpeedLimitKBps: number; uploadSpeedLimitKBps: number }>
        > => {
            try {
                if (typeof payload !== 'object' || payload === null) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                const p = payload as Record<string, unknown>;

                if (typeof p.infoHash !== 'string' || p.infoHash === '') {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                const { infoHash } = payload as { infoHash: string };
                const limits = downloadManager.getTorrentSpeedLimits(infoHash);
                return ok(limits);
            } catch (err) {
                return failWithLog('torrent:get-speed-limits', err);
            }
        },
    );

    // ── tracker:get ───────────────────────────────────────────────────────────
    // payload: { infoHash: string }
    ipcMain.handle(
        'tracker:get',
        async (_event, payload: unknown): Promise<IPCResponse<TrackerInfo[]>> => {
            try {
                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    typeof (payload as Record<string, unknown>).infoHash !== 'string' ||
                    (payload as Record<string, unknown>).infoHash === ''
                ) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                if (!torrentEngine) {
                    return fail(ErrorCodes.ENGINE_NOT_AVAILABLE);
                }

                const { infoHash } = payload as { infoHash: string };
                const trackers = torrentEngine.getTrackers(infoHash);
                return ok(trackers);
            } catch (err) {
                return failWithLog('tracker:get', err);
            }
        },
    );

    // ── tracker:add ───────────────────────────────────────────────────────────
    // payload: { infoHash: string, url: string }
    ipcMain.handle(
        'tracker:add',
        async (_event, payload: unknown): Promise<IPCResponse<TrackerInfo[]>> => {
            try {
                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    typeof (payload as Record<string, unknown>).infoHash !== 'string' ||
                    (payload as Record<string, unknown>).infoHash === '' ||
                    typeof (payload as Record<string, unknown>).url !== 'string' ||
                    (payload as Record<string, unknown>).url === ''
                ) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                if (!torrentEngine) {
                    return fail(ErrorCodes.ENGINE_NOT_AVAILABLE);
                }

                const { infoHash, url } = payload as { infoHash: string; url: string };

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
    // payload: { infoHash: string, url: string }
    ipcMain.handle(
        'tracker:remove',
        async (_event, payload: unknown): Promise<IPCResponse<TrackerInfo[]>> => {
            try {
                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    typeof (payload as Record<string, unknown>).infoHash !== 'string' ||
                    (payload as Record<string, unknown>).infoHash === '' ||
                    typeof (payload as Record<string, unknown>).url !== 'string' ||
                    (payload as Record<string, unknown>).url === ''
                ) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                if (!torrentEngine) {
                    return fail(ErrorCodes.ENGINE_NOT_AVAILABLE);
                }

                const { infoHash, url } = payload as { infoHash: string; url: string };
                torrentEngine.removeTracker(infoHash, url);
                const trackers = torrentEngine.getTrackers(infoHash);
                return ok(trackers);
            } catch (err) {
                return failWithLog('tracker:remove', err);
            }
        },
    );

    // ── tracker:apply-global ──────────────────────────────────────────────────
    // payload: { infoHash: string }
    ipcMain.handle(
        'tracker:apply-global',
        async (_event, payload: unknown): Promise<IPCResponse<TrackerInfo[]>> => {
            try {
                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    typeof (payload as Record<string, unknown>).infoHash !== 'string' ||
                    (payload as Record<string, unknown>).infoHash === ''
                ) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                if (!torrentEngine) {
                    return fail(ErrorCodes.ENGINE_NOT_AVAILABLE);
                }

                const { infoHash } = payload as { infoHash: string };
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
    // payload: (nenhum)
    ipcMain.handle(
        'tracker:get-global',
        async (_event): Promise<IPCResponse<string[]>> => {
            try {
                const trackers = settingsManager.getGlobalTrackers();
                return ok(trackers);
            } catch (err) {
                return failWithLog('tracker:get-global', err);
            }
        },
    );

    // ── tracker:add-global ────────────────────────────────────────────────────
    // payload: { url: string }
    ipcMain.handle(
        'tracker:add-global',
        async (_event, payload: unknown): Promise<IPCResponse<string[]>> => {
            try {
                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    typeof (payload as Record<string, unknown>).url !== 'string' ||
                    (payload as Record<string, unknown>).url === ''
                ) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                const { url } = payload as { url: string };

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
    // payload: { url: string }
    ipcMain.handle(
        'tracker:remove-global',
        async (_event, payload: unknown): Promise<IPCResponse<string[]>> => {
            try {
                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    typeof (payload as Record<string, unknown>).url !== 'string' ||
                    (payload as Record<string, unknown>).url === ''
                ) {
                    return fail(ErrorCodes.INVALID_PARAMS);
                }

                const { url } = payload as { url: string };
                settingsManager.removeGlobalTracker(url);
                const trackers = settingsManager.getGlobalTrackers();
                return ok(trackers);
            } catch (err) {
                return failWithLog('tracker:remove-global', err);
            }
        },
    );
}
