import React from 'react';
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
    return (
        <aside className={styles.sidebar} aria-label="Filtros de download">
            {/* Busca por nome */}
            <div className={styles.section}>
                <span className={styles.sectionTitle}>Busca</span>
                <SearchBar />
            </div>

            {/* Filtro por status */}
            <div className={styles.section}>
                <span className={styles.sectionTitle}>Status</span>
                <StatusFilter />
            </div>

            {/* Ordenação */}
            <div className={styles.section}>
                <span className={styles.sectionTitle}>Ordenação</span>
                <SortSelector />
            </div>
        </aside>
    );
}
