import { create } from 'zustand';
import type { DownloadItem } from '../../shared/types';

// ─── Store interface ──────────────────────────────────────────────────────────

interface DownloadStore {
    items: DownloadItem[];
    setItems(items: DownloadItem[]): void;
    mergeItems(items: DownloadItem[]): void;
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
     * Merge inteligente: atualiza a lista com o snapshot do main process,
     * mas preserva mudanças locais de status feitas via updateItem (ex: onError)
     * que o main process ainda não refletiu.
     *
     * O main process é a fonte de verdade para dados dinâmicos (progress, speed, peers),
     * mas o renderer pode ter aplicado uma transição de status (ex: 'error' via onError)
     * que o próximo snapshot de progresso ainda não contém.
     *
     * Estratégia: se o item local tem status 'error' e o snapshot do main ainda
     * mostra 'downloading', preserva o status local. Para todos os outros campos,
     * o snapshot do main prevalece.
     */
    mergeItems(incoming: DownloadItem[]): void {
        set((state) => {
            // Indexar itens locais por infoHash para lookup O(1)
            const localMap = new Map<string, DownloadItem>();
            for (const item of state.items) {
                localMap.set(item.infoHash, item);
            }

            const merged = incoming.map((remote) => {
                const local = localMap.get(remote.infoHash);
                if (!local) return remote;

                // Preservar status local 'error' quando o main ainda reporta 'downloading'.
                // O main process eventualmente também transicionará para 'error',
                // momento em que ambos estarão sincronizados.
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
