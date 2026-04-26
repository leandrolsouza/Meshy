import { contextBridge, ipcRenderer } from 'electron';
import type {
    DownloadItem,
    AppSettings,
    IPCResponse,
    TorrentFileInfo,
    TrackerInfo,
    MeshyAPI,
} from '../shared/types';

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

    // ── File Selection ──────────────────────────────────────────────────────────

    getFiles(infoHash: string): Promise<IPCResponse<TorrentFileInfo[]>> {
        return ipcRenderer.invoke('torrent:get-files', { infoHash });
    },

    setFileSelection(
        infoHash: string,
        selectedIndices: number[],
    ): Promise<IPCResponse<TorrentFileInfo[]>> {
        return ipcRenderer.invoke('torrent:set-file-selection', { infoHash, selectedIndices });
    },

    // ── Trackers (por torrent) ──────────────────────────────────────────────────

    getTrackers(infoHash: string): Promise<IPCResponse<TrackerInfo[]>> {
        return ipcRenderer.invoke('tracker:get', { infoHash });
    },

    addTracker(infoHash: string, url: string): Promise<IPCResponse<TrackerInfo[]>> {
        return ipcRenderer.invoke('tracker:add', { infoHash, url });
    },

    removeTracker(infoHash: string, url: string): Promise<IPCResponse<TrackerInfo[]>> {
        return ipcRenderer.invoke('tracker:remove', { infoHash, url });
    },

    applyGlobalTrackers(infoHash: string): Promise<IPCResponse<TrackerInfo[]>> {
        return ipcRenderer.invoke('tracker:apply-global', { infoHash });
    },

    // ── Limites de velocidade por torrent ────────────────────────────────────────

    setTorrentSpeedLimits(
        infoHash: string,
        downloadLimit: number,
        uploadLimit: number,
    ): Promise<IPCResponse<DownloadItem>> {
        return ipcRenderer.invoke('torrent:set-speed-limits', {
            infoHash,
            downloadLimit,
            uploadLimit,
        });
    },

    getTorrentSpeedLimits(
        infoHash: string,
    ): Promise<IPCResponse<{ downloadSpeedLimitKBps: number; uploadSpeedLimitKBps: number }>> {
        return ipcRenderer.invoke('torrent:get-speed-limits', { infoHash });
    },

    // ── Trackers globais ────────────────────────────────────────────────────────

    getGlobalTrackers(): Promise<IPCResponse<string[]>> {
        return ipcRenderer.invoke('tracker:get-global');
    },

    addGlobalTracker(url: string): Promise<IPCResponse<string[]>> {
        return ipcRenderer.invoke('tracker:add-global', { url });
    },

    removeGlobalTracker(url: string): Promise<IPCResponse<string[]>> {
        return ipcRenderer.invoke('tracker:remove-global', { url });
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
