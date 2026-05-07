import React, { useCallback, useEffect, useState } from 'react';
import { TorrentMetadata, TorrentStatus } from '../../../shared/types';
import { formatCreationDate } from '../../utils/detailsFormatters';
import styles from './GeneralTab.module.css';

export interface GeneralTabProps {
    infoHash: string;
    status: TorrentStatus;
}

/**
 * Aba Geral — exibe metadados do torrent (criador, comentário, data de criação, info hash).
 * Invoca `window.meshy.getMetadata(infoHash)` ao montar para obter os dados via IPC.
 * Exibe fallbacks para campos null e indicadores de loading quando status é "resolving-metadata".
 */
export function GeneralTab({ infoHash, status }: GeneralTabProps): React.JSX.Element {
    const [metadata, setMetadata] = useState<TorrentMetadata | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function fetchMetadata(): Promise<void> {
            setLoading(true);
            setError(null);

            try {
                const response = await window.meshy.getMetadata(infoHash);

                if (cancelled) return;

                if (response.success) {
                    setMetadata(response.data);
                } else {
                    setError(response.error);
                }
            } catch {
                if (!cancelled) {
                    setError('Não foi possível carregar os metadados.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        fetchMetadata();

        return () => {
            cancelled = true;
        };
    }, [infoHash]);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(infoHash);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Falha silenciosa — feedback visual de erro poderia ser adicionado
        }
    }, [infoHash]);

    const isResolvingMetadata = status === 'resolving-metadata';

    // Estado de loading inicial (aguardando resposta IPC)
    if (loading && !isResolvingMetadata) {
        return (
            <div className={styles.loading} data-testid="general-tab-loading">
                Carregando metadados...
            </div>
        );
    }

    // Estado de erro
    if (error && !isResolvingMetadata) {
        return (
            <div className={styles.error} data-testid="general-tab-error">
                Não foi possível carregar os metadados.
            </div>
        );
    }

    return (
        <div className={styles.container} data-testid="general-tab">
            {/* Criador */}
            <div className={styles.field}>
                <span className={styles.fieldLabel}>Criador</span>
                {isResolvingMetadata && !metadata ? (
                    <span
                        className={styles.loadingIndicator}
                        data-testid="creator-loading"
                    />
                ) : (
                    <span
                        className={
                            metadata?.creator ? styles.fieldValue : styles.fieldValueNull
                        }
                        data-testid="creator-value"
                    >
                        {metadata?.creator ?? 'Desconhecido'}
                    </span>
                )}
            </div>

            {/* Comentário */}
            <div className={styles.field}>
                <span className={styles.fieldLabel}>Comentário</span>
                {isResolvingMetadata && !metadata ? (
                    <span
                        className={styles.loadingIndicator}
                        data-testid="comment-loading"
                    />
                ) : (
                    <span
                        className={
                            metadata?.comment ? styles.fieldValue : styles.fieldValueNull
                        }
                        data-testid="comment-value"
                    >
                        {metadata?.comment ?? 'Sem comentário'}
                    </span>
                )}
            </div>

            {/* Data de Criação */}
            <div className={styles.field}>
                <span className={styles.fieldLabel}>Data de Criação</span>
                {isResolvingMetadata && !metadata ? (
                    <span
                        className={styles.loadingIndicator}
                        data-testid="creation-date-loading"
                    />
                ) : (
                    <span
                        className={
                            metadata?.creationDate != null
                                ? styles.fieldValue
                                : styles.fieldValueNull
                        }
                        data-testid="creation-date-value"
                    >
                        {metadata?.creationDate != null
                            ? formatCreationDate(metadata.creationDate)
                            : 'Desconhecida'}
                    </span>
                )}
            </div>

            {/* Info Hash */}
            <div className={styles.field}>
                <span className={styles.fieldLabel}>Info Hash</span>
                <div className={styles.infoHashRow}>
                    <span className={styles.infoHashValue} data-testid="info-hash-value">
                        {infoHash}
                    </span>
                    <button
                        className={`${styles.copyButton}${copied ? ` ${styles.copyButtonSuccess}` : ''}`}
                        onClick={handleCopy}
                        title="Copiar info hash"
                        data-testid="copy-info-hash-button"
                    >
                        {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
