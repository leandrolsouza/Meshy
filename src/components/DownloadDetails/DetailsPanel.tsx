import React, { useEffect, useRef, useState } from 'react';
import { TorrentStatus } from '../../../shared/types';
import { GeneralTab } from './GeneralTab';
import { PeersTab } from './PeersTab';
import { PiecesTab } from './PiecesTab';
import { SpeedTab } from './SpeedTab';
import { TabBar, TabDefinition } from './TabBar';
import styles from './DetailsPanel.module.css';

export interface DetailsPanelProps {
    infoHash: string;
    status: TorrentStatus;
    isExpanded: boolean;
    onToggle: () => void;
}

const TABS: TabDefinition[] = [
    { id: 'general', label: 'Geral' },
    { id: 'peers', label: 'Peers' },
    { id: 'pieces', label: 'Peças' },
    { id: 'speed', label: 'Velocidade' },
];

/** Status que impedem a expansão do painel */
const NON_EXPANDABLE_STATUSES: TorrentStatus[] = ['resolving-metadata', 'queued'];

/**
 * Container do painel de detalhes expansível.
 * Gerencia estado de expansão/colapso com animação CSS e aba ativa.
 * Painéis inativos permanecem montados (ocultos via CSS) para preservar estado.
 */
export function DetailsPanel({
    infoHash,
    status,
    isExpanded,
    onToggle,
}: DetailsPanelProps): React.JSX.Element {
    const [activeTab, setActiveTab] = useState<string>('general');
    const prevExpandedRef = useRef(isExpanded);
    const panelIdPrefix = `details-${infoHash}`;

    // Reset aba para "Geral" sempre que o painel expande
    useEffect(() => {
        if (isExpanded && !prevExpandedRef.current) {
            setActiveTab('general');
        }
        prevExpandedRef.current = isExpanded;
    }, [isExpanded]);

    // Auto-colapsar se torrent transiciona para status não-expansível
    useEffect(() => {
        if (isExpanded && NON_EXPANDABLE_STATUSES.includes(status)) {
            onToggle();
        }
    }, [status, isExpanded, onToggle]);

    const _isDisabled = NON_EXPANDABLE_STATUSES.includes(status);

    return (
        <div
            className={`${styles.panel} ${isExpanded ? styles.panelExpanded : styles.panelCollapsed}`}
            data-testid="details-panel"
        >
            {/* Conteúdo renderizado sempre para manter painéis montados */}
            <div className={styles.panelContent}>
                <TabBar
                    tabs={TABS}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    panelIdPrefix={panelIdPrefix}
                />

                {TABS.map((tab) => {
                    const isActive = tab.id === activeTab;
                    return (
                        <div
                            key={tab.id}
                            id={`${panelIdPrefix}-panel-${tab.id}`}
                            role="tabpanel"
                            aria-labelledby={`${panelIdPrefix}-tab-${tab.id}`}
                            className={`${styles.tabPanel}${!isActive ? ` ${styles.tabPanelHidden}` : ''}`}
                        >
                            {tab.id === 'general' && (
                                <div data-testid="general-tab-content">
                                    <GeneralTab
                                        infoHash={infoHash}
                                        status={status}
                                    />
                                </div>
                            )}
                            {tab.id === 'peers' && (
                                <div data-testid="peers-tab-content">
                                    <PeersTab
                                        infoHash={infoHash}
                                        status={status}
                                    />
                                </div>
                            )}
                            {tab.id === 'pieces' && (
                                <div data-testid="pieces-tab-content">
                                    <PiecesTab
                                        infoHash={infoHash}
                                        status={status}
                                    />
                                </div>
                            )}
                            {tab.id === 'speed' && (
                                <div data-testid="speed-tab-content">
                                    <SpeedTab
                                        infoHash={infoHash}
                                        isCollecting={isExpanded}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Hook auxiliar para verificar se o status permite expansão.
 * Pode ser usado pelo componente pai (DownloadItem) para desabilitar o botão.
 */
export function isExpandable(status: TorrentStatus): boolean {
    return !NON_EXPANDABLE_STATUSES.includes(status);
}
