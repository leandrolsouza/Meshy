import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import WebTorrent from 'webtorrent';
import type { Torrent } from 'webtorrent';
import { ThrottleGroup } from 'speed-limiter';
import { isValidMagnetUri, hasTorrentMagicBytes } from './validators';
import { isValidTrackerUrl, normalizeTrackerUrl } from '../shared/validators';
import type { TorrentStatus, TorrentFileInfo, TrackerInfo, TrackerStatus } from '../shared/types';
import {
    getAnnounceList,
    setAnnounceList,
    getInternalTrackers,
    destroyInternalTracker,
    addTrackerToTorrent,
    destroyAllWires,
    getNumSeeders,
} from './webtorrentInternals';
import type { WireWithPex } from './webtorrentInternals';

export type { TorrentStatus } from '../shared/types';
export type { TorrentFileInfo } from '../shared/types';
export type { TrackerInfo } from '../shared/types';

// The @types/webtorrent package doesn't include throttleDownload/throttleUpload,
// but they exist in the actual webtorrent@2.x library.
interface WebTorrentInstanceWithThrottle extends WebTorrent.Instance {
    throttleDownload(rate: number): void;
    throttleUpload(rate: number): void;
}

export interface TorrentEngineOptions {
    downloadPath: string;
    downloadSpeedLimit: number; // KB/s, 0 = sem limite
    uploadSpeedLimit: number; // KB/s, 0 = sem limite
    dhtEnabled: boolean; // DHT — Distributed Hash Table (padrão: true)
    pexEnabled: boolean; // PEX — Peer Exchange (padrão: true)
    utpEnabled: boolean; // uTP — Micro Transport Protocol (padrão: true)
}

export interface TorrentInfo {
    infoHash: string;
    name: string;
    totalSize: number; // bytes
    progress: number; // 0.0 – 1.0
    downloadSpeed: number; // bytes/s
    uploadSpeed: number; // bytes/s
    numPeers: number;
    numSeeders: number;
    timeRemaining: number; // ms, Infinity se desconhecido
    downloaded: number; // bytes
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
    /** Define limite individual de download para um torrent (kbps > 0 ativa, 0 desativa) */
    setTorrentDownloadSpeedLimit(infoHash: string, kbps: number): void;
    /** Define limite individual de upload para um torrent (kbps > 0 ativa, 0 desativa) */
    setTorrentUploadSpeedLimit(infoHash: string, kbps: number): void;
    getAll(): TorrentInfo[];
    /** Retorna a lista de arquivos de um torrent */
    getFiles(infoHash: string): TorrentFileInfo[];
    /** Aplica seleção de arquivos: seleciona os índices fornecidos, desseleciona os demais */
    setFileSelection(infoHash: string, selectedIndices: number[]): TorrentFileInfo[];
    /** Retorna a lista de trackers de um torrent com status de conexão */
    getTrackers(infoHash: string): TrackerInfo[];
    /** Adiciona um tracker a um torrent (valida URL e rejeita duplicatas) */
    addTracker(infoHash: string, trackerUrl: string): void;
    /** Remove um tracker de um torrent e encerra a conexão */
    removeTracker(infoHash: string, trackerUrl: string): void;
    /** Reinicia o motor com novas opções, re-adicionando torrents ativos */
    restart(options: TorrentEngineOptions): Promise<void>;
    /** Indica se o motor está em processo de reinício */
    isRestarting(): boolean;
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
        numSeeders: getNumSeeders(torrent),
        timeRemaining: torrent.timeRemaining ?? Infinity,
        downloaded: torrent.downloaded ?? 0,
        status,
    };
}

// ─── Implementation ───────────────────────────────────────────────────────────

class TorrentEngineImpl extends EventEmitter implements TorrentEngine {
    private client: WebTorrentInstanceWithThrottle;
    private downloadPath: string;
    /** Tracks the current status for each infoHash */
    private readonly statusMap = new Map<string, TorrentStatus>();
    /** Tracks selected file indices per torrent */
    private readonly selectionMap = new Map<string, Set<number>>();
    /** ThrottleGroup de download individual por torrent */
    private readonly downloadThrottleMap = new Map<string, ThrottleGroup>();
    /** ThrottleGroup de upload individual por torrent */
    private readonly uploadThrottleMap = new Map<string, ThrottleGroup>();

    /** Armazena as opções para uso posterior (ex: restart) */
    private options: TorrentEngineOptions;

    constructor(options: TorrentEngineOptions, client?: WebTorrent.Instance) {
        super();
        this.downloadPath = options.downloadPath;
        this.options = options;

        // Passa opções de rede ao construtor do WebTorrent.
        // PEX não é uma opção do construtor — é controlado via wire extension (ut_pex).
        this.client = (client ??
            new WebTorrent({
                dht: options.dhtEnabled,
                utp: options.utpEnabled,
            })) as WebTorrentInstanceWithThrottle;

        // Apply initial speed limits
        if (options.downloadSpeedLimit > 0) {
            this.client.throttleDownload(options.downloadSpeedLimit * 1024);
        }
        if (options.uploadSpeedLimit > 0) {
            this.client.throttleUpload(options.uploadSpeedLimit * 1024);
        }

        // Desabilitar PEX removendo a extensão ut_pex dos wires quando pexEnabled é false
        if (!options.pexEnabled) {
            this._setupPexDisable();
        }
    }

    // ── addTorrentFile ──────────────────────────────────────────────────────────

    addTorrentFile(filePath: string): Promise<TorrentInfo> {
        return new Promise((resolve, reject) => {
            let buffer: Buffer;
            try {
                buffer = readFileSync(filePath);
            } catch (err) {
                return reject(
                    new Error(`Não foi possível ler o arquivo: ${(err as Error).message}`),
                );
            }

            if (!hasTorrentMagicBytes(buffer)) {
                return reject(
                    new Error(
                        'Arquivo inválido: não é um arquivo .torrent válido (magic bytes incorretos)',
                    ),
                );
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
                return reject(
                    new Error('Formato inválido. Esperado: magnet:?xt=urn:btih:<40 hex chars>'),
                );
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

                // O torrent.pause() do WebTorrent apenas para de buscar novos peers,
                // mas NÃO desconecta os peers já conectados — o download continua.
                // Para realmente parar a transferência, destruímos todos os wires.
                destroyAllWires(torrent);

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
                this._cleanupThrottleGroups(infoHash);
                return resolve();
            }

            torrent.destroy({ destroyStore: deleteFiles }, (err) => {
                if (err) {
                    return reject(err instanceof Error ? err : new Error(String(err)));
                }
                this.statusMap.delete(infoHash);
                this.selectionMap.delete(infoHash);
                this._cleanupThrottleGroups(infoHash);
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

    // ── setTorrentDownloadSpeedLimit ────────────────────────────────────────────

    setTorrentDownloadSpeedLimit(infoHash: string, kbps: number): void {
        this._setTorrentThrottle(infoHash, kbps, this.downloadThrottleMap);
    }

    // ── setTorrentUploadSpeedLimit ──────────────────────────────────────────────

    setTorrentUploadSpeedLimit(infoHash: string, kbps: number): void {
        this._setTorrentThrottle(infoHash, kbps, this.uploadThrottleMap);
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

    // ── getTrackers ─────────────────────────────────────────────────────────────

    getTrackers(infoHash: string): TrackerInfo[] {
        const torrent = this._getTorrent(infoHash);
        if (!torrent) {
            throw new Error(`Torrent não encontrado: ${infoHash}`);
        }

        const announce = getAnnounceList(torrent);
        const internalTrackers = getInternalTrackers(torrent);

        return announce.map((url) => {
            const tracker = internalTrackers[url];
            let status: TrackerStatus = 'pending';

            if (tracker) {
                if (tracker.destroyed) {
                    status = 'error';
                } else {
                    status = 'connected';
                }
            }

            return { url, status };
        });
    }

    // ── addTracker ──────────────────────────────────────────────────────────────

    addTracker(infoHash: string, trackerUrl: string): void {
        const torrent = this._getTorrent(infoHash);
        if (!torrent) {
            throw new Error(`Torrent não encontrado: ${infoHash}`);
        }

        if (!isValidTrackerUrl(trackerUrl)) {
            throw new Error(
                'URL de tracker inválida. Protocolos aceitos: http://, https://, udp://',
            );
        }

        const normalized = normalizeTrackerUrl(trackerUrl);
        const announce = getAnnounceList(torrent);
        const alreadyExists = announce.some(
            (existing) => normalizeTrackerUrl(existing) === normalized,
        );

        if (alreadyExists) {
            throw new Error(`Tracker já presente: ${normalized}`);
        }

        addTrackerToTorrent(torrent, normalized);
    }

    // ── removeTracker ───────────────────────────────────────────────────────────

    removeTracker(infoHash: string, trackerUrl: string): void {
        const torrent = this._getTorrent(infoHash);
        if (!torrent) {
            throw new Error(`Torrent não encontrado: ${infoHash}`);
        }

        const normalized = normalizeTrackerUrl(trackerUrl);
        const announce = getAnnounceList(torrent);
        const index = announce.findIndex(
            (existing) => normalizeTrackerUrl(existing) === normalized,
        );

        if (index === -1) {
            throw new Error(`Tracker não encontrado: ${normalized}`);
        }

        // Remove do array announce
        announce.splice(index, 1);
        setAnnounceList(torrent, announce);

        // Destrói a conexão com o tracker, se existir
        destroyInternalTracker(torrent, normalized, normalizeTrackerUrl);
    }

    // ── Private helpers ─────────────────────────────────────────────────────────

    /** Flag que indica se o motor está em processo de reinício */
    private _restarting = false;

    // ── isRestarting ────────────────────────────────────────────────────────────

    isRestarting(): boolean {
        return this._restarting;
    }

    // ── restart ─────────────────────────────────────────────────────────────────

    async restart(options: TorrentEngineOptions): Promise<void> {
        this._restarting = true;

        try {
            // 1. Coletar infoHashes e magnetURIs dos torrents ativos
            const activeTorrents = this.client.torrents.map((t) => ({
                infoHash: t.infoHash,
                magnetURI: t.magnetURI,
                status: this.statusMap.get(t.infoHash),
            }));

            // 2. Destruir todos os torrents sem deletar arquivos
            for (const t of this.client.torrents) {
                await new Promise<void>((resolve) => {
                    t.destroy({ destroyStore: false }, () => resolve());
                });
            }

            // 3. Destruir o cliente atual
            await new Promise<void>((resolve, reject) => {
                this.client.destroy((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // 4. Criar novo cliente com novas opções
            this.client = new WebTorrent({
                dht: options.dhtEnabled,
                utp: options.utpEnabled,
            }) as WebTorrentInstanceWithThrottle;

            this.downloadPath = options.downloadPath;
            this.options = options;

            // Aplicar limites de velocidade
            if (options.downloadSpeedLimit > 0) {
                this.client.throttleDownload(options.downloadSpeedLimit * 1024);
            }
            if (options.uploadSpeedLimit > 0) {
                this.client.throttleUpload(options.uploadSpeedLimit * 1024);
            }

            // Configurar PEX se desabilitado
            if (!options.pexEnabled) {
                this._setupPexDisable();
            }

            // 5. Re-adicionar torrents que estavam ativos (pular pausados/concluídos)
            for (const torrentInfo of activeTorrents) {
                if (torrentInfo.status === 'paused' || torrentInfo.status === 'completed') {
                    continue;
                }
                try {
                    if (torrentInfo.magnetURI) {
                        await this.addMagnetLink(torrentInfo.magnetURI);
                    }
                } catch {
                    this.statusMap.set(torrentInfo.infoHash, 'error');
                    this.emit(
                        'error',
                        torrentInfo.infoHash,
                        new Error('Falha ao re-adicionar torrent após reinício'),
                    );
                }
            }
        } finally {
            this._restarting = false;
        }
    }

    // ── _setupPexDisable ────────────────────────────────────────────────────────

    /** Registra listener para desabilitar PEX (ut_pex) nos wires de todos os torrents */
    private _setupPexDisable(): void {
        this.client.on('torrent', (torrent) => {
            torrent.on('wire', (wire) => {
                const w = wire as unknown as WireWithPex;
                if (w.ut_pex) {
                    w.ut_pex.destroy?.();
                }
            });
        });
    }

    // ── _getTorrent ─────────────────────────────────────────────────────────────

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

        // Interceptar wires para aplicar throttle individual por torrent
        torrent.on('wire', (wire) => {
            this._applyWireThrottle(torrent.infoHash, wire);
        });
    }

    /**
     * Aplica throttle individual a um wire conectado ao torrent.
     * Se existir um ThrottleGroup para o infoHash, cria um Throttle (Transform stream)
     * e o insere no pipeline de dados do wire.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _applyWireThrottle(infoHash: string, wire: any): void {
        const dlGroup = this.downloadThrottleMap.get(infoHash);
        if (dlGroup && dlGroup.getEnabled()) {
            const dlThrottle = dlGroup.throttle();
            wire._recvThrottle = dlThrottle;
        }

        const ulGroup = this.uploadThrottleMap.get(infoHash);
        if (ulGroup && ulGroup.getEnabled()) {
            const ulThrottle = ulGroup.throttle();
            wire._sendThrottle = ulThrottle;
        }
    }

    /**
     * Cria, atualiza ou desabilita um ThrottleGroup para um torrent específico.
     * - kbps > 0: cria ou atualiza o ThrottleGroup com rate = kbps * 1024 bytes/s
     * - kbps === 0: desabilita o ThrottleGroup (enabled: false)
     */
    private _setTorrentThrottle(
        infoHash: string,
        kbps: number,
        throttleMap: Map<string, ThrottleGroup>,
    ): void {
        const existing = throttleMap.get(infoHash);

        if (kbps > 0) {
            const rateBytes = kbps * 1024;
            if (existing) {
                // Atualizar taxa do ThrottleGroup existente
                existing.setRate(rateBytes);
                existing.setEnabled(true);
            } else {
                // Criar novo ThrottleGroup
                const group = new ThrottleGroup({ rate: rateBytes, enabled: true });
                throttleMap.set(infoHash, group);
            }
        } else {
            // kbps === 0: desabilitar throttle
            if (existing) {
                existing.setEnabled(false);
            }
        }
    }

    /** Remove e destrói os ThrottleGroups associados a um torrent */
    private _cleanupThrottleGroups(infoHash: string): void {
        const dlGroup = this.downloadThrottleMap.get(infoHash);
        if (dlGroup) {
            dlGroup.destroy();
            this.downloadThrottleMap.delete(infoHash);
        }

        const ulGroup = this.uploadThrottleMap.get(infoHash);
        if (ulGroup) {
            ulGroup.destroy();
            this.uploadThrottleMap.delete(infoHash);
        }
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
