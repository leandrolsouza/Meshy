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
import { isValidSpeedLimit, isValidMaxConcurrentDownloads, isValidThemeId } from './validators';
import { isValidTrackerUrl } from '../shared/validators';
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
                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    typeof (payload as Record<string, unknown>).filePath !== 'string' ||
                    (payload as Record<string, unknown>).filePath === ''
                ) {
                    return fail('Parâmetros inválidos: filePath deve ser uma string não-vazia');
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
                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    typeof (payload as Record<string, unknown>).magnetUri !== 'string' ||
                    (payload as Record<string, unknown>).magnetUri === ''
                ) {
                    return fail('Parâmetros inválidos: magnetUri deve ser uma string não-vazia');
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
                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    typeof (payload as Record<string, unknown>).infoHash !== 'string' ||
                    (payload as Record<string, unknown>).infoHash === ''
                ) {
                    return fail('Parâmetros inválidos: infoHash deve ser uma string não-vazia');
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
                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    typeof (payload as Record<string, unknown>).infoHash !== 'string' ||
                    (payload as Record<string, unknown>).infoHash === ''
                ) {
                    return fail('Parâmetros inválidos: infoHash deve ser uma string não-vazia');
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
                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    typeof (payload as Record<string, unknown>).infoHash !== 'string' ||
                    (payload as Record<string, unknown>).infoHash === '' ||
                    typeof (payload as Record<string, unknown>).deleteFiles !== 'boolean'
                ) {
                    return fail(
                        'Parâmetros inválidos: infoHash deve ser uma string não-vazia e deleteFiles deve ser um booleano',
                    );
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
                    return fail('Parâmetros inválidos: payload deve ser um objeto');
                }

                const partial = payload as Partial<AppSettings>;

                // Validate downloadSpeedLimit if provided
                if (
                    partial.downloadSpeedLimit !== undefined &&
                    !isValidSpeedLimit(partial.downloadSpeedLimit)
                ) {
                    return fail(
                        'Valor inválido: downloadSpeedLimit deve ser um inteiro não-negativo',
                    );
                }

                // Validate uploadSpeedLimit if provided
                if (
                    partial.uploadSpeedLimit !== undefined &&
                    !isValidSpeedLimit(partial.uploadSpeedLimit)
                ) {
                    return fail(
                        'Valor inválido: uploadSpeedLimit deve ser um inteiro não-negativo',
                    );
                }

                // Validate destinationFolder if provided
                if (
                    partial.destinationFolder !== undefined &&
                    typeof partial.destinationFolder !== 'string'
                ) {
                    return fail('Parâmetros inválidos: destinationFolder deve ser uma string');
                }

                // Validate maxConcurrentDownloads if provided
                if (
                    partial.maxConcurrentDownloads !== undefined &&
                    !isValidMaxConcurrentDownloads(partial.maxConcurrentDownloads)
                ) {
                    return fail(
                        'Valor inválido: maxConcurrentDownloads deve ser um inteiro entre 1 e 10',
                    );
                }

                // Validate notificationsEnabled if provided
                if (
                    partial.notificationsEnabled !== undefined &&
                    typeof partial.notificationsEnabled !== 'boolean'
                ) {
                    return fail('Valor inválido: notificationsEnabled deve ser um booleano');
                }

                // Validate theme if provided
                if (partial.theme !== undefined && !isValidThemeId(partial.theme)) {
                    return fail('Tema inválido: deve ser uma string não-vazia');
                }

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
                return fail('Nenhuma pasta selecionada');
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
                    return fail('Parâmetros inválidos: infoHash deve ser uma string não-vazia');
                }

                const { infoHash } = payload as { infoHash: string };

                // Check if torrent exists in the download manager
                const allItems = downloadManager.getAll();
                const item = allItems.find((i) => i.infoHash === infoHash);

                if (!item) {
                    return fail('Torrent não encontrado');
                }

                // If torrent is resolving metadata, return empty array
                if (item.status === 'resolving-metadata') {
                    return ok([]);
                }

                if (!torrentEngine) {
                    return fail('TorrentEngine não disponível');
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
                    return fail('Parâmetros inválidos: infoHash deve ser uma string não-vazia');
                }

                const { infoHash } = payload as { infoHash: string };
                const rawIndices = (payload as Record<string, unknown>).selectedIndices;

                // Validate selectedIndices is a non-empty array of non-negative integers
                if (!Array.isArray(rawIndices) || rawIndices.length === 0) {
                    return fail('Selecione ao menos um arquivo');
                }

                for (const idx of rawIndices) {
                    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0) {
                        return fail('Índice de arquivo inválido');
                    }
                }

                const selectedIndices = rawIndices as number[];

                // Check if torrent exists
                const allItems = downloadManager.getAll();
                const item = allItems.find((i) => i.infoHash === infoHash);

                if (!item) {
                    return fail('Torrent não encontrado');
                }

                if (!torrentEngine) {
                    return fail('TorrentEngine não disponível');
                }

                // Validate indices are within range by getting file count first
                const currentFiles = torrentEngine.getFiles(infoHash);
                const totalFiles = currentFiles.length;

                for (const idx of selectedIndices) {
                    if (idx >= totalFiles) {
                        return fail('Índice de arquivo inválido');
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
                    return fail('Parâmetros inválidos: payload deve ser um objeto');
                }

                const p = payload as Record<string, unknown>;

                if (typeof p.infoHash !== 'string' || p.infoHash === '') {
                    return fail(
                        'Parâmetros inválidos: infoHash deve ser uma string não-vazia',
                    );
                }

                if (!isValidSpeedLimit(p.downloadLimit)) {
                    return fail(
                        'Valor inválido: downloadLimit deve ser um inteiro não-negativo',
                    );
                }

                if (!isValidSpeedLimit(p.uploadLimit)) {
                    return fail(
                        'Valor inválido: uploadLimit deve ser um inteiro não-negativo',
                    );
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
                    return fail('Parâmetros inválidos: payload deve ser um objeto');
                }

                const p = payload as Record<string, unknown>;

                if (typeof p.infoHash !== 'string' || p.infoHash === '') {
                    return fail(
                        'Parâmetros inválidos: infoHash deve ser uma string não-vazia',
                    );
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
                    return fail('Parâmetros inválidos: infoHash deve ser uma string não-vazia');
                }

                if (!torrentEngine) {
                    return fail('TorrentEngine não disponível');
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
                    return fail(
                        'Parâmetros inválidos: infoHash e url devem ser strings não-vazias',
                    );
                }

                if (!torrentEngine) {
                    return fail('TorrentEngine não disponível');
                }

                const { infoHash, url } = payload as { infoHash: string; url: string };

                if (!isValidTrackerUrl(url)) {
                    return fail(
                        'URL de tracker inválida. Protocolos aceitos: http://, https://, udp://',
                    );
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
                    return fail(
                        'Parâmetros inválidos: infoHash e url devem ser strings não-vazias',
                    );
                }

                if (!torrentEngine) {
                    return fail('TorrentEngine não disponível');
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
                    return fail('Parâmetros inválidos: infoHash deve ser uma string não-vazia');
                }

                if (!torrentEngine) {
                    return fail('TorrentEngine não disponível');
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
                    return fail('Parâmetros inválidos: url deve ser uma string não-vazia');
                }

                const { url } = payload as { url: string };

                if (!isValidTrackerUrl(url)) {
                    return fail(
                        'URL de tracker inválida. Protocolos aceitos: http://, https://, udp://',
                    );
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
                    return fail('Parâmetros inválidos: url deve ser uma string não-vazia');
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
