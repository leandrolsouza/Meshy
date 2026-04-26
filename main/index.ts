import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { createSettingsManager } from './settingsManager';
import { createTorrentEngine } from './torrentEngine';
import { createDownloadManager } from './downloadManager';
import { createNotificationManager } from './notificationManager';
import { registerIpcHandlers, attachWindowEvents } from './ipcHandler';
import type { DownloadManager } from './downloadManager';

import ElectronStore from 'electron-store';

// Module-level references so the before-quit handler can access them
let downloadManager: DownloadManager | null = null;

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

    // Inicializar notificações nativas do OS com referência à janela principal
    createNotificationManager(downloadManager, settingsManager, { mainWindow });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            const newWindow = createMainWindow();
            // Only attach per-window events — IPC handlers are already registered.
            attachWindowEvents(downloadManager!, torrentEngine, newWindow);
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
