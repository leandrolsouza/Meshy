import React from 'react';
import styles from './SettingsTabs.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SettingsTabId = 'general' | 'transfer' | 'network' | 'trackers';

export interface SettingsTab {
    id: SettingsTabId;
    label: string;
}

// ─── Definição das abas ───────────────────────────────────────────────────────

export const SETTINGS_TABS: SettingsTab[] = [
    { id: 'general', label: 'Geral' },
    { id: 'transfer', label: 'Transferências' },
    { id: 'network', label: 'Rede' },
    { id: 'trackers', label: 'Trackers' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface SettingsTabsProps {
    activeTab: SettingsTabId;
    onTabChange: (tab: SettingsTabId) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Barra de abas horizontal para navegação entre seções de configurações.
 * Usa role="tablist" / role="tab" para acessibilidade.
 */
export function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps): React.JSX.Element {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        let nextIndex: number | null = null;

        if (e.key === 'ArrowRight') {
            nextIndex = (index + 1) % SETTINGS_TABS.length;
        } else if (e.key === 'ArrowLeft') {
            nextIndex = (index - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length;
        } else if (e.key === 'Home') {
            nextIndex = 0;
        } else if (e.key === 'End') {
            nextIndex = SETTINGS_TABS.length - 1;
        }

        if (nextIndex !== null) {
            e.preventDefault();
            const nextTab = SETTINGS_TABS[nextIndex];
            onTabChange(nextTab.id);
            // Foca o botão da aba destino
            const tabEl = document.getElementById(`settings-tab-${nextTab.id}`);
            tabEl?.focus();
        }
    };

    return (
        <div className={styles.tabBar} role="tablist" aria-label="Seções de configurações">
            {SETTINGS_TABS.map((tab, index) => {
                const isActive = tab.id === activeTab;
                return (
                    <button
                        key={tab.id}
                        id={`settings-tab-${tab.id}`}
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`settings-tabpanel-${tab.id}`}
                        tabIndex={isActive ? 0 : -1}
                        className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
                        onClick={() => onTabChange(tab.id)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
