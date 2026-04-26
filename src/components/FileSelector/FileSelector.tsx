import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { useIntl } from 'react-intl';
import type { TorrentFileInfo } from '../../../shared/types';
import { formatBytes } from '../../utils/formatters';
import styles from './FileSelector.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface FileSelectorProps {
    files: TorrentFileInfo[];
    onSelectionChange: (selectedIndices: number[]) => void;
    disabled?: boolean;
    loading?: boolean;
    error?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FileSelector({
    files,
    onSelectionChange,
    disabled = false,
    loading = false,
    error = null,
}: FileSelectorProps): React.JSX.Element {
    const intl = useIntl();
    const selectAllRef = useRef<HTMLInputElement>(null);

    const selectedIndices = useMemo(
        () => files.filter((f) => f.selected).map((f) => f.index),
        [files],
    );

    const allSelected = files.length > 0 && selectedIndices.length === files.length;
    const noneSelected = selectedIndices.length === 0;
    const isIndeterminate = !allSelected && !noneSelected;

    // Manter a propriedade nativa indeterminate em sincronia
    useEffect(() => {
        if (selectAllRef.current) {
            selectAllRef.current.indeterminate = isIndeterminate;
        }
    }, [isIndeterminate]);

    const totalSelectedSize = useMemo(
        () => files.filter((f) => f.selected).reduce((sum, f) => sum + f.length, 0),
        [files],
    );

    const totalSelectedDownloaded = useMemo(
        () => files.filter((f) => f.selected).reduce((sum, f) => sum + f.downloaded, 0),
        [files],
    );

    const controlsDisabled = disabled || loading;

    const handleSelectAll = useCallback(() => {
        if (allSelected) {
            onSelectionChange([]);
        } else {
            onSelectionChange(files.map((f) => f.index));
        }
    }, [allSelected, files, onSelectionChange]);

    const handleFileToggle = useCallback(
        (fileIndex: number) => {
            const currentSelected = new Set(selectedIndices);
            if (currentSelected.has(fileIndex)) {
                currentSelected.delete(fileIndex);
            } else {
                currentSelected.add(fileIndex);
            }
            onSelectionChange(Array.from(currentSelected));
        },
        [selectedIndices, onSelectionChange],
    );

    return (
        <div className={styles.container}>
            {/* Header com Selecionar Todos e tamanho total */}
            <div className={styles.header}>
                <label className={styles.selectAllLabel}>
                    <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleSelectAll}
                        disabled={controlsDisabled}
                        aria-checked={isIndeterminate ? 'mixed' : allSelected}
                        className={styles.checkbox}
                    />
                    <span>{intl.formatMessage({ id: 'fileSelector.selectAll' })}</span>
                </label>
                <span className={styles.totalSize} data-testid="total-selected-size">
                    {formatBytes(totalSelectedDownloaded)} / {formatBytes(totalSelectedSize)}
                </span>
            </div>

            {/* Indicador de carregamento */}
            {loading && (
                <div className={styles.loading} role="status" aria-live="polite">
                    {intl.formatMessage({ id: 'fileSelector.applyingSelection' })}
                </div>
            )}

            {/* Mensagem de erro */}
            {error && (
                <div className={styles.error} role="alert">
                    {error}
                </div>
            )}

            {/* Lista de arquivos */}
            <ul className={styles.fileList}>
                {files.map((file) => {
                    const fileProgress =
                        file.length > 0 ? Math.min((file.downloaded / file.length) * 100, 100) : 0;
                    const fileCompleted = fileProgress >= 100;

                    return (
                        <li key={file.index} className={styles.fileItem}>
                            <label
                                className={styles.fileLabel}
                                htmlFor={`file-checkbox-${file.index}`}
                            >
                                <input
                                    id={`file-checkbox-${file.index}`}
                                    type="checkbox"
                                    checked={file.selected}
                                    onChange={() => handleFileToggle(file.index)}
                                    disabled={controlsDisabled}
                                    className={styles.checkbox}
                                />
                                <div className={styles.fileInfo}>
                                    <div className={styles.fileNameRow}>
                                        <span className={styles.fileName}>{file.name}</span>
                                        <span className={styles.fileSize}>
                                            {formatBytes(file.downloaded)} /{' '}
                                            {formatBytes(file.length)}
                                        </span>
                                    </div>
                                    {file.selected && (
                                        <div
                                            className={styles.fileProgressBar}
                                            role="progressbar"
                                            aria-valuenow={Math.round(fileProgress)}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            aria-label={intl.formatMessage({ id: 'fileSelector.progressLabel' }, { name: file.name, percent: Math.round(fileProgress) })}
                                        >
                                            <div
                                                className={`${styles.fileProgressFill} ${fileCompleted ? styles.fileProgressComplete : ''}`}
                                                style={{ width: `${fileProgress}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </label>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
