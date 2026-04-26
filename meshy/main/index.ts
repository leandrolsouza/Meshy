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

    // ── Inicializar notificações nativas do OS ────────────────────────────────
    // Criado após a janela principal para permitir foco ao clicar na notificação.
    // A referência será atualizada abaixo, após criar a mainWindow.
    let notificationManager: import('./notificationManager').NotificationManager | null = null;

    // ── Register before-quit handler to persist session ────────────────────────
    // Requirements: 7.1 — serialize all DownloadItems to PersistedDownloadItem
    // and save to electron-store before the app exits.
    app.on('before-quit', () => {
        downloadManager?.persistSession();
    });

    // ── Create main window ────────────────────────────────────────────────────
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    if (process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    // Register IPC handlers ONCE (global — survives window close/reopen on macOS).
    registerIpcHandlers(downloadManager, settingsManager, torrentEngine);

    // Attach per-window resources (progress interval, error forwarding).
    attachWindowEvents(downloadManager, torrentEngine, mainWindow);

    // Inicializar notificações nativas do OS com referência à janela principal
    notificationManager = createNotificationManager(downloadManager, settingsManager, {
        mainWindow,
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            const newWindow = new BrowserWindow({
                width: 1200,
                height: 800,
                webPreferences: {
                    preload: join(__dirname, '../preload/index.js'),
                    nodeIntegration: false,
                    contextIsolation: true,
                },
            });
            if (process.env['ELECTRON_RENDERER_URL']) {
                newWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
            } else {
                newWindow.loadFile(join(__dirname, '../renderer/index.html'));
            }
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
