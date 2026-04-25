import { useFilterStore } from '../../src/store/filterStore';

// ─── Reset do store antes de cada teste ───────────────────────────────────────

beforeEach(() => {
    useFilterStore.getState().resetFilters();
});

// ─── Testes unitários para o filterStore ──────────────────────────────────────

/**
 * Valida: Requisitos 5.1, 5.2
 */
describe('filterStore', () => {
    describe('valores padrão iniciais', () => {
        it('searchTerm é string vazia', () => {
            expect(useFilterStore.getState().searchTerm).toBe('');
        });

        it('selectedStatuses é array vazio', () => {
            expect(useFilterStore.getState().selectedStatuses).toEqual([]);
        });

        it('sortField é addedAt', () => {
            expect(useFilterStore.getState().sortField).toBe('addedAt');
        });

        it('sortDirection é desc', () => {
            expect(useFilterStore.getState().sortDirection).toBe('desc');
        });
    });

    describe('setSearchTerm', () => {
        it('atualiza o searchTerm', () => {
            useFilterStore.getState().setSearchTerm('ubuntu');
            expect(useFilterStore.getState().searchTerm).toBe('ubuntu');
        });

        it('permite definir string vazia', () => {
            useFilterStore.getState().setSearchTerm('algo');
            useFilterStore.getState().setSearchTerm('');
            expect(useFilterStore.getState().searchTerm).toBe('');
        });
    });

    describe('setSelectedStatuses', () => {
        it('atualiza os selectedStatuses', () => {
            useFilterStore.getState().setSelectedStatuses(['downloading', 'paused']);
            expect(useFilterStore.getState().selectedStatuses).toEqual(['downloading', 'paused']);
        });

        it('permite definir array vazio (equivale a "Todos")', () => {
            useFilterStore.getState().setSelectedStatuses(['completed']);
            useFilterStore.getState().setSelectedStatuses([]);
            expect(useFilterStore.getState().selectedStatuses).toEqual([]);
        });
    });

    describe('setSortField', () => {
        it('atualiza o sortField', () => {
            useFilterStore.getState().setSortField('progress');
            expect(useFilterStore.getState().sortField).toBe('progress');
        });
    });

    describe('setSortDirection', () => {
        it('atualiza o sortDirection', () => {
            useFilterStore.getState().setSortDirection('asc');
            expect(useFilterStore.getState().sortDirection).toBe('asc');
        });
    });

    describe('toggleSortDirection', () => {
        it('alterna de desc para asc', () => {
            expect(useFilterStore.getState().sortDirection).toBe('desc');
            useFilterStore.getState().toggleSortDirection();
            expect(useFilterStore.getState().sortDirection).toBe('asc');
        });

        it('alterna de asc para desc', () => {
            useFilterStore.getState().setSortDirection('asc');
            useFilterStore.getState().toggleSortDirection();
            expect(useFilterStore.getState().sortDirection).toBe('desc');
        });
    });

    describe('resetFilters', () => {
        it('restaura todos os valores padrão após alterações', () => {
            useFilterStore.getState().setSearchTerm('teste');
            useFilterStore.getState().setSelectedStatuses(['downloading', 'error']);
            useFilterStore.getState().setSortField('name');
            useFilterStore.getState().setSortDirection('asc');

            useFilterStore.getState().resetFilters();

            const state = useFilterStore.getState();
            expect(state.searchTerm).toBe('');
            expect(state.selectedStatuses).toEqual([]);
            expect(state.sortField).toBe('addedAt');
            expect(state.sortDirection).toBe('desc');
        });
    });
});
