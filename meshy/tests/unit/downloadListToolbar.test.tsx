/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SearchBar } from '../../src/components/DownloadList/SearchBar';
import { StatusFilter } from '../../src/components/DownloadList/StatusFilter';
import { SortSelector } from '../../src/components/DownloadList/SortSelector';
import { DownloadListToolbar } from '../../src/components/DownloadList/DownloadListToolbar';
import { useFilterStore } from '../../src/store/filterStore';

// ─── Reset do store antes de cada teste ───────────────────────────────────────

beforeEach(() => {
    useFilterStore.getState().resetFilters();
});

// ─── SearchBar ────────────────────────────────────────────────────────────────
// Requisitos: 6.1, 6.4

describe('SearchBar', () => {
    it('renderiza input com placeholder "Buscar por nome..."', () => {
        render(<SearchBar />);
        const input = screen.getByPlaceholderText('Buscar por nome...');
        expect(input).toBeInTheDocument();
    });

    it('input tem aria-label "Buscar downloads por nome"', () => {
        render(<SearchBar />);
        const input = screen.getByRole('textbox', { name: 'Buscar downloads por nome' });
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute('aria-label', 'Buscar downloads por nome');
    });

    it('digitar no input atualiza o searchTerm no filterStore', () => {
        render(<SearchBar />);
        const input = screen.getByRole('textbox', { name: 'Buscar downloads por nome' });

        fireEvent.change(input, { target: { value: 'ubuntu' } });

        expect(useFilterStore.getState().searchTerm).toBe('ubuntu');
    });

    it('botão de limpar (×) aparece quando o campo não está vazio', () => {
        render(<SearchBar />);
        const input = screen.getByRole('textbox', { name: 'Buscar downloads por nome' });

        fireEvent.change(input, { target: { value: 'teste' } });

        const clearButton = screen.getByRole('button', { name: 'Limpar busca' });
        expect(clearButton).toBeInTheDocument();
    });

    it('botão de limpar não aparece quando o campo está vazio', () => {
        render(<SearchBar />);

        const clearButton = screen.queryByRole('button', { name: 'Limpar busca' });
        expect(clearButton).not.toBeInTheDocument();
    });

    it('clicar no botão de limpar limpa o searchTerm', () => {
        render(<SearchBar />);
        const input = screen.getByRole('textbox', { name: 'Buscar downloads por nome' });

        fireEvent.change(input, { target: { value: 'algo' } });
        expect(useFilterStore.getState().searchTerm).toBe('algo');

        const clearButton = screen.getByRole('button', { name: 'Limpar busca' });
        fireEvent.click(clearButton);

        expect(useFilterStore.getState().searchTerm).toBe('');
    });

    it('pressionar Escape limpa o searchTerm', () => {
        render(<SearchBar />);
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
        render(<StatusFilter />);
        const group = screen.getByRole('group', { name: 'Filtrar downloads por status' });
        expect(group).toBeInTheDocument();
    });

    it('renderiza botão "Todos" e botões para cada status', () => {
        render(<StatusFilter />);

        expect(screen.getByRole('button', { name: 'Todos' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Na fila' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Resolvendo metadados' })).toBeInTheDocument();
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
        render(<StatusFilter />);

        fireEvent.click(screen.getByRole('button', { name: 'Baixando' }));

        expect(useFilterStore.getState().selectedStatuses).toEqual(['downloading']);
    });

    it('clicar em "Todos" limpa a seleção', () => {
        // Pré-condição: selecionar um status
        useFilterStore.getState().setSelectedStatuses(['downloading', 'paused']);

        render(<StatusFilter />);

        fireEvent.click(screen.getByRole('button', { name: 'Todos' }));

        expect(useFilterStore.getState().selectedStatuses).toEqual([]);
    });
});

// ─── SortSelector ─────────────────────────────────────────────────────────────
// Requisitos: 6.3, 6.4

describe('SortSelector', () => {
    it('renderiza select com aria-label "Ordenar lista de downloads"', () => {
        render(<SortSelector />);
        const select = screen.getByRole('combobox', { name: 'Ordenar lista de downloads' });
        expect(select).toBeInTheDocument();
    });

    it('renderiza todas as opções de ordenação', () => {
        render(<SortSelector />);

        expect(screen.getByRole('option', { name: 'Data de adição' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Progresso' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Velocidade de download' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Velocidade de upload' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Nome' })).toBeInTheDocument();
    });

    it('mudar o select atualiza o sortField no filterStore', () => {
        render(<SortSelector />);
        const select = screen.getByRole('combobox', { name: 'Ordenar lista de downloads' });

        fireEvent.change(select, { target: { value: 'progress' } });

        expect(useFilterStore.getState().sortField).toBe('progress');
    });

    it('clicar no botão de direção alterna entre asc e desc', () => {
        render(<SortSelector />);
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

// ─── DownloadListToolbar ──────────────────────────────────────────────────────
// Requisitos: 6.1, 6.2, 6.3

describe('DownloadListToolbar', () => {
    it('renderiza SearchBar, StatusFilter e SortSelector juntos', () => {
        render(<DownloadListToolbar completedCount={0} onClearCompleted={jest.fn()} />);

        // SearchBar presente
        expect(
            screen.getByRole('textbox', { name: 'Buscar downloads por nome' }),
        ).toBeInTheDocument();

        // StatusFilter presente
        expect(
            screen.getByRole('group', { name: 'Filtrar downloads por status' }),
        ).toBeInTheDocument();

        // SortSelector presente
        expect(
            screen.getByRole('combobox', { name: 'Ordenar lista de downloads' }),
        ).toBeInTheDocument();
    });

    it('não exibe botão "Limpar concluídos" quando completedCount é 0', () => {
        render(<DownloadListToolbar completedCount={0} onClearCompleted={jest.fn()} />);

        expect(
            screen.queryByRole('button', { name: 'Limpar downloads concluídos' }),
        ).not.toBeInTheDocument();
    });

    it('exibe botão "Limpar concluídos" com contagem quando há itens concluídos', () => {
        render(<DownloadListToolbar completedCount={3} onClearCompleted={jest.fn()} />);

        const button = screen.getByRole('button', { name: 'Limpar downloads concluídos' });
        expect(button).toBeInTheDocument();
        expect(button).toHaveTextContent('Limpar concluídos (3)');
    });

    it('clicar no botão abre diálogo de confirmação', () => {
        render(<DownloadListToolbar completedCount={2} onClearCompleted={jest.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Limpar downloads concluídos' }));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Limpar downloads concluídos')).toBeInTheDocument();
    });

    it('confirmar "Manter arquivos" chama onClearCompleted(false)', () => {
        const onClear = jest.fn();
        render(<DownloadListToolbar completedCount={1} onClearCompleted={onClear} />);

        fireEvent.click(screen.getByRole('button', { name: 'Limpar downloads concluídos' }));
        fireEvent.click(screen.getByRole('button', { name: 'Manter arquivos' }));

        expect(onClear).toHaveBeenCalledWith(false);
    });

    it('confirmar "Excluir arquivos" chama onClearCompleted(true)', () => {
        const onClear = jest.fn();
        render(<DownloadListToolbar completedCount={1} onClearCompleted={onClear} />);

        fireEvent.click(screen.getByRole('button', { name: 'Limpar downloads concluídos' }));
        fireEvent.click(screen.getByRole('button', { name: 'Excluir arquivos' }));

        expect(onClear).toHaveBeenCalledWith(true);
    });
});
