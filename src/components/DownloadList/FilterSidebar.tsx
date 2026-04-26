import React from 'react';
import { useIntl } from 'react-intl';
import { SearchBar } from './SearchBar';
import { StatusFilter } from './StatusFilter';
import { SortSelector } from './SortSelector';
import styles from './FilterSidebar.module.css';

// ─── Componente FilterSidebar ─────────────────────────────────────────────────

/**
 * Painel lateral com controles de busca, filtro por status e ordenação.
 *
 * Exibido ao lado da lista de downloads quando o usuário clica no ícone
 * de busca na Activity Bar. Os controles são empilhados verticalmente
 * com seções rotuladas para clareza.
 */
export function FilterSidebar(): React.JSX.Element {
    const intl = useIntl();

    return (
        <aside className={styles.sidebar} aria-label={intl.formatMessage({ id: 'filter.sidebar.ariaLabel' })}>
            {/* Busca por nome */}
            <div className={styles.section}>
                <span className={styles.sectionTitle}>{intl.formatMessage({ id: 'filter.sidebar.search' })}</span>
                <SearchBar />
            </div>

            {/* Filtro por status */}
            <div className={styles.section}>
                <span className={styles.sectionTitle}>{intl.formatMessage({ id: 'filter.sidebar.status' })}</span>
                <StatusFilter />
            </div>

            {/* Ordenação */}
            <div className={styles.section}>
                <span className={styles.sectionTitle}>{intl.formatMessage({ id: 'filter.sidebar.sort' })}</span>
                <SortSelector />
            </div>
        </aside>
    );
}
