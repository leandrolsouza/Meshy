import React, { useCallback, useRef } from 'react';
import styles from './TabBar.module.css';

export interface TabDefinition {
    id: string;
    label: string;
}

export interface TabBarProps {
    tabs: TabDefinition[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
    panelIdPrefix: string;
}

/**
 * Barra de abas acessível com navegação por teclado (ARIA tablist/tab).
 * Componente controlado — `activeTab` e `onTabChange` vêm do pai.
 */
export function TabBar({ tabs, activeTab, onTabChange, panelIdPrefix }: TabBarProps): React.JSX.Element {
    const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
            if (currentIndex === -1) return;

            let nextIndex: number;

            switch (e.key) {
                case 'ArrowRight':
                    nextIndex = (currentIndex + 1) % tabs.length;
                    break;
                case 'ArrowLeft':
                    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                    break;
                case 'Home':
                    nextIndex = 0;
                    break;
                case 'End':
                    nextIndex = tabs.length - 1;
                    break;
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    onTabChange(tabs[currentIndex].id);
                    return;
                default:
                    return;
            }

            e.preventDefault();
            tabsRef.current[nextIndex]?.focus();
            onTabChange(tabs[nextIndex].id);
        },
        [tabs, activeTab, onTabChange],
    );

    const setTabRef = useCallback(
        (index: number) => (el: HTMLButtonElement | null) => {
            tabsRef.current[index] = el;
        },
        [],
    );

    return (
        <div
            className={styles.tabList}
            role="tablist"
            onKeyDown={handleKeyDown}
        >
            {tabs.map((tab, index) => {
                const isActive = tab.id === activeTab;
                return (
                    <button
                        key={tab.id}
                        ref={setTabRef(index)}
                        id={`${panelIdPrefix}-tab-${tab.id}`}
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`${panelIdPrefix}-panel-${tab.id}`}
                        tabIndex={isActive ? 0 : -1}
                        className={`${styles.tab}${isActive ? ` ${styles.tabActive}` : ''}`}
                        onClick={() => onTabChange(tab.id)}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
