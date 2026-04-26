import React, { useState, useCallback, useEffect } from 'react';
import { useIntl } from 'react-intl';
import {
    VscArrowDown,
    VscArrowUp,
    VscDebugPause,
    VscPlay,
    VscTrash,
    VscChevronDown,
    VscChevronRight,
} from 'react-icons/vsc';
import type { DownloadItem as DownloadItemType, TorrentFileInfo } from '../../../shared/types';
import { ProgressBar } from '../common/ProgressBar';
import { SpeedDisplay } from '../common/SpeedDisplay';
import { formatBytes } from '../../utils/formatters';
import { resolveErrorMessage } from '../../utils/resolveErrorMessage';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { FileSelector } from '../FileSelector/FileSelector';
import { TrackerPanel } from '../TrackerPanel/TrackerPanel';
import styles from './DownloadItem.module.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Detecta se o nome é um infoHash (hex longo) e retorna versão truncada. */
const HEX_HASH_RE = /^[0-9a-f]{32,}$/i;

function displayName(name: string): string {
    if (HEX_HASH_RE.test(name)) {
        return `${name.slice(0, 8)}…${name.slice(-8)}`;
    }
    return name;
}

function formatTimeParts(ms: number): string | null {
    if (!isFinite(ms) || ms <= 0) return null;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function progressVariant(status: DownloadItemType['status']): 'default' | 'success' | 'error' {
    if (status === 'completed') return 'success';
    if (status === 'error' || status === 'metadata-failed' || status === 'files-not-found')
        return 'error';
    return 'default';
}

const STATUS_LABEL_KEYS: Record<DownloadItemType['status'], string> = {
    queued: 'downloads.statusLabel.queued',
    'resolving-metadata': 'downloads.statusLabel.resolvingMetadata',
    downloading: 'downloads.statusLabel.downloading',
    paused: 'downloads.statusLabel.paused',
    completed: 'downloads.statusLabel.completed',
    error: 'downloads.statusLabel.error',
    'metadata-failed': 'downloads.statusLabel.metadataFailed',
    'files-not-found': 'downloads.statusLabel.filesNotFound',
};

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
    const intl = useIntl();
    const progressPercent = Math.round(item.progress * 100);
    const isCompleted = item.status === 'completed';
    const isPaused = item.status === 'paused';
    const isWaiting =
        item.status === 'queued' || item.status === 'resolving-metadata';
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

    // ── File selector expansion state (Task 6.1) ─────────────────────────────
    const [expanded, setExpanded] = useState(false);

    // ── Tracker panel expansion state (Task 8.5) ─────────────────────────────
    const [trackersExpanded, setTrackersExpanded] = useState(false);

    const [files, setFiles] = useState<TorrentFileInfo[]>([]);
    const [filesLoading, setFilesLoading] = useState(false);
    const [filesError, setFilesError] = useState<string | null>(null);
    const [selectionLoading, setSelectionLoading] = useState(false);
    const [selectionError, setSelectionError] = useState<string | null>(null);

    // Can expand when torrent is not in resolving-metadata state
    const canExpand = item.status !== 'resolving-metadata' && item.status !== 'queued';

    // ── Fetch files when expanded (Task 6.2) ─────────────────────────────────
    // Busca inicial ao expandir. O setState no início do effect é intencional:
    // precisamos sinalizar loading antes do fetch assíncrono.
    useEffect(() => {
        if (!expanded) return;

        let cancelled = false;

        const fetchFiles = async (): Promise<void> => {
            try {
                const response = await window.meshy.getFiles(item.infoHash);
                if (cancelled) return;
                if (response.success) {
                    setFiles(response.data);
                    setFilesError(null);
                } else {
                    setFilesError(resolveErrorMessage(intl, response.error));
                }
            } catch (err: unknown) {
                if (cancelled) return;
                setFilesError(
                    err instanceof Error
                        ? err.message
                        : intl.formatMessage({ id: 'downloads.filesError' }),
                );
            } finally {
                if (!cancelled) {
                    setFilesLoading(false);
                }
            }
        };

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFilesLoading(true);
        setFilesError(null);
        fetchFiles();

        return () => {
            cancelled = true;
        };
    }, [expanded, item.infoHash, intl]);

    // ── Atualizar progresso dos arquivos periodicamente enquanto baixando ─────
    const isActive = item.status === 'downloading' || item.status === 'resolving-metadata';

    useEffect(() => {
        if (!expanded || !isActive || files.length === 0) return;

        let cancelled = false;

        const interval = setInterval(() => {
            window.meshy
                .getFiles(item.infoHash)
                .then((response) => {
                    if (cancelled) return;
                    if (response.success) {
                        setFiles(response.data);
                    }
                })
                .catch(() => {
                    // Silenciar erros de polling — não sobrescrever o estado
                });
        }, 1500);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [expanded, isActive, item.infoHash, files.length]);

    // ── Handle selection change (Task 6.3) ───────────────────────────────────
    const handleSelectionChange = useCallback(
        (selectedIndices: number[]) => {
            setSelectionLoading(true);
            setSelectionError(null);

            window.meshy
                .setFileSelection(item.infoHash, selectedIndices)
                .then((response) => {
                    setSelectionLoading(false);
                    if (response.success) {
                        setFiles(response.data);
                    } else {
                        setSelectionError(resolveErrorMessage(intl, response.error));
                    }
                })
                .catch((err: unknown) => {
                    setSelectionLoading(false);
                    setSelectionError(
                        err instanceof Error
                            ? err.message
                            : intl.formatMessage({ id: 'downloads.speedLimits.error' }),
                    );
                });
        },
        [item.infoHash, intl],
    );

    // ── Toggle expand/collapse ───────────────────────────────────────────────
    const handleToggleExpand = useCallback(() => {
        setExpanded((prev) => !prev);
    }, []);

    // ── Toggle tracker panel ─────────────────────────────────────────────────
    const handleToggleTrackers = useCallback(() => {
        setTrackersExpanded((prev) => !prev);
    }, []);

    // ── File count display (Task 6.4) ────────────────────────────────────────
    const hasFileCount =
        item.selectedFileCount !== undefined &&
        item.totalFileCount !== undefined &&
        item.totalFileCount > 0;

    return (
        <div className={styles.card}>
            {/* Name and status */}
            <div className={styles.header}>
                <span className={styles.name} title={item.name}>
                    {displayName(item.name)}
                </span>
                <div className={styles.headerRight}>
                    {hasFileCount && (
                        <span className={styles.fileCount}>
                            {intl.formatMessage(
                                { id: 'downloads.fileCount' },
                                { selected: item.selectedFileCount, total: item.totalFileCount },
                            )}
                        </span>
                    )}
                    <span className={styles.status}>
                        {intl.formatMessage({ id: STATUS_LABEL_KEYS[item.status] ?? item.status })}
                    </span>
                </div>
            </div>

            {/* Progress bar */}
            <ProgressBar
                value={progressPercent}
                max={100}
                label={intl.formatMessage(
                    { id: 'downloads.progress.label' },
                    { name: item.name, percent: progressPercent },
                )}
                variant={progressVariant(item.status)}
            />

            {/* Details */}
            <div className={styles.details}>
                <span>
                    {formatBytes(item.downloadedSize)} / {formatBytes(item.totalSize)} (
                    {progressPercent}%)
                </span>
                {!isCompleted && !isPaused && !isWaiting && (
                    <SpeedDisplay speedBytesPerSec={item.downloadSpeed} icon={<VscArrowDown />} />
                )}
                {!isCompleted && !isPaused && !isWaiting && (
                    <SpeedDisplay speedBytesPerSec={item.uploadSpeed} icon={<VscArrowUp />} />
                )}
                {!isCompleted && !isPaused && !isWaiting && (
                    <span>
                        {intl.formatMessage(
                            { id: 'downloads.seedersAndPeers' },
                            { seeders: item.numSeeders, peers: item.numPeers },
                        )}
                    </span>
                )}
                {isCompleted ? (
                    <span>
                        {intl.formatMessage(
                            { id: 'downloads.timeElapsed' },
                            {
                                time:
                                    formatTimeParts(item.elapsedMs ?? 0) ??
                                    intl.formatMessage({ id: 'downloads.timeElapsed.none' }),
                            },
                        )}
                    </span>
                ) : isPaused || isWaiting ? null : (
                    <span>
                        {intl.formatMessage(
                            { id: 'downloads.timeRemaining' },
                            {
                                time:
                                    formatTimeParts(item.timeRemaining) ??
                                    intl.formatMessage({
                                        id: 'downloads.timeRemaining.calculating',
                                    }),
                            },
                        )}
                    </span>
                )}
            </div>

            {/* Actions */}
            <div className={styles.actions}>
                {canExpand && (
                    <button
                        className="btn"
                        onClick={handleToggleExpand}
                        aria-label={
                            expanded
                                ? intl.formatMessage({
                                    id: 'downloads.actions.collapseFilesAriaLabel',
                                })
                                : intl.formatMessage({
                                    id: 'downloads.actions.expandFilesAriaLabel',
                                })
                        }
                        aria-expanded={expanded}
                    >
                        {expanded ? <VscChevronDown /> : <VscChevronRight />}{' '}
                        {intl.formatMessage({ id: 'downloads.actions.expandFiles' })}
                    </button>
                )}
                {canExpand && (
                    <button
                        className="btn"
                        onClick={handleToggleTrackers}
                        aria-label={
                            trackersExpanded
                                ? intl.formatMessage({
                                    id: 'downloads.actions.collapseTrackersAriaLabel',
                                })
                                : intl.formatMessage({
                                    id: 'downloads.actions.expandTrackersAriaLabel',
                                })
                        }
                        aria-expanded={trackersExpanded}
                    >
                        {trackersExpanded ? <VscChevronDown /> : <VscChevronRight />}{' '}
                        {intl.formatMessage({ id: 'downloads.actions.expandTrackers' })}
                    </button>
                )}
                {item.status === 'downloading' && (
                    <button
                        className="btn"
                        onClick={() => onPause(item.infoHash)}
                        aria-label={intl.formatMessage(
                            { id: 'downloads.actions.pauseAriaLabel' },
                            { name: item.name },
                        )}
                    >
                        <VscDebugPause /> {intl.formatMessage({ id: 'downloads.actions.pause' })}
                    </button>
                )}
                {item.status === 'paused' && (
                    <button
                        className="btn"
                        onClick={() => onResume(item.infoHash)}
                        aria-label={intl.formatMessage(
                            { id: 'downloads.actions.resumeAriaLabel' },
                            { name: item.name },
                        )}
                    >
                        <VscPlay /> {intl.formatMessage({ id: 'downloads.actions.resume' })}
                    </button>
                )}
                <button
                    className="btn btn--danger"
                    onClick={() => setIsConfirmDialogOpen(true)}
                    aria-label={intl.formatMessage(
                        { id: 'downloads.actions.removeAriaLabel' },
                        { name: item.name },
                    )}
                >
                    <VscTrash /> {intl.formatMessage({ id: 'common.remove' })}
                </button>
            </div>

            {/* Expanded file selector section (Task 6.2) */}
            {expanded && (
                <div className={styles.fileSelectorSection}>
                    {filesLoading && !files.length && (
                        <div
                            className={styles.fileSelectorLoading}
                            role="status"
                            aria-live="polite"
                        >
                            {intl.formatMessage({ id: 'downloads.filesLoading' })}
                        </div>
                    )}
                    {filesError && (
                        <div className={styles.fileSelectorError} role="alert">
                            {filesError}
                        </div>
                    )}
                    {files.length > 0 && (
                        <FileSelector
                            files={files}
                            onSelectionChange={handleSelectionChange}
                            loading={selectionLoading}
                            error={selectionError}
                        />
                    )}
                </div>
            )}

            {/* Expanded tracker panel section (Task 8.5) */}
            {trackersExpanded && (
                <div className={styles.trackerPanelSection}>
                    <TrackerPanel infoHash={item.infoHash} />
                </div>
            )}

            <ConfirmDialog
                isOpen={isConfirmDialogOpen}
                title={intl.formatMessage({ id: 'downloads.confirmRemove.title' })}
                message={intl.formatMessage(
                    { id: 'downloads.confirmRemove.message' },
                    { name: item.name },
                )}
                onConfirmKeepFiles={() => {
                    setIsConfirmDialogOpen(false);
                    onRemove(item.infoHash, false);
                }}
                onConfirmDeleteFiles={() => {
                    setIsConfirmDialogOpen(false);
                    onRemove(item.infoHash, true);
                }}
                onCancel={() => setIsConfirmDialogOpen(false)}
            />
        </div>
    );
}
