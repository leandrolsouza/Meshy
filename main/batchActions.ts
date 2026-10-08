import type { BatchAction, BatchActionResult } from '../shared/types';
import { ErrorCodes } from '../shared/errorCodes';
import type { DownloadManager } from './downloadManager';

export async function performBatchAction(
    manager: DownloadManager,
    hashes: string[],
    operation: BatchAction,
    deleteFiles: boolean,
    isRestarting: () => boolean,
): Promise<BatchActionResult[]> {
    const order = [...hashes];
    if (operation !== 'resume') {
        const items = manager.getAll();
        const queued = new Set(
            items.filter((item) => item.status === 'queued').map((item) => item.infoHash),
        );
        order.sort((a, b) => Number(queued.has(b)) - Number(queued.has(a)));
    }
    const results = new Map<string, BatchActionResult>();
    for (const infoHash of order) {
        const item = manager.getAll().find((download) => download.infoHash === infoHash);
        const result: BatchActionResult = {
            infoHash,
            name: item?.name ?? infoHash.slice(0, 8),
            success: false,
        };
        try {
            if (isRestarting()) throw new Error(ErrorCodes.ENGINE_RESTARTING);
            if (!item) throw new Error(ErrorCodes.TORRENT_NOT_FOUND);
            if (item.fileOperation) throw new Error(ErrorCodes.FILE_OPERATION_BUSY);
            if (operation === 'resume' && item.status !== 'paused')
                throw new Error(ErrorCodes.INVALID_PARAMS);
            if (
                operation === 'pause' &&
                !['queued', 'downloading', 'resolving-metadata'].includes(item.status)
            )
                throw new Error(ErrorCodes.INVALID_PARAMS);
            if (operation === 'remove') await manager.remove(infoHash, deleteFiles);
            else await manager[operation](infoHash);
            result.success = true;
        } catch (error) {
            const message = error instanceof Error ? error.message : '';
            result.error = (Object.values(ErrorCodes) as string[]).includes(message)
                ? message
                : ErrorCodes.OPERATION_FAILED;
        }
        results.set(infoHash, result);
    }
    manager.persistSession();
    return hashes.map((hash) => results.get(hash)!);
}
