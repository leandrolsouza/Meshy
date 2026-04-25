import React, { useState, useEffect, useCallback } from 'react';
import { VscTrash } from 'react-icons/vsc';
import type { TrackerInfo } from '../../../shared/types';
import { useTrackers } from '../../hooks/useTrackers';
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

/** Retorna o label acessível para o status do tracker */
function statusLabel(status: TrackerInfo['status']): string {
    switch (status) {
        case 'connected':
            return 'Conectado';
        case 'error':
            return 'Erro';
        case 'pending':
            return 'Aguardando';
        default:
            return 'Desconhecido';
    }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TrackerPanel({ infoHash }: TrackerPanelProps): React.JSX.Element {
    const { trackers, loading, error, loadTrackers, addTracker, removeTracker, applyGlobalTrackers } =
        useTrackers(infoHash);

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
            setAddError('Informe a URL do tracker.');
            setAddSuccess(null);
            return;
        }

        setAddError(null);
        setAddSuccess(null);

        const success = await addTracker(url);
        if (success) {
            setNewTrackerUrl('');
            setAddSuccess('Tracker adicionado com sucesso.');
        } else {
            setAddError(error ?? 'Erro ao adicionar tracker.');
        }
    }, [newTrackerUrl, addTracker, error]);

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
            setApplyMessage('Trackers favoritos aplicados com sucesso.');
        } else {
            setApplyError(error ?? 'Erro ao aplicar trackers favoritos.');
        }
    }, [applyGlobalTrackers, error]);

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
            <h3 className={styles.title}>Trackers</h3>

            {/* Mensagem de carregamento */}
            {loading && (
                <div className={styles.loading} role="status" aria-live="polite">
                    Carregando trackers...
                </div>
            )}

            {/* Erro geral do hook */}
            {error && !addError && (
                <div className={styles.error} role="alert">
                    {error}
                </div>
            )}

            {/* Lista de trackers */}
            {trackers.length > 0 && (
                <ul className={styles.trackerList} aria-label="Lista de trackers">
                    {trackers.map((tracker) => (
                        <li key={tracker.url} className={styles.trackerItem}>
                            <span
                                className={`${styles.statusIndicator} ${statusIndicatorClass(tracker.status)}`}
                                title={statusLabel(tracker.status)}
                                aria-label={statusLabel(tracker.status)}
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
                                aria-label={`Remover tracker ${tracker.url}`}
                                disabled={loading}
                            >
                                <VscTrash />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {/* Lista vazia */}
            {!loading && trackers.length === 0 && !error && (
                <div className={styles.emptyMessage}>Nenhum tracker encontrado.</div>
            )}

            {/* Campo para adicionar tracker manualmente */}
            <div className={styles.addTrackerRow}>
                <input
                    type="text"
                    className="input"
                    placeholder="udp://tracker.example.com:6969/announce"
                    value={newTrackerUrl}
                    onChange={(e) => {
                        setNewTrackerUrl(e.target.value);
                        setAddError(null);
                        setAddSuccess(null);
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={loading}
                    aria-label="URL do tracker"
                />
                <button
                    className="btn btn--primary"
                    onClick={handleAddTracker}
                    disabled={loading || !newTrackerUrl.trim()}
                >
                    Adicionar
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
                <button
                    className="btn"
                    onClick={handleApplyGlobalTrackers}
                    disabled={loading}
                >
                    Aplicar Favoritos
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
