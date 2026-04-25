import React, { useState, useCallback } from 'react';
import styles from './DropZone.module.css';

// ─── Electron File augmentation ───────────────────────────────────────────────

interface ElectronFile extends File {
    path: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Drag-and-drop zone for `.torrent` files.
 *
 * On drop, reads the file path from the Electron-augmented File object and
 * calls `window.meshy.addTorrentFile(filePath)`.
 */
export function DropZone(): React.JSX.Element {
    const [isDragOver, setIsDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        setError(null);

        const file = e.dataTransfer.files[0] as ElectronFile | undefined;

        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.torrent')) {
            setError('Apenas arquivos .torrent são suportados.');
            return;
        }

        const filePath = file.path;
        if (!filePath) {
            setError('Não foi possível obter o caminho do arquivo.');
            return;
        }

        const response = await window.meshy.addTorrentFile(filePath);
        if (!response.success) {
            setError(response.error);
        }
    }, []);

    const zoneClass = isDragOver
        ? `${styles.zone} ${styles.active}`
        : styles.zone;

    return (
        <div
            className={zoneClass}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="region"
            aria-label="Área para arrastar arquivos .torrent"
        >
            <p className={styles.text}>
                Arraste um arquivo <code>.torrent</code> aqui
            </p>
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
