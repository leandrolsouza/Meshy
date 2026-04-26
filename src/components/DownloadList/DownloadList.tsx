import React, { useMemo, useCallback, useState } from 'react';
import { useIntl } from 'react-intl';
import { VscChevronDown, VscChevronRight } from 'react-icons/vsc';
import { useDownloads } from '../../hooks/useDownloads';
import { useFilterStore } from '../../store/filterStore';
import { applyFilters, groupByStatus } from '../../utils/downloadFilters';
import type { StatusGroup } from '../../utils/downloadFilters';
import { DownloadItem } from './DownloadItem';
import { ConfirmDialog } from '../common/ConfirmDialog';
import styles from './DownloadList.module.css';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renderiza a lista completa de downloads ativos do store.
 *
 * Aplica o pipeline de filtragem (busca por nome, filtro por status e ordenação)
 * usando o estado do filterStore. Os controles de busca, filtro e ordenação
 * ficam no FilterSidebar (painel lateral). Aqui ficam apenas o botão de limpar
 * concluídos, a mensagem de estado vazio filtrado e a região aria-live.
 */
export function DownloadList(): React.JSX.Element {
    const intl = useIntl();
    const { items, pause, resume, remove } = useDownloads();
    const { searchTerm, selectedStatuses, sortField, sortDirection, resetFilters } =
        useFilterStore();

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<StatusGroup>>(new Set());

    // Pipeline de filtragem e ordenação aplicado sobre os itens do store
    const filteredItems = useMemo(
        () => applyFilters(items, searchTerm, selectedStatuses, sortField, sortDirection),
        [items, searchTerm, selectedStatuses, sortField, sortDirection],
    );

    // Agrupamento por status sobre os itens filtrados
    const groups = useMemo(() => groupByStatus(filteredItems), [filteredItems]);

    // Contagem de downloads concluídos (para o botão "Limpar concluídos")
    const completedCount = useMemo(
        () => items.filter((i) => i.status === 'completed').length,
        [items],
    );

    // Toggle de colapso de um grupo
    const toggleGroup = useCallback((groupId: StatusGroup) => {
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            return next;
        });
    }, []);

    // Limpa todos os downloads concluídos da lista
    const handleClearCompleted = useCallback(
        (deleteFiles: boolean) => {
            const completedItems = items.filter((i) => i.status === 'completed');
            completedItems.forEach((i) => remove(i.infoHash, deleteFiles));
        },
        [items, remove],
    );

    // Estado vazio absoluto: nenhum download no store
    if (items.length === 0) {
        return (
            <div className={styles.empty}>
                <p className={styles.emptyTitle}>
                    {intl.formatMessage({ id: 'downloads.empty.title' })}
                </p>
                <p className={styles.emptyHint}>
                    {intl.formatMessage({ id: 'downloads.empty.hint' })}
                </p>
            </div>
        );
    }

    // Mensagem para a região aria-live
    const ariaMessage =
        filteredItems.length === 0
            ? intl.formatMessage({ id: 'downloads.ariaLive.none' })
            : filteredItems.length === 1
                ? intl.formatMessage({ id: 'downloads.ariaLive.one' })
                : intl.formatMessage(
                    { id: 'downloads.ariaLive.many' },
                    { count: filteredItems.length },
                );

    // Verifica se algum filtro está ativo
    const hasActiveFilters = searchTerm.trim() !== '' || selectedStatuses.length > 0;

    return (
        <div className={styles.container}>
            {/* Barra de ações inline (limpar concluídos) */}
            {completedCount > 0 && (
                <div className={styles.actionsBar}>
                    <button
                        className="btn btn--danger"
                        onClick={() => setIsConfirmOpen(true)}
                        aria-label={intl.formatMessage({ id: 'downloads.clearCompletedAriaLabel' })}
                    >
                        {intl.formatMessage(
                            { id: 'downloads.clearCompleted' },
                            { count: completedCount },
                        )}
                    </button>
                </div>
            )}

            {/* Região aria-live para anunciar contagem de resultados */}
            <div className={styles.ariaLive} aria-live="polite" role="status">
                {ariaMessage}
            </div>

            {/* Indicador de filtros ativos */}
            {hasActiveFilters && filteredItems.length > 0 && (
                <div className={styles.filterIndicator}>
                    <span>
                        {intl.formatMessage(
                            { id: 'downloads.filterIndicator' },
                            { filtered: filteredItems.length, total: items.length },
                        )}
                    </span>
                    <button
                        type="button"
                        className={styles.clearFiltersLink}
                        onClick={resetFilters}
                    >
                        {intl.formatMessage({ id: 'downloads.clearFilters' })}
                    </button>
                </div>
            )}

            {filteredItems.length === 0 ? (
                // Estado vazio filtrado: filtros excluem todos os itens
                <div className={styles.filteredEmpty}>
                    <p className={styles.emptyTitle}>
                        {intl.formatMessage({ id: 'downloads.filteredEmpty.title' })}
                    </p>
                    <button
                        type="button"
                        className={styles.clearFiltersButton}
                        onClick={resetFilters}
                    >
                        {intl.formatMessage({ id: 'downloads.clearFilters' })}
                    </button>
                </div>
            ) : (
                // Lista agrupada por status
                <div className={styles.list}>
                    {groups.map((group) => {
                        const isCollapsed = collapsedGroups.has(group.id);
                        const groupLabel = intl.formatMessage({ id: group.labelKey });
                        return (
                            <div key={group.id} className={styles.group}>
                                <button
                                    type="button"
                                    className={styles.groupHeader}
                                    onClick={() => toggleGroup(group.id)}
                                    aria-expanded={!isCollapsed}
                                    aria-label={intl.formatMessage(
                                        { id: 'downloads.group.toggleAriaLabel' },
                                        { group: groupLabel, count: group.items.length },
                                    )}
                                >
                                    <span className={styles.groupChevron}>
                                        {isCollapsed ? <VscChevronRight /> : <VscChevronDown />}
                                    </span>
                                    <span className={styles.groupLabel}>{groupLabel}</span>
                                    <span className={styles.groupCount}>
                                        {intl.formatMessage(
                                            { id: 'downloads.group.count' },
                                            { count: group.items.length },
                                        )}
                                    </span>
                                </button>
                                {!isCollapsed && (
                                    <div className={styles.groupItems}>
                                        {group.items.map((item) => (
                                            <DownloadItem
                                                key={item.infoHash}
                                                item={item}
                                                onPause={pause}
                                                onResume={resume}
                                                onRemove={(infoHash, deleteFiles) =>
                                                    remove(infoHash, deleteFiles)
                                                }
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <ConfirmDialog
                isOpen={isConfirmOpen}
                title={intl.formatMessage({ id: 'downloads.confirmClearCompleted.title' })}
                message={intl.formatMessage(
                    { id: 'downloads.confirmClearCompleted.message' },
                    { count: completedCount },
                )}
                onConfirmKeepFiles={() => {
                    setIsConfirmOpen(false);
                    handleClearCompleted(false);
                }}
                onConfirmDeleteFiles={() => {
                    setIsConfirmOpen(false);
                    handleClearCompleted(true);
                }}
                onCancel={() => setIsConfirmOpen(false)}
            />
        </div>
    );
}
