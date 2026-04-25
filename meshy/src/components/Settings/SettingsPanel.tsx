import React, { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { isValidSpeedLimit, isValidMaxConcurrentDownloads, MIN_CONCURRENT_DOWNLOADS, MAX_CONCURRENT_DOWNLOADS } from '../../../shared/validators';
import styles from './SettingsPanel.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Settings panel for configuring destination folder and speed limits.
 *
 * Renders inline in the Editor Area when accessed via the Activity Bar.
 * Accepts `isOpen` and `onClose` props for compatibility — when `isOpen`
 * is false the component returns null.
 */
export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps): React.JSX.Element | null {
    const { settings, loading, error, updateSettings, selectFolder } = useSettings();

    const [downloadLimit, setDownloadLimit] = useState('');
    const [uploadLimit, setUploadLimit] = useState('');
    const [maxConcurrent, setMaxConcurrent] = useState('');
    const [downloadLimitError, setDownloadLimitError] = useState<string | null>(null);
    const [uploadLimitError, setUploadLimitError] = useState<string | null>(null);
    const [maxConcurrentError, setMaxConcurrentError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Sync local form state when settings load from the main process.
    // This is intentional: the effect bridges async IPC data into local form state.
    useEffect(() => {
        if (settings) {
            setDownloadLimit(String(settings.downloadSpeedLimit)); // eslint-disable-line react-hooks/set-state-in-effect
            setUploadLimit(String(settings.uploadSpeedLimit));
            setMaxConcurrent(String(settings.maxConcurrentDownloads));
        }
    }, [settings]);

    const handleSelectFolder = useCallback(async () => {
        await selectFolder();
    }, [selectFolder]);

    const handleDownloadLimitChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setDownloadLimit(e.target.value);
        setDownloadLimitError(null);
    }, []);

    const handleUploadLimitChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setUploadLimit(e.target.value);
        setUploadLimitError(null);
    }, []);

    const handleMaxConcurrentChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setMaxConcurrent(e.target.value);
        setMaxConcurrentError(null);
    }, []);

    const handleSave = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();

            let hasError = false;

            if (!isValidSpeedLimit(Number(downloadLimit))) {
                setDownloadLimitError('Valor inválido: deve ser um inteiro não-negativo.');
                hasError = true;
            }

            if (!isValidSpeedLimit(Number(uploadLimit))) {
                setUploadLimitError('Valor inválido: deve ser um inteiro não-negativo.');
                hasError = true;
            }

            if (!isValidMaxConcurrentDownloads(Number(maxConcurrent))) {
                setMaxConcurrentError(
                    `Valor inválido: deve ser um inteiro entre ${MIN_CONCURRENT_DOWNLOADS} e ${MAX_CONCURRENT_DOWNLOADS}.`,
                );
                hasError = true;
            }

            if (hasError) return;

            setIsSaving(true);
            try {
                await updateSettings({
                    downloadSpeedLimit: Number(downloadLimit),
                    uploadSpeedLimit: Number(uploadLimit),
                    maxConcurrentDownloads: Number(maxConcurrent),
                });
            } finally {
                setIsSaving(false);
            }
        },
        [downloadLimit, uploadLimit, maxConcurrent, updateSettings],
    );

    if (!isOpen) return null;

    const dlInputClass = downloadLimitError ? 'input input--error' : 'input';
    const ulInputClass = uploadLimitError ? 'input input--error' : 'input';
    const mcInputClass = maxConcurrentError ? 'input input--error' : 'input';

    // ── Form content shared between inline and modal rendering ────────────

    const formContent = (
        <>
            {loading && <p>Carregando configurações...</p>}
            {error && (
                <p role="alert" className="modal__error">
                    Erro ao carregar configurações: {error}
                </p>
            )}

            {settings && (
                <form onSubmit={handleSave} noValidate>
                    {/* Destination folder */}
                    <div className={styles.fieldGroup}>
                        <label htmlFor="destination-folder" className="label">
                            Pasta de destino
                        </label>
                        <div className={styles.folderRow}>
                            <input
                                id="destination-folder"
                                type="text"
                                className={`input input--readonly ${styles.folderInput}`}
                                value={settings.destinationFolder}
                                readOnly
                            />
                            <button type="button" className="btn" onClick={handleSelectFolder}>
                                Selecionar pasta
                            </button>
                        </div>
                    </div>

                    {/* Download speed limit */}
                    <div className={styles.fieldGroup}>
                        <label htmlFor="download-speed-limit" className="label">
                            Limite de download (KB/s, 0 = sem limite)
                        </label>
                        <input
                            id="download-speed-limit"
                            type="number"
                            min={0}
                            step={1}
                            className={dlInputClass}
                            value={downloadLimit}
                            onChange={handleDownloadLimitChange}
                            aria-describedby={downloadLimitError ? 'download-limit-error' : undefined}
                            aria-invalid={downloadLimitError !== null}
                        />
                        {downloadLimitError && (
                            <p id="download-limit-error" role="alert" className="modal__error">
                                {downloadLimitError}
                            </p>
                        )}
                    </div>

                    {/* Upload speed limit */}
                    <div className={styles.fieldGroup}>
                        <label htmlFor="upload-speed-limit" className="label">
                            Limite de upload (KB/s, 0 = sem limite)
                        </label>
                        <input
                            id="upload-speed-limit"
                            type="number"
                            min={0}
                            step={1}
                            className={ulInputClass}
                            value={uploadLimit}
                            onChange={handleUploadLimitChange}
                            aria-describedby={uploadLimitError ? 'upload-limit-error' : undefined}
                            aria-invalid={uploadLimitError !== null}
                        />
                        {uploadLimitError && (
                            <p id="upload-limit-error" role="alert" className="modal__error">
                                {uploadLimitError}
                            </p>
                        )}
                    </div>

                    {/* Max concurrent downloads */}
                    <div className={styles.fieldGroupLast}>
                        <label htmlFor="max-concurrent-downloads" className="label">
                            Downloads simultâneos (máx)
                        </label>
                        <input
                            id="max-concurrent-downloads"
                            type="number"
                            min={MIN_CONCURRENT_DOWNLOADS}
                            max={MAX_CONCURRENT_DOWNLOADS}
                            step={1}
                            className={mcInputClass}
                            value={maxConcurrent}
                            onChange={handleMaxConcurrentChange}
                            aria-describedby={maxConcurrentError ? 'max-concurrent-error' : undefined}
                            aria-invalid={maxConcurrentError !== null}
                        />
                        {maxConcurrentError && (
                            <p id="max-concurrent-error" role="alert" className="modal__error">
                                {maxConcurrentError}
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className={styles.actions}>
                        <button type="submit" className="btn btn--primary" disabled={isSaving}>
                            {isSaving ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            )}
        </>
    );

    // ── Inline rendering (Activity Bar navigation) ────────────────────────

    return (
        <section className={styles.settingsPanel} aria-labelledby="settings-panel-title">
            <h2 id="settings-panel-title" className={styles.panelTitle}>
                Configurações
            </h2>
            {formContent}
        </section>
    );
}
