import React from 'react';
import { useDownloads } from '../../hooks/useDownloads';
import { DownloadItem } from './DownloadItem';
import styles from './DownloadList.module.css';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders the full list of active downloads from the store.
 * Shows an empty-state message when there are no downloads.
 */
export function DownloadList(): React.JSX.Element {
    const { items, pause, resume, remove } = useDownloads();

    if (items.length === 0) {
        return (
            <div className={styles.empty}>
                <p className={styles.emptyTitle}>Nenhum download ativo.</p>
                <p className={styles.emptyHint}>
                    Adicione um torrent arrastando um arquivo <code>.torrent</code> ou colando um magnet link.
                </p>
            </div>
        );
    }

    return (
        <div className={styles.list}>
            {items.map((item) => (
                <DownloadItem
                    key={item.infoHash}
                    item={item}
                    onPause={pause}
                    onResume={resume}
                    onRemove={(infoHash, deleteFiles) => remove(infoHash, deleteFiles)}
                />
            ))}
        </div>
    );
}
