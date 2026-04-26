/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { DownloadItem } from '../../shared/types';
import { useFilterStore } from '../../src/store/filterStore';
import { useDownloadStore } from '../../src/store/downloadStore';

// ─── Mock useDownloads ────────────────────────────────────────────────────────

jest.mock('../../src/hooks/useDownloads', () => ({
    useDownloads: jest.fn(),
}));

import { useDownloads } from '../../src/hooks/useDownloads';

// ─── Mock DownloadItem para simplificar renderização ──────────────────────────

jest.mock('../../src/components/DownloadList/DownloadItem', () => ({
    DownloadItem: ({ item }: { item: DownloadItem }) => (
        <div data-testid={`item-${item.infoHash}`}>{item.name}</div>
    ),
}));

// ─── Mock ConfirmDialog ───────────────────────────────────────────────────────

jest.mock('../../src/components/common/ConfirmDialog', () => ({
    ConfirmDialog: () => null,
}));

// ─── Import do componente sob teste (após mocks) ─────────────────────────────

import { DownloadList } from '../../src/components/DownloadList/DownloadList';

// ─── Dados de teste ───────────────────────────────────────────────────────────

function makeItem(
    overrides: Partial<DownloadItem> & { infoHash: string; name: string },
): DownloadItem {
    return {
        totalSize: 1000,
        downloadedSize: 500,
        progress: 0.5,
        downloadSpeed: 100,
        uploadSpeed: 50,
        numPeers: 5,
        numSeeders: 3,
        timeRemaining: 60000,
        status: 'downloading',
        destinationFolder: '/tmp',
        addedAt: Date.now(),
        downloadSpeedLimitKBps: 0,
        uploadSpeedLimitKBps: 0,
        ...overrides,
    };
}

const itemA = makeItem({ infoHash: 'aaa', name: 'Ubuntu ISO', status: 'downloading' });
const itemB = makeItem({ infoHash: 'bbb', name: 'Fedora ISO', status: 'paused' });
const itemC = makeItem({ infoHash: 'ccc', name: 'Debian ISO', status: 'completed' });

const allItems = [itemA, itemB, itemC];

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
    useFilterStore.getState().resetFilters();
    useDownloadStore.getState().setItems([]);

    (useDownloads as jest.Mock).mockReturnValue({
        items: allItems,
        pause: jest.fn(),
        resume: jest.fn(),
        remove: jest.fn(),
    });
});

// ─── Testes de integração do DownloadList com filtros ─────────────────────────
// Os controles de busca/filtro/ordenação agora ficam no FilterSidebar.
// Aqui testamos que o pipeline de filtragem funciona corretamente no DownloadList
// manipulando o filterStore diretamente.

describe('DownloadList — integração com pipeline de filtros', () => {
    // ── Região aria-live atualiza com contagem de resultados ──────────────

    it('região aria-live exibe contagem de resultados para múltiplos itens', () => {
        render(<DownloadList />);

        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent('3 downloads encontrados');
    });

    it('região aria-live exibe singular para 1 item', () => {
        (useDownloads as jest.Mock).mockReturnValue({
            items: [itemA],
            pause: jest.fn(),
            resume: jest.fn(),
            remove: jest.fn(),
        });

        render(<DownloadList />);

        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent('1 download encontrado');
    });

    // ── Estado vazio filtrado ─────────────────────────────────────────────

    it('exibe mensagem de estado vazio filtrado quando filtros excluem todos os itens', () => {
        // Definir filtro via store (simula o que o FilterSidebar faria)
        useFilterStore.getState().setSearchTerm('inexistente');

        render(<DownloadList />);

        expect(
            screen.getByText('Nenhum download corresponde aos filtros aplicados.'),
        ).toBeInTheDocument();

        expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument();
    });

    it('região aria-live exibe "Nenhum download encontrado" quando filtros excluem todos', () => {
        useFilterStore.getState().setSearchTerm('inexistente');

        render(<DownloadList />);

        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent('Nenhum download encontrado');
    });

    // ── Botão "Limpar filtros" restaura a lista completa ──────────────────

    it('botão "Limpar filtros" chama resetFilters e restaura a lista completa', () => {
        // Definir filtro via store
        useFilterStore.getState().setSearchTerm('inexistente');

        render(<DownloadList />);

        // Verificar estado vazio filtrado
        expect(
            screen.getByText('Nenhum download corresponde aos filtros aplicados.'),
        ).toBeInTheDocument();

        // Clicar em "Limpar filtros"
        fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));

        // Verificar que o filterStore foi resetado
        const state = useFilterStore.getState();
        expect(state.searchTerm).toBe('');
        expect(state.selectedStatuses).toEqual([]);
        expect(state.sortField).toBe('addedAt');
        expect(state.sortDirection).toBe('desc');

        // Verificar que todos os itens são exibidos novamente
        expect(screen.getByTestId('item-aaa')).toBeInTheDocument();
        expect(screen.getByTestId('item-bbb')).toBeInTheDocument();
        expect(screen.getByTestId('item-ccc')).toBeInTheDocument();
    });

    // ── Indicador de filtros ativos ───────────────────────────────────────

    it('exibe indicador de filtros ativos quando há filtro de busca', () => {
        useFilterStore.getState().setSearchTerm('Ubuntu');

        render(<DownloadList />);

        expect(screen.getByText(/Exibindo 1 de 3 downloads/)).toBeInTheDocument();
    });

    it('exibe indicador de filtros ativos quando há filtro de status', () => {
        useFilterStore.getState().setSelectedStatuses(['paused']);

        render(<DownloadList />);

        expect(screen.getByText(/Exibindo 1 de 3 downloads/)).toBeInTheDocument();
    });
});
