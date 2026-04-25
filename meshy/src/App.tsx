import React, { useEffect, useState } from 'react';
import { useDownloadStore } from './store/downloadStore';
import { DownloadList } from './components/DownloadList/DownloadList';
import { DropZone } from './components/AddTorrent/DropZone';
import { AddTorrentModal } from './components/AddTorrent/AddTorrentModal';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import styles from './App.module.css';

// ─── App ──────────────────────────────────────────────────────────────────────

/**
 * Root application component.
 *
 * On mount, calls `window.meshy.getAll()` to populate the store with the
 * current download state from the main process.
 */
function App(): React.JSX.Element {
    const setItems = useDownloadStore((state) => state.setItems);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        async function loadInitialState(): Promise<void> {
            try {
                const response = await window.meshy.getAll();
                if (response.success) {
                    setItems(response.data);
                }
            } catch (err) {
                console.error('[App] Failed to load initial download state:', err);
            }
        }

        loadInitialState();
    }, [setItems]);

    return (
        <div className={styles.app}>
            <header className={styles.header}>
                <h1 className={styles.title}>Meshy</h1>
                <div className={styles.headerActions}>
                    <button
                        className="btn btn--primary"
                        onClick={() => setIsAddModalOpen(true)}
                        aria-label="Adicionar torrent via magnet link"
                    >
                        + Magnet Link
                    </button>
                    <button
                        className="btn"
                        onClick={() => setIsSettingsOpen(true)}
                        aria-label="Abrir configurações"
                    >
                        ⚙ Configurações
                    </button>
                </div>
            </header>

            <DropZone />

            <main className={styles.main}>
                <DownloadList />
            </main>

            <AddTorrentModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
            />
            <SettingsPanel
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
}

export default App;
