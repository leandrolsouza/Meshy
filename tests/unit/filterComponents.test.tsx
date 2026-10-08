/**
 * @jest-environment jsdom
 *
 * Testes dos componentes de filtro da lista de downloads:
 * SearchBar, StatusFilter e SortSelector.
 *
 * Nota: este arquivo substituiu downloadListToolbar.test.tsx após a remoção
 * do componente morto DownloadListToolbar (tarefa 7.3).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import '@testing-library/jest-dom';
import { SearchBar } from '../../src/components/DownloadList/SearchBar';
import { StatusFilter } from '../../src/components/DownloadList/StatusFilter';
import { SortSelector } from '../../src/components/DownloadList/SortSelector';
import { useFilterStore } from '../../src/store/filterStore';
import ptBR from '../../src/locales/pt-BR.json';

// ─── Helper: wrap with IntlProvider ───────────────────────────────────────────

function renderWithIntl(ui: React.ReactElement) {
    return render(
        <IntlProvider locale="pt-BR" defaultLocale="pt-BR" messages={ptBR}>
            {ui}
        </IntlProvider>,
    );
}

// ─── Reset do store antes de cada teste ───────────────────────────────────────

beforeEach(() => {
    useFilterStore.getState().resetFilters();
});

// ─── SearchBar ────────────────────────────────────────────────────────────────
// Requisitos: 6.1, 6.4

describe('SearchBar', () => {
    it('renderiza input com placeholder "Buscar por nome..."', () => {
        renderWithIntl(<SearchBar />);
        const input = screen.getByPlaceholderText('Buscar por nome...');
        expect(input).toBeInTheDocument();
    });

    it('input tem aria-label "Buscar downloads por nome"', () => {
        renderWithIntl(<SearchBar />);
        const input = screen.getByRole('textbox', { name: 'Buscar downloads por nome' });
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute('aria-label', 'Buscar downloads por nome');
    });

    it('digitar no input atualiza o searchTerm no filterStore', () => {
        renderWithIntl(<SearchBar />);
        const input = screen.getByRole('textbox', { name: 'Buscar downloads por nome' });

        fireEvent.change(input, { target: { value: 'ubuntu' } });

        expect(useFilterStore.getState().searchTerm).toBe('ubuntu');
    });

    it('botão de limpar (×) aparece quando o campo não está vazio', () => {
        renderWithIntl(<SearchBar />);
        const input = screen.getByRole('textbox', { name: 'Buscar downloads por nome' });

        fireEvent.change(input, { target: { value: 'teste' } });

        const clearButton = screen.getByRole('button', { name: 'Limpar busca' });
        expect(clearButton).toBeInTheDocument();
    });

    it('botão de limpar não aparece quando o campo está vazio', () => {
        renderWithIntl(<SearchBar />);

        const clearButton = screen.queryByRole('button', { name: 'Limpar busca' });
        expect(clearButton).not.toBeInTheDocument();
    });

    it('clicar no botão de limpar limpa o searchTerm', () => {
        renderWithIntl(<SearchBar />);
        const input = screen.getByRole('textbox', { name: 'Buscar downloads por nome' });

        fireEvent.change(input, { target: { value: 'algo' } });
        expect(useFilterStore.getState().searchTerm).toBe('algo');

        const clearButton = screen.getByRole('button', { name: 'Limpar busca' });
        fireEvent.click(clearButton);

        expect(useFilterStore.getState().searchTerm).toBe('');
    });

    it('pressionar Escape limpa o searchTerm', () => {
        renderWithIntl(<SearchBar />);
        const input = screen.getByRole('textbox', { name: 'Buscar downloads por nome' });

        fireEvent.change(input, { target: { value: 'linux' } });
        expect(useFilterStore.getState().searchTerm).toBe('linux');

        fireEvent.keyDown(input, { key: 'Escape' });

        expect(useFilterStore.getState().searchTerm).toBe('');
    });
});

// ─── StatusFilter ─────────────────────────────────────────────────────────────
// Requisitos: 6.2, 6.4

describe('StatusFilter', () => {
    it('renderiza grupo com aria-label "Filtrar downloads por status"', () => {
        renderWithIntl(<StatusFilter />);
        const group = screen.getByRole('group', { name: 'Filtrar downloads por status' });
        expect(group).toBeInTheDocument();
    });

    it('renderiza botão "Todos" e botões para cada status', () => {
        renderWithIntl(<StatusFilter />);

        expect(screen.getByRole('button', { name: 'Todos' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Na fila' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Resolvendo metadados...' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Baixando' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Pausado' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Concluído' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Erro' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Falha nos metadados' })).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Arquivos não encontrados' }),
        ).toBeInTheDocument();
    });

    it('clicar em um status ativa o filtro (atualiza selectedStatuses)', () => {
        renderWithIntl(<StatusFilter />);

        fireEvent.click(screen.getByRole('button', { name: 'Baixando' }));

        expect(useFilterStore.getState().selectedStatuses).toEqual(['downloading']);
    });

    it('clicar em "Todos" limpa a seleção', () => {
        // Pré-condição: selecionar um status
        useFilterStore.getState().setSelectedStatuses(['downloading', 'paused']);

        renderWithIntl(<StatusFilter />);

        fireEvent.click(screen.getByRole('button', { name: 'Todos' }));

        expect(useFilterStore.getState().selectedStatuses).toEqual([]);
    });
});

// ─── SortSelector ─────────────────────────────────────────────────────────────
// Requisitos: 6.3, 6.4

describe('SortSelector', () => {
    it('renderiza select com aria-label "Ordenar lista de downloads"', () => {
        renderWithIntl(<SortSelector />);
        const select = screen.getByRole('combobox', { name: 'Ordenar lista de downloads' });
        expect(select).toBeInTheDocument();
    });

    it('renderiza todas as opções de ordenação', () => {
        renderWithIntl(<SortSelector />);

        expect(screen.getByRole('option', { name: 'Data de adição' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Progresso' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Velocidade de download' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Velocidade de upload' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Nome' })).toBeInTheDocument();
    });

    it('mudar o select atualiza o sortField no filterStore', () => {
        renderWithIntl(<SortSelector />);
        const select = screen.getByRole('combobox', { name: 'Ordenar lista de downloads' });

        fireEvent.change(select, { target: { value: 'progress' } });

        expect(useFilterStore.getState().sortField).toBe('progress');
    });

    it('clicar no botão de direção alterna entre asc e desc', () => {
        renderWithIntl(<SortSelector />);
        const directionButton = screen.getByRole('button', {
            name: 'Alternar direção de ordenação',
        });

        // Padrão é desc (↓)
        expect(useFilterStore.getState().sortDirection).toBe('desc');

        fireEvent.click(directionButton);
        expect(useFilterStore.getState().sortDirection).toBe('asc');

        fireEvent.click(directionButton);
        expect(useFilterStore.getState().sortDirection).toBe('desc');
    });
});
