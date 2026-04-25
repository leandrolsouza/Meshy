import React, { useState } from 'react';
import type { DownloadItem as DownloadItemType } from '../../../shared/types';
import { ProgressBar } from '../common/ProgressBar';
import { SpeedDisplay } from '../common/SpeedDisplay';
import { formatBytes } from '../../utils/formatters';
import { ConfirmDialog } from '../common/ConfirmDialog';
import styles from './DownloadItem.module.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeRemaining(ms: number): string {
    if (!isFinite(ms) || ms <= 0) return 'Calculando...';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function formatElapsed(ms: number): string {
    if (!ms || ms <= 0) return '—';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function statusLabel(status: DownloadItemType['status']): string {
    const labels: Record<DownloadItemType['status'], string> = {
        queued: 'Na fila',
        'resolving-metadata': 'Resolvendo metadados...',
        downloading: 'Baixando',
        paused: 'Pausado',
        completed: 'Concluído',
        error: 'Erro',
        'metadata-failed': 'Falha nos metadados',
        'files-not-found': 'Arquivos não encontrados',
    };
    return labels[status] ?? status;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DownloadItemProps {
    item: DownloadItemType;
    onPause: (infoHash: string) => void;
    onResume: (infoHash: string) => void;
    onRemove: (infoHash: string, deleteFiles: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DownloadItem({
    item,
    onPause,
    onResume,
    onRemove,
}: DownloadItemProps): React.JSX.Element {
    const progressPercent = Math.round(item.progress * 100);
    const isCompleted = item.status === 'completed';
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

    return (
        <div className={styles.card}>
            {/* Name and status */}
            <div className={styles.header}>
                <span className={styles.name} title={item.name}>
                    {item.name}
                </span>
                <span className={styles.status}>
                    {statusLabel(item.status)}
                </span>
            </div>

            {/* Progress bar */}
            <ProgressBar
                value={progressPercent}
                max={100}
                label={`Progresso de ${item.name}: ${progressPercent}%`}
            />

            {/* Details */}
            <div className={styles.details}>
                <span>{formatBytes(item.downloadedSize)} / {formatBytes(item.totalSize)} ({progressPercent}%)</span>
                {!isCompleted && <SpeedDisplay speedBytesPerSec={item.downloadSpeed} label="↓" />}
                {!isCompleted && <SpeedDisplay speedBytesPerSec={item.uploadSpeed} label="↑" />}
                {!isCompleted && (
                    <span>{item.numSeeders} seeders · {item.numPeers} peers</span>
                )}
                {isCompleted ? (
                    <span>Tempo total: {formatElapsed(item.elapsedMs ?? 0)}</span>
                ) : (
                    <span>Restante: {formatTimeRemaining(item.timeRemaining)}</span>
                )}
            </div>

            {/* Actions */}
            <div className={styles.actions}>
                {item.status === 'downloading' && (
                    <button className="btn" onClick={() => onPause(item.infoHash)} aria-label={`Pausar ${item.name}`}>
                        Pausar
                    </button>
                )}
                {item.status === 'paused' && (
                    <button className="btn" onClick={() => onResume(item.infoHash)} aria-label={`Retomar ${item.name}`}>
                        Retomar
                    </button>
                )}
                {item.status !== 'completed' && (
                    <button
                        className="btn btn--danger"
                        onClick={() => setIsConfirmDialogOpen(true)}
                        aria-label={`Remover ${item.name}`}
                    >
                        Remover
                    </button>
                )}
            </div>

            <ConfirmDialog
                isOpen={isConfirmDialogOpen}
                title="Remover download"
                message={`Deseja remover "${item.name}"? Os arquivos baixados podem ser mantidos ou excluídos do disco.`}
                onConfirmKeepFiles={() => { setIsConfirmDialogOpen(false); onRemove(item.infoHash, false); }}
                onConfirmDeleteFiles={() => { setIsConfirmDialogOpen(false); onRemove(item.infoHash, true); }}
                onCancel={() => setIsConfirmDialogOpen(false)}
            />
        </div>
    );
}
