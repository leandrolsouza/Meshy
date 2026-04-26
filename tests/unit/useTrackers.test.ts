/**
 * @jest-environment jsdom
 */
/**
 * Testes unitários para o hook useTrackers.
 *
 * Cobre: loadTrackers, addTracker, removeTracker, applyGlobalTrackers.
 * Testa cenários de sucesso, falha, e tratamento de exceções.
 */
import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { TrackerInfo } from '../../shared/types';

// ─── Mock window.meshy ───────────────────────────────────────────────────────

const mockTrackers: TrackerInfo[] = [
    { url: 'udp://tracker1.example.com:6969', status: 'connected' },
    { url: 'udp://tracker2.example.com:6969', status: 'pending' },
];

const mockMeshy = {
    getTrackers: jest.fn(),
    addTracker: jest.fn(),
    removeTracker: jest.fn(),
    applyGlobalTrackers: jest.fn(),
};

beforeAll(() => {
    Object.defineProperty(window, 'meshy', {
        value: mockMeshy,
        writable: true,
    });
});

// ─── Import hook after mocks ──────────────────────────────────────────────────

import { useTrackers } from '../../src/hooks/useTrackers';

// ─── Tests ────────────────────────────────────────────────────────────────────

const TEST_INFO_HASH = 'abc123def456';

describe('useTrackers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── Estado inicial ────────────────────────────────────────────────────

    describe('estado inicial', () => {
        it('inicia com lista vazia, sem loading e sem erro', () => {
            const { result } = renderHook(() => useTrackers(TEST_INFO_HASH));

            expect(result.current.trackers).toEqual([]);
            expect(result.current.loading).toBe(false);
            expect(result.current.error).toBeNull();
        });
    });

    // ── loadTrackers ──────────────────────────────────────────────────────

    describe('loadTrackers', () => {
        it('carrega trackers com sucesso', async () => {
            mockMeshy.getTrackers.mockResolvedValue({
                success: true,
                data: mockTrackers,
            });

            const { result } = renderHook(() => useTrackers(TEST_INFO_HASH));

            await act(async () => {
                await result.current.loadTrackers();
            });

            expect(mockMeshy.getTrackers).toHaveBeenCalledWith(TEST_INFO_HASH);
            expect(result.current.trackers).toEqual(mockTrackers);
            expect(result.current.loading).toBe(false);
            expect(result.current.error).toBeNull();
        });

        it('define erro quando a resposta é falha', async () => {
            mockMeshy.getTrackers.mockResolvedValue({
                success: false,
                error: 'Torrent não encontrado',
            });

            const { result } = renderHook(() => useTrackers(TEST_INFO_HASH));

            await act(async () => {
                await result.current.loadTrackers();
            });

            expect(result.current.trackers).toEqual([]);
            expect(result.current.error).toBe('Torrent não encontrado');
        });

        it('define erro quando a chamada IPC lança exceção', async () => {
            mockMeshy.getTrackers.mockRejectedValue(new Error('IPC timeout'));

            const { result } = renderHook(() => useTrackers(TEST_INFO_HASH));

            await act(async () => {
                await result.current.loadTrackers();
            });

            expect(result.current.error).toBe('IPC timeout');
            expect(result.current.loading).toBe(false);
        });

        it('trata exceções não-Error como string', async () => {
            mockMeshy.getTrackers.mockRejectedValue('erro desconhecido');

            const { result } = renderHook(() => useTrackers(TEST_INFO_HASH));

            await act(async () => {
                await result.current.loadTrackers();
            });

            expect(result.current.error).toBe('erro desconhecido');
        });
    });

    // ── addTracker ────────────────────────────────────────────────────────

    describe('addTracker', () => {
        it('adiciona tracker com sucesso e retorna true', async () => {
            const updatedTrackers = [
                ...mockTrackers,
                {
                    url: 'udp://new-tracker.example.com:6969',
                    status: 'pending' as const,
                },
            ];
            mockMeshy.addTracker.mockResolvedValue({
                success: true,
                data: updatedTrackers,
            });

            const { result } = renderHook(() => useTrackers(TEST_INFO_HASH));

            let success: boolean;
            await act(async () => {
                success = await result.current.addTracker('udp://new-tracker.example.com:6969');
            });

            expect(success!).toBe(true);
            expect(mockMeshy.addTracker).toHaveBeenCalledWith(
                TEST_INFO_HASH,
                'udp://new-tracker.example.com:6969',
            );
            expect(result.current.trackers).toHaveLength(3);
        });

        it('retorna false e define erro quando a resposta é falha', async () => {
            mockMeshy.addTracker.mockResolvedValue({
                success: false,
                error: 'URL inválida',
            });

            const { result } = renderHook(() => useTrackers(TEST_INFO_HASH));

            let success: boolean;
            await act(async () => {
                success = await result.current.addTracker('invalid-url');
            });

            expect(success!).toBe(false);
            expect(result.current.error).toBe('URL inválida');
        });

        it('retorna false e define erro quando lança exceção', async () => {
            mockMeshy.addTracker.mockRejectedValue(new Error('Rede indisponível'));

            const { result } = renderHook(() => useTrackers(TEST_INFO_HASH));

            let success: boolean;
            await act(async () => {
                success = await result.current.addTracker('udp://tracker.example.com:6969');
            });

            expect(success!).toBe(false);
            expect(result.current.error).toBe('Rede indisponível');
        });
    });

    // ── removeTracker ─────────────────────────────────────────────────────

    describe('removeTracker', () => {
        it('remove tracker com sucesso e retorna true', async () => {
            const remainingTrackers = [mockTrackers[1]];
            mockMeshy.removeTracker.mockResolvedValue({
                success: true,
                data: remainingTrackers,
            });

            const { result } = renderHook(() => useTrackers(TEST_INFO_HASH));

            let success: boolean;
            await act(async () => {
                success = await result.current.removeTracker(mockTrackers[0].url);
            });

            expect(success!).toBe(true);
            expect(mockMeshy.removeTracker).toHaveBeenCalledWith(
                TEST_INFO_HASH,
                mockTrackers[0].url,
            );
            expect(result.current.trackers).toHaveLength(1);
        });

        it('retorna false e define erro quando a resposta é falha', async () => {
            mockMeshy.removeTracker.mockResolvedValue({
                success: false,
                error: 'Tracker não encontrado',
            });

            const { result } = renderHook(() => useTrackers(TEST_INFO_HASH));

            let success: boolean;
            await act(async () => {
                success = await result.current.removeTracker('udp://unknown:6969');
            });

            expect(success!).toBe(false);
            expect(result.current.error).toBe('Tracker não encontrado');
        });

        it('retorna false e define erro quando lança exceção', async () => {
            mockMeshy.removeTracker.mockRejectedValue(new Error('Falha IPC'));

            const { result } = renderHook(() => useTrackers(TEST_INFO_HASH));

            let success: boolean;
            await act(async () => {
                success = await result.current.removeTracker('udp://tracker:6969');
            });

            expect(success!).toBe(false);
            expect(result.current.error).toBe('Falha IPC');
        });
    });

    // ── applyGlobalTrackers ───────────────────────────────────────────────

    describe('applyGlobalTrackers', () => {
        it('aplica trackers globais com sucesso e retorna true', async () => {
            const globalTrackers: TrackerInfo[] = [
                ...mockTrackers,
                { url: 'udp://global.example.com:6969', status: 'pending' },
            ];
            mockMeshy.applyGlobalTrackers.mockResolvedValue({
                success: true,
                data: globalTrackers,
            });

            const { result } = renderHook(() => useTrackers(TEST_INFO_HASH));

            let success: boolean;
            await act(async () => {
                success = await result.current.applyGlobalTrackers();
            });

            expect(success!).toBe(true);
            expect(mockMeshy.applyGlobalTrackers).toHaveBeenCalledWith(TEST_INFO_HASH);
            expect(result.current.trackers).toHaveLength(3);
        });

        it('retorna false e define erro quando a resposta é falha', async () => {
            mockMeshy.applyGlobalTrackers.mockResolvedValue({
                success: false,
                error: 'Nenhum tracker global configurado',
            });

            const { result } = renderHook(() => useTrackers(TEST_INFO_HASH));

            let success: boolean;
            await act(async () => {
                success = await result.current.applyGlobalTrackers();
            });

            expect(success!).toBe(false);
            expect(result.current.error).toBe('Nenhum tracker global configurado');
        });

        it('retorna false e define erro quando lança exceção', async () => {
            mockMeshy.applyGlobalTrackers.mockRejectedValue(new Error('Timeout'));

            const { result } = renderHook(() => useTrackers(TEST_INFO_HASH));

            let success: boolean;
            await act(async () => {
                success = await result.current.applyGlobalTrackers();
            });

            expect(success!).toBe(false);
            expect(result.current.error).toBe('Timeout');
        });
    });

    // ── Limpeza de erro entre operações ───────────────────────────────────

    describe('limpeza de erro', () => {
        it('limpa erro anterior ao iniciar nova operação', async () => {
            // Primeira chamada falha
            mockMeshy.getTrackers.mockResolvedValueOnce({
                success: false,
                error: 'Erro inicial',
            });

            const { result } = renderHook(() => useTrackers(TEST_INFO_HASH));

            await act(async () => {
                await result.current.loadTrackers();
            });
            expect(result.current.error).toBe('Erro inicial');

            // Segunda chamada sucede — erro deve ser limpo
            mockMeshy.getTrackers.mockResolvedValueOnce({
                success: true,
                data: mockTrackers,
            });

            await act(async () => {
                await result.current.loadTrackers();
            });
            expect(result.current.error).toBeNull();
            expect(result.current.trackers).toEqual(mockTrackers);
        });
    });
});
