import React, { useState, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { isValidMagnetUri } from '../../../shared/validators';
import type { TorrentFileInfo } from '../../../shared/types';
import { FileSelector } from '../FileSelector/FileSelector';
import { resolveErrorMessage } from '../../utils/resolveErrorMessage';
import styles from './AddTorrentModal.module.css';

// ─── Electron File augmentation ───────────────────────────────────────────────

interface ElectronFile extends File {
    path: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddTorrentModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** When true, renders inline in the Editor Area without overlay (Activity Bar access). */
    inline?: boolean;
}

// ─── File selection step state ────────────────────────────────────────────────

interface FileSelectionState {
    infoHash: string;
    files: TorrentFileInfo[];
    selectedIndices: number[];
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Panel for adding a torrent via magnet link or .torrent file.
 *
 * Renders inline in the Editor Area when accessed via the Activity Bar
 * (`inline` prop). When rendered as a modal (future shortcut access),
 * positions itself as a Command Palette: top-aligned with margin-top.
 *
 * For magnet links: validates the URI client-side, adds the torrent, and closes.
 * For .torrent files: adds the torrent, fetches file metadata, shows FileSelector
 * for the user to adjust selection, then applies the selection on confirm.
 */
export function AddTorrentModal({
    isOpen,
    onClose,
    inline = false,
}: AddTorrentModalProps): React.JSX.Element | null {
    const intl = useIntl();
    const [magnetUri, setMagnetUri] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ── File selection state (Task 7.1) ───────────────────────────────────
    const [fileSelection, setFileSelection] = useState<FileSelectionState | null>(null);
    const [fileSelectionLoading, setFileSelectionLoading] = useState(false);

    const resetState = useCallback(() => {
        setMagnetUri('');
        setValidationError(null);
        setSubmitError(null);
        setFileSelection(null);
        setFileSelectionLoading(false);
        setIsSubmitting(false);
    }, []);

    const handleClose = useCallback(() => {
        resetState();
        onClose();
    }, [onClose, resetState]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setMagnetUri(e.target.value);
        setValidationError(null);
        setSubmitError(null);
    }, []);

    // ── Handle .torrent file selection (Task 7.1) ─────────────────────────
    const handleTorrentFileSelect = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0] as ElectronFile | undefined;
            if (!file) return;

            if (!file.name.toLowerCase().endsWith('.torrent')) {
                setSubmitError(intl.formatMessage({ id: 'addTorrent.torrentFile.onlyTorrent' }));
                return;
            }

            const filePath = file.path;
            if (!filePath) {
                setSubmitError(intl.formatMessage({ id: 'addTorrent.torrentFile.noPath' }));
                return;
            }

            setIsSubmitting(true);
            setSubmitError(null);

            try {
                // Add the torrent to the engine
                const addResponse = await window.meshy.addTorrentFile(filePath);
                if (!addResponse.success) {
                    setSubmitError(resolveErrorMessage(intl, addResponse.error));
                    setIsSubmitting(false);
                    return;
                }

                const { infoHash } = addResponse.data;

                // Fetch file list from the engine
                const filesResponse = await window.meshy.getFiles(infoHash);
                if (!filesResponse.success) {
                    // Torrent was added but we couldn't get files — close anyway
                    handleClose();
                    return;
                }

                const files = filesResponse.data;

                if (files.length === 0) {
                    // No metadata available yet (e.g., resolving-metadata) — close
                    handleClose();
                    return;
                }

                // Show file selector with all files pre-selected
                const allIndices = files.map((f) => f.index);
                setFileSelection({ infoHash, files, selectedIndices: allIndices });
            } catch (err: unknown) {
                setSubmitError(
                    err instanceof Error
                        ? err.message
                        : intl.formatMessage({ id: 'addTorrent.errorGeneric' }),
                );
            } finally {
                setIsSubmitting(false);
            }
        },
        [handleClose, intl],
    );

    // ── Handle file selection change in FileSelector (Task 7.2) ───────────
    const handleFileSelectionChange = useCallback(
        (selectedIndices: number[]) => {
            if (!fileSelection) return;
            setFileSelection({ ...fileSelection, selectedIndices });
        },
        [fileSelection],
    );

    // ── Handle confirm with file selection (Task 7.3) ─────────────────────
    const handleConfirmFileSelection = useCallback(async () => {
        if (!fileSelection) return;

        setFileSelectionLoading(true);
        setSubmitError(null);

        try {
            const response = await window.meshy.setFileSelection(
                fileSelection.infoHash,
                fileSelection.selectedIndices,
            );
            if (response.success) {
                handleClose();
            } else {
                setSubmitError(resolveErrorMessage(intl, response.error));
            }
        } catch (err: unknown) {
            setSubmitError(
                err instanceof Error
                    ? err.message
                    : intl.formatMessage({ id: 'addTorrent.errorApplySelection' }),
            );
        } finally {
            setFileSelectionLoading(false);
        }
    }, [fileSelection, handleClose, intl]);

    // ── Handle magnet link submit ─────────────────────────────────────────
    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();

            const trimmed = magnetUri.trim();

            if (!trimmed) {
                setValidationError(intl.formatMessage({ id: 'addTorrent.magnetLink.empty' }));
                return;
            }

            if (!isValidMagnetUri(trimmed)) {
                setValidationError(intl.formatMessage({ id: 'addTorrent.magnetLink.invalid' }));
                return;
            }

            setIsSubmitting(true);
            setSubmitError(null);

            try {
                const response = await window.meshy.addMagnetLink(trimmed);
                if (response.success) {
                    handleClose();
                } else {
                    setSubmitError(resolveErrorMessage(intl, response.error));
                }
            } finally {
                setIsSubmitting(false);
            }
        },
        [magnetUri, handleClose, intl],
    );

    if (!isOpen) return null;

    // ── Determine if the add button should be disabled (Task 7.2) ─────────
    const isAddDisabled =
        isSubmitting || (fileSelection !== null && fileSelection.selectedIndices.length === 0);

    const inputClass = validationError ? 'input input--error' : 'input';

    // ── File selection step content (Task 7.1) ────────────────────────────

    const fileSelectionContent = fileSelection && (
        <div className={styles.fileSelectionSection}>
            <FileSelector
                files={fileSelection.files.map((f) => ({
                    ...f,
                    selected: fileSelection.selectedIndices.includes(f.index),
                }))}
                onSelectionChange={handleFileSelectionChange}
                disabled={fileSelectionLoading}
                loading={fileSelectionLoading}
            />
        </div>
    );

    // ── Form content shared between inline and modal rendering ────────────

    const formContent = fileSelection ? (
        // File selection step — user is choosing which files to download
        <div>
            {fileSelectionContent}

            {submitError && (
                <p role="alert" className="modal__error">
                    {submitError}
                </p>
            )}

            <div className={styles.actions}>
                <button
                    type="button"
                    className="btn"
                    onClick={handleClose}
                    disabled={fileSelectionLoading}
                >
                    {intl.formatMessage({ id: 'common.cancel' })}
                </button>
                <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleConfirmFileSelection}
                    disabled={isAddDisabled || fileSelectionLoading}
                >
                    {fileSelectionLoading
                        ? intl.formatMessage({ id: 'addTorrent.applyingSelection' })
                        : intl.formatMessage({ id: 'common.confirm' })}
                </button>
            </div>
        </div>
    ) : (
        // Initial step — magnet link input + .torrent file picker
        <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="magnet-input" className="label">
                {intl.formatMessage({ id: 'addTorrent.magnetLink.label' })}
            </label>
            <input
                id="magnet-input"
                type="text"
                className={inputClass}
                value={magnetUri}
                onChange={handleChange}
                placeholder={intl.formatMessage({ id: 'addTorrent.magnetLink.placeholder' })}
                aria-describedby={validationError ? 'magnet-error' : undefined}
                aria-invalid={validationError !== null}
                disabled={isSubmitting}
                autoFocus
            />

            {validationError && (
                <p id="magnet-error" role="alert" className="modal__error">
                    {validationError}
                </p>
            )}

            <div className={styles.torrentFileSection}>
                <span className={styles.separator}>{intl.formatMessage({ id: 'common.or' })}</span>
                <label htmlFor="torrent-file-input" className={styles.torrentFileLabel}>
                    {intl.formatMessage({ id: 'addTorrent.torrentFile.label' })}
                </label>
                <input
                    id="torrent-file-input"
                    type="file"
                    accept=".torrent"
                    onChange={handleTorrentFileSelect}
                    disabled={isSubmitting}
                    className={styles.torrentFileInput}
                />
            </div>

            {submitError && (
                <p role="alert" className="modal__error">
                    {submitError}
                </p>
            )}

            <div className={styles.actions}>
                <button type="button" className="btn" onClick={handleClose} disabled={isSubmitting}>
                    {intl.formatMessage({ id: 'common.cancel' })}
                </button>
                <button type="submit" className="btn btn--primary" disabled={isAddDisabled}>
                    {isSubmitting
                        ? intl.formatMessage({ id: 'addTorrent.submitting' })
                        : intl.formatMessage({ id: 'addTorrent.submit' })}
                </button>
            </div>
        </form>
    );

    // ── Inline rendering (Activity Bar navigation) ────────────────────────

    if (inline) {
        return (
            <section className={styles.addTorrentPanel} aria-labelledby="add-torrent-panel-title">
                <h2 id="add-torrent-panel-title" className={styles.panelTitle}>
                    {intl.formatMessage({ id: 'addTorrent.title' })}
                </h2>
                {formContent}
            </section>
        );
    }

    // ── Command Palette modal rendering (future shortcut access) ──────────

    return (
        <div
            className={styles.commandPaletteOverlay}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-torrent-modal-title"
        >
            <div className={styles.commandPalettePanel}>
                <h2 id="add-torrent-modal-title" className={styles.panelTitle}>
                    {intl.formatMessage({ id: 'addTorrent.title' })}
                </h2>
                {formContent}
            </div>
        </div>
    );
}
