/** @jest-environment jsdom */

/**
 * Testes unitários para o componente PeersTab.
 *
 * Verifica: tabela com colunas corretas, formatação de dados, empty state,
 * erro de IPC, polling ativo/inativo.
 *
 * Requirements: 3.1, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PeersTab } from '../../../src/components/DownloadDetails/PeersTab';
import { PeerInfo } from '../../../shared/types';

// Mock window.meshy.getPeers
const mockGetPeers = jest.fn();

beforeAll(() => {
    Object.defineProperty(window, 'meshy', {
        value: { getPeers: mockGetPeers },
        writable: true,
    });
});

describe('PeersTab', () => {
    const defaultProps = {
        infoHash: 'a'.repeat(40),
        status: 'downloading' as const,
    };

    const samplePeers: PeerInfo[] = [
        {
            address: '192.168.1.1:6881',
            client: 'qBittorrent/4.5.0',
            downloadSpeed: 512,
            progress: 0.75,
        },
        {
            address: '10.0.0.2:51413',
            client: 'Transmission/3.0',
            downloadSpeed: 2048,
            progress: 1.0,
        },
        {
            address: '172.16.0.5:8999',
            client: 'Deluge/2.1',
            downloadSpeed: 1_500_000,
            progress: 0.0,
        },
    ];

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // ─── Requirement 3.1: Tabela com colunas corretas ─────────────────────────

    it('renderiza tabela com colunas corretas (Endereço IP, Cliente, Velocidade, Progresso)', async () => {
        mockGetPeers.mockResolvedValue({ success: true, data: samplePeers });

        await act(async () => {
            render(<PeersTab {...defaultProps} />);
        });

        const table = screen.getByTestId('peers-table');
        const headers = table.querySelectorAll('th');
        expect(headers).toHaveLength(4);
        expect(headers[0]).toHaveTextContent('Endereço IP');
        expect(headers[1]).toHaveTextContent('Cliente');
        expect(headers[2]).toHaveTextContent('Velocidade');
        expect(headers[3]).toHaveTextContent('Progresso');
    });

    // ─── Requirement 3.5: Endereço IP no formato host:porta ───────────────────

    it('exibe endereço IP de cada peer no formato host:porta', async () => {
        mockGetPeers.mockResolvedValue({ success: true, data: samplePeers });

        await act(async () => {
            render(<PeersTab {...defaultProps} />);
        });

        expect(screen.getByText('192.168.1.1:6881')).toBeInTheDocument();
        expect(screen.getByText('10.0.0.2:51413')).toBeInTheDocument();
        expect(screen.getByText('172.16.0.5:8999')).toBeInTheDocument();
    });

    // ─── Requirement 3.6: Velocidade formatada com formatPeerSpeed ────────────

    it('formata velocidade de download corretamente (B/s, KB/s, MB/s)', async () => {
        mockGetPeers.mockResolvedValue({ success: true, data: samplePeers });

        await act(async () => {
            render(<PeersTab {...defaultProps} />);
        });

        // 512 B/s (< 1024)
        expect(screen.getByText('512 B/s')).toBeInTheDocument();
        // 2048 bytes/s = 2.0 KB/s
        expect(screen.getByText('2.0 KB/s')).toBeInTheDocument();
        // 1_500_000 bytes/s = 1.4 MB/s
        expect(screen.getByText('1.4 MB/s')).toBeInTheDocument();
    });

    // ─── Requirement 3.7: Progresso formatado com formatPeerProgress ──────────

    it('formata progresso de cada peer como porcentagem inteira', async () => {
        mockGetPeers.mockResolvedValue({ success: true, data: samplePeers });

        await act(async () => {
            render(<PeersTab {...defaultProps} />);
        });

        // 0.75 → 75%
        expect(screen.getByText('75%')).toBeInTheDocument();
        // 1.0 → 100%
        expect(screen.getByText('100%')).toBeInTheDocument();
        // 0.0 → 0%
        expect(screen.getByText('0%')).toBeInTheDocument();
    });

    // ─── Requirement 3.4: Empty state ─────────────────────────────────────────

    it('exibe "Nenhum peer conectado" quando não há peers', async () => {
        mockGetPeers.mockResolvedValue({ success: true, data: [] });

        await act(async () => {
            render(<PeersTab {...defaultProps} />);
        });

        expect(screen.getByTestId('peers-empty')).toHaveTextContent(
            'Nenhum peer conectado',
        );
    });

    // ─── Requirement 3.8: Erro de IPC ─────────────────────────────────────────

    it('exibe mensagem de erro quando IPC falha (success === false)', async () => {
        mockGetPeers.mockResolvedValue({
            success: false,
            error: 'Torrent não encontrado',
        });

        await act(async () => {
            render(<PeersTab {...defaultProps} />);
        });

        expect(screen.getByTestId('peers-error')).toHaveTextContent(
            'Torrent não encontrado',
        );
    });

    it('exibe mensagem de erro genérica quando IPC lança exceção', async () => {
        mockGetPeers.mockRejectedValue(new Error('Network error'));

        await act(async () => {
            render(<PeersTab {...defaultProps} />);
        });

        expect(screen.getByTestId('peers-error')).toHaveTextContent(
            'Falha ao obter lista de peers',
        );
    });

    // ─── Requirement 3.3: Polling ativo quando status é "downloading" ─────────

    it('realiza polling a cada 2s quando status é "downloading"', async () => {
        mockGetPeers.mockResolvedValue({ success: true, data: samplePeers });

        await act(async () => {
            render(<PeersTab {...defaultProps} status="downloading" />);
        });

        // Chamada inicial imediata
        expect(mockGetPeers).toHaveBeenCalledTimes(1);

        // Avança 2s — segunda chamada
        await act(async () => {
            jest.advanceTimersByTime(2000);
        });
        expect(mockGetPeers).toHaveBeenCalledTimes(2);

        // Avança mais 2s — terceira chamada
        await act(async () => {
            jest.advanceTimersByTime(2000);
        });
        expect(mockGetPeers).toHaveBeenCalledTimes(3);
    });

    // ─── Requirement 3.9: Polling inativo quando status não é "downloading" ───

    it('não realiza polling quando status é "paused"', async () => {
        mockGetPeers.mockResolvedValue({ success: true, data: samplePeers });

        await act(async () => {
            render(<PeersTab {...defaultProps} status="paused" />);
        });

        // Sem chamada inicial (polling desabilitado)
        expect(mockGetPeers).toHaveBeenCalledTimes(0);

        // Avança tempo — nenhuma chamada adicional
        await act(async () => {
            jest.advanceTimersByTime(4000);
        });
        expect(mockGetPeers).toHaveBeenCalledTimes(0);
    });

    it('não realiza polling quando status é "completed"', async () => {
        mockGetPeers.mockResolvedValue({ success: true, data: samplePeers });

        await act(async () => {
            render(<PeersTab {...defaultProps} status="completed" />);
        });

        expect(mockGetPeers).toHaveBeenCalledTimes(0);

        await act(async () => {
            jest.advanceTimersByTime(4000);
        });
        expect(mockGetPeers).toHaveBeenCalledTimes(0);
    });

    // ─── Requirement 3.8: Interrompe polling em caso de erro ──────────────────

    it('interrompe polling após erro de IPC', async () => {
        // Primeira chamada sucesso, segunda falha
        mockGetPeers
            .mockResolvedValueOnce({ success: true, data: samplePeers })
            .mockResolvedValueOnce({ success: false, error: 'Erro de conexão' });

        await act(async () => {
            render(<PeersTab {...defaultProps} status="downloading" />);
        });

        // Chamada inicial com sucesso
        expect(mockGetPeers).toHaveBeenCalledTimes(1);

        // Avança 2s — segunda chamada falha
        await act(async () => {
            jest.advanceTimersByTime(2000);
        });
        expect(mockGetPeers).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId('peers-error')).toBeInTheDocument();

        // Avança mais 2s — polling deve estar interrompido
        await act(async () => {
            jest.advanceTimersByTime(2000);
        });
        // Não deve ter feito mais chamadas (polling parado)
        expect(mockGetPeers).toHaveBeenCalledTimes(2);
    });

    // ─── Requirement 3.1: Renderiza dados de peers na tabela ──────────────────

    it('renderiza nome do cliente de cada peer', async () => {
        mockGetPeers.mockResolvedValue({ success: true, data: samplePeers });

        await act(async () => {
            render(<PeersTab {...defaultProps} />);
        });

        expect(screen.getByText('qBittorrent/4.5.0')).toBeInTheDocument();
        expect(screen.getByText('Transmission/3.0')).toBeInTheDocument();
        expect(screen.getByText('Deluge/2.1')).toBeInTheDocument();
    });

    it('renderiza o número correto de linhas na tabela', async () => {
        mockGetPeers.mockResolvedValue({ success: true, data: samplePeers });

        await act(async () => {
            render(<PeersTab {...defaultProps} />);
        });

        const table = screen.getByTestId('peers-table');
        const rows = table.querySelectorAll('tbody tr');
        expect(rows).toHaveLength(3);
    });

    // ─── Loading state ────────────────────────────────────────────────────────

    it('exibe "Carregando..." antes da primeira resposta quando polling está inativo', () => {
        mockGetPeers.mockResolvedValue({ success: true, data: samplePeers });

        render(<PeersTab {...defaultProps} status="paused" />);

        expect(screen.getByTestId('peers-loading')).toHaveTextContent(
            'Carregando...',
        );
    });
});
