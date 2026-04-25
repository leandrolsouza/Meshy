import React, { useId } from 'react';
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

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Modal de confirmação para remoção de download.
 * Oferece as opções "Manter arquivos", "Excluir arquivos" e "Cancelar".
 */
export function ConfirmDialog({
    isOpen,
    title,
    message,
    onConfirmKeepFiles,
    onConfirmDeleteFiles,
    onCancel,
}: ConfirmDialogProps): React.JSX.Element | null {
    const titleId = useId();

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div
                className={styles.panel}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
            >
                <h2 id={titleId} className={styles.title}>{title}</h2>
                <p className={styles.message}>{message}</p>

                <div className={styles.actions}>
                    <button className="btn" onClick={onCancel}>
                        Cancelar
                    </button>
                    <button className="btn btn--outline-primary" onClick={onConfirmKeepFiles}>
                        Manter arquivos
                    </button>
                    <button className="btn btn--danger-filled" onClick={onConfirmDeleteFiles}>
                        Excluir arquivos
                    </button>
                </div>
            </div>
        </div>
    );
}
