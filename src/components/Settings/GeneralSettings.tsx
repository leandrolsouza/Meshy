import React, { useCallback, useState } from 'react';
import { resolveErrorMessage } from '../../utils/resolveErrorMessage';
import { useIntl } from 'react-intl';
import type { AppSettings } from '../../../shared/types';
import { ThemeSwitcher } from './ThemeSwitcher';
import { LanguageSelector } from './LanguageSelector';
import styles from './SettingsPanel.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface GeneralSettingsProps {
    settings: AppSettings;
    currentThemeId: string;
    notificationsEnabled: boolean;
    onThemeChange: (themeId: string) => void;
    onSelectFolder: () => void;
    onNotificationsChange: (enabled: boolean) => void;
    onUpdateSettings: (partial: Partial<AppSettings>) => Promise<boolean>;
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
    onUpdateSettings,
}: GeneralSettingsProps): React.JSX.Element {
    const intl = useIntl();
    const [systemBusy, setSystemBusy] = useState(false);
    const [systemError, setSystemError] = useState<string | null>(null);
    const [registered, setRegistered] = useState(false);
    const registerMagnet = async () => {
        setSystemBusy(true);
        setSystemError(null);
        setRegistered(false);
        try {
            const response = await window.meshy.registerMagnetHandler();
            if (response.success) setRegistered(true);
            else setSystemError(resolveErrorMessage(intl, response.error));
        } catch {
            setSystemError(intl.formatMessage({ id: 'error.system.protocolRegistration' }));
        } finally {
            setSystemBusy(false);
        }
    };

    const handleNotificationsChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onNotificationsChange(e.target.checked);
        },
        [onNotificationsChange],
    );

    const handleLocaleChange = useCallback(
        (locale: string) => {
            onUpdateSettings({ locale });
        },
        [onUpdateSettings],
    );

    return (
        <>
            {/* Seletor de tema — aplicação imediata, sem "Salvar" */}
            <div className={styles.fieldGroup}>
                <label htmlFor="theme-select" className="label">
                    {intl.formatMessage({ id: 'settings.general.theme' })}
                </label>
                <ThemeSwitcher currentThemeId={currentThemeId} onThemeChange={onThemeChange} />
            </div>

            {/* Seletor de idioma — aplicação imediata, sem "Salvar" */}
            <div className={styles.fieldGroup}>
                <label htmlFor="language-select" className="label">
                    {intl.formatMessage({ id: 'settings.general.language' })}
                </label>
                <LanguageSelector onLocaleChange={handleLocaleChange} />
            </div>

            {/* Pasta de destino */}
            <div className={styles.fieldGroup}>
                <label htmlFor="destination-folder" className="label">
                    {intl.formatMessage({ id: 'settings.general.destinationFolder' })}
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
                        {intl.formatMessage({ id: 'settings.general.selectFolder' })}
                    </button>
                </div>
            </div>

            {/* Notificações nativas */}
            <div className={styles.fieldGroup}>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={settings.closeToTray ?? false}
                        onChange={(event) =>
                            void onUpdateSettings({ closeToTray: event.target.checked })
                        }
                    />
                    {intl.formatMessage({ id: 'settings.general.closeToTray' })}
                </label>
                <p>{intl.formatMessage({ id: 'settings.general.closeToTrayHelp' })}</p>
            </div>
            <div className={styles.fieldGroup}>
                <button
                    type="button"
                    className="btn"
                    disabled={systemBusy}
                    onClick={() => void registerMagnet()}
                >
                    {intl.formatMessage({ id: 'settings.general.registerMagnet' })}
                </button>
                <p>{intl.formatMessage({ id: 'settings.general.associationsHelp' })}</p>
                {registered && (
                    <p role="status">
                        {intl.formatMessage({ id: 'settings.general.magnetRegistered' })}
                    </p>
                )}
                {systemError && <p role="alert">{systemError}</p>}
            </div>
            <div className={styles.fieldGroup}>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={notificationsEnabled}
                        onChange={handleNotificationsChange}
                        className={styles.checkbox}
                    />
                    {intl.formatMessage({ id: 'settings.general.notifications' })}
                </label>
            </div>
        </>
    );
}
