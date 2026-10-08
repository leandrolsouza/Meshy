/**
 * Testes para os caminhos de erro corrigidos em main/torrentEngine.ts.
 *
 * Cobre os blocos catch adicionados/corrigidos nas tarefas 8.1 e 8.2:
 *   - healthCheck(): bloco catch que captura erros ao acessar client.torrents
 *   - remove() com deleteFiles=true: bloco catch que silencia falhas de limpeza de pasta
 *
 * _Requisitos: 6.5, 6.6_
 */

// Mock webtorrent antes dos imports para que Jest (CommonJS) não tente
// parsear o pacote ESM.
jest.mock('webtorrent', () => {
    const MockWebTorrent = jest.fn().mockImplementation(() => ({
        torrents: [],
        throttleDownload: jest.fn(),
        throttleUpload: jest.fn(),
        add: jest.fn(),
        remove: jest.fn(),
        destroy: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
    }));
    return { __esModule: true, default: MockWebTorrent };
});

// Mock fs/promises para controlar readdir e rm por teste.
jest.mock('fs/promises', () => ({
    readFile: jest.fn(),
    rm: jest.fn(),
    readdir: jest.fn(),
}));

import { createTorrentEngine } from '../../main/torrentEngine';
import type WebTorrent from 'webtorrent';
import type { Torrent } from 'webtorrent';
import { readdir, rm } from 'fs/promises';

// readdir é sobrecarregado; cast via unknown para contornar a incompatibilidade de tipos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReaddir = readdir as unknown as jest.MockedFunction<(...args: any[]) => Promise<string[]>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRm = rm as unknown as jest.MockedFunction<(...args: any[]) => Promise<void>>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Cria um fake Torrent mínimo com destroy que chama o callback. */
function makeFakeTorrent(
    infoHash: string,
    overrides: Partial<Torrent & { destroyError?: Error }> = {},
): Torrent {
    const { destroyError, ...rest } = overrides as Partial<Torrent> & { destroyError?: Error };
    return {
        infoHash,
        name: 'fake-torrent',
        length: 1024,
        progress: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        numPeers: 0,
        timeRemaining: Infinity,
        downloaded: 0,
        files: [],
        ready: true,
        magnetURI: `magnet:?xt=urn:btih:${infoHash}`,
        pause: jest.fn(),
        resume: jest.fn(),
        // destroy chama o callback com o erro fornecido (ou undefined para sucesso).
        destroy: jest.fn((_opts: unknown, cb?: (err?: Error) => void) => {
            if (cb) cb(destroyError);
        }),
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
        ...rest,
    } as unknown as Torrent;
}

/** Cria um mock de WebTorrent client com um array de torrents mutável. */
function makeMockClient(overrides: Partial<WebTorrent> = {}): WebTorrent & {
    torrents: Torrent[];
} {
    const torrents: Torrent[] = [];
    return {
        torrents,
        throttleDownload: jest.fn(),
        throttleUpload: jest.fn(),
        add: jest.fn(),
        remove: jest.fn(),
        destroy: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
        ...overrides,
    } as unknown as WebTorrent & { torrents: Torrent[] };
}

const DEFAULT_OPTIONS = {
    downloadPath: '/tmp/downloads',
    downloadSpeedLimit: 0,
    uploadSpeedLimit: 0,
    dhtEnabled: true,
    pexEnabled: true,
    utpEnabled: true,
};

// ─── healthCheck() — bloco catch (Requisitos 6.5, 6.6) ───────────────────────

describe('TorrentEngine.healthCheck() — bloco catch (Requisitos 6.5, 6.6)', () => {
    it('retorna { healthy: false, error } quando client.torrents lança exceção', () => {
        const mockClient = makeMockClient();
        const engine = createTorrentEngine(DEFAULT_OPTIONS, mockClient);

        // Substituir `torrents` por um getter que lança APÓS a construção do engine
        // (durante a construção, `torrents` ainda é o array, evitando quebrar _configureClient).
        Object.defineProperty(mockClient, 'torrents', {
            get: () => {
                throw new Error('client inacessível');
            },
            configurable: true,
        });

        const result = engine.healthCheck();

        expect(result.healthy).toBe(false);
        expect(result.activeTorrents).toBe(0);
        expect(result.totalPeers).toBe(0);
        expect(result.error).toBe('client inacessível');
    });

    it('inclui o restarting flag correto no resultado de erro do healthCheck', () => {
        const mockClient = makeMockClient();
        const engine = createTorrentEngine(DEFAULT_OPTIONS, mockClient);

        Object.defineProperty(mockClient, 'torrents', {
            get: () => {
                throw new Error('falha');
            },
            configurable: true,
        });

        const result = engine.healthCheck();

        // restarting deve ser false (engine não está em restart)
        expect(result.restarting).toBe(false);
        // uptimeMs deve ser número não-negativo
        expect(typeof result.uptimeMs).toBe('number');
        expect(result.uptimeMs).toBeGreaterThanOrEqual(0);
    });

    it('retorna healthy: true quando o engine está funcionando normalmente', () => {
        const mockClient = makeMockClient();
        const engine = createTorrentEngine(DEFAULT_OPTIONS, mockClient);

        const result = engine.healthCheck();

        expect(result.healthy).toBe(true);
        expect(result.restarting).toBe(false);
        expect(result.error).toBeUndefined();
        expect(result.activeTorrents).toBe(0);
        expect(result.totalPeers).toBe(0);
    });

    it('conta torrents ativos e peers corretamente no caminho feliz', () => {
        const mockClient = makeMockClient();
        mockClient.torrents.push(makeFakeTorrent('a'.repeat(40), { numPeers: 2 } as Partial<Torrent>));
        mockClient.torrents.push(makeFakeTorrent('b'.repeat(40), { numPeers: 5 } as Partial<Torrent>));

        const engine = createTorrentEngine(DEFAULT_OPTIONS, mockClient);
        const result = engine.healthCheck();

        expect(result.activeTorrents).toBe(2);
        expect(result.totalPeers).toBe(7);
    });
});

// ─── remove() com deleteFiles=true — bloco catch (Requisitos 6.5, 6.6) ────────

describe('TorrentEngine.remove() deleteFiles=true — bloco catch (Requisitos 6.5, 6.6)', () => {
    beforeEach(() => {
        mockReaddir.mockReset();
        mockRm.mockReset();
    });

    it('resolve sem erro quando readdir lança (pasta já inexistente ou sem permissão)', async () => {
        const infoHash = 'c'.repeat(40);
        const fakeTorrent = makeFakeTorrent(infoHash);
        const mockClient = makeMockClient();
        mockClient.torrents.push(fakeTorrent);

        mockReaddir.mockRejectedValue(new Error('ENOENT: no such file or directory'));

        const engine = createTorrentEngine(DEFAULT_OPTIONS, mockClient);

        await expect(engine.remove(infoHash, true)).resolves.toBeUndefined();
    });

    it('resolve sem erro quando rm lança após readdir retornar pasta vazia', async () => {
        const infoHash = 'd'.repeat(40);
        const fakeTorrent = makeFakeTorrent(infoHash);
        const mockClient = makeMockClient();
        mockClient.torrents.push(fakeTorrent);

        mockReaddir.mockResolvedValue([]);
        mockRm.mockRejectedValue(new Error('EPERM: operation not permitted'));

        const engine = createTorrentEngine(DEFAULT_OPTIONS, mockClient);

        await expect(engine.remove(infoHash, true)).resolves.toBeUndefined();
    });

    it('resolve sem chamar rm quando a pasta não está vazia', async () => {
        const infoHash = 'e'.repeat(40);
        const fakeTorrent = makeFakeTorrent(infoHash);
        const mockClient = makeMockClient();
        mockClient.torrents.push(fakeTorrent);

        mockReaddir.mockResolvedValue(['video.mp4', 'subs.srt']);

        const engine = createTorrentEngine(DEFAULT_OPTIONS, mockClient);

        await expect(engine.remove(infoHash, true)).resolves.toBeUndefined();
        expect(mockRm).not.toHaveBeenCalled();
    });

    it('remove o torrent do estado interno mesmo quando o cleanup da pasta falha', async () => {
        const infoHash = 'f'.repeat(40);
        const mockClient = makeMockClient();

        // Simula o comportamento real do WebTorrent: destroy() remove o torrent
        // do array client.torrents antes de chamar o callback.
        const fakeTorrent = makeFakeTorrent(infoHash);
        (fakeTorrent.destroy as jest.Mock).mockImplementation(
            (_opts: unknown, cb?: (err?: Error) => void) => {
                const idx = mockClient.torrents.indexOf(fakeTorrent);
                if (idx !== -1) mockClient.torrents.splice(idx, 1);
                if (cb) cb(undefined);
            },
        );
        mockClient.torrents.push(fakeTorrent);

        mockReaddir.mockRejectedValue(new Error('acesso negado'));

        const engine = createTorrentEngine(DEFAULT_OPTIONS, mockClient);

        await engine.remove(infoHash, true);

        // Após remoção, o torrent não deve mais aparecer em getAll()
        expect(engine.getAll()).toHaveLength(0);
    });

    it('rejeita quando torrent.destroy reporta um erro', async () => {
        const infoHash = 'g'.repeat(40);
        const fakeTorrent = makeFakeTorrent(infoHash, {
            destroyError: new Error('destroy falhou'),
        } as { destroyError: Error });
        const mockClient = makeMockClient();
        mockClient.torrents.push(fakeTorrent);

        const engine = createTorrentEngine(DEFAULT_OPTIONS, mockClient);

        await expect(engine.remove(infoHash, true)).rejects.toThrow('destroy falhou');
    });

    it('resolve imediatamente sem chamar readdir quando deleteFiles é false', async () => {
        const infoHash = 'h'.repeat(40);
        const fakeTorrent = makeFakeTorrent(infoHash);
        const mockClient = makeMockClient();
        mockClient.torrents.push(fakeTorrent);

        const engine = createTorrentEngine(DEFAULT_OPTIONS, mockClient);

        await expect(engine.remove(infoHash, false)).resolves.toBeUndefined();
        expect(mockReaddir).not.toHaveBeenCalled();
        expect(mockRm).not.toHaveBeenCalled();
    });
});
