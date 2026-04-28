import { create } from 'zustand';
import type { DownloadItem } from '../../shared/types';

// ─── Store interface ──────────────────────────────────────────────────────────

interface DownloadStore {
    items: DownloadItem[];
    setItems(items: DownloadItem[]): void;
    mergeItems(incoming: DownloadItem[]): void;
    updateItem(item: DownloadItem): void;
    removeItem(infoHash: string): void;
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useDownloadStore = create<DownloadStore>((set) => ({
    items: [],

    /**
     * Replaces the entire items array.
     * Usado para carga inicial (getAll) onde não há estado local a preservar.
     */
    setItems(items: DownloadItem[]): void {
        set({ items });
    },

    /**
     * Merge inteligente: atualiza a lista com o snapshot do main process.
     *
     * O main process é a fonte de verdade absoluta. O status no main process
     * é atualizado sincronamente ANTES das operações assíncronas do engine,
     * então o snapshot sempre reflete o estado correto.
     *
     * A única exceção é o status 'error' definido localmente via onError,
     * que pode chegar antes do próximo snapshot de progresso.
     */
    mergeItems(incoming: DownloadItem[]): void {
        set((state) => {
            const localMap = new Map<string, DownloadItem>();
            for (const item of state.items) {
                localMap.set(item.infoHash, item);
            }

            const merged = incoming.map((remote) => {
                const local = localMap.get(remote.infoHash);
                if (!local) return remote;

                // Preservar status local 'error' quando o main ainda reporta 'downloading'.
                // O onError do renderer pode marcar como error antes do próximo snapshot.
                if (local.status === 'error' && remote.status === 'downloading') {
                    return { ...remote, status: local.status } as DownloadItem;
                }

                return remote;
            });

            return { items: merged };
        });
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
