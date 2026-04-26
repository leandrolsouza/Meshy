/**
 * @jest-environment jsdom
 */
/**
 * Testes unitários para o hook useDownloads.
 *
 * Cobre: registro de listeners, ações IPC (add, pause, resume, remove),
 * atualização do store, e cleanup de listeners.
 */
import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { DownloadItem } from '../../shared/types';
import { useDownloadStore } from '../../src/store/downloadStore';

// ─── Helper: cria um DownloadItem com valores padrão ──────────────────────────

function makeItem(overrides: Partial<DownloadItem> = {}): DownloadItem {
    return {
        infoHash: 'abc123',
        name: 'Test Torrent',
        totalSize: 1024 * 1024,
        downloadedSize: 0,
        progress: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        numPeers: 0,
        numSeeders: 0,
        timeRemaining: Infinity,
        status: 'downloading',
        destinationFolder: '/tmp',
        addedAt: Date.now(),
        ...overrides,
    };
}

// ─── Mock window.meshy ───────────────────────────────────────────────────────

let progressCallback: ((items: DownloadItem[]) => void) | null = null;
let errorCallback: ((data: { infoHash: string; message: string }) => void) | null = null;
const removeProgressListener = jest.fn();
const removeErrorListener = jest.fn();

const mockMeshy = {
    getAll: jest.fn().mockResolvedValue({ success: true, data: [] }),
    addTorrentFile: jest.fn(),
    addMagnetLink: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    remove: jest.fn(),
    getFiles: jest.fn(),
    setFileSelection: jest.fn(),
    onProgress: jest.fn((cb: (items: DownloadItem[]) => void) => {
        progressCallback = cb;
        return removeProgressListener;
    }),
    onError: jest.fn((cb: (data: { infoHash: string; message: string }) => void) => {
        errorCallback = cb;
        return removeErrorListener;
    }),
};

beforeAll(() => {
    Object.defineProperty(window, 'meshy', {
        value: mockMeshy,
        writable: true,
    });
});

// ─── Import hook after mocks ──────────────────────────────────────────────────

import { useDownloads } from '../../src/hooks/useDownloads';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useDownloads', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useDownloadStore.setState({ items: [] });
        progressCallback = null;
        errorCallback = null;
    });

    // ── Listener registration ─────────────────────────────────────────────

    describe('registro de listeners', () => {
        it('registra onProgress e onError ao montar', () => {
            renderHook(() => useDownloads());

            expect(mockMeshy.onProgress).toHaveBeenCalledTimes(1);
            expect(mockMeshy.onError).toHaveBeenCalledTimes(1);
        });

        it('remove listeners ao desmontar', () => {
            const { unmount } = renderHook(() => useDownloads());

            unmount();

            expect(removeProgressListener).toHaveBeenCalledTimes(1);
            expect(removeErrorListener).toHaveBeenCalledTimes(1);
        });
    });

    // ── onProgress ────────────────────────────────────────────────────────

    describe('onProgress', () => {
        it('atualiza o store via mergeItems quando recebe progresso', () => {
            renderHook(() => useDownloads());

            const items = [makeItem({ infoHash: 'a', progress: 0.5 })];

            act(() => {
                progressCallback!(items);
            });

            expect(useDownloadStore.getState().items).toHaveLength(1);
            expect(useDownloadStore.getState().items[0].progress).toBe(0.5);
        });
    });

    // ── onError ───────────────────────────────────────────────────────────

    describe('onError', () => {
        it('marca o item como "error" no store quando recebe erro', () => {
            // Pré-popular o store com um item
            useDownloadStore.setState({
                items: [makeItem({ infoHash: 'a', status: 'downloading' })],
            });

            renderHook(() => useDownloads());

            act(() => {
                errorCallback!({ infoHash: 'a', message: 'Falha na conexão' });
            });

            expect(useDownloadStore.getState().items[0].status).toBe('error');
        });

        it('não altera o store se o infoHash não existir', () => {
            useDownloadStore.setState({
                items: [makeItem({ infoHash: 'a', status: 'downloading' })],
            });

            renderHook(() => useDownloads());

            act(() => {
                errorCallback!({ infoHash: 'inexistente', message: 'Erro' });
            });

            expect(useDownloadStore.getState().items[0].status).toBe('downloading');
        });
    });

    // ── addTorrentFile ────────────────────────────────────────────────────

    describe('addTorrentFile', () => {
        it('chama window.meshy.addTorrentFile e atualiza o store em caso de sucesso', async () => {
            const newItem = makeItem({ infoHash: 'new', name: 'New Torrent' });
            mockMeshy.addTorrentFile.mockResolvedValue({ success: true, data: newItem });

            const { result } = renderHook(() => useDownloads());

            let response: Awaited<ReturnType<typeof result.current.addTorrentFile>>;
            await act(async () => {
                response = await result.current.addTorrentFile('/path/to/file.torrent');
            });

            expect(mockMeshy.addTorrentFile).toHaveBeenCalledWith('/path/to/file.torrent');
            expect(response!.success).toBe(true);
            expect(useDownloadStore.getState().items).toHaveLength(1);
            expect(useDownloadStore.getState().items[0].infoHash).toBe('new');
        });

        it('não atualiza o store em caso de falha', async () => {
            mockMeshy.addTorrentFile.mockResolvedValue({
                success: false,
                error: 'Arquivo inválido',
            });

            const { result } = renderHook(() => useDownloads());

            let response: Awaited<ReturnType<typeof result.current.addTorrentFile>>;
            await act(async () => {
                response = await result.current.addTorrentFile('/invalid');
            });

            expect(response!.success).toBe(false);
            expect(useDownloadStore.getState().items).toHaveLength(0);
        });
    });

    // ── addMagnetLink ─────────────────────────────────────────────────────

    describe('addMagnetLink', () => {
        it('chama window.meshy.addMagnetLink e atualiza o store em caso de sucesso', async () => {
            const newItem = makeItem({ infoHash: 'magnet1' });
            mockMeshy.addMagnetLink.mockResolvedValue({ success: true, data: newItem });

            const { result } = renderHook(() => useDownloads());

            await act(async () => {
                await result.current.addMagnetLink('magnet:?xt=urn:btih:abc123');
            });

            expect(mockMeshy.addMagnetLink).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc123');
            expect(useDownloadStore.getState().items[0].infoHash).toBe('magnet1');
        });
    });

    // ── pause ─────────────────────────────────────────────────────────────

    describe('pause', () => {
        it('chama window.meshy.pause e atualiza status para "paused"', async () => {
            useDownloadStore.setState({
                items: [makeItem({ infoHash: 'a', status: 'downloading' })],
            });
            mockMeshy.pause.mockResolvedValue({ success: true });

            const { result } = renderHook(() => useDownloads());

            await act(async () => {
                await result.current.pause('a');
            });

            expect(mockMeshy.pause).toHaveBeenCalledWith('a');
            expect(useDownloadStore.getState().items[0].status).toBe('paused');
        });

        it('não altera status se a operação falhar', async () => {
            useDownloadStore.setState({
                items: [makeItem({ infoHash: 'a', status: 'downloading' })],
            });
            mockMeshy.pause.mockResolvedValue({ success: false, error: 'Timeout' });

            const { result } = renderHook(() => useDownloads());

            await act(async () => {
                await result.current.pause('a');
            });

            expect(useDownloadStore.getState().items[0].status).toBe('downloading');
        });
    });

    // ── resume ────────────────────────────────────────────────────────────

    describe('resume', () => {
        it('chama window.meshy.resume e atualiza status para "downloading"', async () => {
            useDownloadStore.setState({
                items: [makeItem({ infoHash: 'a', status: 'paused' })],
            });
            mockMeshy.resume.mockResolvedValue({ success: true });

            const { result } = renderHook(() => useDownloads());

            await act(async () => {
                await result.current.resume('a');
            });

            expect(mockMeshy.resume).toHaveBeenCalledWith('a');
            expect(useDownloadStore.getState().items[0].status).toBe('downloading');
        });
    });

    // ── remove ────────────────────────────────────────────────────────────

    describe('remove', () => {
        it('chama window.meshy.remove e remove o item do store', async () => {
            useDownloadStore.setState({
                items: [makeItem({ infoHash: 'a' }), makeItem({ infoHash: 'b' })],
            });
            mockMeshy.remove.mockResolvedValue({ success: true });

            const { result } = renderHook(() => useDownloads());

            await act(async () => {
                await result.current.remove('a', false);
            });

            expect(mockMeshy.remove).toHaveBeenCalledWith('a', false);
            expect(useDownloadStore.getState().items).toHaveLength(1);
            expect(useDownloadStore.getState().items[0].infoHash).toBe('b');
        });

        it('passa deleteFiles=true para a API', async () => {
            useDownloadStore.setState({
                items: [makeItem({ infoHash: 'a' })],
            });
            mockMeshy.remove.mockResolvedValue({ success: true });

            const { result } = renderHook(() => useDownloads());

            await act(async () => {
                await result.current.remove('a', true);
            });

            expect(mockMeshy.remove).toHaveBeenCalledWith('a', true);
        });

        it('não remove do store se a operação falhar', async () => {
            useDownloadStore.setState({
                items: [makeItem({ infoHash: 'a' })],
            });
            mockMeshy.remove.mockResolvedValue({ success: false, error: 'Erro' });

            const { result } = renderHook(() => useDownloads());

            await act(async () => {
                await result.current.remove('a', false);
            });

            expect(useDownloadStore.getState().items).toHaveLength(1);
        });
    });

    // ── getFiles / setFileSelection (delegação direta) ────────────────────

    describe('getFiles', () => {
        it('delega diretamente para window.meshy.getFiles', async () => {
            mockMeshy.getFiles.mockResolvedValue({ success: true, data: [] });

            const { result } = renderHook(() => useDownloads());

            await act(async () => {
                await result.current.getFiles('a');
            });

            expect(mockMeshy.getFiles).toHaveBeenCalledWith('a');
        });
    });

    describe('setFileSelection', () => {
        it('delega diretamente para window.meshy.setFileSelection', async () => {
            mockMeshy.setFileSelection.mockResolvedValue({ success: true, data: [] });

            const { result } = renderHook(() => useDownloads());

            await act(async () => {
                await result.current.setFileSelection('a', [0, 2]);
            });

            expect(mockMeshy.setFileSelection).toHaveBeenCalledWith('a', [0, 2]);
        });
    });
});
