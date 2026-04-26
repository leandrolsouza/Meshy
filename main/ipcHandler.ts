import { ipcMain, dialog, BrowserWindow } from 'electron';
import { existsSync, accessSync, constants as fsConstants } from 'fs';
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
import { isValidSpeedLimit, isValidTorrentFile } from './validators';
import { isValidTrackerUrl } from '../shared/validators';
import { ErrorCodes } from '../shared/errorCodes';
import { logger, createScopedLogger } from './logger';
import type { ScopedLogger } from './logger';
import { metrics } from './metrics';
import type { MetricsSnapshot } from './metrics';
import { validatePayload, infoHashSchema, infoHashUrlSchema, urlSchema } from './payloadValidator';
import { validateSettingsPayload } from './settingsValidator';

export type { IPCResponse } from '../shared/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok<T>(data: T): IPCResponse<T> {
    return { success: true, data };
}

function fail(error: string): IPCResponse<never> {
    return { success: false, error };
}

function failWithLog(channel: string, err: unknown, scopedLog?: ScopedLogger): IPCResponse<never> {
    const message = err instanceof Error ? err.message : String(err);
    if (scopedLog) {
        scopedLog.error('Falha na operação', { errorCode: message });
    } else {
        logger.error(`[IPC] ${channel} failed:`, message);
    }
    return { success: false, error: message };
}

// ─── Timeout wrapper ──────────────────────────────────────────────────────────

/**
 * Verifica se um caminho de diretório tem permissão de escrita.
 * Retorna false em caso de erro (diretório inacessível, sem permissão, etc).
 */
function hasWritePermission(dirPath: string): boolean {
    try {
        accessSync(dirPath, fsConstants.W_OK);
        return true;
    } catch {
        return false;
    }
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

/**
 * Rate limiter simples por canal IPC usando sliding window.
 * Limita o número de chamadas por segundo para evitar abuso do renderer.
 */
class ChannelRateLimiter {
    private readonly timestamps = new Map<string, number[]>();
    private readonly maxPerSecond: number;

    constructor(maxPerSecond: number) {
        this.maxPerSecond = maxPerSecond;
    }

    /**
     * Tenta consumir um token para o canal. Retorna true se permitido.
     */
    tryConsume(channel: string): boolean {
        const now = Date.now();
        const windowStart = now - 1000;

        let calls = this.timestamps.get(channel);
        if (!calls) {
            calls = [];
            this.timestamps.set(channel, calls);
        }

        // Remover timestamps fora da janela de 1 segundo
        while (calls.length > 0 && calls[0] <= windowStart) {
            calls.shift();
        }

        if (calls.length >= this.maxPerSecond) {
            return false;
        }

        calls.push(now);
        return true;
    }

    /** Limpa todos os timestamps. Útil para testes. */
    reset(): void {
        this.timestamps.clear();
    }
}

/** Rate limiter global para todos os canais IPC (500 chamadas/segundo por canal) */
const rateLimiter = new ChannelRateLimiter(500);

// Exportado para permitir reset nos testes
export { rateLimiter as _rateLimiter };

/** Código de erro para rate limiting */
const RATE_LIMITED = 'error.rateLimit';

/** Timeout padrão para operações IPC (30 segundos) */
const IPC_TIMEOUT_MS = 30_000;

/**
 * Envolve uma Promise com um timeout. Se a operação não completar dentro do
 * prazo, rejeita com um erro descritivo incluindo o nome do canal IPC.
 */
function withTimeout<T>(
    promise: Promise<T>,
    channel: string,
    timeoutMs = IPC_TIMEOUT_MS,
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Operação expirou após ${timeoutMs}ms`));
        }, timeoutMs);

        promise
            .then((result) => {
                clearTimeout(timer);
                resolve(result);
            })
            .catch((err) => {
                clearTimeout(timer);
                reject(err);
            });
    });
}

// ─── Metrics wrapper ──────────────────────────────────────────────────────────

/**
 * Envolve um handler IPC com tracking de latência e contagem de erros.
 * Mede o tempo de execução e registra no coletor de métricas.
 * Em modo debug, loga a latência de cada chamada.
 */
function withMetrics<T>(
    channel: string,
    handler: () => Promise<IPCResponse<T>>,
): Promise<IPCResponse<T>> {
    const start = Date.now();
    return handler().then((result) => {
        const durationMs = Date.now() - start;
        metrics.recordIpcCall(channel, durationMs, result.success);
        logger.debug(
            `[IPC] ${channel} concluído`,
            `durationMs=${durationMs}`,
            `success=${result.success}`,
        );
        return result;
    });
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
        metrics.recordEngineError();
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
    // ── Wrapper para tracking automático de métricas ──────────────────────────
    // Intercepta ipcMain.handle para medir latência e contar erros de cada canal.
    // Inclui rate limiting para proteger contra abuso do renderer.
    const trackedHandle = <T>(
        channel: string,
        handler: (event: Electron.IpcMainInvokeEvent, payload: unknown) => Promise<IPCResponse<T>>,
    ): void => {
        ipcMain.handle(channel, async (event, payload) => {
            if (!rateLimiter.tryConsume(channel)) {
                logger.warn(`[IPC] Rate limit excedido para canal: ${channel}`);
                return fail(RATE_LIMITED) as IPCResponse<T>;
            }
            return withMetrics(channel, () => handler(event, payload));
        });
    };

    // ── torrent:add-file ──────────────────────────────────────────────────────
    trackedHandle(
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

                // Validar extensão .torrent antes de ler o arquivo do filesystem
                if (!isValidTorrentFile(result.data.filePath)) {
                    return fail(ErrorCodes.INVALID_FILE_PATH);
                }

                const item = await withTimeout(
                    downloadManager.addTorrentFile(result.data.filePath),
                    'torrent:add-file',
                );
                return ok(item);
            } catch (err) {
                return failWithLog('torrent:add-file', err);
            }
        },
    );

    // ── torrent:add-magnet ────────────────────────────────────────────────────
    trackedHandle(
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

                const item = await withTimeout(
                    downloadManager.addMagnetLink(result.data.magnetUri),
                    'torrent:add-magnet',
                );
                return ok(item);
            } catch (err) {
                return failWithLog('torrent:add-magnet', err);
            }
        },
    );

    // ── torrent:pause ─────────────────────────────────────────────────────────
    trackedHandle('torrent:pause', async (_event, payload: unknown): Promise<IPCResponse<void>> => {
        try {
            if (torrentEngine?.isRestarting()) {
                return fail(ErrorCodes.ENGINE_RESTARTING);
            }

            const result = validatePayload<{ infoHash: string }>(payload, infoHashSchema);
            if (!result.valid) return fail(ErrorCodes.INVALID_PARAMS);

            await withTimeout(downloadManager.pause(result.data.infoHash), 'torrent:pause');
            return ok(undefined);
        } catch (err) {
            return failWithLog('torrent:pause', err);
        }
    });

    // ── torrent:resume ────────────────────────────────────────────────────────
    trackedHandle(
        'torrent:resume',
        async (_event, payload: unknown): Promise<IPCResponse<void>> => {
            try {
                if (torrentEngine?.isRestarting()) {
                    return fail(ErrorCodes.ENGINE_RESTARTING);
                }

                const result = validatePayload<{ infoHash: string }>(payload, infoHashSchema);
                if (!result.valid) return fail(ErrorCodes.INVALID_PARAMS);

                await withTimeout(downloadManager.resume(result.data.infoHash), 'torrent:resume');
                return ok(undefined);
            } catch (err) {
                return failWithLog('torrent:resume', err);
            }
        },
    );

    // ── torrent:remove ────────────────────────────────────────────────────────
    trackedHandle(
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

                await withTimeout(
                    downloadManager.remove(result.data.infoHash, result.data.deleteFiles),
                    'torrent:remove',
                );
                return ok(undefined);
            } catch (err) {
                return failWithLog('torrent:remove', err);
            }
        },
    );

    // ── torrent:get-all ───────────────────────────────────────────────────────
    trackedHandle('torrent:get-all', async (_event): Promise<IPCResponse<DownloadItem[]>> => {
        try {
            const items = downloadManager.getAll();
            return ok(items);
        } catch (err) {
            return failWithLog('torrent:get-all', err);
        }
    });

    // ── settings:get ──────────────────────────────────────────────────────────
    trackedHandle('settings:get', async (_event): Promise<IPCResponse<AppSettings>> => {
        try {
            const settings = settingsManager.get();
            return ok(settings);
        } catch (err) {
            return failWithLog('settings:get', err);
        }
    });

    // ── settings:set ──────────────────────────────────────────────────────────
    trackedHandle(
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

                // Validar que a pasta de destino existe e tem permissão de escrita
                if (partial.destinationFolder !== undefined) {
                    if (
                        !existsSync(partial.destinationFolder) ||
                        !hasWritePermission(partial.destinationFolder)
                    ) {
                        return fail(ErrorCodes.INVALID_PARAMS);
                    }
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
    trackedHandle('settings:select-folder', async (_event): Promise<IPCResponse<string>> => {
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
    trackedHandle(
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
    trackedHandle(
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
    trackedHandle(
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
    trackedHandle(
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

    // ── torrent:retry ─────────────────────────────────────────────────────────
    trackedHandle(
        'torrent:retry',
        async (_event, payload: unknown): Promise<IPCResponse<DownloadItem>> => {
            try {
                if (torrentEngine?.isRestarting()) {
                    return fail(ErrorCodes.ENGINE_RESTARTING);
                }

                const result = validatePayload<{ infoHash: string }>(payload, infoHashSchema);
                if (!result.valid) return fail(ErrorCodes.INVALID_PARAMS);

                const item = await withTimeout(
                    downloadManager.retryDownload(result.data.infoHash),
                    'torrent:retry',
                );
                return ok(item);
            } catch (err) {
                return failWithLog('torrent:retry', err);
            }
        },
    );

    // ── tracker:get ───────────────────────────────────────────────────────────
    trackedHandle(
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
    trackedHandle(
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
    trackedHandle(
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
    trackedHandle(
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
                        // Erros individuais de tracker (ex: duplicatas) são esperados
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
    trackedHandle('tracker:get-global', async (_event): Promise<IPCResponse<string[]>> => {
        try {
            const trackers = settingsManager.getGlobalTrackers();
            return ok(trackers);
        } catch (err) {
            return failWithLog('tracker:get-global', err);
        }
    });

    // ── tracker:add-global ────────────────────────────────────────────────────
    trackedHandle(
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
    trackedHandle(
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

    // ── renderer:report-error ─────────────────────────────────────────────────
    // Canal para o renderer reportar erros (ErrorBoundary, exceções não capturadas)
    // ao main process, onde são persistidos via electron-log.
    trackedHandle(
        'renderer:report-error',
        async (_event, payload: unknown): Promise<IPCResponse<void>> => {
            const scopedLog = createScopedLogger(logger, { channel: 'renderer:report-error' });
            try {
                const result = validatePayload<{ message: string; source: string }>(payload, {
                    message: { type: 'string', nonEmpty: true },
                    source: { type: 'string', nonEmpty: true },
                });
                if (!result.valid) return fail(ErrorCodes.INVALID_PARAMS);

                const { message, source } = result.data;

                // Extrair stack trace opcional (não obrigatório)
                const stack =
                    typeof payload === 'object' && payload !== null
                        ? (payload as Record<string, unknown>).stack
                        : undefined;
                const stackStr = typeof stack === 'string' ? stack : undefined;

                // Extrair component stack opcional (React ErrorBoundary)
                const componentStack =
                    typeof payload === 'object' && payload !== null
                        ? (payload as Record<string, unknown>).componentStack
                        : undefined;
                const componentStackStr =
                    typeof componentStack === 'string' ? componentStack : undefined;

                scopedLog.error(`${source}: ${message}`, {
                    source,
                    ...(stackStr ? { stack: stackStr } : {}),
                    ...(componentStackStr ? { componentStack: componentStackStr } : {}),
                });

                // Registrar nas métricas
                metrics.recordRendererError();

                return ok(undefined);
            } catch (err) {
                return failWithLog('renderer:report-error', err, scopedLog);
            }
        },
    );

    // ── app:get-metrics ───────────────────────────────────────────────────────
    // Retorna snapshot das métricas de operação para debugging no renderer.
    trackedHandle('app:get-metrics', async (_event): Promise<IPCResponse<MetricsSnapshot>> => {
        try {
            const snapshot = metrics.getSnapshot();
            return ok(snapshot);
        } catch (err) {
            return failWithLog('app:get-metrics', err);
        }
    });
}
