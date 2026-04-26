import React, { useCallback } from 'react';
import { useIntl } from 'react-intl';
import { VscArrowUp, VscArrowDown } from 'react-icons/vsc';
import { useFilterStore } from '../../store/filterStore';
import type { SortField } from '../../utils/downloadFilters';
import styles from './SortSelector.module.css';

// ─── Mapeamento de campos de ordenação para chaves de tradução ────────────────

const SORT_FIELD_LABEL_KEYS: Record<SortField, string> = {
    addedAt: 'filter.sort.addedAt',
    progress: 'filter.sort.progress',
    downloadSpeed: 'filter.sort.downloadSpeed',
    uploadSpeed: 'filter.sort.uploadSpeed',
    name: 'filter.sort.name',
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
    const intl = useIntl();
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
                aria-label={intl.formatMessage({ id: 'filter.sort.ariaLabel' })}
            >
                {ALL_SORT_FIELDS.map((field) => (
                    <option key={field} value={field}>
                        {intl.formatMessage({ id: SORT_FIELD_LABEL_KEYS[field] })}
                    </option>
                ))}
            </select>
            <button
                type="button"
                className={styles.directionButton}
                onClick={handleDirectionToggle}
                aria-label={intl.formatMessage({ id: 'filter.sort.directionAriaLabel' })}
            >
                {sortDirection === 'asc' ? <VscArrowUp /> : <VscArrowDown />}
            </button>
        </div>
    );
}
