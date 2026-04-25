import React, { useState, useCallback } from 'react';
import { isValidMagnetUri } from '../../../shared/validators';
import styles from './AddTorrentModal.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddTorrentModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Modal dialog for adding a torrent via magnet link.
 *
 * Validates the magnet URI client-side before sending to the main process.
 * Displays a descriptive error message for invalid formats.
 */
export function AddTorrentModal({ isOpen, onClose }: AddTorrentModalProps): React.JSX.Element | null {
    const [magnetUri, setMagnetUri] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleClose = useCallback(() => {
        setMagnetUri('');
        setValidationError(null);
        setSubmitError(null);
        onClose();
    }, [onClose]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setMagnetUri(e.target.value);
        setValidationError(null);
        setSubmitError(null);
    }, []);

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();

            const trimmed = magnetUri.trim();

            if (!trimmed) {
                setValidationError('Por favor, cole um magnet link.');
                return;
            }

            if (!isValidMagnetUri(trimmed)) {
                setValidationError(
                    'Formato inválido. O magnet link deve começar com "magnet:?xt=urn:btih:" seguido de 40 caracteres hexadecimais.',
                );
                return;
            }

            setIsSubmitting(true);
            setSubmitError(null);

            try {
                const response = await window.meshy.addMagnetLink(trimmed);
                if (response.success) {
                    handleClose();
                } else {
                    setSubmitError(response.error);
                }
            } finally {
                setIsSubmitting(false);
            }
        },
        [magnetUri, handleClose],
    );

    if (!isOpen) return null;

    const inputClass = validationError ? 'input input--error' : 'input';

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-torrent-modal-title">
            <div className="modal">
                <h2 id="add-torrent-modal-title" className="modal__title">
                    Adicionar Torrent
                </h2>

                <form onSubmit={handleSubmit} noValidate>
                    <label htmlFor="magnet-input" className="label">
                        Magnet Link
                    </label>
                    <input
                        id="magnet-input"
                        type="text"
                        className={inputClass}
                        value={magnetUri}
                        onChange={handleChange}
                        placeholder="magnet:?xt=urn:btih:..."
                        aria-describedby={validationError ? 'magnet-error' : undefined}
                        aria-invalid={validationError !== null}
                        disabled={isSubmitting}
                        autoFocus
                    />

                    {validationError && (
                        <p id="magnet-error" role="alert" className="modal__error">
                            {validationError}
                        </p>
                    )}

                    {submitError && (
                        <p role="alert" className="modal__error">
                            {submitError}
                        </p>
                    )}

                    <div className={styles.actions}>
                        <button type="button" className="btn" onClick={handleClose} disabled={isSubmitting}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
                            {isSubmitting ? 'Adicionando...' : 'Adicionar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
