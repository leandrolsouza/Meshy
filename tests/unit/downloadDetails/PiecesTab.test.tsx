/** @jest-environment jsdom */

/**
 * Testes unitários para os componentes PiecesTab e PieceGrid.
 *
 * Verifica: grid renderizada, resumo textual correto, retry button em erro,
 * polling ativo/inativo, agrupamento visual.
 *
 * Requirements: 4.1, 4.5, 4.7, 4.8
 */

import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PiecesTab } from '../../../src/components/DownloadDetails/PiecesTab';
import { PieceGrid } from '../../../src/components/DownloadDetails/PieceGrid';

// Mock window.meshy.getPieces
const mockGetPieces = jest.fn();

beforeAll(() => {
    Object.defineProperty(window, 'meshy', {
        value: { getPieces: mockGetPieces },
        writable: true,
    });
});

describe('PieceGrid', () => {
    // ─── Requirement 4.1: Grid renderiza blocos para cada peça ────────────────

    it('renderiza um bloco para cada peça quando total <= 500', () => {
        const pieces = [true, false, true, true, false];
        const { container } = render(<PieceGrid pieces={pieces} />);

        const blocks = container.querySelectorAll('[class*="block"]');
        expect(blocks).toHaveLength(5);
    });

    it('renderiza blocos agrupados quando total > 1000', () => {
        // 1500 peças devem ser agrupadas em no máximo 500 blocos
        const pieces = new Array(1500).fill(false).map((_, i) => i % 3 === 0);
        const { container } = render(<PieceGrid pieces={pieces} />);

        const blocks = container.querySelectorAll('[class*="block"]');
        expect(blocks.length).toBeLessThanOrEqual(500);
        expect(blocks.length).toBeGreaterThan(0);
    });

    it('renderiza grid vazia quando array de peças está vazio', () => {
        const { container } = render(<PieceGrid pieces={[]} />);

        const blocks = container.querySelectorAll('[class*="block"]');
        expect(blocks).toHaveLength(0);
    });
});

describe('PiecesTab', () => {
    const defaultProps = {
        infoHash: 'a'.repeat(40),
        status: 'downloading' as const,
    };

    const samplePieces = [true, true, false, true, false, false, true, true, true, false];

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // ─── Requirement 4.1: Grid renderizada com peças ──────────────────────────

    it('renderiza PieceGrid com blocos para cada peça', async () => {
        mockGetPieces.mockResolvedValue({ success: true, data: samplePieces });

        await act(async () => {
            render(<PiecesTab {...defaultProps} />);
        });

        const container = screen.getByTestId('pieces-container');
        const blocks = container.querySelectorAll('[class*="block"]');
        expect(blocks).toHaveLength(samplePieces.length);
    });

    // ─── Requirement 4.5: Resumo textual correto ──────────────────────────────

    it('exibe resumo "{completas}/{total} peças baixadas" corretamente', async () => {
        mockGetPieces.mockResolvedValue({ success: true, data: samplePieces });

        await act(async () => {
            render(<PiecesTab {...defaultProps} />);
        });

        const completed = samplePieces.filter((p) => p).length;
        const summary = screen.getByTestId('pieces-summary');
        expect(summary).toHaveTextContent(
            `${completed}/${samplePieces.length} peças baixadas`,
        );
    });

    it('exibe resumo correto para todas as peças completas', async () => {
        const allComplete = [true, true, true, true, true];
        mockGetPieces.mockResolvedValue({ success: true, data: allComplete });

        await act(async () => {
            render(<PiecesTab {...defaultProps} />);
        });

        expect(screen.getByTestId('pieces-summary')).toHaveTextContent(
            '5/5 peças baixadas',
        );
    });

    it('exibe resumo correto para nenhuma peça completa', async () => {
        const noneComplete = [false, false, false];
        mockGetPieces.mockResolvedValue({ success: true, data: noneComplete });

        await act(async () => {
            render(<PiecesTab {...defaultProps} />);
        });

        expect(screen.getByTestId('pieces-summary')).toHaveTextContent(
            '0/3 peças baixadas',
        );
    });

    // ─── Requirement 4.7: Erro exibe mensagem + botão "Tentar novamente" ──────

    it('exibe mensagem de erro quando IPC retorna success === false', async () => {
        mockGetPieces.mockResolvedValue({
            success: false,
            error: 'Torrent não encontrado',
        });

        await act(async () => {
            render(<PiecesTab {...defaultProps} />);
        });

        const errorContainer = screen.getByTestId('pieces-error');
        expect(errorContainer).toHaveTextContent('Torrent não encontrado');
    });

    it('exibe mensagem de erro genérica quando IPC lança exceção', async () => {
        mockGetPieces.mockRejectedValue(new Error('Network error'));

        await act(async () => {
            render(<PiecesTab {...defaultProps} />);
        });

        expect(screen.getByTestId('pieces-error')).toHaveTextContent(
            'Falha ao obter dados de peças',
        );
    });

    it('exibe botão "Tentar novamente" no estado de erro', async () => {
        mockGetPieces.mockResolvedValue({
            success: false,
            error: 'Erro de conexão',
        });

        await act(async () => {
            render(<PiecesTab {...defaultProps} />);
        });

        const retryButton = screen.getByTestId('pieces-retry-button');
        expect(retryButton).toBeInTheDocument();
        expect(retryButton).toHaveTextContent('Tentar novamente');
    });

    it('botão "Tentar novamente" chama fetchPieces novamente', async () => {
        mockGetPieces
            .mockResolvedValueOnce({ success: false, error: 'Erro temporário' })
            .mockResolvedValueOnce({ success: true, data: samplePieces });

        await act(async () => {
            render(<PiecesTab {...defaultProps} />);
        });

        // Primeira chamada falhou
        expect(mockGetPieces).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('pieces-error')).toBeInTheDocument();

        // Clica no botão de retry
        await act(async () => {
            fireEvent.click(screen.getByTestId('pieces-retry-button'));
        });

        // Segunda chamada com sucesso
        expect(mockGetPieces).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId('pieces-container')).toBeInTheDocument();
    });

    // ─── Requirement 4.4: Polling ativo quando status é "downloading" ─────────

    it('realiza polling a cada 2s quando status é "downloading"', async () => {
        mockGetPieces.mockResolvedValue({ success: true, data: samplePieces });

        await act(async () => {
            render(<PiecesTab {...defaultProps} status="downloading" />);
        });

        // Chamada inicial imediata
        expect(mockGetPieces).toHaveBeenCalledTimes(1);

        // Avança 2s — segunda chamada
        await act(async () => {
            jest.advanceTimersByTime(2000);
        });
        expect(mockGetPieces).toHaveBeenCalledTimes(2);

        // Avança mais 2s — terceira chamada
        await act(async () => {
            jest.advanceTimersByTime(2000);
        });
        expect(mockGetPieces).toHaveBeenCalledTimes(3);
    });

    // ─── Requirement 4.8: Polling inativo quando status é "paused" ou "completed"

    it('não realiza polling quando status é "paused"', async () => {
        mockGetPieces.mockResolvedValue({ success: true, data: samplePieces });

        await act(async () => {
            render(<PiecesTab {...defaultProps} status="paused" />);
        });

        // Sem chamada inicial (polling desabilitado)
        expect(mockGetPieces).toHaveBeenCalledTimes(0);

        // Avança tempo — nenhuma chamada adicional
        await act(async () => {
            jest.advanceTimersByTime(4000);
        });
        expect(mockGetPieces).toHaveBeenCalledTimes(0);
    });

    it('não realiza polling quando status é "completed"', async () => {
        mockGetPieces.mockResolvedValue({ success: true, data: samplePieces });

        await act(async () => {
            render(<PiecesTab {...defaultProps} status="completed" />);
        });

        expect(mockGetPieces).toHaveBeenCalledTimes(0);

        await act(async () => {
            jest.advanceTimersByTime(4000);
        });
        expect(mockGetPieces).toHaveBeenCalledTimes(0);
    });

    // ─── Loading state ────────────────────────────────────────────────────────

    it('exibe "Carregando..." antes da primeira resposta quando polling está inativo', () => {
        mockGetPieces.mockResolvedValue({ success: true, data: samplePieces });

        render(<PiecesTab {...defaultProps} status="paused" />);

        expect(screen.getByTestId('pieces-loading')).toHaveTextContent(
            'Carregando...',
        );
    });
});
