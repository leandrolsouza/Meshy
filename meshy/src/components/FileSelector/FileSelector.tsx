import React, { useCallback, useMemo, useRef, useEffect } from 'react';
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
    const selectAllRef = useRef<HTMLInputElement>(null);

    const selectedIndices = useMemo(
        () => files.filter((f) => f.selected).map((f) => f.index),
        [files],
    );

    const allSelected = files.length > 0 && selectedIndices.length === files.length;
    const noneSelected = selectedIndices.length === 0;
    const isIndeterminate = !allSelected && !noneSelected;

    // Keep the native indeterminate property in sync
    useEffect(() => {
        if (selectAllRef.current) {
            selectAllRef.current.indeterminate = isIndeterminate;
        }
    }, [isIndeterminate]);

    const totalSelectedSize = useMemo(
        () => files.filter((f) => f.selected).reduce((sum, f) => sum + f.length, 0),
        [files],
    );

    const controlsDisabled = disabled || loading;

    const handleSelectAll = useCallback(() => {
        if (allSelected) {
            // Deselect all — but we need at least one, so this sends empty
            // The parent is responsible for validation; we just report the change
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
            {/* Header with Select All and total size */}
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
                    <span>Selecionar todos</span>
                </label>
                <span className={styles.totalSize} data-testid="total-selected-size">
                    {formatBytes(totalSelectedSize)}
                </span>
            </div>

            {/* Loading indicator */}
            {loading && (
                <div className={styles.loading} role="status" aria-live="polite">
                    Aplicando seleção...
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className={styles.error} role="alert">
                    {error}
                </div>
            )}

            {/* File list */}
            <ul className={styles.fileList}>
                {files.map((file) => (
                    <li key={file.index} className={styles.fileItem}>
                        <label className={styles.fileLabel} htmlFor={`file-checkbox-${file.index}`}>
                            <input
                                id={`file-checkbox-${file.index}`}
                                type="checkbox"
                                checked={file.selected}
                                onChange={() => handleFileToggle(file.index)}
                                disabled={controlsDisabled}
                                className={styles.checkbox}
                            />
                            <span className={styles.fileName}>{file.name}</span>
                            <span className={styles.fileSize}>{formatBytes(file.length)}</span>
                        </label>
                    </li>
                ))}
            </ul>
        </div>
    );
}
