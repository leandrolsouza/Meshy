import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import { SearchBar } from './SearchBar';
import { StatusFilter } from './StatusFilter';
import { SortSelector } from './SortSelector';
import { ConfirmDialog } from '../common/ConfirmDialog';
import styles from './DownloadListToolbar.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface DownloadListToolbarProps {
    /** Quantidade de downloads concluídos disponíveis para limpeza */
    completedCount: number;
    /** Callback para limpar todos os downloads concluídos */
    onClearCompleted: (deleteFiles: boolean) => void;
}

// ─── Componente DownloadListToolbar ───────────────────────────────────────────

/**
 * Barra de ferramentas da lista de downloads.
 *
 * Agrupa horizontalmente a barra de busca, o filtro de status, o seletor
 * de ordenação e o botão de limpar concluídos. O layout usa flexbox
 * responsivo com wrap para telas menores.
 */
export function DownloadListToolbar({
    completedCount,
    onClearCompleted,
}: DownloadListToolbarProps): React.JSX.Element {
    const intl = useIntl();
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    return (
        <div className={styles.toolbar}>
            {/* Linha 1: busca + ordenação + limpar concluídos */}
            <div className={styles.topRow}>
                <div className={styles.searchBarWrapper}>
                    <SearchBar />
                </div>
                <SortSelector />
                {completedCount > 0 && (
                    <button
                        className={`btn btn--danger ${styles.clearButton}`}
                        onClick={() => setIsConfirmOpen(true)}
                        aria-label={intl.formatMessage({ id: 'downloads.clearCompletedAriaLabel' })}
                    >
                        {intl.formatMessage({ id: 'downloads.clearCompleted' }, { count: completedCount })}
                    </button>
                )}
            </div>

            {/* Linha 2: filtros de status */}
            <div className={styles.bottomRow}>
                <StatusFilter />
            </div>

            <ConfirmDialog
                isOpen={isConfirmOpen}
                title={intl.formatMessage({ id: 'downloads.confirmClearCompleted.title' })}
                message={intl.formatMessage({ id: 'downloads.confirmClearCompleted.message' }, { count: completedCount })}
                onConfirmKeepFiles={() => {
                    setIsConfirmOpen(false);
                    onClearCompleted(false);
                }}
                onConfirmDeleteFiles={() => {
                    setIsConfirmOpen(false);
                    onClearCompleted(true);
                }}
                onCancel={() => setIsConfirmOpen(false)}
            />
        </div>
    );
}
