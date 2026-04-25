import { contextBridge, ipcRenderer } from 'electron';
import type { DownloadItem, AppSettings, IPCResponse, MeshyAPI } from '../shared/types';

// ─── Expose API via contextBridge ────────────────────────────────────────────

const meshyAPI: MeshyAPI = {
    // ── Commands ────────────────────────────────────────────────────────────────

    addTorrentFile(filePath: string): Promise<IPCResponse<DownloadItem>> {
        return ipcRenderer.invoke('torrent:add-file', { filePath });
    },

    addMagnetLink(magnetUri: string): Promise<IPCResponse<DownloadItem>> {
        return ipcRenderer.invoke('torrent:add-magnet', { magnetUri });
    },

    pause(infoHash: string): Promise<IPCResponse<void>> {
        return ipcRenderer.invoke('torrent:pause', { infoHash });
    },

    resume(infoHash: string): Promise<IPCResponse<void>> {
        return ipcRenderer.invoke('torrent:resume', { infoHash });
    },

    remove(infoHash: string, deleteFiles: boolean): Promise<IPCResponse<void>> {
        return ipcRenderer.invoke('torrent:remove', { infoHash, deleteFiles });
    },

    getAll(): Promise<IPCResponse<DownloadItem[]>> {
        return ipcRenderer.invoke('torrent:get-all');
    },

    getSettings(): Promise<IPCResponse<AppSettings>> {
        return ipcRenderer.invoke('settings:get');
    },

    setSettings(partial: Partial<AppSettings>): Promise<IPCResponse<AppSettings>> {
        return ipcRenderer.invoke('settings:set', partial);
    },

    selectFolder(): Promise<IPCResponse<string>> {
        return ipcRenderer.invoke('settings:select-folder');
    },

    // ── Events ──────────────────────────────────────────────────────────────────

    /**
     * Subscribes to torrent progress updates emitted by the main process every second.
     * Returns a cleanup function that removes the listener when called.
     */
    onProgress(callback: (items: DownloadItem[]) => void): () => void {
        const listener = (_event: Electron.IpcRendererEvent, items: DownloadItem[]) => {
            callback(items);
        };
        ipcRenderer.on('torrent:progress', listener);
        return () => {
            ipcRenderer.removeListener('torrent:progress', listener);
        };
    },

    /**
     * Subscribes to torrent error events emitted by the main process.
     * Returns a cleanup function that removes the listener when called.
     */
    onError(callback: (data: { infoHash: string; message: string }) => void): () => void {
        const listener = (
            _event: Electron.IpcRendererEvent,
            data: { infoHash: string; message: string },
        ) => {
            callback(data);
        };
        ipcRenderer.on('torrent:error', listener);
        return () => {
            ipcRenderer.removeListener('torrent:error', listener);
        };
    },
};

contextBridge.exposeInMainWorld('meshy', meshyAPI);
