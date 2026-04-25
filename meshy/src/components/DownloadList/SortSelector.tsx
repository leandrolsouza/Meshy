import React, { useCallback } from 'react';
import { VscArrowUp, VscArrowDown } from 'react-icons/vsc';
import { useFilterStore } from '../../store/filterStore';
import type { SortField } from '../../utils/downloadFilters';
import styles from './SortSelector.module.css';

// ─── Labels em pt-BR para cada campo de ordenação ─────────────────────────────

const SORT_FIELD_LABELS: Record<SortField, string> = {
    addedAt: 'Data de adição',
    progress: 'Progresso',
    downloadSpeed: 'Velocidade de download',
    uploadSpeed: 'Velocidade de upload',
    name: 'Nome',
};

/** Ordem de exibição das opções no select. */
const ALL_SORT_FIELDS: SortField[] = [
    'addedAt',
    'progress',
    'downloadSpeed',
    'uploadSpeed',
    'name',
];

// ─── Componente SortSelector ──────────────────────────────────────────────────

/**
 * Seletor de ordenação da lista de downloads.
 *
 * Contém um `<select>` para escolher o campo de ordenação e um botão
 * para alternar a direção (ascendente ↑ / descendente ↓).
 * Dispara `setSortField` e `toggleSortDirection` no filterStore.
 */
export function SortSelector(): React.JSX.Element {
    const sortField = useFilterStore((state) => state.sortField);
    const sortDirection = useFilterStore((state) => state.sortDirection);
    const setSortField = useFilterStore((state) => state.setSortField);
    const toggleSortDirection = useFilterStore((state) => state.toggleSortDirection);

    // Atualiza o campo de ordenação ao mudar o select
    const handleFieldChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            setSortField(e.target.value as SortField);
        },
        [setSortField],
    );

    // Alterna a direção de ordenação
    const handleDirectionToggle = useCallback(() => {
        toggleSortDirection();
    }, [toggleSortDirection]);

    return (
        <div className={styles.container}>
            <select
                className={styles.select}
                value={sortField}
                onChange={handleFieldChange}
                aria-label="Ordenar lista de downloads"
            >
                {ALL_SORT_FIELDS.map((field) => (
                    <option key={field} value={field}>
                        {SORT_FIELD_LABELS[field]}
                    </option>
                ))}
            </select>
            <button
                type="button"
                className={styles.directionButton}
                onClick={handleDirectionToggle}
                aria-label="Alternar direção de ordenação"
            >
                {sortDirection === 'asc' ? <VscArrowUp /> : <VscArrowDown />}
            </button>
        </div>
    );
}
