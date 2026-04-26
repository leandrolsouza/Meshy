import React, { useMemo, useCallback, useState } from 'react';
import { useDownloads } from '../../hooks/useDownloads';
import { useFilterStore } from '../../store/filterStore';
import { applyFilters } from '../../utils/downloadFilters';
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
    const { items, pause, resume, remove, setTorrentSpeedLimits } = useDownloads();
    const { searchTerm, selectedStatuses, sortField, sortDirection, resetFilters } =
        useFilterStore();

    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    // Pipeline de filtragem e ordenação aplicado sobre os itens do store
    const filteredItems = useMemo(
        () => applyFilters(items, searchTerm, selectedStatuses, sortField, sortDirection),
        [items, searchTerm, selectedStatuses, sortField, sortDirection],
    );

    // Contagem de downloads concluídos (para o botão "Limpar concluídos")
    const completedCount = useMemo(
        () => items.filter((i) => i.status === 'completed').length,
        [items],
    );

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
                <p className={styles.emptyTitle}>Nenhum download ativo.</p>
                <p className={styles.emptyHint}>
                    Adicione um torrent arrastando um arquivo <code>.torrent</code> ou colando um
                    magnet link.
                </p>
            </div>
        );
    }

    // Mensagem para a região aria-live
    const ariaMessage =
        filteredItems.length === 0
            ? 'Nenhum download encontrado'
            : filteredItems.length === 1
                ? '1 download encontrado'
                : `${filteredItems.length} downloads encontrados`;

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
                        aria-label="Limpar downloads concluídos"
                    >
                        Limpar concluídos ({completedCount})
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
                        Exibindo {filteredItems.length} de {items.length} downloads
                    </span>
                    <button
                        type="button"
                        className={styles.clearFiltersLink}
                        onClick={resetFilters}
                    >
                        Limpar filtros
                    </button>
                </div>
            )}

            {filteredItems.length === 0 ? (
                // Estado vazio filtrado: filtros excluem todos os itens
                <div className={styles.filteredEmpty}>
                    <p className={styles.emptyTitle}>
                        Nenhum download corresponde aos filtros aplicados.
                    </p>
                    <button
                        type="button"
                        className={styles.clearFiltersButton}
                        onClick={resetFilters}
                    >
                        Limpar filtros
                    </button>
                </div>
            ) : (
                // Lista normal com itens filtrados e ordenados
                <div className={styles.list}>
                    {filteredItems.map((item) => (
                        <DownloadItem
                            key={item.infoHash}
                            item={item}
                            onPause={pause}
                            onResume={resume}
                            onRemove={(infoHash, deleteFiles) => remove(infoHash, deleteFiles)}
                            onSetSpeedLimits={setTorrentSpeedLimits}
                        />
                    ))}
                </div>
            )}

            <ConfirmDialog
                isOpen={isConfirmOpen}
                title="Limpar downloads concluídos"
                message={`Deseja remover ${completedCount === 1 ? '1 download concluído' : `${completedCount} downloads concluídos`} da lista? Os arquivos baixados podem ser mantidos ou excluídos do disco.`}
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
