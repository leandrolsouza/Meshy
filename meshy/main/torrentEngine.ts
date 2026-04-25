import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import WebTorrent from 'webtorrent';
import type { Torrent } from 'webtorrent';
import { isValidMagnetUri, hasTorrentMagicBytes } from './validators';
import type { TorrentStatus, TorrentFileInfo } from '../shared/types';

export type { TorrentStatus } from '../shared/types';
export type { TorrentFileInfo } from '../shared/types';

// The @types/webtorrent package doesn't include throttleDownload/throttleUpload,
// but they exist in the actual webtorrent@2.x library.
interface WebTorrentInstanceWithThrottle extends WebTorrent.Instance {
    throttleDownload(rate: number): void;
    throttleUpload(rate: number): void;
}

export interface TorrentEngineOptions {
    downloadPath: string;
    downloadSpeedLimit: number; // KB/s, 0 = sem limite
    uploadSpeedLimit: number;   // KB/s, 0 = sem limite
}

export interface TorrentInfo {
    infoHash: string;
    name: string;
    totalSize: number;       // bytes
    progress: number;        // 0.0 – 1.0
    downloadSpeed: number;   // bytes/s
    uploadSpeed: number;     // bytes/s
    numPeers: number;
    numSeeders: number;
    timeRemaining: number;   // ms, Infinity se desconhecido
    downloaded: number;      // bytes
    status: TorrentStatus;
}

export interface TorrentEngine {
    addTorrentFile(filePath: string): Promise<TorrentInfo>;
    addMagnetLink(magnetUri: string): Promise<TorrentInfo>;
    pause(infoHash: string): Promise<void>;
    resume(infoHash: string): Promise<void>;
    remove(infoHash: string, deleteFiles: boolean): Promise<void>;
    setDownloadSpeedLimit(kbps: number): void;
    setUploadSpeedLimit(kbps: number): void;
    getAll(): TorrentInfo[];
    /** Retorna a lista de arquivos de um torrent */
    getFiles(infoHash: string): TorrentFileInfo[];
    /** Aplica seleção de arquivos: seleciona os índices fornecidos, desseleciona os demais */
    setFileSelection(infoHash: string, selectedIndices: number[]): TorrentFileInfo[];
    on(event: 'progress', listener: (info: TorrentInfo) => void): void;
    on(event: 'done', listener: (infoHash: string) => void): void;
    on(event: 'error', listener: (infoHash: string, err: Error) => void): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    removeListener(event: string, listener: (...args: any[]) => void): void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAUSE_RESUME_TIMEOUT_MS = 5_000;

// ─── Helper ───────────────────────────────────────────────────────────────────

function torrentToInfo(torrent: Torrent, status: TorrentStatus): TorrentInfo {
    return {
        infoHash: torrent.infoHash,
        name: torrent.name ?? torrent.infoHash,
        totalSize: torrent.length ?? 0,
        progress: torrent.progress ?? 0,
        downloadSpeed: torrent.downloadSpeed ?? 0,
        uploadSpeed: torrent.uploadSpeed ?? 0,
        numPeers: torrent.numPeers ?? 0,
        numSeeders: (torrent as unknown as { numSeeders?: number }).numSeeders ?? 0,
        timeRemaining: torrent.timeRemaining ?? Infinity,
        downloaded: torrent.downloaded ?? 0,
        status,
    };
}

// ─── Implementation ───────────────────────────────────────────────────────────

class TorrentEngineImpl extends EventEmitter implements TorrentEngine {
    private readonly client: WebTorrentInstanceWithThrottle;
    private readonly downloadPath: string;
    /** Tracks the current status for each infoHash */
    private readonly statusMap = new Map<string, TorrentStatus>();
    /** Tracks selected file indices per torrent */
    private readonly selectionMap = new Map<string, Set<number>>();

    constructor(options: TorrentEngineOptions, client?: WebTorrent.Instance) {
        super();
        this.downloadPath = options.downloadPath;

        this.client = (client ?? new WebTorrent()) as WebTorrentInstanceWithThrottle;

        // Apply initial speed limits
        if (options.downloadSpeedLimit > 0) {
            this.client.throttleDownload(options.downloadSpeedLimit * 1024);
        }
        if (options.uploadSpeedLimit > 0) {
            this.client.throttleUpload(options.uploadSpeedLimit * 1024);
        }
    }

    // ── addTorrentFile ──────────────────────────────────────────────────────────

    addTorrentFile(filePath: string): Promise<TorrentInfo> {
        return new Promise((resolve, reject) => {
            let buffer: Buffer;
            try {
                buffer = readFileSync(filePath);
            } catch (err) {
                return reject(new Error(`Não foi possível ler o arquivo: ${(err as Error).message}`));
            }

            if (!hasTorrentMagicBytes(buffer)) {
                return reject(new Error('Arquivo inválido: não é um arquivo .torrent válido (magic bytes incorretos)'));
            }

            this.client.add(buffer, { path: this.downloadPath }, (torrent) => {
                this.statusMap.set(torrent.infoHash, 'downloading');
                this._initSelectionMap(torrent);
                this._attachTorrentListeners(torrent);
                resolve(torrentToInfo(torrent, 'downloading'));
            });

            this.client.once('error', (err) => {
                reject(err instanceof Error ? err : new Error(String(err)));
            });
        });
    }

    // ── addMagnetLink ───────────────────────────────────────────────────────────

    addMagnetLink(magnetUri: string): Promise<TorrentInfo> {
        return new Promise((resolve, reject) => {
            if (!isValidMagnetUri(magnetUri)) {
                return reject(new Error('Formato inválido. Esperado: magnet:?xt=urn:btih:<40 hex chars>'));
            }

            // Para magnet links, precisamos escutar o evento 'metadata' ANTES
            // de chamar client.add(), porque no WebTorrent 2.x o callback do
            // client.add() pode disparar DEPOIS que os metadados já foram
            // resolvidos, fazendo com que o torrent.once('metadata') nunca
            // dispare e o status fique preso em 'resolving-metadata'.
            //
            // Estratégia: usamos o evento 'torrent' do client para capturar
            // o torrent assim que ele é adicionado internamente, registramos
            // o listener de 'metadata' imediatamente, e resolvemos a Promise
            // com status 'resolving-metadata'. Se os metadados já estiverem
            // disponíveis (torrent.length > 0), transicionamos direto.

            let resolved = false;

            const onTorrent = (torrent: Torrent): void => {
                // Verificar se este é o torrent que acabamos de adicionar
                const expectedHash = magnetUri.match(/xt=urn:btih:([a-fA-F0-9]{40})/i);
                if (expectedHash && torrent.infoHash !== expectedHash[1].toLowerCase()) {
                    return; // Não é o nosso torrent
                }

                this.client.removeListener('torrent', onTorrent);

                this.statusMap.set(torrent.infoHash, 'resolving-metadata');
                this._attachTorrentListeners(torrent);

                // Se os metadados já estão disponíveis (torrent.length > 0),
                // transicionar direto para 'downloading'
                if (torrent.length > 0) {
                    this.statusMap.set(torrent.infoHash, 'downloading');
                    this._initSelectionMap(torrent);
                    if (!resolved) {
                        resolved = true;
                        resolve(torrentToInfo(torrent, 'downloading'));
                    }
                    return;
                }

                // Metadados ainda não disponíveis — escutar o evento
                torrent.once('metadata', () => {
                    this.statusMap.set(torrent.infoHash, 'downloading');
                    this._initSelectionMap(torrent);
                });

                if (!resolved) {
                    resolved = true;
                    resolve(torrentToInfo(torrent, 'resolving-metadata'));
                }
            };

            this.client.on('torrent', onTorrent);

            this.client.add(magnetUri, { path: this.downloadPath });

            this.client.once('error', (err) => {
                this.client.removeListener('torrent', onTorrent);
                if (!resolved) {
                    resolved = true;
                    reject(err instanceof Error ? err : new Error(String(err)));
                }
            });
        });
    }

    // ── pause ───────────────────────────────────────────────────────────────────

    pause(infoHash: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const torrent = this._getTorrent(infoHash);
            if (!torrent) {
                return reject(new Error(`Torrent não encontrado: ${infoHash}`));
            }

            const timer = setTimeout(() => {
                reject(new Error('Falha ao pausar: timeout'));
            }, PAUSE_RESUME_TIMEOUT_MS);

            try {
                torrent.pause();
                clearTimeout(timer);
                this.statusMap.set(infoHash, 'paused');
                resolve();
            } catch (err) {
                clearTimeout(timer);
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        });
    }

    // ── resume ──────────────────────────────────────────────────────────────────

    resume(infoHash: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const torrent = this._getTorrent(infoHash);
            if (!torrent) {
                return reject(new Error(`Torrent não encontrado: ${infoHash}`));
            }

            const timer = setTimeout(() => {
                reject(new Error('Falha ao retomar: timeout'));
            }, PAUSE_RESUME_TIMEOUT_MS);

            try {
                torrent.resume();
                clearTimeout(timer);
                this.statusMap.set(infoHash, 'downloading');
                resolve();
            } catch (err) {
                clearTimeout(timer);
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        });
    }

    // ── remove ──────────────────────────────────────────────────────────────────

    remove(infoHash: string, deleteFiles: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            const torrent = this._getTorrent(infoHash);
            if (!torrent) {
                // Already removed — treat as success
                this.statusMap.delete(infoHash);
                this.selectionMap.delete(infoHash);
                return resolve();
            }

            torrent.destroy({ destroyStore: deleteFiles }, (err) => {
                if (err) {
                    return reject(err instanceof Error ? err : new Error(String(err)));
                }
                this.statusMap.delete(infoHash);
                this.selectionMap.delete(infoHash);
                resolve();
            });
        });
    }

    // ── setDownloadSpeedLimit ───────────────────────────────────────────────────

    setDownloadSpeedLimit(kbps: number): void {
        // kbps === 0 means no limit; WebTorrent uses 0 to remove the limit as well
        this.client.throttleDownload(kbps * 1024);
    }

    // ── setUploadSpeedLimit ─────────────────────────────────────────────────────

    setUploadSpeedLimit(kbps: number): void {
        this.client.throttleUpload(kbps * 1024);
    }

    // ── getAll ──────────────────────────────────────────────────────────────────

    getAll(): TorrentInfo[] {
        return this.client.torrents.map((torrent) => {
            const status = this.statusMap.get(torrent.infoHash) ?? 'queued';
            return torrentToInfo(torrent, status);
        });
    }

    // ── EventEmitter overloads (type-safe) ──────────────────────────────────────

    on(event: 'progress', listener: (info: TorrentInfo) => void): this;
    on(event: 'done', listener: (infoHash: string) => void): this;
    on(event: 'error', listener: (infoHash: string, err: Error) => void): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    // ── getFiles ────────────────────────────────────────────────────────────────

    getFiles(infoHash: string): TorrentFileInfo[] {
        const torrent = this._getTorrent(infoHash);
        if (!torrent) {
            throw new Error(`Torrent não encontrado: ${infoHash}`);
        }

        const selected = this.selectionMap.get(infoHash) ?? new Set<number>();

        return torrent.files.map((file, index) => ({
            index,
            name: file.name,
            path: file.path,
            length: file.length,
            downloaded: file.downloaded,
            selected: selected.has(index),
        }));
    }

    // ── setFileSelection ────────────────────────────────────────────────────────

    setFileSelection(infoHash: string, selectedIndices: number[]): TorrentFileInfo[] {
        const torrent = this._getTorrent(infoHash);
        if (!torrent) {
            throw new Error(`Torrent não encontrado: ${infoHash}`);
        }

        const selectedSet = new Set(selectedIndices);
        this.selectionMap.set(infoHash, selectedSet);

        for (let i = 0; i < torrent.files.length; i++) {
            const file = torrent.files[i];
            if (selectedSet.has(i)) {
                file.select();
            } else {
                file.deselect();
            }
        }

        return this.getFiles(infoHash);
    }

    // ── Private helpers ─────────────────────────────────────────────────────────

    private _getTorrent(infoHash: string): Torrent | undefined {
        return this.client.torrents.find((t) => t.infoHash === infoHash);
    }

    /** Initializes the selection map with all file indices (all selected by default) */
    private _initSelectionMap(torrent: Torrent): void {
        const allIndices = new Set<number>();
        for (let i = 0; i < torrent.files.length; i++) {
            allIndices.add(i);
        }
        this.selectionMap.set(torrent.infoHash, allIndices);
    }

    private _attachTorrentListeners(torrent: Torrent): void {
        torrent.on('download', () => {
            const status = this.statusMap.get(torrent.infoHash) ?? 'downloading';
            this.emit('progress', torrentToInfo(torrent, status));
        });

        torrent.on('upload', () => {
            const status = this.statusMap.get(torrent.infoHash) ?? 'downloading';
            this.emit('progress', torrentToInfo(torrent, status));
        });

        torrent.on('done', () => {
            this.statusMap.set(torrent.infoHash, 'completed');
            this.emit('done', torrent.infoHash);
        });

        torrent.on('error', (err) => {
            this.statusMap.set(torrent.infoHash, 'error');
            const error = err instanceof Error ? err : new Error(String(err));
            this.emit('error', torrent.infoHash, error);
        });
    }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a new TorrentEngine instance.
 *
 * @param options  Engine configuration (download path, speed limits).
 * @param webTorrentClient  Optional WebTorrent client for dependency injection
 *                          (useful in tests to avoid real network activity).
 */
export function createTorrentEngine(
    options: TorrentEngineOptions,
    webTorrentClient?: WebTorrent.Instance,
): TorrentEngine {
    return new TorrentEngineImpl(options, webTorrentClient);
}
