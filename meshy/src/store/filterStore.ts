import { create } from 'zustand';
import type { TorrentStatus } from '../../shared/types';
import type { SortField, SortDirection } from '../utils/downloadFilters';

// ─── Store interface ──────────────────────────────────────────────────────────

interface FilterStore {
    searchTerm: string;
    selectedStatuses: TorrentStatus[];
    sortField: SortField;
    sortDirection: SortDirection;

    setSearchTerm(term: string): void;
    setSelectedStatuses(statuses: TorrentStatus[]): void;
    setSortField(field: SortField): void;
    setSortDirection(direction: SortDirection): void;
    toggleSortDirection(): void;
    resetFilters(): void;
}

// ─── Valores padrão ───────────────────────────────────────────────────────────

const DEFAULT_SEARCH_TERM = '';
const DEFAULT_SELECTED_STATUSES: TorrentStatus[] = [];
const DEFAULT_SORT_FIELD: SortField = 'addedAt';
const DEFAULT_SORT_DIRECTION: SortDirection = 'desc';

// ─── Store implementation ─────────────────────────────────────────────────────

export const useFilterStore = create<FilterStore>((set) => ({
    searchTerm: DEFAULT_SEARCH_TERM,
    selectedStatuses: DEFAULT_SELECTED_STATUSES,
    sortField: DEFAULT_SORT_FIELD,
    sortDirection: DEFAULT_SORT_DIRECTION,

    /** Atualiza o termo de busca por nome. */
    setSearchTerm(term: string): void {
        set({ searchTerm: term });
    },

    /** Atualiza o conjunto de status selecionados para filtragem. */
    setSelectedStatuses(statuses: TorrentStatus[]): void {
        set({ selectedStatuses: statuses });
    },

    /** Atualiza o campo de ordenação. */
    setSortField(field: SortField): void {
        set({ sortField: field });
    },

    /** Atualiza a direção de ordenação. */
    setSortDirection(direction: SortDirection): void {
        set({ sortDirection: direction });
    },

    /** Alterna a direção de ordenação entre 'asc' e 'desc'. */
    toggleSortDirection(): void {
        set((state) => ({
            sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc',
        }));
    },

    /** Restaura todos os filtros para os valores padrão. */
    resetFilters(): void {
        set({
            searchTerm: DEFAULT_SEARCH_TERM,
            selectedStatuses: DEFAULT_SELECTED_STATUSES,
            sortField: DEFAULT_SORT_FIELD,
            sortDirection: DEFAULT_SORT_DIRECTION,
        });
    },
}));
