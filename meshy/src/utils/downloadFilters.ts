import type { DownloadItem, TorrentStatus } from '../../shared/types';

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Campos disponíveis para ordenação da lista de downloads */
export type SortField = 'addedAt' | 'progress' | 'downloadSpeed' | 'uploadSpeed' | 'name';

/** Direção de ordenação */
export type SortDirection = 'asc' | 'desc';

// ─── Filtragem por nome ───────────────────────────────────────────────────────

/**
 * Retorna os itens cujo nome contém o termo de busca (case-insensitive).
 * Se o termo estiver vazio, retorna todos os itens sem alteração na ordem.
 * Não modifica o array original.
 */
export function filterByName(items: DownloadItem[], searchTerm: string): DownloadItem[] {
    const trimmed = searchTerm.trim();
    if (trimmed === '') {
        return [...items];
    }
    const lowerTerm = trimmed.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(lowerTerm));
}

// ─── Filtragem por status ─────────────────────────────────────────────────────

/**
 * Retorna os itens cujo status está no conjunto de status selecionados.
 * Se o conjunto estiver vazio (representando "Todos"), retorna todos os itens.
 * Não modifica o array original.
 */
export function filterByStatus(
    items: DownloadItem[],
    selectedStatuses: TorrentStatus[],
): DownloadItem[] {
    if (selectedStatuses.length === 0) {
        return [...items];
    }
    const statusSet = new Set(selectedStatuses);
    return items.filter((item) => statusSet.has(item.status));
}

// ─── Ordenação ────────────────────────────────────────────────────────────────

/**
 * Retorna um novo array ordenado pelo critério e direção especificados.
 * Não modifica o array original.
 */
export function sortItems(
    items: DownloadItem[],
    sortField: SortField,
    sortDirection: SortDirection,
): DownloadItem[] {
    const sorted = [...items];
    const direction = sortDirection === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];

        // Comparação de strings (campo 'name')
        if (typeof valA === 'string' && typeof valB === 'string') {
            return direction * valA.localeCompare(valB);
        }

        // Comparação numérica para os demais campos
        return direction * ((valA as number) - (valB as number));
    });

    return sorted;
}

// ─── Pipeline completo ────────────────────────────────────────────────────────

/**
 * Aplica filtragem por nome, filtragem por status e ordenação em sequência.
 * Conveniência para uso no componente DownloadList.
 */
export function applyFilters(
    items: DownloadItem[],
    searchTerm: string,
    selectedStatuses: TorrentStatus[],
    sortField: SortField,
    sortDirection: SortDirection,
): DownloadItem[] {
    const byName = filterByName(items, searchTerm);
    const byStatus = filterByStatus(byName, selectedStatuses);
    return sortItems(byStatus, sortField, sortDirection);
}
