import fc from 'fast-check';
import type { DownloadItem, TorrentStatus } from '../../shared/types';
import {
    filterByName,
    filterByStatus,
    sortItems,
    applyFilters,
    SortField,
    SortDirection,
} from '../../src/utils/downloadFilters';

// ─── Valores válidos de TorrentStatus ─────────────────────────────────────────

const TORRENT_STATUSES: TorrentStatus[] = [
    'queued',
    'resolving-metadata',
    'downloading',
    'paused',
    'completed',
    'error',
    'metadata-failed',
    'files-not-found',
];

// ─── Geradores reutilizáveis ──────────────────────────────────────────────────

/** Gera um valor aleatório de TorrentStatus */
export function arbitraryTorrentStatus(): fc.Arbitrary<TorrentStatus> {
    return fc.constantFrom(...TORRENT_STATUSES);
}

/** Gera um DownloadItem com valores aleatórios para todos os campos obrigatórios */
export function arbitraryDownloadItem(): fc.Arbitrary<DownloadItem> {
    return fc.record({
        infoHash: fc.hexaString({ minLength: 40, maxLength: 40 }),
        name: fc.string({ minLength: 0, maxLength: 100 }),
        totalSize: fc.nat(),
        downloadedSize: fc.nat(),
        progress: fc.float({ min: 0, max: 1, noNaN: true }),
        downloadSpeed: fc.nat(),
        uploadSpeed: fc.nat(),
        numPeers: fc.nat(),
        numSeeders: fc.nat(),
        timeRemaining: fc.nat(),
        status: arbitraryTorrentStatus(),
        destinationFolder: fc.string(),
        addedAt: fc.nat(),
    });
}

/** Gera strings de busca — incluindo vazio, espaços e caracteres especiais */
export function arbitrarySearchTerm(): fc.Arbitrary<string> {
    return fc.oneof(
        fc.constant(''),
        fc.constant('   '),
        fc.string({ minLength: 0, maxLength: 50 }),
        fc.stringOf(fc.constantFrom('.', '*', '?', '[', ']', '(', ')', '+', '^', '$', '\\', '|')),
    );
}

// ─── Valores válidos de SortField e SortDirection ─────────────────────────────

const SORT_FIELDS: SortField[] = ['addedAt', 'progress', 'downloadSpeed', 'uploadSpeed', 'name'];
const SORT_DIRECTIONS: SortDirection[] = ['asc', 'desc'];

/** Gera um valor aleatório de SortField */
export function arbitrarySortField(): fc.Arbitrary<SortField> {
    return fc.constantFrom(...SORT_FIELDS);
}

/** Gera um valor aleatório de SortDirection */
export function arbitrarySortDirection(): fc.Arbitrary<SortDirection> {
    return fc.constantFrom(...SORT_DIRECTIONS);
}

// ─── Propriedade 1: Filtragem por nome — corretude, pureza e identidade ───────

/**
 * Valida: Requisitos 1.2, 1.3, 7.1, 7.4
 *
 * Para qualquer array de DownloadItem e qualquer string de busca, filterByName deve:
 * (a) retornar apenas itens cujo nome contém o termo (case-insensitive)
 * (b) não excluir nenhum item que contenha o termo
 * (c) retornar todos os itens na mesma ordem quando o termo é vazio
 * (d) não mutar o array original
 */
describe('Feature: download-list-search-filter', () => {
    describe('Propriedade 1: Filtragem por nome — corretude, pureza e identidade', () => {
        it('todo item retornado contém o termo no nome (case-insensitive)', () => {
            fc.assert(
                fc.property(
                    fc.array(arbitraryDownloadItem()),
                    arbitrarySearchTerm(),
                    (items, searchTerm) => {
                        const result = filterByName(items, searchTerm);
                        const trimmed = searchTerm.trim().toLowerCase();

                        if (trimmed === '') return true;

                        return result.every((item) =>
                            item.name.toLowerCase().includes(trimmed),
                        );
                    },
                ),
                { numRuns: 100 },
            );
        });

        it('nenhum item excluído contém o termo no nome (case-insensitive)', () => {
            fc.assert(
                fc.property(
                    fc.array(arbitraryDownloadItem()),
                    arbitrarySearchTerm(),
                    (items, searchTerm) => {
                        const result = filterByName(items, searchTerm);
                        const trimmed = searchTerm.trim().toLowerCase();

                        if (trimmed === '') return true;

                        const resultSet = new Set(result);
                        const excluded = items.filter((item) => !resultSet.has(item));

                        return excluded.every(
                            (item) => !item.name.toLowerCase().includes(trimmed),
                        );
                    },
                ),
                { numRuns: 100 },
            );
        });

        it('termo vazio retorna todos os itens na mesma ordem', () => {
            fc.assert(
                fc.property(
                    fc.array(arbitraryDownloadItem()),
                    fc.constantFrom('', '   ', '  \t  '),
                    (items, emptyTerm) => {
                        const result = filterByName(items, emptyTerm);

                        if (result.length !== items.length) return false;

                        return result.every((item, i) => item === items[i]);
                    },
                ),
                { numRuns: 100 },
            );
        });

        it('o array original não é mutado', () => {
            fc.assert(
                fc.property(
                    fc.array(arbitraryDownloadItem()),
                    arbitrarySearchTerm(),
                    (items, searchTerm) => {
                        const originalLength = items.length;
                        const snapshot = [...items];

                        filterByName(items, searchTerm);

                        if (items.length !== originalLength) return false;

                        return items.every((item, i) => item === snapshot[i]);
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    // ─── Propriedade 2: Filtragem por status — corretude, pureza e identidade ─────

    /**
     * Valida: Requisitos 2.3, 2.4, 7.2, 7.5
     *
     * Para qualquer array de DownloadItem e qualquer subconjunto de TorrentStatus,
     * filterByStatus deve:
     * (a) retornar apenas itens cujo status está no conjunto selecionado
     * (b) não excluir nenhum item cujo status está no conjunto selecionado
     * (c) retornar todos os itens na mesma ordem quando o conjunto está vazio
     * (d) não mutar o array original
     */
    describe('Propriedade 2: Filtragem por status — corretude, pureza e identidade', () => {
        it('todo item retornado tem status no conjunto selecionado', () => {
            fc.assert(
                fc.property(
                    fc.array(arbitraryDownloadItem()),
                    fc.subarray(TORRENT_STATUSES),
                    (items, selectedStatuses) => {
                        const result = filterByStatus(items, selectedStatuses);

                        if (selectedStatuses.length === 0) return true;

                        const statusSet = new Set(selectedStatuses);
                        return result.every((item) => statusSet.has(item.status));
                    },
                ),
                { numRuns: 100 },
            );
        });

        it('nenhum item excluído tem status no conjunto selecionado', () => {
            fc.assert(
                fc.property(
                    fc.array(arbitraryDownloadItem()),
                    fc.subarray(TORRENT_STATUSES),
                    (items, selectedStatuses) => {
                        const result = filterByStatus(items, selectedStatuses);

                        if (selectedStatuses.length === 0) return true;

                        const resultSet = new Set(result);
                        const excluded = items.filter((item) => !resultSet.has(item));
                        const statusSet = new Set(selectedStatuses);

                        return excluded.every((item) => !statusSet.has(item.status));
                    },
                ),
                { numRuns: 100 },
            );
        });

        it('conjunto vazio retorna todos os itens na mesma ordem', () => {
            fc.assert(
                fc.property(fc.array(arbitraryDownloadItem()), (items) => {
                    const result = filterByStatus(items, []);

                    if (result.length !== items.length) return false;

                    return result.every((item, i) => item === items[i]);
                }),
                { numRuns: 100 },
            );
        });

        it('o array original não é mutado', () => {
            fc.assert(
                fc.property(
                    fc.array(arbitraryDownloadItem()),
                    fc.subarray(TORRENT_STATUSES),
                    (items, selectedStatuses) => {
                        const originalLength = items.length;
                        const snapshot = [...items];

                        filterByStatus(items, selectedStatuses);

                        if (items.length !== originalLength) return false;

                        return items.every((item, i) => item === snapshot[i]);
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    // ─── Propriedade 3: Ordenação — corretude e pureza ────────────────────────────

    /**
     * Valida: Requisitos 3.4, 7.3
     *
     * Para qualquer array de DownloadItem, qualquer SortField e qualquer SortDirection,
     * sortItems deve retornar um novo array (sem mutar o original) onde cada par adjacente
     * de itens está na ordem correta conforme campo e direção especificados.
     */
    describe('Propriedade 3: Ordenação — corretude e pureza', () => {
        it('cada par adjacente está na ordem correta conforme campo e direção', () => {
            fc.assert(
                fc.property(
                    fc.array(arbitraryDownloadItem()),
                    arbitrarySortField(),
                    arbitrarySortDirection(),
                    (items, sortField, sortDirection) => {
                        const result = sortItems(items, sortField, sortDirection);

                        for (let i = 0; i < result.length - 1; i++) {
                            const valA = result[i][sortField];
                            const valB = result[i + 1][sortField];

                            if (typeof valA === 'string' && typeof valB === 'string') {
                                const cmp = valA.localeCompare(valB);
                                if (sortDirection === 'asc' && cmp > 0) return false;
                                if (sortDirection === 'desc' && cmp < 0) return false;
                            } else {
                                if (sortDirection === 'asc' && (valA as number) > (valB as number))
                                    return false;
                                if (sortDirection === 'desc' && (valA as number) < (valB as number))
                                    return false;
                            }
                        }

                        return true;
                    },
                ),
                { numRuns: 100 },
            );
        });

        it('o array original não é mutado', () => {
            fc.assert(
                fc.property(
                    fc.array(arbitraryDownloadItem()),
                    arbitrarySortField(),
                    arbitrarySortDirection(),
                    (items, sortField, sortDirection) => {
                        const originalLength = items.length;
                        const snapshot = [...items];

                        sortItems(items, sortField, sortDirection);

                        if (items.length !== originalLength) return false;

                        return items.every((item, i) => item === snapshot[i]);
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    // ─── Propriedade 4: Composição de filtros é interseção ────────────────────────

    /**
     * Valida: Requisito 2.5
     *
     * Para qualquer array de DownloadItem, qualquer termo de busca e qualquer
     * conjunto de status selecionados, o resultado de applyFilters deve conter
     * exatamente os itens que satisfazem ambas as condições simultaneamente:
     * nome contém o termo (case-insensitive, trimmed) E status está no conjunto
     * selecionado (ou todos, se conjunto vazio).
     */
    describe('Propriedade 4: Composição de filtros é interseção', () => {
        it('applyFilters retorna exatamente os itens que satisfazem ambas as condições', () => {
            fc.assert(
                fc.property(
                    fc.array(arbitraryDownloadItem()),
                    arbitrarySearchTerm(),
                    fc.subarray(TORRENT_STATUSES),
                    arbitrarySortField(),
                    arbitrarySortDirection(),
                    (items, searchTerm, selectedStatuses, sortField, sortDirection) => {
                        const result = applyFilters(
                            items,
                            searchTerm,
                            selectedStatuses,
                            sortField,
                            sortDirection,
                        );

                        const trimmed = searchTerm.trim().toLowerCase();

                        // Calcula o conjunto esperado: itens que passam ambos os filtros
                        const expected = items.filter((item) => {
                            const passesName =
                                trimmed === '' ||
                                item.name.toLowerCase().includes(trimmed);
                            const passesStatus =
                                selectedStatuses.length === 0 ||
                                new Set(selectedStatuses).has(item.status);
                            return passesName && passesStatus;
                        });

                        // Compara conjuntos (ignorando ordem, pois applyFilters também ordena)
                        const resultHashes = new Set(result.map((item) => item.infoHash));
                        const expectedHashes = new Set(expected.map((item) => item.infoHash));

                        if (resultHashes.size !== expectedHashes.size) return false;

                        for (const hash of resultHashes) {
                            if (!expectedHashes.has(hash)) return false;
                        }

                        return true;
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    // ─── Propriedade 5: Inversão de direção de ordenação ──────────────────────────

    /**
     * Valida: Requisito 3.4
     *
     * Para qualquer array de DownloadItem e qualquer SortField, ordenar em direção
     * ascendente e depois em direção descendente deve produzir sequências de valores
     * do campo em ordem reversa uma da outra.
     *
     * Comparamos apenas os valores do campo de ordenação (não os itens completos)
     * para evitar problemas com estabilidade de ordenação quando há valores duplicados.
     */
    describe('Propriedade 5: Inversão de direção de ordenação', () => {
        it('valores do campo em asc, ao reverter, igualam valores do campo em desc', () => {
            fc.assert(
                fc.property(
                    fc.array(arbitraryDownloadItem()),
                    arbitrarySortField(),
                    (items, sortField) => {
                        const ascResult = sortItems(items, sortField, 'asc');
                        const descResult = sortItems(items, sortField, 'desc');

                        // Extrai apenas os valores do campo de ordenação
                        const ascValues = ascResult.map((item) => item[sortField]);
                        const descValues = descResult.map((item) => item[sortField]);

                        // Valores em asc, ao reverter, devem igualar valores em desc
                        const ascReversed = [...ascValues].reverse();

                        if (ascReversed.length !== descValues.length) return false;

                        return ascReversed.every((val, i) => val === descValues[i]);
                    },
                ),
                { numRuns: 100 },
            );
        });
    });
});
