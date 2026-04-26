import React, { useCallback } from 'react';
import {
    isValidSpeedLimit,
    isValidMaxConcurrentDownloads,
    MIN_CONCURRENT_DOWNLOADS,
    MAX_CONCURRENT_DOWNLOADS,
} from '../../../shared/validators';
import styles from './SettingsPanel.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TransferSettingsProps {
    downloadLimit: string;
    uploadLimit: string;
    maxConcurrent: string;
    downloadLimitError: string | null;
    uploadLimitError: string | null;
    maxConcurrentError: string | null;
    onDownloadLimitChange: (value: string) => void;
    onUploadLimitChange: (value: string) => void;
    onMaxConcurrentChange: (value: string) => void;
    onDownloadLimitErrorChange: (error: string | null) => void;
    onUploadLimitErrorChange: (error: string | null) => void;
    onMaxConcurrentErrorChange: (error: string | null) => void;
}

// ─── Validação ────────────────────────────────────────────────────────────────

/**
 * Valida os campos de transferência e retorna true se todos estão válidos.
 * Seta as mensagens de erro nos callbacks fornecidos.
 */
export function validateTransferFields(
    downloadLimit: string,
    uploadLimit: string,
    maxConcurrent: string,
    setDownloadLimitError: (error: string | null) => void,
    setUploadLimitError: (error: string | null) => void,
    setMaxConcurrentError: (error: string | null) => void,
): boolean {
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

    return !hasError;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Aba "Transferências" — limites de download/upload e downloads simultâneos.
 */
export function TransferSettings({
    downloadLimit,
    uploadLimit,
    maxConcurrent,
    downloadLimitError,
    uploadLimitError,
    maxConcurrentError,
    onDownloadLimitChange,
    onUploadLimitChange,
    onMaxConcurrentChange,
    onDownloadLimitErrorChange,
    onUploadLimitErrorChange,
    onMaxConcurrentErrorChange,
}: TransferSettingsProps): React.JSX.Element {
    const handleDownloadLimitChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onDownloadLimitChange(e.target.value);
            onDownloadLimitErrorChange(null);
        },
        [onDownloadLimitChange, onDownloadLimitErrorChange],
    );

    const handleUploadLimitChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onUploadLimitChange(e.target.value);
            onUploadLimitErrorChange(null);
        },
        [onUploadLimitChange, onUploadLimitErrorChange],
    );

    const handleMaxConcurrentChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onMaxConcurrentChange(e.target.value);
            onMaxConcurrentErrorChange(null);
        },
        [onMaxConcurrentChange, onMaxConcurrentErrorChange],
    );

    const dlInputClass = downloadLimitError ? 'input input--error' : 'input';
    const ulInputClass = uploadLimitError ? 'input input--error' : 'input';
    const mcInputClass = maxConcurrentError ? 'input input--error' : 'input';

    return (
        <>
            {/* Limite de download */}
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

            {/* Limite de upload */}
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

            {/* Downloads simultâneos */}
            <div className={styles.fieldGroup}>
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
        </>
    );
}
