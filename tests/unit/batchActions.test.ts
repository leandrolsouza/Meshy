import { performBatchAction } from '../../main/batchActions';
import { ErrorCodes } from '../../shared/errorCodes';
import type { DownloadManager } from '../../main/downloadManager';
import type { DownloadItem } from '../../shared/types';

const active = 'a'.repeat(40),
    queued = 'b'.repeat(40),
    paused = 'c'.repeat(40);
function setup() {
    const items = [
        { infoHash: active, name: 'Active', status: 'downloading' },
        { infoHash: queued, name: 'Queue', status: 'queued' },
        { infoHash: paused, name: 'Paused', status: 'paused' },
    ] as DownloadItem[];
    const calls: string[] = [];
    const manager = {
        getAll: () => items,
        pause: jest.fn(async (hash) => {
            calls.push(hash);
        }),
        resume: jest.fn(async () => {}),
        remove: jest.fn(async () => {}),
        persistSession: jest.fn(),
    };
    return { items, calls, manager, typed: manager as unknown as DownloadManager };
}
test('pausa enfileirados primeiro para não iniciar ao liberar slots; resultados preservam seleção', async () => {
    const { typed, calls } = setup();
    const result = await performBatchAction(typed, [active, queued], 'pause', false, () => false);
    expect(calls).toEqual([queued, active]);
    expect(result.map((item) => item.infoHash)).toEqual([active, queued]);
    expect(result.every((item) => item.success)).toBe(true);
});
test('falha de disco em um torrent não impede outros; estado concluído não é retomado', async () => {
    const { typed, items, manager } = setup();
    items[0]!.status = 'paused';
    items[1]!.status = 'completed';
    manager.resume.mockRejectedValueOnce(new Error(ErrorCodes.DISK_SPACE_LOW));
    const result = await performBatchAction(
        typed,
        [active, queued, paused],
        'resume',
        false,
        () => false,
    );
    expect(result.map((item) => [item.success, item.error])).toEqual([
        [false, ErrorCodes.DISK_SPACE_LOW],
        [false, ErrorCodes.INVALID_PARAMS],
        [true, undefined],
    ]);
    expect(manager.resume).toHaveBeenCalledTimes(2);
});
test('remoção mantém ou exclui arquivos somente conforme escolha explícita', async () => {
    const { typed, manager } = setup();
    await performBatchAction(typed, [active, queued], 'remove', false, () => false);
    expect(manager.remove.mock.calls).toEqual([
        [queued, false],
        [active, false],
    ]);
    manager.remove.mockClear();
    await performBatchAction(typed, [paused], 'remove', true, () => false);
    expect(manager.remove).toHaveBeenCalledWith(paused, true);
});
test('hash removido, recuperação de arquivos e restart são reportados individualmente', async () => {
    const { typed, items, manager } = setup();
    items[0]!.fileOperation = 'move';
    const result = await performBatchAction(
        typed,
        [active, 'd'.repeat(40)],
        'remove',
        true,
        () => false,
    );
    expect(result.map((item) => item.error)).toEqual([
        ErrorCodes.FILE_OPERATION_BUSY,
        ErrorCodes.TORRENT_NOT_FOUND,
    ]);
    expect(manager.remove).not.toHaveBeenCalled();
    expect((await performBatchAction(typed, [paused], 'resume', false, () => true))[0]!.error).toBe(
        ErrorCodes.ENGINE_RESTARTING,
    );
});
