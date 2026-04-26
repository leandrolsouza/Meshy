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
import { isValidSpeedLimit } from '../../../shared/validators';
import { ProgressBar } from '../common/ProgressBar';
import { SpeedDisplay } from '../common/SpeedDisplay';
import { formatBytes } from '../../utils/formatters';
import { resolveErrorMessage } from '../../utils/resolveErrorMessage';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { FileSelector } from '../FileSelector/FileSelector';
import { TrackerPanel } from '../TrackerPanel/TrackerPanel';
import styles from './DownloadItem.module.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    onSetSpeedLimits: (
        infoHash: string,
        downloadLimit: number,
        uploadLimit: number,
    ) => Promise<{ success: boolean; error?: string }>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DownloadItem({
    item,
    onPause,
    onResume,
    onRemove,
    onSetSpeedLimits,
}: DownloadItemProps): React.JSX.Element {
    const intl = useIntl();
    const progressPercent = Math.round(item.progress * 100);
    const isCompleted = item.status === 'completed';
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

    // ── Speed limit state ────────────────────────────────────────────────────
    const [dlLimitInput, setDlLimitInput] = useState(String(item.downloadSpeedLimitKBps ?? 0));
    const [ulLimitInput, setUlLimitInput] = useState(String(item.uploadSpeedLimitKBps ?? 0));
    const [limitsLoading, setLimitsLoading] = useState(false);
    const [limitsError, setLimitsError] = useState<string | null>(null);
    const [dlValidationError, setDlValidationError] = useState<string | null>(null);
    const [ulValidationError, setUlValidationError] = useState<string | null>(null);

    // Sincronizar inputs quando o item muda externamente (ex: via onProgress)
    useEffect(() => {
        if (!limitsLoading) {
            setDlLimitInput(String(item.downloadSpeedLimitKBps ?? 0));
            setUlLimitInput(String(item.uploadSpeedLimitKBps ?? 0));
        }
    }, [item.downloadSpeedLimitKBps, item.uploadSpeedLimitKBps, limitsLoading]);

    // Can expand when torrent is not in resolving-metadata state
    const canExpand = item.status !== 'resolving-metadata' && item.status !== 'queued';

    // ── Fetch files when expanded (Task 6.2) ─────────────────────────────────
    // Busca inicial ao expandir
    useEffect(() => {
        if (!expanded) return;

        let cancelled = false;
        setFilesLoading(true);
        setFilesError(null);

        window.meshy
            .getFiles(item.infoHash)
            .then((response) => {
                if (cancelled) return;
                setFilesLoading(false);
                if (response.success) {
                    setFiles(response.data);
                } else {
                    setFilesError(resolveErrorMessage(intl, response.error));
                }
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setFilesLoading(false);
                setFilesError(err instanceof Error ? err.message : intl.formatMessage({ id: 'downloads.filesError' }));
            });

        return () => {
            cancelled = true;
        };
    }, [expanded, item.infoHash]);

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
                        err instanceof Error ? err.message : intl.formatMessage({ id: 'downloads.speedLimits.error' }),
                    );
                });
        },
        [item.infoHash, intl],
    );

    // ── Handle speed limit apply ────────────────────────────────────────────
    const handleApplySpeedLimits = useCallback(async () => {
        // Validar download limit
        const dlValue = dlLimitInput.trim() === '' ? 0 : Number(dlLimitInput);
        const ulValue = ulLimitInput.trim() === '' ? 0 : Number(ulLimitInput);

        const invalidMsg = intl.formatMessage({ id: 'downloads.speedLimits.invalidValue' });
        const errorMsg = intl.formatMessage({ id: 'downloads.speedLimits.error' });
        let hasError = false;

        if (!isValidSpeedLimit(dlValue)) {
            setDlValidationError(invalidMsg);
            hasError = true;
        } else {
            setDlValidationError(null);
        }

        if (!isValidSpeedLimit(ulValue)) {
            setUlValidationError(invalidMsg);
            hasError = true;
        } else {
            setUlValidationError(null);
        }

        if (hasError) return;

        setLimitsLoading(true);
        setLimitsError(null);

        try {
            const response = await onSetSpeedLimits(item.infoHash, dlValue, ulValue);
            if (!response.success) {
                setLimitsError(resolveErrorMessage(intl, response.error ?? errorMsg));
            }
        } catch (err: unknown) {
            setLimitsError(err instanceof Error ? err.message : errorMsg);
        } finally {
            setLimitsLoading(false);
        }
    }, [item.infoHash, dlLimitInput, ulLimitInput, onSetSpeedLimits, intl]);

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
                    {item.name}
                </span>
                <div className={styles.headerRight}>
                    {hasFileCount && (
                        <span className={styles.fileCount}>
                            {intl.formatMessage({ id: 'downloads.fileCount' }, { selected: item.selectedFileCount, total: item.totalFileCount })}
                        </span>
                    )}
                    <span className={styles.status}>{intl.formatMessage({ id: STATUS_LABEL_KEYS[item.status] ?? item.status })}</span>
                </div>
            </div>

            {/* Progress bar */}
            <ProgressBar
                value={progressPercent}
                max={100}
                label={intl.formatMessage({ id: 'downloads.progress.label' }, { name: item.name, percent: progressPercent })}
                variant={progressVariant(item.status)}
            />

            {/* Details */}
            <div className={styles.details}>
                <span>
                    {formatBytes(item.downloadedSize)} / {formatBytes(item.totalSize)} (
                    {progressPercent}%)
                </span>
                {!isCompleted && (
                    <SpeedDisplay speedBytesPerSec={item.downloadSpeed} icon={<VscArrowDown />} />
                )}
                {!isCompleted && (
                    <SpeedDisplay speedBytesPerSec={item.uploadSpeed} icon={<VscArrowUp />} />
                )}
                {!isCompleted && (
                    <span>
                        {intl.formatMessage({ id: 'downloads.seedersAndPeers' }, { seeders: item.numSeeders, peers: item.numPeers })}
                    </span>
                )}
                {isCompleted ? (
                    <span>{intl.formatMessage({ id: 'downloads.timeElapsed' }, { time: formatTimeParts(item.elapsedMs ?? 0) ?? intl.formatMessage({ id: 'downloads.timeElapsed.none' }) })}</span>
                ) : (
                    <span>{intl.formatMessage({ id: 'downloads.timeRemaining' }, { time: formatTimeParts(item.timeRemaining) ?? intl.formatMessage({ id: 'downloads.timeRemaining.calculating' }) })}</span>
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
                                ? intl.formatMessage({ id: 'downloads.actions.collapseFilesAriaLabel' })
                                : intl.formatMessage({ id: 'downloads.actions.expandFilesAriaLabel' })
                        }
                        aria-expanded={expanded}
                    >
                        {expanded ? <VscChevronDown /> : <VscChevronRight />} {intl.formatMessage({ id: 'downloads.actions.expandFiles' })}
                    </button>
                )}
                {canExpand && (
                    <button
                        className="btn"
                        onClick={handleToggleTrackers}
                        aria-label={
                            trackersExpanded
                                ? intl.formatMessage({ id: 'downloads.actions.collapseTrackersAriaLabel' })
                                : intl.formatMessage({ id: 'downloads.actions.expandTrackersAriaLabel' })
                        }
                        aria-expanded={trackersExpanded}
                    >
                        {trackersExpanded ? <VscChevronDown /> : <VscChevronRight />} {intl.formatMessage({ id: 'downloads.actions.expandTrackers' })}
                    </button>
                )}
                {item.status === 'downloading' && (
                    <button
                        className="btn"
                        onClick={() => onPause(item.infoHash)}
                        aria-label={intl.formatMessage({ id: 'downloads.actions.pauseAriaLabel' }, { name: item.name })}
                    >
                        <VscDebugPause /> {intl.formatMessage({ id: 'downloads.actions.pause' })}
                    </button>
                )}
                {item.status === 'paused' && (
                    <button
                        className="btn"
                        onClick={() => onResume(item.infoHash)}
                        aria-label={intl.formatMessage({ id: 'downloads.actions.resumeAriaLabel' }, { name: item.name })}
                    >
                        <VscPlay /> {intl.formatMessage({ id: 'downloads.actions.resume' })}
                    </button>
                )}
                <button
                    className="btn btn--danger"
                    onClick={() => setIsConfirmDialogOpen(true)}
                    aria-label={intl.formatMessage({ id: 'downloads.actions.removeAriaLabel' }, { name: item.name })}
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

            {/* Seção de limites de velocidade por torrent (Tasks 8.1–8.5) */}
            {expanded && (
                <div className={styles.speedLimitsSection} data-testid="speed-limits-section">
                    <div className={styles.speedLimitsTitle}>{intl.formatMessage({ id: 'downloads.speedLimits.title' })}</div>
                    <div className={styles.speedLimitsRow}>
                        <div className={styles.speedLimitField}>
                            <label
                                className={styles.speedLimitLabel}
                                htmlFor={`dl-limit-${item.infoHash}`}
                            >
                                <VscArrowDown /> {intl.formatMessage({ id: 'downloads.speedLimits.download' })}
                            </label>
                            <input
                                id={`dl-limit-${item.infoHash}`}
                                type="number"
                                className={styles.speedLimitInput}
                                value={dlLimitInput}
                                onChange={(e) => {
                                    setDlLimitInput(e.target.value);
                                    setDlValidationError(null);
                                }}
                                min={0}
                                step={1}
                                disabled={limitsLoading}
                                aria-label={intl.formatMessage({ id: 'downloads.speedLimits.downloadAriaLabel' })}
                                aria-invalid={!!dlValidationError}
                            />
                            {dlValidationError && (
                                <span className={styles.speedLimitValidationError} role="alert">
                                    {dlValidationError}
                                </span>
                            )}
                            {Number(dlLimitInput) === 0 && !dlValidationError && (
                                <span className={styles.speedLimitHint}>
                                    {intl.formatMessage({ id: 'downloads.speedLimits.usingGlobal' })}
                                </span>
                            )}
                        </div>
                        <div className={styles.speedLimitField}>
                            <label
                                className={styles.speedLimitLabel}
                                htmlFor={`ul-limit-${item.infoHash}`}
                            >
                                <VscArrowUp /> {intl.formatMessage({ id: 'downloads.speedLimits.upload' })}
                            </label>
                            <input
                                id={`ul-limit-${item.infoHash}`}
                                type="number"
                                className={styles.speedLimitInput}
                                value={ulLimitInput}
                                onChange={(e) => {
                                    setUlLimitInput(e.target.value);
                                    setUlValidationError(null);
                                }}
                                min={0}
                                step={1}
                                disabled={limitsLoading}
                                aria-label={intl.formatMessage({ id: 'downloads.speedLimits.uploadAriaLabel' })}
                                aria-invalid={!!ulValidationError}
                            />
                            {ulValidationError && (
                                <span className={styles.speedLimitValidationError} role="alert">
                                    {ulValidationError}
                                </span>
                            )}
                            {Number(ulLimitInput) === 0 && !ulValidationError && (
                                <span className={styles.speedLimitHint}>
                                    {intl.formatMessage({ id: 'downloads.speedLimits.usingGlobal' })}
                                </span>
                            )}
                        </div>
                        <button
                            className={`btn ${styles.speedLimitApplyBtn}`}
                            onClick={handleApplySpeedLimits}
                            disabled={limitsLoading}
                            aria-label={intl.formatMessage({ id: 'downloads.speedLimits.applyAriaLabel' })}
                        >
                            {limitsLoading ? intl.formatMessage({ id: 'common.applying' }) : intl.formatMessage({ id: 'common.apply' })}
                        </button>
                    </div>
                    {limitsError && (
                        <div
                            className={styles.speedLimitError}
                            role="alert"
                            data-testid="speed-limits-error"
                        >
                            {limitsError}
                        </div>
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
                message={intl.formatMessage({ id: 'downloads.confirmRemove.message' }, { name: item.name })}
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
