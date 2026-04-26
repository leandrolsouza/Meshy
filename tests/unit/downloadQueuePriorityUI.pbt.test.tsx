/**
 * @jest-environment jsdom
 */

/**
 * Testes de propriedade (PBT) para a feature de prioridade na fila de downloads — UI.
 *
 * Propriedades de componente (jsdom environment):
 *   - Property 4: Controles de fila visíveis apenas para itens enfileirados
 *   - Property 5: Botões de limite desabilitados nas extremidades
 *   - Property 6: Apenas itens enfileirados são arrastáveis
 *   - Property 9: Aria-labels contêm nome do download e ação
 *
 * Usa fast-check com mínimo de 100 iterações por propriedade.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import '@testing-library/jest-dom';
import fc from 'fast-check';
import type { DownloadItem as DownloadItemType, TorrentStatus } from '../../shared/types';
import ptBR from '../../src/locales/pt-BR.json';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('react-icons/vsc', () => ({
    VscArrowDown: () => <span data-testid="icon-arrow-down" />,
    VscArrowUp: () => <span data-testid="icon-arrow-up" />,
    VscDebugPause: () => <span data-testid="icon-pause" />,
    VscPlay: () => <span data-testid="icon-play" />,
    VscTrash: () => <span data-testid="icon-trash" />,
    VscChevronDown: () => <span data-testid="icon-chevron-down" />,
    VscChevronRight: () => <span data-testid="icon-chevron-right" />,
    VscFolderOpened: () => <span data-testid="icon-folder-opened" />,
    VscGoToFile: () => <span data-testid="icon-go-to-file" />,
}));

jest.mock('../../src/components/FileSelector/FileSelector', () => ({
    FileSelector: () => <div data-testid="file-selector" />,
}));

jest.mock('../../src/components/TrackerPanel/TrackerPanel', () => ({
    TrackerPanel: () => <div data-testid="tracker-panel" />,
}));

jest.mock('../../src/components/common/ConfirmDialog', () => ({
    ConfirmDialog: () => null,
}));

jest.mock('../../src/components/common/ProgressBar', () => ({
    ProgressBar: () => <div data-testid="progress-bar" />,
}));

jest.mock('../../src/components/common/SpeedDisplay', () => ({
    SpeedDisplay: () => <span data-testid="speed-display" />,
}));

// Import component after mocks
import { DownloadItem } from '../../src/components/DownloadList/DownloadItem';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderWithIntl(ui: React.ReactElement) {
    return render(
        <IntlProvider locale="pt-BR" defaultLocale="pt-BR" messages={ptBR}>
            {ui}
        </IntlProvider>,
    );
}

function createItem(overrides: Partial<DownloadItemType> = {}): DownloadItemType {
    return {
        infoHash: 'abc123def456abc123def456abc123def456abc1',
        name: 'Test Torrent',
        totalSize: 1_000_000,
        downloadedSize: 0,
        progress: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        numPeers: 0,
        numSeeders: 0,
        timeRemaining: Infinity,
        status: 'downloading',
        destinationFolder: '/tmp/downloads',
        addedAt: Date.now(),
        ...overrides,
    };
}

const defaultProps = {
    onPause: jest.fn(),
    onResume: jest.fn(),
    onRemove: jest.fn(),
    queueSize: 5,
    onMoveUp: jest.fn(),
    onMoveDown: jest.fn(),
};

// ─── Todos os valores de TorrentStatus ────────────────────────────────────────

const ALL_STATUSES: TorrentStatus[] = [
    'queued',
    'resolving-metadata',
    'downloading',
    'paused',
    'completed',
    'error',
    'metadata-failed',
    'files-not-found',
];

// ─── Arbitrários fast-check ──────────────────────────────────────────────────

const statusArb = fc.constantFrom(...ALL_STATUSES);

// ─── Setup window.meshy mock ──────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();

    window.meshy = {
        openFolder: jest.fn().mockResolvedValue({ success: true, data: undefined }),
        openFile: jest.fn().mockResolvedValue({ success: true, data: undefined }),
        getFiles: jest.fn().mockResolvedValue({ success: true, data: [] }),
        setFileSelection: jest.fn().mockResolvedValue({ success: true, data: [] }),
        getTrackers: jest.fn().mockResolvedValue({ success: true, data: [] }),
        addTracker: jest.fn(),
        removeTracker: jest.fn(),
        applyGlobalTrackers: jest.fn(),
        getGlobalTrackers: jest.fn(),
        addGlobalTracker: jest.fn(),
        removeGlobalTracker: jest.fn(),
        addTorrentFile: jest.fn(),
        addMagnetLink: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn(),
        remove: jest.fn(),
        getAll: jest.fn(),
        getSettings: jest.fn(),
        setSettings: jest.fn(),
        selectFolder: jest.fn(),
        retryDownload: jest.fn(),
        onProgress: jest.fn().mockReturnValue(() => { }),
        onError: jest.fn().mockReturnValue(() => { }),
        reportError: jest.fn(),
        getMetrics: jest.fn(),
        reorderQueue: jest.fn(),
        getQueueOrder: jest.fn(),
        addTorrentFileBuffer: jest.fn(),
        selectTorrentFile: jest.fn(),
    } as unknown as typeof window.meshy;
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 4: Controles de fila visíveis apenas para itens enfileirados
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: download-queue-priority, Property 4: Controles de fila visíveis apenas para itens enfileirados', () => {
    /**
     * **Validates: Requirements 2.3, 3.3, 5.1, 5.3**
     *
     * Para qualquer status, os botões mover para cima/baixo e badge de posição
     * são visíveis sse status === 'queued'.
     */
    it('botões mover e badge visíveis sse status === queued', () => {
        fc.assert(
            fc.property(statusArb, (status) => {
                const isQueued = status === 'queued';
                const item = createItem({
                    status,
                    queuePosition: isQueued ? 2 : undefined,
                });

                const { unmount } = renderWithIntl(
                    <DownloadItem item={item} {...defaultProps} queueSize={5} />,
                );

                // Botão "Mover para cima"
                const moveUpBtn = screen.queryByRole('button', { name: /mover.*cima/i });
                // Botão "Mover para baixo"
                const moveDownBtn = screen.queryByRole('button', { name: /mover.*baixo/i });
                // Badge de posição (#N)
                const badge = screen.queryByText(/^#\d+$/);

                if (isQueued) {
                    expect(moveUpBtn).toBeInTheDocument();
                    expect(moveDownBtn).toBeInTheDocument();
                    expect(badge).toBeInTheDocument();
                } else {
                    expect(moveUpBtn).not.toBeInTheDocument();
                    expect(moveDownBtn).not.toBeInTheDocument();
                    expect(badge).not.toBeInTheDocument();
                }

                unmount();
            }),
            { numRuns: 100 },
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 5: Botões de limite desabilitados nas extremidades
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: download-queue-priority, Property 5: Botões de limite desabilitados nas extremidades', () => {
    /**
     * **Validates: Requirements 2.2, 3.2, 8.4**
     *
     * Para itens queued com queuePosition e queueSize aleatórios:
     * - "mover para cima" desabilitado quando queuePosition === 1
     * - "mover para baixo" desabilitado quando queuePosition === queueSize
     */
    it('botões desabilitados nas extremidades da fila', () => {
        // Gerar queueSize entre 1 e 20, e queuePosition entre 1 e queueSize
        const arb = fc
            .integer({ min: 1, max: 20 })
            .chain((queueSize) =>
                fc.tuple(
                    fc.constant(queueSize),
                    fc.integer({ min: 1, max: queueSize }),
                ),
            );

        fc.assert(
            fc.property(arb, ([queueSize, queuePosition]) => {
                const item = createItem({
                    status: 'queued',
                    queuePosition,
                });

                const { unmount } = renderWithIntl(
                    <DownloadItem item={item} {...defaultProps} queueSize={queueSize} />,
                );

                const moveUpBtn = screen.getByRole('button', { name: /mover.*cima/i });
                const moveDownBtn = screen.getByRole('button', { name: /mover.*baixo/i });

                // "mover para cima" desabilitado quando queuePosition === 1
                if (queuePosition === 1) {
                    expect(moveUpBtn).toBeDisabled();
                    expect(moveUpBtn).toHaveAttribute('aria-disabled', 'true');
                } else {
                    expect(moveUpBtn).not.toBeDisabled();
                }

                // "mover para baixo" desabilitado quando queuePosition === queueSize
                if (queuePosition === queueSize) {
                    expect(moveDownBtn).toBeDisabled();
                    expect(moveDownBtn).toHaveAttribute('aria-disabled', 'true');
                } else {
                    expect(moveDownBtn).not.toBeDisabled();
                }

                unmount();
            }),
            { numRuns: 100 },
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 6: Apenas itens enfileirados são arrastáveis
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: download-queue-priority, Property 6: Apenas itens enfileirados são arrastáveis', () => {
    /**
     * **Validates: Requirements 4.5**
     *
     * Para qualquer status, draggable é true sse status === 'queued'.
     */
    it('draggable é true sse status === queued', () => {
        fc.assert(
            fc.property(statusArb, (status) => {
                const isQueued = status === 'queued';
                const item = createItem({
                    status,
                    queuePosition: isQueued ? 1 : undefined,
                });

                const { container, unmount } = renderWithIntl(
                    <DownloadItem item={item} {...defaultProps} />,
                );

                const card = container.firstChild as HTMLElement;

                if (isQueued) {
                    expect(card).toHaveAttribute('draggable', 'true');
                } else {
                    // draggable pode ser "false" ou não estar presente
                    const draggable = card.getAttribute('draggable');
                    expect(draggable !== 'true').toBe(true);
                }

                unmount();
            }),
            { numRuns: 100 },
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 9: Aria-labels contêm nome do download e ação
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: download-queue-priority, Property 9: Aria-labels contêm nome e ação', () => {
    /**
     * **Validates: Requirements 8.1**
     *
     * Para nomes de download aleatórios, os aria-labels dos botões
     * "mover para cima" e "mover para baixo" contêm o nome do download.
     */
    it('aria-labels dos botões contêm o nome do download', () => {
        // Gerar nomes alfanuméricos não-vazios (evitar caracteres especiais que
        // poderiam causar problemas com regex ou formatação)
        const nameArb = fc.stringOf(
            fc.constantFrom(
                ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_'.split(''),
            ),
            { minLength: 1, maxLength: 50 },
        );

        fc.assert(
            fc.property(nameArb, (name) => {
                const item = createItem({
                    status: 'queued',
                    name,
                    queuePosition: 2,
                });

                const { unmount } = renderWithIntl(
                    <DownloadItem item={item} {...defaultProps} queueSize={5} />,
                );

                const moveUpBtn = screen.getByRole('button', { name: /mover.*cima/i });
                const moveDownBtn = screen.getByRole('button', { name: /mover.*baixo/i });

                // aria-label deve conter o nome do download
                const upLabel = moveUpBtn.getAttribute('aria-label') ?? '';
                const downLabel = moveDownBtn.getAttribute('aria-label') ?? '';

                expect(upLabel).toContain(name);
                expect(downLabel).toContain(name);

                unmount();
            }),
            { numRuns: 100 },
        );
    });
});
