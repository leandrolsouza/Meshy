import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import type { DiskSpaceInfo, TorrentPreview, TorrentSource } from '../../../shared/types';
import { isValidMagnetUri } from '../../../shared/validators';
import { useDownloadStore } from '../../store/downloadStore';
import { formatBytes } from '../../utils/formatters';
import { resolveErrorMessage } from '../../utils/resolveErrorMessage';
import { FileSelector } from '../FileSelector/FileSelector';
import styles from './AddTorrentModal.module.css';

interface AddTorrentModalProps {
    isOpen: boolean;
    onClose: () => void;
    inline?: boolean;
    initialSources?: TorrentSource[];
}
const FOCUSABLE_SEL =
    'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex="0"]';

/** Todos os caminhos de adição passam por metadados → confirmação → transferência. */
export function AddTorrentModal({
    isOpen,
    onClose,
    inline = false,
    initialSources,
}: AddTorrentModalProps): React.JSX.Element | null {
    const intl = useIntl();
    const [magnetUri, setMagnetUri] = useState('');
    const [preview, setPreview] = useState<TorrentPreview | null>(null);
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [destinationFolder, setDestinationFolder] = useState('');
    const [space, setSpace] = useState<DiskSpaceInfo | null>(null);
    const [spaceError, setSpaceError] = useState<string | null>(null);
    const [spaceLoading, setSpaceLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preparing, setPreparing] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [folderLoading, setFolderLoading] = useState(false);
    const [remainingCount, setRemainingCount] = useState(0);
    const [canRetry, setCanRetry] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const requestRef = useRef<string | null>(null);
    const mounted = useRef(false);
    const pendingSources = useRef<TorrentSource[]>([]);
    const currentSource = useRef<TorrentSource | null>(null);
    const spaceGeneration = useRef(0);

    const cancelRequest = useCallback(() => {
        const requestId = requestRef.current;
        requestRef.current = null;
        if (requestId) void window.meshy.cancelTorrentPreparation(requestId).catch(() => {});
    }, []);

    const prepare = useCallback(
        async (source: TorrentSource) => {
            cancelRequest();
            const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
            requestRef.current = requestId;
            currentSource.current = source;
            setCanRetry(true);
            setPreparing(true);
            setPreview(null);
            setSpace(null);
            setError(null);
            try {
                const response = await window.meshy.prepareTorrent(requestId, source);
                if (!mounted.current || requestRef.current !== requestId) return;
                if (response.success) {
                    setPreview(response.data);
                    setSelectedIndices(response.data.files.map((file) => file.index));
                } else setError(resolveErrorMessage(intl, response.error));
            } catch {
                if (mounted.current && requestRef.current === requestId)
                    setError(intl.formatMessage({ id: 'addTorrent.errorGeneric' }));
            } finally {
                if (mounted.current && requestRef.current === requestId) setPreparing(false);
            }
        },
        [cancelRequest, intl],
    );

    useEffect(() => {
        mounted.current = isOpen;
        return () => {
            mounted.current = false;
            cancelRequest();
        };
    }, [isOpen, cancelRequest]);

    useEffect(() => {
        if (!isOpen) {
            cancelRequest();
            return;
        }
        let active = true;
        void window.meshy
            .getSettings()
            .then((response) => {
                if (active && response.success)
                    setDestinationFolder(response.data.destinationFolder);
            })
            .catch(() => {
                if (active) setError(intl.formatMessage({ id: 'addTorrent.errorGeneric' }));
            });
        const previousFocus = document.activeElement as HTMLElement | null;
        textareaRef.current?.focus();
        return () => {
            active = false;
            previousFocus?.focus();
        };
    }, [isOpen, cancelRequest, intl]);

    useEffect(() => {
        if (!isOpen || !initialSources?.length) return;
        pendingSources.current = initialSources.slice(1);
        setRemainingCount(pendingSources.current.length);
        void prepare(initialSources[0]!);
        return cancelRequest;
    }, [isOpen, initialSources, prepare, cancelRequest]);

    // Ignora consultas obsoletas após trocar seleção, pasta ou fechar o painel.
    useEffect(() => {
        if (!isOpen || !preview || !destinationFolder) return;
        let active = true;
        const refresh = async (): Promise<void> => {
            const generation = ++spaceGeneration.current;
            setSpaceLoading(true);
            setSpaceError(null);
            setSpace(null);
            try {
                const response = await window.meshy.getDiskSpace(
                    preview.requestId,
                    destinationFolder,
                    selectedIndices,
                );
                if (!active || generation !== spaceGeneration.current) return;
                if (response.success) setSpace(response.data);
                else setSpaceError(resolveErrorMessage(intl, response.error));
            } catch {
                if (active && generation === spaceGeneration.current)
                    setSpaceError(
                        intl.formatMessage({ id: 'error.destination.diskSpaceUnavailable' }),
                    );
            } finally {
                if (active && generation === spaceGeneration.current) setSpaceLoading(false);
            }
        };
        void refresh();
        const timer = setInterval(() => void refresh(), 5000);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [isOpen, preview, destinationFolder, selectedIndices, intl]);

    useEffect(() => {
        if (!isOpen || !preview || inline) return;
        containerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SEL)?.focus();
    }, [isOpen, preview, inline]);

    const close = useCallback(() => {
        if (confirming) return;
        cancelRequest();
        pendingSources.current = [];
        currentSource.current = null;
        setCanRetry(false);
        setPreview(null);
        setPreparing(false);
        setError(null);
        setMagnetUri('');
        onClose();
    }, [cancelRequest, confirming, onClose]);

    const submit = async (event: React.FormEvent): Promise<void> => {
        event.preventDefault();
        const lines = magnetUri
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
        if (!lines.length) {
            setError(intl.formatMessage({ id: 'addTorrent.magnetLink.empty' }));
            return;
        }
        const invalid = lines.findIndex((line) => !isValidMagnetUri(line));
        if (invalid !== -1) {
            setError(
                intl.formatMessage(
                    { id: 'addTorrent.magnetLink.invalidLine' },
                    { line: invalid + 1 },
                ),
            );
            return;
        }
        const sources: TorrentSource[] = lines.map((line) => ({ kind: 'magnet', magnetUri: line }));
        pendingSources.current = sources.slice(1);
        setRemainingCount(pendingSources.current.length);
        await prepare(sources[0]!);
    };

    const selectFile = async (): Promise<void> => {
        setFolderLoading(true);
        setError(null);
        try {
            const response = await window.meshy.selectTorrentFile();
            if (mounted.current && response.success) {
                pendingSources.current = [];
                setRemainingCount(0);
                await prepare({ kind: 'file', filePath: response.data });
            }
        } catch {
            if (mounted.current) setError(intl.formatMessage({ id: 'addTorrent.errorGeneric' }));
        } finally {
            if (mounted.current) setFolderLoading(false);
        }
    };

    const selectFolder = async (): Promise<void> => {
        setFolderLoading(true);
        try {
            const response = await window.meshy.selectFolder();
            if (mounted.current && response.success) {
                setSpace(null);
                setDestinationFolder(response.data);
            }
        } catch {
            if (mounted.current) setError(intl.formatMessage({ id: 'addTorrent.errorGeneric' }));
        } finally {
            if (mounted.current) setFolderLoading(false);
        }
    };

    const confirm = async (): Promise<void> => {
        if (!preview || confirming) return;
        const requestId = preview.requestId;
        setConfirming(true);
        setError(null);
        try {
            const response = await window.meshy.confirmTorrent(
                requestId,
                destinationFolder,
                selectedIndices,
            );
            if (!mounted.current || requestRef.current !== requestId) return;
            if (!response.success) {
                setError(resolveErrorMessage(intl, response.error));
                setSpace(null);
                return;
            }
            useDownloadStore.getState().updateItem(response.data);
            requestRef.current = null;
            const next = pendingSources.current.shift();
            setRemainingCount(pendingSources.current.length);
            if (next) await prepare(next);
            else {
                setPreview(null);
                setMagnetUri('');
                onClose();
            }
        } catch {
            if (mounted.current) setError(intl.formatMessage({ id: 'addTorrent.errorGeneric' }));
        } finally {
            if (mounted.current) setConfirming(false);
        }
    };

    const keyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
        if (event.key !== 'Tab' || inline) return;
        const elements = Array.from(
            containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SEL) ?? [],
        );
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
        }
    };
    if (!isOpen) return null;
    const selectedBytes =
        preview?.files
            .filter((file) => selectedIndices.includes(file.index))
            .reduce((sum, file) => sum + file.length, 0) ?? 0;
    const content = (
        <>
            {preparing && <p role="status">{intl.formatMessage({ id: 'addTorrent.preparing' })}</p>}
            {remainingCount > 0 && (
                <p>
                    {intl.formatMessage({ id: 'addTorrent.remaining' }, { count: remainingCount })}
                </p>
            )}
            {preview ? (
                <>
                    <h3 className={styles.previewName}>{preview.name}</h3>
                    <p>
                        {intl.formatMessage(
                            { id: 'addTorrent.selectedSize' },
                            { size: formatBytes(selectedBytes) },
                        )}
                    </p>
                    <div className={styles.fileSelectionSection}>
                        <FileSelector
                            files={preview.files.map((file) => ({
                                ...file,
                                selected: selectedIndices.includes(file.index),
                            }))}
                            onSelectionChange={(indices) => {
                                setSpace(null);
                                setSelectedIndices(indices);
                            }}
                            disabled={confirming}
                        />
                    </div>
                    <label className="label" htmlFor="torrent-destination">
                        {intl.formatMessage({ id: 'settings.general.destinationFolder' })}
                    </label>
                    <div className={styles.folderRow}>
                        <input
                            id="torrent-destination"
                            className="input"
                            value={destinationFolder}
                            readOnly
                        />
                        <button
                            className="btn"
                            type="button"
                            onClick={() => void selectFolder()}
                            disabled={confirming || folderLoading}
                        >
                            {intl.formatMessage({ id: 'settings.general.selectFolder' })}
                        </button>
                    </div>
                    {spaceLoading && (
                        <p role="status">
                            {intl.formatMessage({ id: 'addTorrent.checkingSpace' })}
                        </p>
                    )}
                    {space && (
                        <div className={styles.spaceSummary} role="status">
                            <p>
                                {intl.formatMessage(
                                    { id: 'addTorrent.availableSpace' },
                                    { size: formatBytes(space.freeBytes) },
                                )}
                            </p>
                            <p>
                                {intl.formatMessage(
                                    { id: 'addTorrent.reservedSpace' },
                                    {
                                        size: formatBytes(space.reservedBytes),
                                        margin: formatBytes(space.safetyMarginBytes),
                                    },
                                )}
                            </p>
                            {!space.sufficient && (
                                <p role="alert">
                                    {intl.formatMessage({ id: 'error.destination.diskSpaceLow' })}
                                </p>
                            )}
                        </div>
                    )}
                    {spaceError && <p role="alert">{spaceError}</p>}
                    <div className={styles.actions}>
                        <button type="button" className="btn" onClick={close} disabled={confirming}>
                            {intl.formatMessage({ id: 'common.cancel' })}
                        </button>
                        <button
                            type="button"
                            className="btn btn--primary"
                            onClick={() => void confirm()}
                            disabled={
                                confirming ||
                                folderLoading ||
                                selectedIndices.length === 0 ||
                                !space?.sufficient ||
                                spaceLoading
                            }
                        >
                            {intl.formatMessage({
                                id: confirming
                                    ? 'addTorrent.submitting'
                                    : 'addTorrent.startDownload',
                            })}
                        </button>
                    </div>
                </>
            ) : (
                <form onSubmit={(event) => void submit(event)} noValidate>
                    <label className="label" htmlFor="magnet-input">
                        {intl.formatMessage({ id: 'addTorrent.magnetLink.label' })}
                    </label>
                    <textarea
                        id="magnet-input"
                        ref={textareaRef}
                        className={styles.magnetTextarea}
                        value={magnetUri}
                        onChange={(event) => {
                            setMagnetUri(event.target.value);
                            setError(null);
                        }}
                        placeholder={intl.formatMessage({
                            id: 'addTorrent.magnetLink.placeholder',
                        })}
                        disabled={preparing || folderLoading}
                        rows={3}
                        aria-invalid={!!error}
                        aria-describedby={error ? 'torrent-add-error' : undefined}
                    />
                    <div className={styles.torrentFileSection}>
                        <span className={styles.separator}>
                            {intl.formatMessage({ id: 'common.or' })}
                        </span>
                        <button
                            type="button"
                            className={styles.torrentFileButton}
                            onClick={() => void selectFile()}
                            disabled={preparing || folderLoading}
                        >
                            {intl.formatMessage({ id: 'addTorrent.torrentFile.label' })}
                        </button>
                    </div>
                    <div className={styles.actions}>
                        <button type="button" className="btn" onClick={close}>
                            {intl.formatMessage({ id: 'common.cancel' })}
                        </button>
                        <button
                            type="submit"
                            className="btn btn--primary"
                            disabled={preparing || folderLoading}
                        >
                            {intl.formatMessage({ id: 'addTorrent.review' })}
                        </button>
                    </div>
                </form>
            )}
            {error && (
                <p id="torrent-add-error" role="alert" className={styles.multiLineError}>
                    {error}
                </p>
            )}
            {error && !preview && !preparing && canRetry && (
                <button
                    className="btn"
                    type="button"
                    onClick={() => {
                        if (currentSource.current) void prepare(currentSource.current);
                    }}
                >
                    {intl.formatMessage({ id: 'addTorrent.retryPreparation' })}
                </button>
            )}
        </>
    );
    if (inline)
        return (
            <section className={styles.addTorrentPanel} aria-labelledby="add-torrent-panel-title">
                <h2 id="add-torrent-panel-title" className={styles.panelTitle}>
                    {intl.formatMessage({ id: 'addTorrent.title' })}
                </h2>
                {content}
            </section>
        );
    return (
        <div className={styles.commandPaletteOverlay}>
            <div
                ref={containerRef}
                className={styles.commandPalettePanel}
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-torrent-modal-title"
                onKeyDown={keyDown}
            >
                <h2 id="add-torrent-modal-title" className={styles.panelTitle}>
                    {intl.formatMessage({ id: 'addTorrent.title' })}
                </h2>
                {content}
            </div>
        </div>
    );
}
