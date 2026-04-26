import React from 'react';
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
                    DHT (Distributed Hash Table)
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
                    PEX (Peer Exchange)
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
                    uTP (Micro Transport Protocol)
                </label>
            </div>

            <p className={styles.networkWarning}>
                Alterar essas opções reinicia o motor de torrents. Downloads ativos serão
                brevemente interrompidos e retomados automaticamente.
            </p>
        </>
    );
}
