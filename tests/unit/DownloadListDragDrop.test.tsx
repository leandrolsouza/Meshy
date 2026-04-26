/**
 * @jest-environment jsdom
 */

/**
 * Testes de componente para drag-and-drop no DownloadList.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import '@testing-library/jest-dom';
import type { DownloadItem as DownloadItemType } from '../../shared/types';
import ptBR from '../../src/locales/pt-BR.json';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock do hook useDownloads
const mockReorderQueue = jest.fn().mockResolvedValue({ success: true, data: [] });
const mockPause = jest.fn();
const mockResume = jest.fn();
const mockRemove = jest.fn();

let mockItems: DownloadItemType[] = [];

jest.mock('../../src/hooks/useDownloads', () => ({
    useDownloads: () => ({
        items: mockItems,
        pause: mockPause,
        resume: mockResume,
        remove: mockRemove,
        reorderQueue: mockReorderQueue,
        getQueueOrder: jest.fn(),
    }),
}));

// Mock do filterStore
jest.mock('../../src/store/filterStore', () => ({
    useFilterStore: () => ({
        searchTerm: '',
        selectedStatuses: [],
        sortField: 'addedAt' as const,
        sortDirection: 'desc' as const,
        resetFilters: jest.fn(),
    }),
}));

// Mock de ícones
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
import { DownloadList } from '../../src/components/DownloadList/DownloadList';

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
        queuePosition: 1,
        ...overrides,
    };
}

// ─── Setup window.meshy mock ──────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();
    mockItems = [];

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

// ─── Helper para criar DataTransfer mock ──────────────────────────────────────

function createDataTransfer(): DataTransfer {
    const data: Record<string, string> = {};
    return {
        setData: jest.fn((type: string, val: string) => { data[type] = val; }),
        getData: jest.fn((type: string) => data[type] || ''),
        dropEffect: 'none',
        effectAllowed: 'none',
        clearData: jest.fn(),
        files: [] as unknown as FileList,
        items: [] as unknown as DataTransferItemList,
        types: [] as string[],
        setDragImage: jest.fn(),
    } as unknown as DataTransfer;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Itens queued são arrastáveis
// ═══════════════════════════════════════════════════════════════════════════════

describe('DownloadList — drag-and-drop: itens queued são arrastáveis', () => {
    // Validates: Requirement 4.5
    it('itens com status queued possuem atributo draggable=true', () => {
        mockItems = [
            createItem({
                infoHash: 'hash_queued_1_abcdef1234567890abcd',
                name: 'Queued Item 1',
                status: 'queued',
                queuePosition: 1,
            }),
            createItem({
                infoHash: 'hash_queued_2_abcdef1234567890abcd',
                name: 'Queued Item 2',
                status: 'queued',
                queuePosition: 2,
            }),
        ];

        const { container } = renderWithIntl(<DownloadList />);

        // Buscar os cards dos itens (divs com draggable)
        const draggableElements = container.querySelectorAll('[draggable="true"]');
        expect(draggableElements.length).toBe(2);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Itens não-queued não são arrastáveis
// ═══════════════════════════════════════════════════════════════════════════════

describe('DownloadList — drag-and-drop: itens não-queued não são arrastáveis', () => {
    // Validates: Requirement 4.5
    it('itens com status downloading não possuem draggable=true', () => {
        mockItems = [
            createItem({
                infoHash: 'hash_downloading_1_abcdef1234567890',
                name: 'Downloading Item',
                status: 'downloading',
                downloadSpeed: 100_000,
                queuePosition: undefined,
            }),
        ];

        const { container } = renderWithIntl(<DownloadList />);

        const draggableElements = container.querySelectorAll('[draggable="true"]');
        expect(draggableElements.length).toBe(0);
    });

    it('itens com status paused não possuem draggable=true', () => {
        mockItems = [
            createItem({
                infoHash: 'hash_paused_1_abcdef12345678901234',
                name: 'Paused Item',
                status: 'paused',
                queuePosition: undefined,
            }),
        ];

        const { container } = renderWithIntl(<DownloadList />);

        const draggableElements = container.querySelectorAll('[draggable="true"]');
        expect(draggableElements.length).toBe(0);
    });

    it('itens com status completed não possuem draggable=true', () => {
        mockItems = [
            createItem({
                infoHash: 'hash_completed_1_abcdef123456789012',
                name: 'Completed Item',
                status: 'completed',
                progress: 1,
                downloadedSize: 1_000_000,
                queuePosition: undefined,
            }),
        ];

        const { container } = renderWithIntl(<DownloadList />);

        const draggableElements = container.querySelectorAll('[draggable="true"]');
        expect(draggableElements.length).toBe(0);
    });

    it('mistura de queued e não-queued: apenas queued é arrastável', () => {
        mockItems = [
            createItem({
                infoHash: 'hash_downloading_mix_abcdef12345678',
                name: 'Downloading Mix',
                status: 'downloading',
                downloadSpeed: 50_000,
                queuePosition: undefined,
            }),
            createItem({
                infoHash: 'hash_queued_mix_abcdef1234567890ab',
                name: 'Queued Mix',
                status: 'queued',
                queuePosition: 1,
            }),
        ];

        const { container } = renderWithIntl(<DownloadList />);

        const draggableElements = container.querySelectorAll('[draggable="true"]');
        expect(draggableElements.length).toBe(1);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Indicador visual durante drag
// ═══════════════════════════════════════════════════════════════════════════════

describe('DownloadList — drag-and-drop: indicador visual durante drag', () => {
    // Validates: Requirements 4.1, 4.2
    it('aplica estilo de arrasto ao item sendo arrastado', () => {
        mockItems = [
            createItem({
                infoHash: 'hash_drag_visual_1_abcdef1234567890',
                name: 'Drag Visual Item',
                status: 'queued',
                queuePosition: 1,
            }),
            createItem({
                infoHash: 'hash_drag_visual_2_abcdef1234567890',
                name: 'Drag Visual Item 2',
                status: 'queued',
                queuePosition: 2,
            }),
        ];

        const { container } = renderWithIntl(<DownloadList />);

        const draggableElements = container.querySelectorAll('[draggable="true"]');
        const firstItem = draggableElements[0] as HTMLElement;

        // Iniciar drag no primeiro item
        fireEvent.dragStart(firstItem, {
            dataTransfer: createDataTransfer(),
        });

        // Após dragStart, o item deve ter a classe isDragging
        // (verificamos via opacidade reduzida ou classe CSS)
        // O componente aplica isDragging via prop, que adiciona a classe
        expect(firstItem.className).toContain('isDragging');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Drop invoca reorderQueue com posição correta
// ═══════════════════════════════════════════════════════════════════════════════

describe('DownloadList — drag-and-drop: drop invoca reorderQueue', () => {
    // Validates: Requirement 4.3
    it('drop em zona válida invoca reorderQueue', () => {
        mockItems = [
            createItem({
                infoHash: 'hash_drop_test_1_abcdef12345678901',
                name: 'Drop Test Item 1',
                status: 'queued',
                queuePosition: 1,
            }),
            createItem({
                infoHash: 'hash_drop_test_2_abcdef12345678901',
                name: 'Drop Test Item 2',
                status: 'queued',
                queuePosition: 2,
            }),
        ];

        const { container } = renderWithIntl(<DownloadList />);

        const draggableElements = container.querySelectorAll('[draggable="true"]');
        const firstItem = draggableElements[0] as HTMLElement;

        const dataTransfer = createDataTransfer();

        // Iniciar drag no primeiro item
        fireEvent.dragStart(firstItem, { dataTransfer });

        // Encontrar o container do grupo "Aguardando" (groupItems)
        // O grupo "waiting" contém os itens queued
        const groupItemsContainers = container.querySelectorAll('div[class*="groupItems"]');
        // Deve haver pelo menos um grupo (waiting)
        expect(groupItemsContainers.length).toBeGreaterThan(0);

        const waitingGroup = groupItemsContainers[0] as HTMLElement;

        // Simular dragOver para definir dropTargetIndex
        fireEvent.dragOver(waitingGroup, {
            dataTransfer,
            clientY: 9999, // posição alta para indicar final da lista
            preventDefault: jest.fn(),
        });

        // Simular drop
        fireEvent.drop(waitingGroup, {
            dataTransfer,
            preventDefault: jest.fn(),
        });

        // reorderQueue deve ter sido chamado
        expect(mockReorderQueue).toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Drop fora da zona cancela operação
// ═══════════════════════════════════════════════════════════════════════════════

describe('DownloadList — drag-and-drop: cancelamento', () => {
    // Validates: Requirement 4.4
    it('dragEnd sem drop não invoca reorderQueue', () => {
        mockItems = [
            createItem({
                infoHash: 'hash_cancel_test_1_abcdef1234567890',
                name: 'Cancel Test Item',
                status: 'queued',
                queuePosition: 1,
            }),
        ];

        const { container } = renderWithIntl(<DownloadList />);

        const draggableElements = container.querySelectorAll('[draggable="true"]');
        const firstItem = draggableElements[0] as HTMLElement;

        const dataTransfer = createDataTransfer();

        // Iniciar drag
        fireEvent.dragStart(firstItem, { dataTransfer });

        // Finalizar drag sem drop (simula soltar fora da zona)
        fireEvent.dragEnd(firstItem, { dataTransfer });

        // reorderQueue não deve ter sido chamado
        expect(mockReorderQueue).not.toHaveBeenCalled();
    });

    it('dragLeave do container limpa indicador visual', () => {
        mockItems = [
            createItem({
                infoHash: 'hash_leave_test_1_abcdef12345678901',
                name: 'Leave Test Item 1',
                status: 'queued',
                queuePosition: 1,
            }),
            createItem({
                infoHash: 'hash_leave_test_2_abcdef12345678901',
                name: 'Leave Test Item 2',
                status: 'queued',
                queuePosition: 2,
            }),
        ];

        const { container } = renderWithIntl(<DownloadList />);

        const draggableElements = container.querySelectorAll('[draggable="true"]');
        const firstItem = draggableElements[0] as HTMLElement;

        const dataTransfer = createDataTransfer();

        // Iniciar drag
        fireEvent.dragStart(firstItem, { dataTransfer });

        // Encontrar container do grupo waiting
        const groupItemsContainers = container.querySelectorAll('div[class*="groupItems"]');
        const waitingGroup = groupItemsContainers[0] as HTMLElement;

        // DragOver para criar indicador
        fireEvent.dragOver(waitingGroup, {
            dataTransfer,
            clientY: 100,
            preventDefault: jest.fn(),
        });

        // DragLeave do container (relatedTarget fora do container)
        fireEvent.dragLeave(waitingGroup, {
            relatedTarget: document.body,
        });

        // Após dragLeave, o indicador de drop não deve estar visível
        const dropIndicators = container.querySelectorAll('div[class*="dropIndicator"]');
        expect(dropIndicators.length).toBe(0);
    });
});
