import React, { useState, useCallback } from 'react';
import { VscTrash } from 'react-icons/vsc';
import type { AppSettings } from '../../../shared/types';
import styles from './SettingsPanel.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TrackerSettingsProps {
    settings: AppSettings;
    error: string | null;
    onAddGlobalTracker: (url: string) => Promise<boolean>;
    onRemoveGlobalTracker: (url: string) => Promise<boolean>;
    onAutoApplyChange: (enabled: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Aba "Trackers" — gerenciamento de trackers globais (favoritos).
 */
export function TrackerSettings({
    settings,
    error,
    onAddGlobalTracker,
    onRemoveGlobalTracker,
    onAutoApplyChange,
}: TrackerSettingsProps): React.JSX.Element {
    const [newGlobalTracker, setNewGlobalTracker] = useState('');
    const [globalTrackerError, setGlobalTrackerError] = useState<string | null>(null);

    const handleAddGlobalTracker = useCallback(async () => {
        const url = newGlobalTracker.trim();
        if (!url) {
            setGlobalTrackerError('Informe a URL do tracker.');
            return;
        }

        setGlobalTrackerError(null);
        const success = await onAddGlobalTracker(url);
        if (success) {
            setNewGlobalTracker('');
        } else {
            setGlobalTrackerError(error ?? 'Erro ao adicionar tracker.');
        }
    }, [newGlobalTracker, onAddGlobalTracker, error]);

    const handleRemoveGlobalTracker = useCallback(
        async (url: string) => {
            await onRemoveGlobalTracker(url);
        },
        [onRemoveGlobalTracker],
    );

    const handleGlobalTrackerKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAddGlobalTracker();
            }
        },
        [handleAddGlobalTracker],
    );

    const handleAutoApplyChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onAutoApplyChange(e.target.checked);
        },
        [onAutoApplyChange],
    );

    return (
        <section aria-labelledby="global-trackers-title">
            <h3 id="global-trackers-title" className={styles.sectionTitle}>
                Trackers Globais (Favoritos)
            </h3>

            {/* Lista de trackers globais */}
            {settings.globalTrackers.length > 0 ? (
                <ul className={styles.globalTrackerList} aria-label="Lista de trackers globais">
                    {settings.globalTrackers.map((url) => (
                        <li key={url} className={styles.globalTrackerItem}>
                            <span className={styles.globalTrackerUrl} title={url}>
                                {url}
                            </span>
                            <button
                                className={styles.globalTrackerRemoveButton}
                                onClick={() => handleRemoveGlobalTracker(url)}
                                aria-label={`Remover tracker ${url}`}
                            >
                                <VscTrash />
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className={styles.globalTrackerEmpty}>Nenhum tracker global adicionado.</p>
            )}

            {/* Campo para adicionar tracker global */}
            <div className={styles.globalTrackerAddRow}>
                <input
                    type="text"
                    className="input"
                    placeholder="udp://tracker.example.com:6969/announce"
                    value={newGlobalTracker}
                    onChange={(e) => {
                        setNewGlobalTracker(e.target.value);
                        setGlobalTrackerError(null);
                    }}
                    onKeyDown={handleGlobalTrackerKeyDown}
                    aria-label="URL do tracker global"
                />
                <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleAddGlobalTracker}
                    disabled={!newGlobalTracker.trim()}
                >
                    Adicionar
                </button>
            </div>

            {/* Erro de adição */}
            {globalTrackerError && (
                <p className="modal__error" role="alert">
                    {globalTrackerError}
                </p>
            )}

            {/* Toggle de aplicação automática */}
            <div className={styles.globalTrackerToggle}>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={settings.autoApplyGlobalTrackers}
                        onChange={handleAutoApplyChange}
                        className={styles.checkbox}
                    />
                    Aplicar trackers globais automaticamente a novos torrents
                </label>
            </div>
        </section>
    );
}
