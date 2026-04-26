import React from 'react';
import { useIntl } from 'react-intl';
import styles from './SettingsPanel.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface NetworkSettingsProps {
    dhtEnabled: boolean;
    pexEnabled: boolean;
    utpEnabled: boolean;
    onDhtChange: (enabled: boolean) => void;
    onPexChange: (enabled: boolean) => void;
    onUtpChange: (enabled: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Aba "Rede" — configurações avançadas de rede (DHT, PEX, uTP).
 */
export function NetworkSettings({
    dhtEnabled,
    pexEnabled,
    utpEnabled,
    onDhtChange,
    onPexChange,
    onUtpChange,
}: NetworkSettingsProps): React.JSX.Element {
    const intl = useIntl();

    return (
        <>
            <div className={styles.fieldGroup}>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={dhtEnabled}
                        onChange={(e) => onDhtChange(e.target.checked)}
                        className={styles.checkbox}
                    />
                    {intl.formatMessage({ id: 'settings.network.dht' })}
                </label>
            </div>

            <div className={styles.fieldGroup}>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={pexEnabled}
                        onChange={(e) => onPexChange(e.target.checked)}
                        className={styles.checkbox}
                    />
                    {intl.formatMessage({ id: 'settings.network.pex' })}
                </label>
            </div>

            <div className={styles.fieldGroup}>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={utpEnabled}
                        onChange={(e) => onUtpChange(e.target.checked)}
                        className={styles.checkbox}
                    />
                    {intl.formatMessage({ id: 'settings.network.utp' })}
                </label>
            </div>

            <p className={styles.networkWarning}>
                {intl.formatMessage({ id: 'settings.network.warning' })}
            </p>
        </>
    );
}
