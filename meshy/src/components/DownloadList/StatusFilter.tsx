import React, { useCallback } from 'react';
import type { TorrentStatus } from '../../../shared/types';
import { useFilterStore } from '../../store/filterStore';
import styles from './StatusFilter.module.css';

// ─── Labels em pt-BR para cada status ─────────────────────────────────────────

const STATUS_LABELS: Record<TorrentStatus, string> = {
    queued: 'Na fila',
    'resolving-metadata': 'Resolvendo metadados',
    downloading: 'Baixando',
    paused: 'Pausado',
    completed: 'Concluído',
    error: 'Erro',
    'metadata-failed': 'Falha nos metadados',
    'files-not-found': 'Arquivos não encontrados',
};

/** Ordem de exibição dos status no filtro. */
const ALL_STATUSES: TorrentStatus[] = [
    'queued',
    'resolving-metadata',
    'downloading',
    'paused',
    'completed',
    'error',
    'metadata-failed',
    'files-not-found',
];

// ─── Componente StatusFilter ──────────────────────────────────────────────────

/**
 * Grupo de botões toggle para filtrar downloads por status.
 *
 * O botão "Todos" limpa a seleção (equivale a nenhum filtro de status).
 * Cada botão de status individual ativa/desativa aquele status na seleção.
 * Seleção múltipla é suportada.
 */
export function StatusFilter(): React.JSX.Element {
    const selectedStatuses = useFilterStore((state) => state.selectedStatuses);
    const setSelectedStatuses = useFilterStore((state) => state.setSelectedStatuses);

    // "Todos" está ativo quando nenhum status individual está selecionado
    const isAllActive = selectedStatuses.length === 0;

    // Clicar em "Todos" limpa a seleção
    const handleAllClick = useCallback(() => {
        setSelectedStatuses([]);
    }, [setSelectedStatuses]);

    // Clicar em um status individual ativa/desativa na seleção
    const handleStatusClick = useCallback(
        (status: TorrentStatus) => {
            const isSelected = selectedStatuses.includes(status);
            if (isSelected) {
                const next = selectedStatuses.filter((s) => s !== status);
                setSelectedStatuses(next);
            } else {
                setSelectedStatuses([...selectedStatuses, status]);
            }
        },
        [selectedStatuses, setSelectedStatuses],
    );

    return (
        <div role="group" aria-label="Filtrar downloads por status" className={styles.container}>
            <button
                type="button"
                className={`${styles.button} ${isAllActive ? styles.buttonActive : ''}`}
                aria-pressed={isAllActive}
                onClick={handleAllClick}
            >
                Todos
            </button>
            {ALL_STATUSES.map((status) => {
                const isActive = selectedStatuses.includes(status);
                return (
                    <button
                        key={status}
                        type="button"
                        className={`${styles.button} ${isActive ? styles.buttonActive : ''}`}
                        aria-pressed={isActive}
                        onClick={() => handleStatusClick(status)}
                    >
                        {STATUS_LABELS[status]}
                    </button>
                );
            })}
        </div>
    );
}
