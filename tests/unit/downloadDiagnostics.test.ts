import { createDownloadDiagnostics } from '../../main/downloadDiagnostics';
import type { DownloadManager } from '../../main/downloadManager';
import type { TorrentEngine } from '../../main/torrentEngine';
import type { DownloadItem, TrackerInfo } from '../../shared/types';

function setup() {
    const item = {
        infoHash: 'a'.repeat(40),
        destinationFolder: '/downloads',
        downloadedSize: 10,
        numPeers: 0,
        downloadSpeed: 0,
        status: 'downloading',
        selectedFileCount: 1,
    } as DownloadItem;
    let now = 0;
    let trackers: TrackerInfo[] = [];
    const available = jest.fn(async () => true);
    const engine = { getTrackers: () => trackers } as unknown as TorrentEngine;
    const service = createDownloadDiagnostics({
        manager: { getAll: () => [item] } as DownloadManager,
        engine,
        isFolderAvailable: available,
        now: () => now,
        disableTimer: true,
    });
    return {
        item,
        service,
        available,
        setNow: (value: number) => {
            now = value;
        },
        setTrackers: (value: TrackerInfo[]) => {
            trackers = value;
        },
        read: () => service.enrich([item])[0]!,
    };
}
test('sem peers não afirma ausência de seeders; erro só com todos os trackers em falha', () => {
    const { read, setTrackers } = setup();
    expect(read().diagnostic).toBe('no-peers');
    setTrackers([
        { url: 'udp://tracker:80', status: 'error' },
        { url: 'udp://other:80', status: 'pending' },
    ]);
    expect(read().diagnostic).toBe('no-peers');
    setTrackers([{ url: 'udp://tracker:80', status: 'error' }]);
    expect(read().diagnostic).toBe('trackers-error');
});
test('sem avanço exige 30 segundos e é limpo após progresso, pause e retomar', () => {
    const { item, read, setNow } = setup();
    item.numPeers = 2;
    expect(read().diagnostic).toBeUndefined();
    setNow(29_999);
    expect(read().diagnostic).toBeUndefined();
    setNow(30_000);
    expect(read().diagnostic).toBe('stalled');
    item.downloadedSize++;
    expect(read().diagnostic).toBeUndefined();
    setNow(60_000);
    item.status = 'paused';
    read();
    item.status = 'downloading';
    expect(read().diagnostic).toBeUndefined();
});
test('pasta indisponível é observada no main e recuperação remove diagnóstico', async () => {
    const { available, service, read, item } = setup();
    available.mockResolvedValue(false);
    await service.refresh();
    expect(read().diagnostic).toBe('folder-unavailable');
    available.mockResolvedValue(true);
    await service.refresh();
    expect(read().diagnostic).toBe('no-peers');
    item.fileOperation = 'verify';
    expect(read().diagnostic).toBeUndefined();
    expect(item.diagnostic).toBeUndefined();
});
test.each([
    ['resolving-metadata', 'metadata'],
    ['metadata-failed', 'metadata-failed'],
    ['queued', 'queued'],
    ['completed', undefined],
    ['paused', undefined],
])('status %s usa explicação adequada e não sugere problema em concluído', (status, diagnostic) => {
    const { item, read } = setup();
    item.status = status as DownloadItem['status'];
    expect(read().diagnostic).toBe(diagnostic);
});
test('falta de espaço e seleção vazia são diferenciadas', () => {
    const { item, read } = setup();
    item.selectedFileCount = 0;
    expect(read().diagnostic).toBe('no-selection');
    item.status = 'paused';
    item.pauseReason = 'disk-space';
    expect(read().diagnostic).toBe('disk-space');
});
