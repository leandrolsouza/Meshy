import { app, BrowserWindow, dialog } from 'electron';
import { join } from 'path';
import { createSettingsManager } from './settingsManager';
import { createTorrentEngine } from './torrentEngine';
import { createDownloadManager } from './downloadManager';
import { createNotificationManager } from './notificationManager';
import { registerIpcHandlers, attachWindowEvents } from './ipcHandler';
import type { DownloadManager } from './downloadManager';
import { logger } from './logger';
import { metrics } from './metrics';

import ElectronStore from 'electron-store';

// Module-level references so the before-quit handler can access them
let downloadManager: DownloadManager | null = null;

// ─── Crash handlers ───────────────────────────────────────────────────────────
//
// Capturam exceções e rejeições não tratadas no processo principal.
// Persistem a sessão antes de encerrar para evitar perda de dados.

process.on('uncaughtException', (error) => {
    logger.error('[CRASH] Exceção não capturada:', error.message, error.stack);

    // Persistir sessão para não perder o estado dos downloads
    try {
        downloadManager?.persistSession();
    } catch (persistError) {
        logger.error('[CRASH] Falha ao persistir sessão:', String(persistError));
    }

    // Exibir diálogo de erro para o usuário (se o app ainda estiver funcional)
    try {
        dialog.showErrorBox(
            'Meshy — Erro inesperado',
            `O Meshy encontrou um erro inesperado e precisa ser reiniciado.\n\n${error.message}`,
        );
    } catch {
        // Se o diálogo falhar, apenas encerrar
    }

    app.exit(1);
});

process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    logger.error('[CRASH] Rejeição não tratada:', message, stack);

    // Persistir sessão para não perder o estado dos downloads
    try {
        downloadManager?.persistSession();
    } catch (persistError) {
        logger.error('[CRASH] Falha ao persistir sessão:', String(persistError));
    }
});

// ─── Factory para criação de BrowserWindow ────────────────────────────────────

/**
 * Cria e configura uma nova BrowserWindow com as opções padrão do Meshy.
 * Centraliza a criação para evitar duplicação entre o boot inicial e o
 * handler de `activate` (macOS).
 */
function createMainWindow(): BrowserWindow {
    const window = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    if (process.env['ELECTRON_RENDERER_URL']) {
        window.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
        window.loadFile(join(__dirname, '../renderer/index.html'));
    }

    return window;
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
    // ── Instantiate core services ──────────────────────────────────────────────
    const settingsManager = createSettingsManager();
    const settings = settingsManager.get();

    const torrentEngine = createTorrentEngine({
        downloadPath: settings.destinationFolder,
        downloadSpeedLimit: settings.downloadSpeedLimit,
        uploadSpeedLimit: settings.uploadSpeedLimit,
        dhtEnabled: settings.dhtEnabled,
        pexEnabled: settings.pexEnabled,
        utpEnabled: settings.utpEnabled,
    });

    // Shared electron-store instance for download session persistence
    const downloadsStore = new ElectronStore({ name: 'downloads' });
    const persistedStore = {
        get: (key: 'downloads') => downloadsStore.get(key),
        set: (key: 'downloads', value: unknown) => downloadsStore.set(key, value),
    };

    downloadManager = createDownloadManager(torrentEngine, settingsManager, persistedStore);

    // Restore previous session
    await downloadManager.restoreSession();

    // ── Register before-quit handler to persist session ────────────────────────
    app.on('before-quit', () => {
        downloadManager?.persistSession();
    });

    // ── Create main window ────────────────────────────────────────────────────
    const mainWindow = createMainWindow();

    // Register IPC handlers ONCE (global — survives window close/reopen on macOS).
    registerIpcHandlers(downloadManager, settingsManager, torrentEngine);

    // Attach per-window resources (progress interval, error forwarding).
    attachWindowEvents(downloadManager, torrentEngine, mainWindow);

    // ── Detectar crash do renderer process ────────────────────────────────────
    attachRendererCrashHandler(mainWindow);

    // Inicializar notificações nativas do OS com referência à janela principal
    createNotificationManager(downloadManager, settingsManager, { mainWindow });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            const newWindow = createMainWindow();
            // Only attach per-window events — IPC handlers are already registered.
            attachWindowEvents(downloadManager!, torrentEngine, newWindow);
            attachRendererCrashHandler(newWindow);
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ─── Renderer crash handler ───────────────────────────────────────────────────

/**
 * Detecta quando o renderer process crasha ou é encerrado inesperadamente.
 * Loga o motivo e persiste a sessão para evitar perda de dados.
 */
function attachRendererCrashHandler(window: BrowserWindow): void {
    window.webContents.on('render-process-gone', (_event, details) => {
        logger.error(
            '[CRASH] Renderer process encerrado:',
            `reason=${details.reason}`,
            `exitCode=${details.exitCode}`,
        );

        // Registrar nas métricas
        metrics.recordRendererCrash();

        // Persistir sessão ao detectar crash do renderer
        try {
            downloadManager?.persistSession();
        } catch (persistError) {
            logger.error(
                '[CRASH] Falha ao persistir sessão após crash do renderer:',
                String(persistError),
            );
        }

        // Para crashes recuperáveis, recarregar a janela automaticamente
        if (details.reason === 'crashed' || details.reason === 'oom') {
            logger.info('[CRASH] Tentando recarregar a janela...');
            try {
                if (!window.isDestroyed()) {
                    window.webContents.reload();
                }
            } catch {
                logger.error('[CRASH] Falha ao recarregar a janela');
            }
        }
    });
}
