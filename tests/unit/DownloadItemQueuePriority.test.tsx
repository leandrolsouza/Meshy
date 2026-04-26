/**
 * @jest-environment jsdom
 */

/**
 * Testes de componente para o DownloadItem com controles de fila
 * (badge de posição, botões mover para cima/baixo, aria-live).
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 5.1, 5.2, 5.3,
 *            8.1, 8.2, 8.3, 8.4
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import '@testing-library/jest-dom';
import type { DownloadItem as DownloadItemType } from '../../shared/types';
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

// Importar componente após os mocks
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
        name: 'Torrent de Teste',
        totalSize: 1_000_000,
        downloadedSize: 0,
        progress: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        numPeers: 0,
        numSeeders: 0,
        timeRemaining: 0,
        status: 'queued',
        destinationFolder: '/tmp/downloads',
        addedAt: Date.now(),
        queuePosition: 2,
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
        reorderQueue: jest.fn().mockResolvedValue({ success: true, data: [] }),
        getQueueOrder: jest.fn().mockResolvedValue({ success: true, data: [] }),
    } as unknown as typeof window.meshy;
});

// ═══════════════════════════════════════════════════════════════════════════════
// Badge de posição na fila
// ═══════════════════════════════════════════════════════════════════════════════

describe('DownloadItem — badge de posição na fila', () => {
    // Validates: Requirement 5.1
    it('renderiza badge com posição correta para item queued', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'queued', queuePosition: 3 })}
                {...defaultProps}
            />,
        );
        expect(screen.getByText('#3')).toBeInTheDocument();
    });

    // Validates: Requirement 5.2
    it('atualiza badge quando queuePosition muda', () => {
        const { rerender } = renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'queued', queuePosition: 2 })}
                {...defaultProps}
            />,
        );
        expect(screen.getByText('#2')).toBeInTheDocument();

        rerender(
            <IntlProvider locale="pt-BR" defaultLocale="pt-BR" messages={ptBR}>
                <DownloadItem
                    item={createItem({ status: 'queued', queuePosition: 1 })}
                    {...defaultProps}
                />
            </IntlProvider>,
        );
        expect(screen.getByText('#1')).toBeInTheDocument();
    });

    // Validates: Requirement 5.3
    it('oculta badge para itens com status diferente de queued', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'downloading', queuePosition: undefined })}
                {...defaultProps}
            />,
        );
        expect(screen.queryByText(/#\d+/)).not.toBeInTheDocument();
    });

    it('oculta badge para item paused', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'paused', queuePosition: undefined })}
                {...defaultProps}
            />,
        );
        expect(screen.queryByText(/#\d+/)).not.toBeInTheDocument();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Visibilidade dos botões mover para cima/baixo
// ═══════════════════════════════════════════════════════════════════════════════

describe('DownloadItem — visibilidade dos botões de fila', () => {
    // Validates: Requirements 2.3, 3.3
    it('exibe botões mover para cima e mover para baixo para item queued', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'queued', queuePosition: 2 })}
                {...defaultProps}
            />,
        );
        expect(screen.getByRole('button', { name: /mover.*para cima/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /mover.*para baixo/i })).toBeInTheDocument();
    });

    // Validates: Requirements 2.3, 3.3
    it('oculta botões de fila para item downloading', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'downloading' })}
                {...defaultProps}
            />,
        );
        expect(screen.queryByRole('button', { name: /mover.*para cima/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /mover.*para baixo/i })).not.toBeInTheDocument();
    });

    it('oculta botões de fila para item completed', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'completed', progress: 1, downloadedSize: 1_000_000 })}
                {...defaultProps}
            />,
        );
        expect(screen.queryByRole('button', { name: /mover.*para cima/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /mover.*para baixo/i })).not.toBeInTheDocument();
    });

    it('oculta botões de fila para item paused', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'paused' })}
                {...defaultProps}
            />,
        );
        expect(screen.queryByRole('button', { name: /mover.*para cima/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /mover.*para baixo/i })).not.toBeInTheDocument();
    });

    it('oculta botões de fila para item error', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'error' })}
                {...defaultProps}
            />,
        );
        expect(screen.queryByRole('button', { name: /mover.*para cima/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /mover.*para baixo/i })).not.toBeInTheDocument();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Botões desabilitados nas extremidades da fila
// ═══════════════════════════════════════════════════════════════════════════════

describe('DownloadItem — botões desabilitados nas extremidades', () => {
    // Validates: Requirements 2.2, 8.4
    it('botão mover para cima desabilitado quando queuePosition === 1', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'queued', queuePosition: 1 })}
                {...defaultProps}
                queueSize={3}
            />,
        );
        const moveUpBtn = screen.getByRole('button', { name: /mover.*para cima/i });
        expect(moveUpBtn).toBeDisabled();
        expect(moveUpBtn).toHaveAttribute('aria-disabled', 'true');
    });

    // Validates: Requirements 3.2, 8.4
    it('botão mover para baixo desabilitado quando queuePosition === queueSize', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'queued', queuePosition: 3 })}
                {...defaultProps}
                queueSize={3}
            />,
        );
        const moveDownBtn = screen.getByRole('button', { name: /mover.*para baixo/i });
        expect(moveDownBtn).toBeDisabled();
        expect(moveDownBtn).toHaveAttribute('aria-disabled', 'true');
    });

    it('botão mover para cima habilitado quando queuePosition > 1', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'queued', queuePosition: 2 })}
                {...defaultProps}
                queueSize={3}
            />,
        );
        const moveUpBtn = screen.getByRole('button', { name: /mover.*para cima/i });
        expect(moveUpBtn).not.toBeDisabled();
    });

    it('botão mover para baixo habilitado quando queuePosition < queueSize', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'queued', queuePosition: 1 })}
                {...defaultProps}
                queueSize={3}
            />,
        );
        const moveDownBtn = screen.getByRole('button', { name: /mover.*para baixo/i });
        expect(moveDownBtn).not.toBeDisabled();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Clique nos botões invoca callbacks corretos
// ═══════════════════════════════════════════════════════════════════════════════

describe('DownloadItem — clique nos botões de fila', () => {
    // Validates: Requirement 2.1
    it('clique em mover para cima invoca onMoveUp com infoHash', () => {
        const onMoveUp = jest.fn();
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'queued', queuePosition: 2, infoHash: 'hash_move_up_test_1234567890abcdef1234' })}
                {...defaultProps}
                onMoveUp={onMoveUp}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /mover.*para cima/i }));
        expect(onMoveUp).toHaveBeenCalledWith('hash_move_up_test_1234567890abcdef1234');
    });

    // Validates: Requirement 3.1
    it('clique em mover para baixo invoca onMoveDown com infoHash', () => {
        const onMoveDown = jest.fn();
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'queued', queuePosition: 2, infoHash: 'hash_move_dn_test_1234567890abcdef1234' })}
                {...defaultProps}
                onMoveDown={onMoveDown}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /mover.*para baixo/i }));
        expect(onMoveDown).toHaveBeenCalledWith('hash_move_dn_test_1234567890abcdef1234');
    });

    it('clique em mover para cima não invoca callback quando desabilitado', () => {
        const onMoveUp = jest.fn();
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'queued', queuePosition: 1 })}
                {...defaultProps}
                onMoveUp={onMoveUp}
                queueSize={3}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /mover.*para cima/i }));
        expect(onMoveUp).not.toHaveBeenCalled();
    });

    it('clique em mover para baixo não invoca callback quando desabilitado', () => {
        const onMoveDown = jest.fn();
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'queued', queuePosition: 3 })}
                {...defaultProps}
                onMoveDown={onMoveDown}
                queueSize={3}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /mover.*para baixo/i }));
        expect(onMoveDown).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Aria-labels corretos
// ═══════════════════════════════════════════════════════════════════════════════

describe('DownloadItem — aria-labels dos botões de fila', () => {
    // Validates: Requirement 8.1
    it('botão mover para cima tem aria-label com nome do download', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'queued', queuePosition: 2, name: 'Meu Download Especial' })}
                {...defaultProps}
            />,
        );
        const btn = screen.getByRole('button', { name: /mover.*para cima/i });
        expect(btn.getAttribute('aria-label')).toContain('Meu Download Especial');
    });

    // Validates: Requirement 8.1
    it('botão mover para baixo tem aria-label com nome do download', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'queued', queuePosition: 2, name: 'Outro Download' })}
                {...defaultProps}
            />,
        );
        const btn = screen.getByRole('button', { name: /mover.*para baixo/i });
        expect(btn.getAttribute('aria-label')).toContain('Outro Download');
    });

    // Validates: Requirement 8.2
    it('aria-label do botão mover para cima contém descrição da ação em pt-BR', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'queued', queuePosition: 2, name: 'Teste' })}
                {...defaultProps}
            />,
        );
        const btn = screen.getByRole('button', { name: /mover.*para cima/i });
        // Verifica que o aria-label segue o padrão "Mover {name} para cima na fila"
        expect(btn.getAttribute('aria-label')).toMatch(/Mover Teste para cima na fila/);
    });

    it('aria-label do botão mover para baixo contém descrição da ação em pt-BR', () => {
        renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'queued', queuePosition: 2, name: 'Teste' })}
                {...defaultProps}
            />,
        );
        const btn = screen.getByRole('button', { name: /mover.*para baixo/i });
        expect(btn.getAttribute('aria-label')).toMatch(/Mover Teste para baixo na fila/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Aria-live anuncia mudança de posição
// ═══════════════════════════════════════════════════════════════════════════════

describe('DownloadItem — aria-live anuncia mudança de posição', () => {
    // Validates: Requirement 8.3
    it('anuncia nova posição quando queuePosition muda', () => {
        const { rerender, container } = renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'queued', queuePosition: 3, name: 'Torrent ABC' })}
                {...defaultProps}
            />,
        );

        // Região aria-live inicialmente vazia (sem mudança)
        const ariaLiveRegion = container.querySelector('[aria-live="polite"]');
        expect(ariaLiveRegion).toBeInTheDocument();

        // Rerender com nova posição
        rerender(
            <IntlProvider locale="pt-BR" defaultLocale="pt-BR" messages={ptBR}>
                <DownloadItem
                    item={createItem({ status: 'queued', queuePosition: 1, name: 'Torrent ABC' })}
                    {...defaultProps}
                />
            </IntlProvider>,
        );

        // Verificar que a região aria-live contém o anúncio
        const ariaLiveRegions = container.querySelectorAll('[aria-live="polite"]');
        const announcements = Array.from(ariaLiveRegions).map((el) => el.textContent);
        const hasAnnouncement = announcements.some(
            (text) => text && text.includes('Torrent ABC') && text.includes('1'),
        );
        expect(hasAnnouncement).toBe(true);
    });

    it('não anuncia quando queuePosition não muda', () => {
        const { rerender, container } = renderWithIntl(
            <DownloadItem
                item={createItem({ status: 'queued', queuePosition: 2, name: 'Torrent XYZ' })}
                {...defaultProps}
            />,
        );

        // Rerender com mesma posição
        rerender(
            <IntlProvider locale="pt-BR" defaultLocale="pt-BR" messages={ptBR}>
                <DownloadItem
                    item={createItem({ status: 'queued', queuePosition: 2, name: 'Torrent XYZ' })}
                    {...defaultProps}
                />
            </IntlProvider>,
        );

        // A região aria-live sr-only não deve conter anúncio de mudança
        const srOnlyRegions = container.querySelectorAll('[aria-live="polite"]');
        const announcements = Array.from(srOnlyRegions).map((el) => el.textContent?.trim());
        // Nenhum anúncio deve conter "movido para posição"
        const hasMovedAnnouncement = announcements.some(
            (text) => text && text.includes('movido para posição'),
        );
        expect(hasMovedAnnouncement).toBe(false);
    });
});
