import { createDiskSpaceService } from '../../main/diskSpace';
import type { DownloadItem } from '../../shared/types';

const item = (
    hash: string,
    folder: string,
    status: DownloadItem['status'],
    totalSize = 400,
): DownloadItem => ({
    infoHash: hash,
    name: hash,
    destinationFolder: folder,
    status,
    totalSize,
    downloadedSize: 100,
    progress: 0.25,
    downloadSpeed: 0,
    uploadSpeed: 0,
    numPeers: 0,
    numSeeders: 0,
    timeRemaining: 0,
    addedAt: 1,
});
test('considera os bytes restantes de ativos e fila no mesmo volume, incluindo pastas distintas', async () => {
    const disk = createDiskSpaceService({
        safetyMarginBytes: 50,
        readVolume: async (folder) => ({
            volumeId: folder.includes('other-volume') ? 'B' : 'A',
            freeBytes: 1000,
        }),
    });
    const result = await disk.inspect('/destination', 350, [
        item('1', '/sibling', 'downloading'),
        item('2', '/destination', 'queued'),
        item('3', '/other-volume', 'downloading'),
        item('4', '/destination', 'paused'),
        item('5', '/destination', 'completed'),
    ]);
    expect(result).toEqual({
        freeBytes: 1000,
        selectedBytes: 350,
        reservedBytes: 600,
        safetyMarginBytes: 50,
        sufficient: true,
    });
    expect(
        (
            await disk.inspect('/destination', 351, [
                item('1', '/sibling', 'downloading'),
                item('2', '/destination', 'queued'),
            ])
        ).sufficient,
    ).toBe(false);
});
test('exclui o próprio torrent ao verificar retomada e limita reservas negativas a zero', async () => {
    const disk = createDiskSpaceService({
        safetyMarginBytes: 0,
        readVolume: async () => ({ volumeId: 'A', freeBytes: 350 }),
    });
    expect(
        (
            await disk.inspect(
                '/destination',
                300,
                [item('1', '/destination', 'queued'), item('2', '/destination', 'downloading', 50)],
                '1',
            )
        ).reservedBytes,
    ).toBe(0);
});
test('não informa espaço suficiente quando a consulta ao volume falha', async () => {
    const disk = createDiskSpaceService({
        readVolume: async () => {
            throw new Error('disco desconectado');
        },
    });
    await expect(disk.inspect('/missing', 10, [])).rejects.toThrow(
        'error.destination.diskSpaceUnavailable',
    );
});
