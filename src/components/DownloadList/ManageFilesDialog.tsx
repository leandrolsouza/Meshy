import React, { useEffect, useId, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import type { DownloadItem, FileOperation } from '../../../shared/types';
import { resolveErrorMessage } from '../../utils/resolveErrorMessage';
import { useDownloadStore } from '../../store/downloadStore';
import styles from './ManageFilesDialog.module.css';

export function ManageFilesDialog({
    item,
    onClose,
}: {
    item: DownloadItem;
    onClose: () => void;
}): React.JSX.Element {
    const intl = useIntl();
    const titleId = useId();
    const panel = useRef<HTMLDivElement>(null);
    const mounted = useRef(false);
    const [operation, setOperation] = useState<FileOperation>('verify');
    const [folder, setFolder] = useState(item.destinationFolder);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<DownloadItem | null>(null);
    useEffect(() => {
        mounted.current = true;
        const previous = document.activeElement as HTMLElement | null;
        panel.current?.querySelector<HTMLElement>('input')?.focus();
        return () => {
            mounted.current = false;
            previous?.focus();
        };
    }, []);
    useEffect(() => {
        if (busy) panel.current?.querySelector<HTMLElement>('input[readonly]')?.focus();
        else if (result) panel.current?.querySelector<HTMLElement>('button')?.focus();
    }, [busy, result]);
    const chooseFolder = async () => {
        setBusy(true);
        try {
            const response = await window.meshy.selectFolder();
            if (mounted.current && response.success) {
                setFolder(response.data);
                setError(null);
            }
        } catch {
            if (mounted.current) setError(intl.formatMessage({ id: 'error.operation.failed' }));
        } finally {
            if (mounted.current) setBusy(false);
        }
    };
    const submit = async () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            const response = await window.meshy.manageFiles(
                item.infoHash,
                operation,
                operation === 'verify' ? undefined : folder,
            );
            if (!mounted.current) return;
            if (response.success) {
                useDownloadStore.getState().updateItem(response.data);
                setResult(response.data);
                if (response.data.errorMessage)
                    setError(resolveErrorMessage(intl, response.data.errorMessage));
            } else setError(resolveErrorMessage(intl, response.error));
        } catch {
            if (mounted.current) setError(intl.formatMessage({ id: 'error.operation.failed' }));
        } finally {
            if (mounted.current) setBusy(false);
        }
    };
    const keyDown = (event: React.KeyboardEvent) => {
        event.stopPropagation();
        if (event.key === 'Escape' && !busy) onClose();
        if (event.key !== 'Tab') return;
        const controls = Array.from(
            panel.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled)',
            ) ?? [],
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!controls.includes(document.activeElement as HTMLElement)) {
            event.preventDefault();
            (event.shiftKey ? last : first)?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
        }
    };
    return (
        <div className="modal-overlay">
            <div
                ref={panel}
                className={styles.panel}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onKeyDown={keyDown}
            >
                <h2 id={titleId}>
                    {intl.formatMessage({ id: 'files.title' }, { name: item.name })}
                </h2>
                {!result && (
                    <>
                        <fieldset disabled={busy} className={styles.operations}>
                            <legend>{intl.formatMessage({ id: 'files.operation' })}</legend>
                            {(['verify', 'locate', 'move'] as const).map((mode) => (
                                <label key={mode}>
                                    <input
                                        type="radio"
                                        name={titleId}
                                        checked={operation === mode}
                                        onChange={() => {
                                            setOperation(mode);
                                            setError(null);
                                            setFolder(item.destinationFolder);
                                        }}
                                    />
                                    {intl.formatMessage({ id: `files.${mode}` })}
                                </label>
                            ))}
                        </fieldset>
                        <p>{intl.formatMessage({ id: `files.${operation}Help` })}</p>
                        <label className="label" htmlFor={`${titleId}-folder`}>
                            {intl.formatMessage({ id: 'files.folder' })}
                        </label>
                        <input
                            id={`${titleId}-folder`}
                            className="input"
                            readOnly
                            value={operation === 'verify' ? item.destinationFolder : folder}
                        />
                        {operation !== 'verify' && (
                            <button
                                className="btn"
                                disabled={busy}
                                onClick={() => void chooseFolder()}
                            >
                                {intl.formatMessage({ id: 'settings.general.selectFolder' })}
                            </button>
                        )}
                        <p>{intl.formatMessage({ id: 'files.pausedHelp' })}</p>
                    </>
                )}
                {busy && <p role="status">{intl.formatMessage({ id: 'files.working' })}</p>}
                {result && (
                    <p role="status">
                        {intl.formatMessage(
                            {
                                id:
                                    result.status === 'completed'
                                        ? 'files.complete'
                                        : 'files.partial',
                            },
                            { percent: Math.round(result.progress * 100) },
                        )}
                    </p>
                )}
                {error && (
                    <p role="alert" className={styles.error}>
                        {error}
                    </p>
                )}
                <div className={styles.actions}>
                    <button className="btn" disabled={busy} onClick={onClose}>
                        {intl.formatMessage({ id: result ? 'files.close' : 'common.cancel' })}
                    </button>
                    {!result && (
                        <button
                            className="btn btn--primary"
                            disabled={busy || !folder}
                            onClick={() => void submit()}
                        >
                            {intl.formatMessage({ id: 'files.confirm' })}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
