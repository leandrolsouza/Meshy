import { useEffect } from 'react';
import type { DownloadItem, IPCResponse, TorrentFileInfo } from '../../shared/types';
import { useDownloadStore } from '../store/downloadStore';

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages the downloads state by:
 * - Registering a `window.meshy.onProgress` listener that updates the store every second.
 * - Registering a `window.meshy.onError` listener to handle torrent errors.
 * - Exposing action functions that delegate to the contextBridge API.
 *
 * Cleans up all listeners on unmount.
 */
export function useDownloads() {
    const { setItems, updateItem, removeItem } = useDownloadStore();

    // ── Register IPC event listeners ──────────────────────────────────────────

    useEffect(() => {
        // onProgress: main process emits the full list of active items every second
        const removeProgressListener = window.meshy.onProgress((items: DownloadItem[]) => {
            setItems(items);
        });

        // onError: main process emits an error event for a specific torrent
        const removeErrorListener = window.meshy.onError(
            (data: { infoHash: string; message: string }) => {
                console.error(`[useDownloads] Torrent error for ${data.infoHash}: ${data.message}`);
                // Update the item status to 'error' in the store
                const items = useDownloadStore.getState().items;
                const item = items.find((i) => i.infoHash === data.infoHash);
                if (item) {
                    updateItem({ ...item, status: 'error' });
                }
            },
        );

        // Cleanup: remove both listeners when the component unmounts
        return () => {
            removeProgressListener();
            removeErrorListener();
        };
    }, [setItems, updateItem]);

    // ── Actions ───────────────────────────────────────────────────────────────

    /**
     * Adds a torrent from a local `.torrent` file path.
     * Updates the store with the new item on success.
     */
    async function addTorrentFile(filePath: string): Promise<IPCResponse<DownloadItem>> {
        const response = await window.meshy.addTorrentFile(filePath);
        if (response.success) {
            updateItem(response.data);
        }
        return response;
    }

    /**
     * Adds a torrent from a magnet URI.
     * Updates the store with the new item on success.
     */
    async function addMagnetLink(magnetUri: string): Promise<IPCResponse<DownloadItem>> {
        const response = await window.meshy.addMagnetLink(magnetUri);
        if (response.success) {
            updateItem(response.data);
        }
        return response;
    }

    /**
     * Pauses the torrent with the given infoHash.
     */
    async function pause(infoHash: string): Promise<IPCResponse<void>> {
        const response = await window.meshy.pause(infoHash);
        if (response.success) {
            const item = useDownloadStore.getState().items.find((i) => i.infoHash === infoHash);
            if (item) {
                updateItem({ ...item, status: 'paused' });
            }
        }
        return response;
    }

    /**
     * Resumes the torrent with the given infoHash.
     */
    async function resume(infoHash: string): Promise<IPCResponse<void>> {
        const response = await window.meshy.resume(infoHash);
        if (response.success) {
            const item = useDownloadStore.getState().items.find((i) => i.infoHash === infoHash);
            if (item) {
                updateItem({ ...item, status: 'downloading' });
            }
        }
        return response;
    }

    /**
     * Removes the torrent with the given infoHash.
     * Optionally deletes the downloaded files.
     */
    async function remove(infoHash: string, deleteFiles: boolean): Promise<IPCResponse<void>> {
        const response = await window.meshy.remove(infoHash, deleteFiles);
        if (response.success) {
            removeItem(infoHash);
        }
        return response;
    }

    /**
     * Retrieves the list of files for a torrent identified by infoHash.
     */
    async function getFiles(infoHash: string): Promise<IPCResponse<TorrentFileInfo[]>> {
        return window.meshy.getFiles(infoHash);
    }

    /**
     * Applies file selection for a torrent: selects the given indices, deselects the rest.
     */
    async function setFileSelection(
        infoHash: string,
        selectedIndices: number[],
    ): Promise<IPCResponse<TorrentFileInfo[]>> {
        return window.meshy.setFileSelection(infoHash, selectedIndices);
    }

    /**
     * Define limites de velocidade individuais (download e upload) para um torrent.
     * Atualiza o item no store em caso de sucesso.
     */
    async function setTorrentSpeedLimits(
        infoHash: string,
        downloadLimit: number,
        uploadLimit: number,
    ): Promise<IPCResponse<DownloadItem>> {
        const response = await window.meshy.setTorrentSpeedLimits(
            infoHash,
            downloadLimit,
            uploadLimit,
        );
        if (response.success) {
            updateItem(response.data);
        }
        return response;
    }

    return {
        items: useDownloadStore((state) => state.items),
        addTorrentFile,
        addMagnetLink,
        pause,
        resume,
        remove,
        getFiles,
        setFileSelection,
        setTorrentSpeedLimits,
    };
}
