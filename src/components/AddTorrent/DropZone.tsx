import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useIntl } from 'react-intl';
import { VscCloudUpload } from 'react-icons/vsc';
import { isValidMagnetUri } from '../../../shared/validators';
import { useDownloadStore } from '../../store/downloadStore';
import { resolveErrorMessage } from '../../utils/resolveErrorMessage';
import styles from './DropZone.module.css';

// ─── Electron File augmentation ───────────────────────────────────────────────

interface ElectronFile extends File {
    path: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Zona de drag-and-drop para arquivos `.torrent` e magnet links.
 *
 * Suporta três formas de entrada:
 * - Arrastar um arquivo `.torrent` (lê o path via Electron File)
 * - Arrastar texto contendo um magnet link (lê via dataTransfer text/plain)
 * - Colar (Ctrl+V / Cmd+V) um magnet link em qualquer lugar da janela
 */
export function DropZone(): React.JSX.Element {
    const intl = useIntl();
    const [isDragOver, setIsDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const zoneRef = useRef<HTMLDivElement>(null);
    const updateItem = useDownloadStore((state) => state.updateItem);

    // ── Limpa mensagem de sucesso após 3 segundos ─────────────────────────
    useEffect(() => {
        if (!success) return;
        const timer = setTimeout(() => setSuccess(null), 3000);
        return () => clearTimeout(timer);
    }, [success]);

    // ── Adiciona magnet link via IPC ──────────────────────────────────────
    const addMagnet = useCallback(
        async (uri: string) => {
            const trimmed = uri.trim();

            if (!isValidMagnetUri(trimmed)) {
                setError(intl.formatMessage({ id: 'dropZone.invalidMagnet' }));
                return;
            }

            setIsLoading(true);
            setError(null);
            setSuccess(null);

            try {
                const response = await window.meshy.addMagnetLink(trimmed);
                if (response.success) {
                    updateItem(response.data);
                    setSuccess(intl.formatMessage({ id: 'dropZone.success' }));
                } else {
                    setError(resolveErrorMessage(intl, response.error));
                }
            } finally {
                setIsLoading(false);
            }
        },
        [updateItem, intl],
    );

    // ── Listener global de paste (document-level) ─────────────────────────
    // Captura Ctrl+V em qualquer lugar da janela, sem exigir foco na zona.
    useEffect(() => {
        const handleGlobalPaste = (e: ClipboardEvent): void => {
            // Ignora se o foco está em um campo de input/textarea
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            const text = e.clipboardData?.getData('text/plain');
            if (!text || !text.trim().startsWith('magnet:')) return;

            e.preventDefault();
            addMagnet(text);
        };

        document.addEventListener('paste', handleGlobalPaste);
        return () => document.removeEventListener('paste', handleGlobalPaste);
    }, [addMagnet]);

    // ── Drag events ───────────────────────────────────────────────────────

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

    const handleDrop = useCallback(
        async (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);
            setError(null);
            setSuccess(null);

            // 1. Tenta arquivo .torrent
            const file = e.dataTransfer.files[0] as ElectronFile | undefined;
            if (file) {
                if (!file.name.toLowerCase().endsWith('.torrent')) {
                    // Arquivo não é .torrent — continua para verificar texto abaixo
                } else {
                    const filePath = file.path;
                    if (!filePath) {
                        setError(intl.formatMessage({ id: 'dropZone.noFilePath' }));
                        return;
                    }
                    const response = await window.meshy.addTorrentFile(filePath);
                    if (response.success) {
                        updateItem(response.data);
                    } else {
                        setError(resolveErrorMessage(intl, response.error));
                    }
                    return;
                }
            }

            // 2. Tenta magnet link via texto arrastado
            const text = e.dataTransfer.getData('text/plain');
            if (text && text.trim().startsWith('magnet:')) {
                await addMagnet(text);
                return;
            }

            // 3. Nenhum formato reconhecido
            if (file) {
                setError(intl.formatMessage({ id: 'dropZone.unsupportedFormat' }));
            }
        },
        [addMagnet, updateItem, intl],
    );

    const zoneClass = isDragOver
        ? `${styles.zone} ${styles.active}`
        : isLoading
            ? `${styles.zone} ${styles.loading}`
            : styles.zone;

    return (
        <div
            ref={zoneRef}
            className={zoneClass}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="region"
            aria-label={intl.formatMessage({ id: 'dropZone.ariaLabel' })}
        >
            {isLoading ? (
                <p className={styles.text}>{intl.formatMessage({ id: 'dropZone.loading' })}</p>
            ) : (
                <>
                    <div className={styles.icon}>
                        <VscCloudUpload />
                    </div>
                    <p className={styles.text}>
                        {intl.formatMessage({ id: 'dropZone.text' })}
                    </p>
                    <p className={styles.hint}>{intl.formatMessage({ id: 'dropZone.hint' })}</p>
                </>
            )}
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
            {success && (
                <p className={styles.success} role="status">
                    {success}
                </p>
            )}
        </div>
    );
}
