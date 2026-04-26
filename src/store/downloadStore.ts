import { create } from 'zustand';
import type { DownloadItem } from '../../shared/types';

// ─── Store interface ──────────────────────────────────────────────────────────

interface DownloadStore {
    items: DownloadItem[];
    setItems(items: DownloadItem[]): void;
    updateItem(item: DownloadItem): void;
    removeItem(infoHash: string): void;
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useDownloadStore = create<DownloadStore>((set) => ({
    items: [],

    /**
     * Replaces the entire items array.
     * Used when receiving a full snapshot from the main process (e.g., onProgress).
     */
    setItems(items: DownloadItem[]): void {
        set({ items });
    },

    /**
     * Finds the item by infoHash and replaces it.
     * If the item is not found, it is appended to the list.
     */
    updateItem(item: DownloadItem): void {
        set((state) => {
            const index = state.items.findIndex((i) => i.infoHash === item.infoHash);
            if (index === -1) {
                return { items: [...state.items, item] };
            }
            const updated = [...state.items];
            updated[index] = item;
            return { items: updated };
        });
    },

    /**
     * Filters out the item with the given infoHash.
     */
    removeItem(infoHash: string): void {
        set((state) => ({
            items: state.items.filter((i) => i.infoHash !== infoHash),
        }));
    },
}));
