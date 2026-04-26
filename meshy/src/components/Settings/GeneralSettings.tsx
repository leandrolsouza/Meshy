import React, { useCallback } from 'react';
import type { AppSettings } from '../../../shared/types';
import { ThemeSwitcher } from './ThemeSwitcher';
import styles from './SettingsPanel.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface GeneralSettingsProps {
    settings: AppSettings;
    currentThemeId: string;
    notificationsEnabled: boolean;
    onThemeChange: (themeId: string) => void;
    onSelectFolder: () => void;
    onNotificationsChange: (enabled: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Aba "Geral" — tema, pasta de destino e notificações.
 */
export function GeneralSettings({
    settings,
    currentThemeId,
    notificationsEnabled,
    onThemeChange,
    onSelectFolder,
    onNotificationsChange,
}: GeneralSettingsProps): React.JSX.Element {
    const handleNotificationsChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onNotificationsChange(e.target.checked);
        },
        [onNotificationsChange],
    );

    return (
        <>
            {/* Seletor de tema — aplicação imediata, sem "Salvar" */}
            <div className={styles.fieldGroup}>
                <label htmlFor="theme-select" className="label">
                    Tema
                </label>
                <ThemeSwitcher currentThemeId={currentThemeId} onThemeChange={onThemeChange} />
            </div>

            {/* Pasta de destino */}
            <div className={styles.fieldGroup}>
                <label htmlFor="destination-folder" className="label">
                    Pasta de destino
                </label>
                <div className={styles.folderRow}>
                    <input
                        id="destination-folder"
                        type="text"
                        className={`input input--readonly ${styles.folderInput}`}
                        value={settings.destinationFolder}
                        readOnly
                    />
                    <button type="button" className="btn" onClick={onSelectFolder}>
                        Selecionar pasta
                    </button>
                </div>
            </div>

            {/* Notificações nativas */}
            <div className={styles.fieldGroup}>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={notificationsEnabled}
                        onChange={handleNotificationsChange}
                        className={styles.checkbox}
                    />
                    Notificações do sistema (download concluído ou com erro)
                </label>
            </div>
        </>
    );
}
