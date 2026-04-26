import React, { useState, useEffect, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { VscTrash } from 'react-icons/vsc';
import type { TrackerInfo } from '../../../shared/types';
import { useTrackers } from '../../hooks/useTrackers';
import { resolveErrorMessage } from '../../utils/resolveErrorMessage';
import styles from './TrackerPanel.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TrackerPanelProps {
    infoHash: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retorna a classe CSS do indicador de status do tracker */
function statusIndicatorClass(status: TrackerInfo['status']): string {
    switch (status) {
        case 'connected':
            return styles.statusConnected;
        case 'error':
            return styles.statusError;
        case 'pending':
            return styles.statusPending;
        default:
            return styles.statusPending;
    }
}

/** Mapa de status para chave de tradução */
const STATUS_LABEL_KEYS: Record<string, string> = {
    connected: 'trackers.status.connected',
    error: 'trackers.status.error',
    pending: 'trackers.status.pending',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TrackerPanel({ infoHash }: TrackerPanelProps): React.JSX.Element {
    const intl = useIntl();
    const {
        trackers,
        loading,
        error,
        loadTrackers,
        addTracker,
        removeTracker,
        applyGlobalTrackers,
    } = useTrackers(infoHash);

    // ── Estado local para adicionar tracker manualmente ───────────────────────
    const [newTrackerUrl, setNewTrackerUrl] = useState('');
    const [addError, setAddError] = useState<string | null>(null);
    const [addSuccess, setAddSuccess] = useState<string | null>(null);
    const [applyMessage, setApplyMessage] = useState<string | null>(null);
    const [applyError, setApplyError] = useState<string | null>(null);

    // ── Carregar trackers ao montar ──────────────────────────────────────────
    useEffect(() => {
        loadTrackers();
    }, [loadTrackers]);

    // ── Adicionar tracker manualmente ────────────────────────────────────────
    const handleAddTracker = useCallback(async () => {
        const url = newTrackerUrl.trim();
        if (!url) {
            setAddError(intl.formatMessage({ id: 'trackers.addError.empty' }));
            setAddSuccess(null);
            return;
        }

        setAddError(null);
        setAddSuccess(null);

        const success = await addTracker(url);
        if (success) {
            setNewTrackerUrl('');
            setAddSuccess(intl.formatMessage({ id: 'trackers.addSuccess' }));
        } else {
            setAddError(
                error
                    ? resolveErrorMessage(intl, error)
                    : intl.formatMessage({ id: 'trackers.addError.generic' }),
            );
        }
    }, [newTrackerUrl, addTracker, error, intl]);

    // ── Remover tracker ──────────────────────────────────────────────────────
    const handleRemoveTracker = useCallback(
        async (url: string) => {
            await removeTracker(url);
        },
        [removeTracker],
    );

    // ── Aplicar favoritos globais ────────────────────────────────────────────
    const handleApplyGlobalTrackers = useCallback(async () => {
        setApplyMessage(null);
        setApplyError(null);

        const success = await applyGlobalTrackers();
        if (success) {
            setApplyMessage(intl.formatMessage({ id: 'trackers.applyFavoritesSuccess' }));
        } else {
            setApplyError(
                error
                    ? resolveErrorMessage(intl, error)
                    : intl.formatMessage({ id: 'trackers.applyFavoritesError' }),
            );
        }
    }, [applyGlobalTrackers, error, intl]);

    // ── Submeter com Enter ───────────────────────────────────────────────────
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTracker();
            }
        },
        [handleAddTracker],
    );

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>{intl.formatMessage({ id: 'trackers.title' })}</h3>

            {/* Mensagem de carregamento */}
            {loading && (
                <div className={styles.loading} role="status" aria-live="polite">
                    {intl.formatMessage({ id: 'trackers.loading' })}
                </div>
            )}

            {/* Erro geral do hook */}
            {error && !addError && (
                <div className={styles.error} role="alert">
                    {resolveErrorMessage(intl, error)}
                </div>
            )}

            {/* Lista de trackers */}
            {trackers.length > 0 && (
                <ul
                    className={styles.trackerList}
                    aria-label={intl.formatMessage({ id: 'trackers.listAriaLabel' })}
                >
                    {trackers.map((tracker) => {
                        const label = intl.formatMessage({
                            id: STATUS_LABEL_KEYS[tracker.status] ?? 'trackers.status.unknown',
                        });
                        return (
                            <li key={tracker.url} className={styles.trackerItem}>
                                <span
                                    className={`${styles.statusIndicator} ${statusIndicatorClass(tracker.status)}`}
                                    title={label}
                                    aria-label={label}
                                />
                                <span className={styles.trackerUrl} title={tracker.url}>
                                    {tracker.url}
                                </span>
                                {tracker.message && (
                                    <span className={styles.trackerMessage} title={tracker.message}>
                                        {tracker.message}
                                    </span>
                                )}
                                <button
                                    className={styles.removeButton}
                                    onClick={() => handleRemoveTracker(tracker.url)}
                                    aria-label={intl.formatMessage(
                                        { id: 'trackers.removeAriaLabel' },
                                        { url: tracker.url },
                                    )}
                                    disabled={loading}
                                >
                                    <VscTrash />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Lista vazia */}
            {!loading && trackers.length === 0 && !error && (
                <div className={styles.emptyMessage}>
                    {intl.formatMessage({ id: 'trackers.empty' })}
                </div>
            )}

            {/* Campo para adicionar tracker manualmente */}
            <div className={styles.addTrackerRow}>
                <input
                    type="text"
                    className="input"
                    placeholder={intl.formatMessage({ id: 'trackers.addPlaceholder' })}
                    value={newTrackerUrl}
                    onChange={(e) => {
                        setNewTrackerUrl(e.target.value);
                        setAddError(null);
                        setAddSuccess(null);
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    aria-label={intl.formatMessage({ id: 'trackers.addAriaLabel' })}
                />
                <button
                    className="btn btn--primary"
                    onClick={handleAddTracker}
                    disabled={loading || !newTrackerUrl.trim()}
                >
                    {intl.formatMessage({ id: 'common.add' })}
                </button>
            </div>

            {/* Mensagens de feedback para adição */}
            {addError && (
                <div className={styles.error} role="alert">
                    {addError}
                </div>
            )}
            {addSuccess && (
                <div className={styles.success} role="status">
                    {addSuccess}
                </div>
            )}

            {/* Botão Aplicar Favoritos */}
            <div className={styles.applyRow}>
                <button className="btn" onClick={handleApplyGlobalTrackers} disabled={loading}>
                    {intl.formatMessage({ id: 'trackers.applyFavorites' })}
                </button>
            </div>

            {/* Mensagens de feedback para aplicação de favoritos */}
            {applyError && (
                <div className={styles.error} role="alert">
                    {applyError}
                </div>
            )}
            {applyMessage && (
                <div className={styles.success} role="status">
                    {applyMessage}
                </div>
            )}
        </div>
    );
}
