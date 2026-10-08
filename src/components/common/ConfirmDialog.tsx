import React, { useId, useRef, useEffect, useCallback } from 'react';
import { useIntl } from 'react-intl';
import styles from './ConfirmDialog.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirmKeepFiles: () => void;
    onConfirmDeleteFiles: () => void;
    onCancel: () => void;
}

// ─── Focus helpers ────────────────────────────────────────────────────────────

/** Seletor CSS para todos os elementos interativos e focalizáveis do painel. */
const FOCUSABLE_SEL =
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
    'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Modal de confirmação para remoção de download.
 * Oferece as opções "Manter arquivos", "Excluir arquivos" e "Cancelar".
 *
 * Acessibilidade (Requisito 8.5):
 *  - role="dialog", aria-modal="true", aria-labelledby apontam para o título
 *  - Foco movido para o primeiro elemento focalizável ao abrir
 *  - Escape fecha o diálogo
 */
export function ConfirmDialog({
    isOpen,
    title,
    message,
    onConfirmKeepFiles,
    onConfirmDeleteFiles,
    onCancel,
}: ConfirmDialogProps): React.JSX.Element | null {
    const intl = useIntl();
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);

    // ── Mover foco para o primeiro elemento focalizável ao abrir ──────────
    useEffect(() => {
        if (!isOpen) return;
        const frameId = requestAnimationFrame(() => {
            const el = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SEL);
            el?.focus();
        });
        return () => cancelAnimationFrame(frameId);
    }, [isOpen]);

    // ── Fechar ao pressionar Escape ───────────────────────────────────────
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onCancel();
            }
        },
        [onCancel],
    );

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div
                ref={panelRef}
                className={styles.panel}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
            >
                <h2 id={titleId} className={styles.title}>
                    {title}
                </h2>
                <p className={styles.message}>{message}</p>

                <div className={styles.actions}>
                    <button className="btn" onClick={onCancel}>
                        {intl.formatMessage({ id: 'common.cancel' })}
                    </button>
                    <button className="btn btn--primary" onClick={onConfirmKeepFiles}>
                        {intl.formatMessage({ id: 'common.keepFiles' })}
                    </button>
                    <button className="btn btn--danger" onClick={onConfirmDeleteFiles}>
                        {intl.formatMessage({ id: 'common.deleteFiles' })}
                    </button>
                </div>
            </div>
        </div>
    );
}
