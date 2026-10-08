import React, { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import type { BatchAction, BatchActionResult, DownloadItem } from '../../../shared/types';
import { useDownloadStore } from '../../store/downloadStore';
import { resolveErrorMessage } from '../../utils/resolveErrorMessage';
import { ConfirmDialog } from '../common/ConfirmDialog';
import styles from './DownloadList.module.css';

export function BatchActions({
    visibleItems,
    selectedHashes,
    onSelect,
    onClear,
    onBusy,
}: {
    visibleItems: DownloadItem[];
    selectedHashes: Set<string>;
    onSelect: (hashes: string[]) => void;
    onClear: () => void;
    onBusy: (busy: boolean) => void;
}): React.JSX.Element {
    const intl = useIntl();
    const [busy, setBusy] = useState(false);
    const [results, setResults] = useState<BatchActionResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [removeHashes, setRemoveHashes] = useState<string[]>([]);
    const mounted = useRef(false);
    const pending = useRef(false);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const selected = visibleItems.filter((item) => selectedHashes.has(item.infoHash));
    const eligible = (operation: BatchAction) =>
        selected
            .filter(
                (item) =>
                    !item.fileOperation &&
                    (operation === 'remove' ||
                        (operation === 'resume'
                            ? item.status === 'paused'
                            : ['downloading', 'queued', 'resolving-metadata'].includes(
                                  item.status,
                              ))),
            )
            .slice(0, 200)
            .map((item) => item.infoHash);
    const execute = async (operation: BatchAction, hashes: string[], deleteFiles = false) => {
        if (pending.current || !hashes.length) return;
        pending.current = true;
        setBusy(true);
        onBusy(true);
        setError(null);
        setResults([]);
        try {
            const response = await window.meshy.batchAction(hashes, operation, deleteFiles);
            if (!mounted.current) return;
            if (!response.success) {
                setError(resolveErrorMessage(intl, response.error));
                return;
            }
            setResults(response.data);
            if (operation === 'remove')
                for (const result of response.data)
                    if (result.success) useDownloadStore.getState().removeItem(result.infoHash);
            const snapshot = await window.meshy.getAll();
            if (!mounted.current) return;
            if (snapshot.success) useDownloadStore.getState().mergeItems(snapshot.data);
            else setError(resolveErrorMessage(intl, snapshot.error));
            // Mantém selecionados somente os que falharam, para repetir a ação.
            const failed = new Set(
                response.data.filter((result) => !result.success).map((result) => result.infoHash),
            );
            onSelect(
                selected
                    .filter((item) => !hashes.includes(item.infoHash) || failed.has(item.infoHash))
                    .map((item) => item.infoHash),
            );
        } catch {
            if (mounted.current) setError(intl.formatMessage({ id: 'error.operation.failed' }));
        } finally {
            pending.current = false;
            onBusy(false);
            if (mounted.current) setBusy(false);
        }
    };
    return (
        <div className={styles.batch}>
            <div
                className={styles.actionsBar}
                role="group"
                aria-label={intl.formatMessage({ id: 'batch.title' })}
            >
                <button
                    className="btn"
                    type="button"
                    disabled={busy || !visibleItems.some((item) => !item.fileOperation)}
                    onClick={() =>
                        onSelect(
                            visibleItems
                                .filter((item) => !item.fileOperation)
                                .map((item) => item.infoHash),
                        )
                    }
                >
                    {intl.formatMessage({ id: 'batch.selectVisible' })}
                </button>
                <button
                    className="btn"
                    type="button"
                    disabled={busy || !selected.length}
                    onClick={onClear}
                >
                    {intl.formatMessage({ id: 'batch.clear' })}
                </button>
                <span>
                    {intl.formatMessage({ id: 'batch.selected' }, { count: selected.length })}
                </span>
                <button
                    className="btn"
                    type="button"
                    disabled={busy || !eligible('pause').length}
                    onClick={() => void execute('pause', eligible('pause'))}
                >
                    {intl.formatMessage({ id: 'batch.pause' })}
                </button>
                <button
                    className="btn"
                    type="button"
                    disabled={busy || !eligible('resume').length}
                    onClick={() => void execute('resume', eligible('resume'))}
                >
                    {intl.formatMessage({ id: 'batch.resume' })}
                </button>
                <button
                    className="btn btn--danger"
                    type="button"
                    disabled={busy || !eligible('remove').length}
                    onClick={() => setRemoveHashes(eligible('remove'))}
                >
                    {intl.formatMessage({ id: 'batch.remove' })}
                </button>
            </div>
            <p>{intl.formatMessage({ id: 'batch.visibleHelp' })}</p>
            {busy && <p role="status">{intl.formatMessage({ id: 'downloads.processing' })}</p>}
            {results.length > 0 && (
                <div role="status">
                    <p>
                        {intl.formatMessage(
                            { id: 'batch.summary' },
                            {
                                succeeded: results.filter((result) => result.success).length,
                                total: results.length,
                            },
                        )}
                    </p>
                    <ul>
                        {results.map((result) => (
                            <li key={result.infoHash}>
                                {result.name}:{' '}
                                {result.success
                                    ? intl.formatMessage({ id: 'batch.success' })
                                    : resolveErrorMessage(
                                          intl,
                                          result.error ?? 'error.operation.failed',
                                      )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {error && <p role="alert">{error}</p>}
            <ConfirmDialog
                isOpen={removeHashes.length > 0}
                title={intl.formatMessage({ id: 'batch.removeTitle' })}
                message={intl.formatMessage(
                    { id: 'batch.removeMessage' },
                    { count: removeHashes.length },
                )}
                onCancel={() => setRemoveHashes([])}
                onConfirmKeepFiles={() => {
                    const hashes = removeHashes;
                    setRemoveHashes([]);
                    void execute('remove', hashes, false);
                }}
                onConfirmDeleteFiles={() => {
                    const hashes = removeHashes;
                    setRemoveHashes([]);
                    void execute('remove', hashes, true);
                }}
            />
        </div>
    );
}
