import React, { useCallback, useEffect, useRef, useState } from 'react';
import { resolveErrorMessage } from '../../utils/resolveErrorMessage';
import { useIntl } from 'react-intl';
import type { AppSettings, IPCResponse, MagnetHandlerStatus } from '../../../shared/types';
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
    const [registered, setRegistered] = useState<MagnetHandlerStatus | null>(null);
    const pending = useRef(false);
    const generation = useRef(0);
    const registerButton = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (registered?.isDefault && document.activeElement === document.body)
            registerButton.current?.focus();
    }, [registered?.isDefault]);
    useEffect(
        () => () => {
            generation.current++;
        },
        [],
    );
    const runSystemAction = async (
        operation: () => Promise<IPCResponse<MagnetHandlerStatus | void>>,
        reset = false,
    ) => {
        if (pending.current) return;
        pending.current = true;
        const current = ++generation.current;
        setSystemBusy(true);
        setSystemError(null);
        if (reset) setRegistered(null);
        try {
            const response = await operation();
            if (current !== generation.current) return;
            if (response.success) {
                if (response.data) setRegistered(response.data);
            } else setSystemError(resolveErrorMessage(intl, response.error));
        } catch {
            if (current === generation.current)
                setSystemError(intl.formatMessage({ id: 'error.system.protocolRegistration' }));
        } finally {
            pending.current = false;
            if (current === generation.current) setSystemBusy(false);
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
                    ref={registerButton}
                    type="button"
                    className="btn"
                    disabled={systemBusy}
                    onClick={() =>
                        void runSystemAction(() => window.meshy.registerMagnetHandler(), true)
                    }
                >
                    {intl.formatMessage({ id: 'settings.general.registerMagnet' })}
                </button>
                <p>{intl.formatMessage({ id: 'settings.general.associationsHelp' })}</p>
                {registered && (
                    <p role="status" className={styles.systemFeedback}>
                        {intl.formatMessage(
                            {
                                id: registered.isDefault
                                    ? 'settings.general.magnetDefault'
                                    : 'settings.general.magnetRegistered',
                            },
                            { application: registered.applicationName },
                        )}
                    </p>
                )}
                {registered && !registered.isDefault && (
                    <div className={styles.systemActions}>
                        {registered.canOpenDefaultApps && (
                            <button
                                type="button"
                                className="btn"
                                disabled={systemBusy}
                                onClick={() =>
                                    void runSystemAction(() => window.meshy.openMagnetDefaultApps())
                                }
                            >
                                {intl.formatMessage({ id: 'settings.general.openDefaultApps' })}
                            </button>
                        )}
                        <button
                            type="button"
                            className="btn"
                            disabled={systemBusy}
                            onClick={() =>
                                void runSystemAction(() => window.meshy.getMagnetHandlerStatus())
                            }
                        >
                            {intl.formatMessage({ id: 'settings.general.checkMagnetDefault' })}
                        </button>
                    </div>
                )}
                {systemError && (
                    <p role="alert" className={styles.systemFeedback}>
                        {systemError}
                    </p>
                )}
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
