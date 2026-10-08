import React, { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import type { BandwidthStatus } from '../../../shared/types';
import { usePolling } from '../../hooks/usePolling';
import { resolveErrorMessage } from '../../utils/resolveErrorMessage';
import styles from './LightModeButton.module.css';

export function LightModeButton(): React.JSX.Element | null {
    const intl = useIntl();
    const [status, setStatus] = useState<BandwidthStatus | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mounted = useRef(false);
    const generation = useRef(0);
    const pending = useRef(false);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    usePolling(
        async () => {
            if (pending.current) return;
            const current = ++generation.current;
            try {
                const response = await window.meshy.getBandwidthStatus();
                if (!mounted.current || generation.current !== current) return;
                if (response.success) {
                    setStatus(response.data);
                    setError(null);
                } else setError(resolveErrorMessage(intl, response.error));
            } catch {
                if (mounted.current && generation.current === current)
                    setError(intl.formatMessage({ id: 'error.operation.failed' }));
            }
        },
        10_000,
        !!window.meshy.getBandwidthStatus,
    );
    const toggle = async () => {
        if (!status || pending.current) return;
        pending.current = true;
        ++generation.current;
        setBusy(true);
        setError(null);
        try {
            const response = await window.meshy.setLightMode(!status.manualEnabled);
            if (!mounted.current) return;
            if (response.success) setStatus(response.data);
            else setError(resolveErrorMessage(intl, response.error));
        } catch {
            if (mounted.current) setError(intl.formatMessage({ id: 'error.operation.failed' }));
        } finally {
            pending.current = false;
            if (mounted.current) setBusy(false);
        }
    };
    if (!window.meshy.getBandwidthStatus) return null;
    return (
        <div className={styles.control}>
            <button
                className="btn"
                type="button"
                disabled={busy || !status}
                aria-pressed={status?.manualEnabled ?? false}
                onClick={() => void toggle()}
                title={intl.formatMessage({ id: 'bandwidth.quickHelp' })}
            >
                {intl.formatMessage({ id: 'bandwidth.quick' })}
            </button>
            {status && (
                <span
                    className={styles.mode}
                    title={intl.formatMessage(
                        { id: 'bandwidth.effective' },
                        {
                            download: status.downloadLimit || '∞',
                            upload: status.uploadLimit || '∞',
                        },
                    )}
                >
                    {intl.formatMessage({ id: `bandwidth.mode.${status.mode}` })}
                </span>
            )}
            {error && (
                <span role="alert" className={styles.error}>
                    {error}
                </span>
            )}
        </div>
    );
}
