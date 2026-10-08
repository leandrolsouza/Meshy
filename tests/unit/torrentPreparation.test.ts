import { EventEmitter } from 'events';
import WebTorrent from 'webtorrent';
import { createTorrentPreparation, MetadataOnlyStore } from '../../main/torrentPreparation';
jest.mock('webtorrent', () => jest.fn());

function setup(automatic = true) {
    const torrent = Object.assign(new EventEmitter(), {
        infoHash: 'a'.repeat(40),
        name: 'Archive',
        magnetURI: `magnet:?xt=urn:btih:${'a'.repeat(40)}`,
        torrentFile: Buffer.from('d4:test4:datae'),
        metadata: null,
        files: [{ name: 'a.bin', path: 'Archive/a.bin', length: 123 }],
        wires: [],
        announce: [],
    });
    const client = Object.assign(new EventEmitter(), {
        add: jest.fn(() => {
            if (automatic) Promise.resolve().then(() => torrent.emit('metadata'));
            return torrent;
        }),
        destroy: jest.fn((callback: (error?: Error) => void) => {
            torrent.emit('close');
            callback();
        }),
    });
    const service = createTorrentPreparation({
        createClient: () => client as unknown as WebTorrent,
        metadataTimeoutMs: 100,
    });
    return { service, torrent, client };
}
test('obtém metadados com zero seleção, armazenamento sem disco e encerra a rede antes de apresentar a revisão', async () => {
    const { service, client } = setup();
    const preview = await service.prepare('request-123', {
        kind: 'buffer',
        buffer: Buffer.from('de'),
    });
    expect(client.add).toHaveBeenCalledWith(
        Buffer.from('de'),
        expect.objectContaining({
            deselect: true,
            uploads: false,
            storeCacheSlots: 0,
            store: MetadataOnlyStore,
        }),
    );
    expect(client.destroy).toHaveBeenCalledTimes(1);
    expect(preview).toMatchObject({
        requestId: 'request-123',
        name: 'Archive',
        files: [{ index: 0, length: 123, downloaded: 0 }],
    });
    expect(service.get('request-123').buffer).toEqual(Buffer.from('d4:test4:datae'));
    service.dispose();
});
test('cancelar enquanto aguarda metadados encerra o cliente e não deixa rascunho', async () => {
    const { service, client, torrent } = setup(false);
    const work = service.prepare('request-123', {
        kind: 'magnet',
        magnetUri: `magnet:?xt=urn:btih:${'a'.repeat(40)}`,
    });
    const rejection = expect(work).rejects.toThrow('preparationCancelled');
    service.cancel('request-123');
    torrent.emit('metadata');
    await rejection;
    expect(client.destroy).toHaveBeenCalledTimes(1);
    expect(() => service.get('request-123')).toThrow('preparationExpired');
});
test('timeout e erro de rede liberam os recursos', async () => {
    jest.useFakeTimers();
    try {
        const { service, client } = setup(false);
        const work = service.prepare('request-123', { kind: 'buffer', buffer: Buffer.from('de') });
        const rejection = expect(work).rejects.toThrow('metadataTimeout');
        await jest.advanceTimersByTimeAsync(101);
        await rejection;
        expect(client.destroy).toHaveBeenCalledTimes(1);
        service.dispose();
    } finally {
        jest.useRealTimers();
    }
    const { service, client } = setup(false);
    const work = service.prepare('request-456', { kind: 'buffer', buffer: Buffer.from('de') });
    const rejection = expect(work).rejects.toThrow('rede indisponível');
    client.emit('error', new Error('rede indisponível'));
    await rejection;
    expect(client.destroy).toHaveBeenCalledTimes(1);
});
test('rascunhos cancelados e entradas inválidas não criam clientes adicionais', async () => {
    const invalid = setup();
    await expect(
        invalid.service.prepare('request-123', { kind: 'buffer', buffer: Buffer.from('invalid') }),
    ).rejects.toThrow('invalidFilePath');
    expect(invalid.client.add).not.toHaveBeenCalled();
    const { service } = setup();
    await service.prepare('request-456', { kind: 'buffer', buffer: Buffer.from('de') });
    await expect(
        service.prepare('request-456', { kind: 'buffer', buffer: Buffer.from('de') }),
    ).rejects.toThrow('params.invalid');
    service.cancel('request-456');
    expect(() => service.get('request-456')).toThrow('preparationExpired');
});

test('rascunhos expiram após dez minutos sem confirmação', async () => {
    jest.useFakeTimers();
    try {
        const { service } = setup();
        await service.prepare('request-123', { kind: 'buffer', buffer: Buffer.from('de') });
        await jest.advanceTimersByTimeAsync(10 * 60_000);
        expect(() => service.get('request-123')).toThrow('preparationExpired');
        service.dispose();
    } finally {
        jest.useRealTimers();
    }
});

test('a preparação respeita as configurações de rede atuais', async () => {
    const { client } = setup();
    jest.mocked(WebTorrent).mockImplementation(() => client as unknown as WebTorrent);
    const getNetworkOptions = jest.fn(() => ({
        dhtEnabled: false,
        pexEnabled: false,
        utpEnabled: false,
    }));
    const service = createTorrentPreparation({ getNetworkOptions });
    await service.prepare('request-123', { kind: 'buffer', buffer: Buffer.from('de') });
    expect(WebTorrent).toHaveBeenLastCalledWith(
        expect.objectContaining({ dht: false, utp: false, utPex: false }),
    );
    expect((client as unknown as WebTorrent).utPex).toBe(false);
    service.dispose();
});
test('o armazenamento de preparação recusa conteúdo e não devolve peças', async () => {
    const store = new MetadataOnlyStore();
    await new Promise<void>((resolve) =>
        store.get(0, {}, (error) => {
            expect(error).toBeInstanceOf(Error);
            resolve();
        }),
    );
    await new Promise<void>((resolve) =>
        store.put(0, new Uint8Array([1]), (error) => {
            expect(error.message).toMatch(/não transfere/);
            resolve();
        }),
    );
});
