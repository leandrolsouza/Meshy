/** @jest-environment jsdom */

/**
 * Testes unitários para o componente SpeedTab.
 *
 * Verifica: canvas renderizado, empty state com eixos, coleta de amostras,
 * pausa/retomada da coleta.
 *
 * Requirements: 5.1, 5.9
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useDownloadStore } from '../../../src/store/downloadStore';

// Mock do useSpeedHistory para rastrear chamadas de addSample
const mockAddSample = jest.fn();
const mockGetSamples = jest.fn().mockReturnValue([]);

jest.mock('../../../src/hooks/useSpeedHistory', () => ({
    useSpeedHistory: () => ({
        addSample: mockAddSample,
        getSamples: mockGetSamples,
    }),
}));

// Mock do SpeedChart para evitar dependência de canvas real
jest.mock('../../../src/components/DownloadDetails/SpeedChart', () => ({
    SpeedChart: ({ samples }: { samples: unknown[] }) => (
        <canvas
            data-testid="speed-chart-canvas"
            data-samples-count={samples.length}
            role="img"
            aria-label="Gráfico de velocidade de download e upload"
        />
    ),
}));

// Importar após mocks
import { SpeedTab } from '../../../src/components/DownloadDetails/SpeedTab';

describe('SpeedTab', () => {
    const defaultInfoHash = 'a'.repeat(40);

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();

        // Configurar store com um item de download
        useDownloadStore.setState({
            items: [
                {
                    infoHash: defaultInfoHash,
                    name: 'Test Torrent',
                    totalSize: 1000000,
                    downloadedSize: 500000,
                    progress: 0.5,
                    downloadSpeed: 50000,
                    uploadSpeed: 10000,
                    numPeers: 5,
                    numSeeders: 3,
                    timeRemaining: 60000,
                    status: 'downloading',
                    destinationFolder: '/tmp',
                    addedAt: Date.now(),
                },
            ],
        });
    });

    afterEach(() => {
        jest.useRealTimers();
        useDownloadStore.setState({ items: [] });
    });

    // ─── Requirement 5.1, 5.9: Canvas renderizado ─────────────────────────────

    it('renderiza o elemento canvas dentro do SpeedTab', () => {
        render(<SpeedTab infoHash={defaultInfoHash} isCollecting={false} />);

        const container = screen.getByTestId('speed-tab');
        expect(container).toBeInTheDocument();

        const canvas = screen.getByTestId('speed-chart-canvas');
        expect(canvas).toBeInTheDocument();
    });

    it('canvas possui aria-label e role="img" para acessibilidade', () => {
        render(<SpeedTab infoHash={defaultInfoHash} isCollecting={false} />);

        const canvas = screen.getByTestId('speed-chart-canvas');
        expect(canvas).toHaveAttribute('role', 'img');
        expect(canvas).toHaveAttribute(
            'aria-label',
            'Gráfico de velocidade de download e upload',
        );
    });

    // ─── Requirement 5.9: Empty state com eixos ───────────────────────────────

    it('renderiza gráfico com 0 amostras quando isCollecting é false (empty state)', () => {
        mockGetSamples.mockReturnValue([]);

        render(<SpeedTab infoHash={defaultInfoHash} isCollecting={false} />);

        const canvas = screen.getByTestId('speed-chart-canvas');
        expect(canvas).toHaveAttribute('data-samples-count', '0');
    });

    // ─── Requirement 5.1: Coleta de amostras a cada 1s ────────────────────────

    it('coleta amostra imediatamente ao iniciar com isCollecting=true', () => {
        render(<SpeedTab infoHash={defaultInfoHash} isCollecting={true} />);

        // Coleta inicial imediata
        expect(mockAddSample).toHaveBeenCalledTimes(1);
        expect(mockAddSample).toHaveBeenCalledWith(50000, 10000);
    });

    it('coleta amostras a cada 1s quando isCollecting é true', () => {
        render(<SpeedTab infoHash={defaultInfoHash} isCollecting={true} />);

        // Coleta inicial imediata
        expect(mockAddSample).toHaveBeenCalledTimes(1);

        // Avança 1s — segunda coleta
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(mockAddSample).toHaveBeenCalledTimes(2);

        // Avança mais 1s — terceira coleta
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(mockAddSample).toHaveBeenCalledTimes(3);
    });

    it('não coleta amostras quando isCollecting é false', () => {
        render(<SpeedTab infoHash={defaultInfoHash} isCollecting={false} />);

        expect(mockAddSample).not.toHaveBeenCalled();

        // Avança 3s — nenhuma coleta
        act(() => {
            jest.advanceTimersByTime(3000);
        });

        expect(mockAddSample).not.toHaveBeenCalled();
    });

    // ─── Requirement 5.1: Pausa e retomada da coleta ──────────────────────────

    it('para de coletar quando isCollecting muda de true para false', () => {
        const { rerender } = render(
            <SpeedTab infoHash={defaultInfoHash} isCollecting={true} />,
        );

        // Coleta inicial + 1s
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(mockAddSample).toHaveBeenCalledTimes(2);

        // Pausa a coleta
        rerender(<SpeedTab infoHash={defaultInfoHash} isCollecting={false} />);

        // Avança 3s — nenhuma coleta adicional
        act(() => {
            jest.advanceTimersByTime(3000);
        });

        expect(mockAddSample).toHaveBeenCalledTimes(2);
    });

    it('retoma coleta quando isCollecting muda de false para true', () => {
        const { rerender } = render(
            <SpeedTab infoHash={defaultInfoHash} isCollecting={false} />,
        );

        // Sem coleta enquanto pausado
        act(() => {
            jest.advanceTimersByTime(3000);
        });
        expect(mockAddSample).not.toHaveBeenCalled();

        // Retoma coleta
        rerender(<SpeedTab infoHash={defaultInfoHash} isCollecting={true} />);

        // Coleta inicial imediata ao retomar
        expect(mockAddSample).toHaveBeenCalledTimes(1);

        // Avança 1s — nova coleta
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(mockAddSample).toHaveBeenCalledTimes(2);
    });

    // ─── Leitura de velocidade do store ───────────────────────────────────────

    it('lê downloadSpeed e uploadSpeed do item correspondente no store', () => {
        render(<SpeedTab infoHash={defaultInfoHash} isCollecting={true} />);

        // Verifica que addSample foi chamado com os valores do store
        expect(mockAddSample).toHaveBeenCalledWith(50000, 10000);
    });

    it('usa velocidade 0 quando item não é encontrado no store', () => {
        const unknownHash = 'b'.repeat(40);

        render(<SpeedTab infoHash={unknownHash} isCollecting={true} />);

        // Deve usar 0 como fallback para ambas as velocidades
        expect(mockAddSample).toHaveBeenCalledWith(0, 0);
    });

    it('reflete mudanças de velocidade no store nas coletas subsequentes', () => {
        render(<SpeedTab infoHash={defaultInfoHash} isCollecting={true} />);

        // Primeira coleta com valores iniciais
        expect(mockAddSample).toHaveBeenCalledWith(50000, 10000);

        // Atualiza velocidade no store
        useDownloadStore.setState({
            items: [
                {
                    infoHash: defaultInfoHash,
                    name: 'Test Torrent',
                    totalSize: 1000000,
                    downloadedSize: 600000,
                    progress: 0.6,
                    downloadSpeed: 100000,
                    uploadSpeed: 20000,
                    numPeers: 5,
                    numSeeders: 3,
                    timeRemaining: 30000,
                    status: 'downloading',
                    destinationFolder: '/tmp',
                    addedAt: Date.now(),
                },
            ],
        });

        // Avança 1s — coleta com novos valores
        act(() => {
            jest.advanceTimersByTime(1000);
        });

        expect(mockAddSample).toHaveBeenLastCalledWith(100000, 20000);
    });
});
