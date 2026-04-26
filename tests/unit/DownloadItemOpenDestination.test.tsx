/**
 * @jest-environment jsdom
 */

/**
 * Testes de propriedade (7.9) e de componente (7.10) para os botões
 * "Abrir pasta" / "Abrir arquivo" e menu de contexto do DownloadItem.
 *
 * Validates: Requirements 5.1–5.5, 6.1–6.6, 7.1–7.6, 8.1–8.3
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
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
        downloadedSize: 1_000_000,
        progress: 1,
        downloadSpeed: 0,
        uploadSpeed: 0,
        numPeers: 0,
        numSeeders: 0,
        timeRemaining: 0,
        status: 'completed',
        destinationFolder: '/tmp/downloads',
        addedAt: Date.now(),
        ...overrides,
    };
}

const defaultProps = {
    onPause: jest.fn(),
    onResume: jest.fn(),
    onRemove: jest.fn(),
    queueSize: 0,
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

// ─── Setup window.meshy mock ──────────────────────────────────────────────────

const mockOpenFolder = jest.fn<Promise<{ success: true; data: void }>, [string]>();
const mockOpenFile = jest.fn<Promise<{ success: true; data: void }>, [string]>();

beforeEach(() => {
    jest.clearAllMocks();
    mockOpenFolder.mockResolvedValue({ success: true, data: undefined });
    mockOpenFile.mockResolvedValue({ success: true, data: undefined });

    window.meshy = {
        openFolder: mockOpenFolder,
        openFile: mockOpenFile,
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
    } as unknown as typeof window.meshy;
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7.9 — Propriedade 9: visibilidade dos botões segue status e selectedFileCount
// ═══════════════════════════════════════════════════════════════════════════════

describe('Property 9: visibilidade dos botões segue status e selectedFileCount', () => {
    /**
     * **Validates: Requirements 5.1, 6.1, 6.2**
     *
     * Para qualquer combinação de status e selectedFileCount:
     * - "Abrir pasta" visível sse status === 'completed'
     * - "Abrir arquivo" visível sse status === 'completed' E selectedFileCount === 1
     */
    it('botão "Abrir pasta" visível sse completed, "Abrir arquivo" visível sse completed + selectedFileCount=1', () => {
        const statusArb = fc.constantFrom(...ALL_STATUSES);
        const selectedFileCountArb = fc.option(fc.nat({ max: 20 }), { nil: undefined });

        fc.assert(
            fc.property(statusArb, selectedFileCountArb, (status, selectedFileCount) => {
                const item = createItem({ status, selectedFileCount });
                const { unmount } = renderWithIntl(
                    <DownloadItem item={item} {...defaultProps} />,
                );

                const openFolderBtn = screen.queryByRole('button', { name: /abrir pasta/i });
                const openFileBtn = screen.queryByRole('button', { name: /abrir arquivo/i });

                // "Abrir pasta" visível sse status === 'completed'
                if (status === 'completed') {
                    expect(openFolderBtn).toBeInTheDocument();
                } else {
                    expect(openFolderBtn).not.toBeInTheDocument();
                }

                // "Abrir arquivo" visível sse status === 'completed' E selectedFileCount === 1
                if (status === 'completed' && selectedFileCount === 1) {
                    expect(openFileBtn).toBeInTheDocument();
                } else {
                    expect(openFileBtn).not.toBeInTheDocument();
                }

                unmount();
            }),
            { numRuns: 50 },
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7.10 — Testes de componente para botões e menu de contexto
// ═══════════════════════════════════════════════════════════════════════════════

describe('DownloadItem — botões Abrir pasta / Abrir arquivo', () => {
    // ── Visibilidade dos botões ───────────────────────────────────────────────

    it('"Abrir pasta" visível quando status === completed', () => {
        renderWithIntl(<DownloadItem item={createItem({ status: 'completed' })} {...defaultProps} />);
        expect(screen.getByRole('button', { name: /abrir pasta/i })).toBeInTheDocument();
    });

    it('"Abrir pasta" oculto quando status !== completed', () => {
        renderWithIntl(<DownloadItem item={createItem({ status: 'downloading' })} {...defaultProps} />);
        expect(screen.queryByRole('button', { name: /abrir pasta/i })).not.toBeInTheDocument();
    });

    it('"Abrir arquivo" visível quando completed + selectedFileCount=1', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'completed', selectedFileCount: 1 })}
                {...defaultProps}
            />,
        );
        expect(screen.getByRole('button', { name: /abrir arquivo/i })).toBeInTheDocument();
    });

    it('"Abrir arquivo" oculto quando selectedFileCount !== 1', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'completed', selectedFileCount: 3 })}
                {...defaultProps}
            />,
        );
        expect(screen.queryByRole('button', { name: /abrir arquivo/i })).not.toBeInTheDocument();
    });

    it('"Abrir arquivo" oculto quando selectedFileCount é undefined', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'completed', selectedFileCount: undefined })}
                {...defaultProps}
            />,
        );
        expect(screen.queryByRole('button', { name: /abrir arquivo/i })).not.toBeInTheDocument();
    });

    // ── Clique invoca IPC correto ─────────────────────────────────────────────

    it('clique em "Abrir pasta" invoca window.meshy.openFolder(infoHash)', async () => {
        const item = createItem({ status: 'completed', infoHash: 'hash_folder_test_1234567890abcdef1234' });
        renderWithIntl(<DownloadItem item={item} {...defaultProps} />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /abrir pasta/i }));
        });

        expect(mockOpenFolder).toHaveBeenCalledWith('hash_folder_test_1234567890abcdef1234');
    });

    it('clique em "Abrir arquivo" invoca window.meshy.openFile(infoHash)', async () => {
        const item = createItem({
            status: 'completed',
            selectedFileCount: 1,
            infoHash: 'hash_file_test_12345678901234567890',
        });
        renderWithIntl(<DownloadItem item={item} {...defaultProps} />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /abrir arquivo/i }));
        });

        expect(mockOpenFile).toHaveBeenCalledWith('hash_file_test_12345678901234567890');
    });

    // ── Exibição de erro ──────────────────────────────────────────────────────

    it('exibe mensagem de erro quando openFolder retorna success: false', async () => {
        mockOpenFolder.mockResolvedValueOnce({
            success: false,
            error: 'error.destination.folderNotFound',
        } as any);

        renderWithIntl(
            <DownloadItem item={createItem({ status: 'completed' })} {...defaultProps} />,
        );

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /abrir pasta/i }));
        });

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Pasta de destino não encontrada');
        });
    });

    it('exibe mensagem de erro quando openFile retorna success: false', async () => {
        mockOpenFile.mockResolvedValueOnce({
            success: false,
            error: 'error.destination.fileNotFound',
        } as any);

        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'completed', selectedFileCount: 1 })}
                {...defaultProps}
            />,
        );

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /abrir arquivo/i }));
        });

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Arquivo não encontrado');
        });
    });
});

// ── Menu de contexto ──────────────────────────────────────────────────────────

describe('DownloadItem — menu de contexto', () => {
    it('clique direito abre menu com opção "Abrir pasta"', () => {
        const { container } = renderWithIntl(
            <DownloadItem item={createItem({ status: 'completed' })} {...defaultProps} />,
        );

        const card = container.firstChild as HTMLElement;
        fireEvent.contextMenu(card);

        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();

        const items = screen.getAllByRole('menuitem');
        const openFolderItem = items.find((el) => el.textContent?.includes('Abrir pasta'));
        expect(openFolderItem).toBeDefined();
    });

    it('menu de contexto inclui "Abrir arquivo" quando selectedFileCount=1', () => {
        const { container } = renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'completed', selectedFileCount: 1 })}
                {...defaultProps}
            />,
        );

        const card = container.firstChild as HTMLElement;
        fireEvent.contextMenu(card);

        const items = screen.getAllByRole('menuitem');
        const openFileItem = items.find((el) => el.textContent?.includes('Abrir arquivo'));
        expect(openFileItem).toBeDefined();
    });

    it('opções desabilitadas quando status !== completed', () => {
        const { container } = renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'downloading', selectedFileCount: 1 })}
                {...defaultProps}
            />,
        );

        const card = container.firstChild as HTMLElement;
        fireEvent.contextMenu(card);

        const items = screen.getAllByRole('menuitem');
        items.forEach((menuItem) => {
            if (
                menuItem.textContent?.includes('Abrir pasta') ||
                menuItem.textContent?.includes('Abrir arquivo')
            ) {
                expect(menuItem).toHaveAttribute('aria-disabled', 'true');
            }
        });
    });
});

// ── Acessibilidade ────────────────────────────────────────────────────────────

describe('DownloadItem — acessibilidade dos botões', () => {
    it('botão "Abrir pasta" tem aria-label contendo o nome do torrent', () => {
        const item = createItem({ status: 'completed', name: 'Meu Torrent Especial' });
        renderWithIntl(<DownloadItem item={item} {...defaultProps} />);

        const btn = screen.getByRole('button', { name: /abrir pasta/i });
        expect(btn.getAttribute('aria-label')).toContain('Meu Torrent Especial');
    });

    it('botão "Abrir arquivo" tem aria-label contendo o nome do torrent', () => {
        const item = createItem({
            status: 'completed',
            selectedFileCount: 1,
            name: 'Arquivo Único',
        });
        renderWithIntl(<DownloadItem item={item} {...defaultProps} />);

        const btn = screen.getByRole('button', { name: /abrir arquivo/i });
        expect(btn.getAttribute('aria-label')).toContain('Arquivo Único');
    });
});
