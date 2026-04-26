import { EventEmitter } from 'events';
import { existsSync, accessSync, constants as fsConstants } from 'fs';
import type { TorrentEngine, TorrentInfo } from './torrentEngine';
import type { SettingsManager } from './settingsManager';
import type {
    DownloadItem,
    PersistedDownloadItem,
    TorrentFileInfo,
    TorrentStatus,
} from '../shared/types';
import { DEFAULT_MAX_CONCURRENT_DOWNLOADS, calcularLimiteEfetivo } from '../shared/validators';
import { logger as defaultLogger } from './logger';
import type { Logger } from './logger';

export type { DownloadItem, PersistedDownloadItem } from '../shared/types';

export interface DownloadManager {
    addTorrentFile(filePath: string): Promise<DownloadItem>;
    addMagnetLink(magnetUri: string): Promise<DownloadItem>;
    pause(infoHash: string): Promise<void>;
    resume(infoHash: string): Promise<void>;
    remove(infoHash: string, deleteFiles: boolean): Promise<void>;
    getAll(): DownloadItem[];
    setFileSelection(infoHash: string, selectedIndices: number[]): TorrentFileInfo[];
    restoreSession(): Promise<void>;
    persistSession(): void;
    /** Atualiza o limite de downloads simultâneos e processa a fila */
    setMaxConcurrentDownloads(max: number): void;
    /** Define limites individuais de velocidade para um torrent */
    setTorrentSpeedLimits(
        infoHash: string,
        downloadLimitKBps: number,
        uploadLimitKBps: number,
    ): DownloadItem;
    /** Retorna os limites individuais de velocidade de um torrent */
    getTorrentSpeedLimits(infoHash: string): {
        downloadSpeedLimitKBps: number;
        uploadSpeedLimitKBps: number;
    };
    /** Recalcula o limite efetivo de todos os torrents com limite individual ao alterar o limite global */
    onGlobalSpeedLimitChanged(): void;
    /** Retenta um download que está em status 'error' ou 'metadata-failed' */
    retryDownload(infoHash: string): Promise<DownloadItem>;
    on(event: 'update', listener: (item: DownloadItem) => void): void;
    on(event: 'remove', listener: (infoHash: string) => void): void;
    removeListener(event: 'update', listener: (item: DownloadItem) => void): void;
    removeListener(event: 'remove', listener: (infoHash: string) => void): void;
}

// ─── Store interface (subset used by DownloadManager) ─────────────────────────

/**
 * Minimal interface for the persisted store, allowing injection of a mock in tests.
 */
export interface PersistedStore {
    get(key: 'downloads'): PersistedDownloadItem[] | undefined;
    get(key: 'downloadsSchemaVersion'): number | undefined;
    set(key: 'downloads', value: PersistedDownloadItem[]): void;
    set(key: 'downloadsSchemaVersion', value: number): void;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function torrentInfoToDownloadItem(
    info: TorrentInfo,
    destinationFolder: string,
    addedAt: number,
): DownloadItem {
    return {
        infoHash: info.infoHash,
        name: info.name,
        totalSize: info.totalSize,
        downloadedSize: info.downloaded,
        progress: info.progress,
        downloadSpeed: info.downloadSpeed,
        uploadSpeed: info.uploadSpeed,
        numPeers: info.numPeers,
        numSeeders: info.numSeeders,
        timeRemaining: info.timeRemaining,
        status: info.status,
        destinationFolder,
        addedAt,
        downloadSpeedLimitKBps: 0,
        uploadSpeedLimitKBps: 0,
    };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const METADATA_TIMEOUT_MS = 60_000;

/** Versão atual do schema de downloads persistidos */
const DOWNLOADS_SCHEMA_VERSION = 1;

/** Configuração de retry com exponential backoff */
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1_000; // 1s, 4s, 16s (base^attempt²)

/** Intervalo de limpeza periódica de recursos órfãos (5 minutos) */
const ORPHAN_CLEANUP_INTERVAL_MS = 5 * 60 * 1_000;

// ─── Folder validation ────────────────────────────────────────────────────────

/**
 * Validates that the given folder path exists and is writable.
 * Throws an Error with a descriptive message if validation fails.
 */
function validateDestinationFolder(folderPath: string): void {
    if (!existsSync(folderPath)) {
        throw new Error('Pasta inválida ou sem permissão de escrita');
    }
    try {
        accessSync(folderPath, fsConstants.W_OK);
    } catch {
        throw new Error('Pasta inválida ou sem permissão de escrita');
    }
}

// ─── Implementation ───────────────────────────────────────────────────────────

class DownloadManagerImpl extends EventEmitter implements DownloadManager {
    private readonly items = new Map<string, DownloadItem>();
    /** Pending metadata-resolution timers keyed by infoHash */
    private readonly metadataTimers = new Map<string, ReturnType<typeof setTimeout>>();
    /** Tracks selected file indices per torrent for persistence */
    private readonly selectedFileIndicesMap = new Map<string, number[]>();
    /** Fila ordenada de infoHashes aguardando slot de download */
    private readonly queue: string[] = [];
    /** Limite de downloads simultâneos */
    private maxConcurrent: number;
    /** Tracks magnet URIs for queued items that need to be added to the engine later */
    private readonly queuedMagnetUris = new Map<string, string>();
    /** Limites individuais de velocidade por torrent */
    private readonly speedLimitsMap = new Map<
        string,
        { downloadSpeedLimitKBps: number; uploadSpeedLimitKBps: number }
    >();
    private readonly engine: TorrentEngine;
    private readonly settings: SettingsManager;
    private readonly store: PersistedStore | undefined;
    private readonly log: Logger;
    /** Timer de limpeza periódica de recursos órfãos */
    private readonly cleanupTimer: ReturnType<typeof setInterval> | null;

    constructor(
        engine: TorrentEngine,
        settings: SettingsManager,
        store?: PersistedStore,
        log?: Logger,
        options?: { disableCleanupTimer?: boolean },
    ) {
        super();
        // Evitar warnings de memory leak — o ipcHandler e notificationManager
        // registram listeners de 'update' e 'remove' por janela.
        this.setMaxListeners(0);
        this.engine = engine;
        this.settings = settings;
        this.store = store;
        this.log = log ?? defaultLogger;
        this.maxConcurrent =
            settings.get().maxConcurrentDownloads ?? DEFAULT_MAX_CONCURRENT_DOWNLOADS;

        // Limpeza periódica de recursos órfãos (5 minutos).
        // Desabilitável em testes para evitar interferência com fake timers.
        // unref() permite que o timer não impeça o encerramento do processo.
        if (options?.disableCleanupTimer) {
            this.cleanupTimer = null;
        } else {
            this.cleanupTimer = setInterval(
                () => this._cleanupOrphans(),
                ORPHAN_CLEANUP_INTERVAL_MS,
            );
            this.cleanupTimer.unref();
        }

        // Subscribe to engine events
        this.engine.on('progress', (info: TorrentInfo) => {
            const existing = this.items.get(info.infoHash);
            if (!existing) return;

            // Ignorar eventos de progresso para downloads já concluídos.
            // O WebTorrent continua emitindo 'download'/'upload' mesmo após
            // marcarmos como completed (porque o torrent inteiro pode não ter
            // terminado). Sem este guard, a detecção de conclusão por arquivos
            // selecionados dispara repetidamente.
            if (existing.status === 'completed') return;

            // Detect metadata resolution: resolving-metadata → downloading
            // When this transition happens, clear the 60s timeout and update
            // name + totalSize from the now-resolved metadata.
            const wasResolvingMetadata = existing.status === 'resolving-metadata';
            const isNowDownloading = info.status === 'downloading';

            if (wasResolvingMetadata && isNowDownloading) {
                this._clearMetadataTimer(info.infoHash);
            }

            // Recalculate progress and totalSize based on selected files
            let totalSize =
                wasResolvingMetadata && isNowDownloading ? info.totalSize : existing.totalSize;
            let downloadedSize = info.downloaded;
            let progress = info.progress;
            let selectedFileCount = existing.selectedFileCount;
            let totalFileCount = existing.totalFileCount;

            try {
                const files = this.engine.getFiles(info.infoHash);
                if (files.length > 0) {
                    const selectedFiles = files.filter((f) => f.selected);
                    totalFileCount = files.length;
                    selectedFileCount = selectedFiles.length;

                    if (selectedFiles.length > 0) {
                        totalSize = selectedFiles.reduce((sum, f) => sum + f.length, 0);
                        downloadedSize = selectedFiles.reduce((sum, f) => sum + f.downloaded, 0);
                        progress = totalSize > 0 ? downloadedSize / totalSize : 0;
                    }
                }
            } catch {
                // getFiles pode falhar se o torrent ainda não está no engine (ex: resolving-metadata)
            }

            // Detectar conclusão baseada nos arquivos selecionados:
            // O WebTorrent só emite 'done' quando TODOS os arquivos do torrent
            // são baixados. Quando o usuário desmarca arquivos, o 'done' nunca
            // dispara. Verificamos manualmente se todos os selecionados já foram
            // baixados (progress >= 1) e o torrent está ativo.
            const selectedFilesComplete =
                totalSize > 0 && downloadedSize >= totalSize && info.status === 'downloading';

            if (selectedFilesComplete) {
                const completedAt = Date.now();
                const elapsedMs = completedAt - existing.addedAt;
                const completed: DownloadItem = {
                    ...existing,
                    name: wasResolvingMetadata && isNowDownloading ? info.name : existing.name,
                    totalSize,
                    downloadedSize,
                    progress: 1,
                    downloadSpeed: 0,
                    uploadSpeed: 0,
                    numPeers: info.numPeers,
                    numSeeders: info.numSeeders,
                    timeRemaining: 0,
                    status: 'completed',
                    selectedFileCount,
                    totalFileCount,
                    completedAt,
                    elapsedMs,
                };
                this.items.set(info.infoHash, completed);
                this.emit('update', completed);

                // Liberar slot para a fila
                this._processQueue();
                return;
            }

            const updated: DownloadItem = {
                ...existing,
                // Update name when metadata becomes available
                name: wasResolvingMetadata && isNowDownloading ? info.name : existing.name,
                totalSize,
                downloadedSize,
                progress,
                downloadSpeed: info.downloadSpeed,
                uploadSpeed: info.uploadSpeed,
                numPeers: info.numPeers,
                numSeeders: info.numSeeders,
                timeRemaining: info.timeRemaining,
                status: info.status,
                selectedFileCount,
                totalFileCount,
            };
            this.items.set(info.infoHash, updated);
            this.emit('update', updated);
        });

        this.engine.on('done', (infoHash: string) => {
            const existing = this.items.get(infoHash);
            if (!existing) return;

            this._clearMetadataTimer(infoHash);
            const completedAt = Date.now();
            const elapsedMs = completedAt - existing.addedAt;
            const updated: DownloadItem = {
                ...existing,
                status: 'completed',
                progress: 1,
                completedAt,
                elapsedMs,
            };
            this.items.set(infoHash, updated);
            this.emit('update', updated);

            // Um slot foi liberado — processar a fila
            this._processQueue();
        });

        this.engine.on('error', (infoHash: string, err: Error) => {
            this.log.error('[DownloadManager] Torrent error:', infoHash, err.message);

            const existing = this.items.get(infoHash);
            if (!existing) return;

            this._clearMetadataTimer(infoHash);
            const updated: DownloadItem = {
                ...existing,
                status: 'error',
                errorMessage: err.message,
            };
            this.items.set(infoHash, updated);
            this.emit('update', updated);

            // Um slot foi liberado — processar a fila
            this._processQueue();
        });
    }

    // ── addTorrentFile ──────────────────────────────────────────────────────────

    async addTorrentFile(filePath: string): Promise<DownloadItem> {
        const destinationFolder = this.settings.get().destinationFolder;
        validateDestinationFolder(destinationFolder);

        const info = await this.engine.addTorrentFile(filePath);

        // Duplicate detection: check if infoHash already exists
        const existing = this.items.get(info.infoHash);
        if (existing) {
            throw new Error('Torrent já existe na lista');
        }

        const addedAt = Date.now();

        // Verificar se há slots disponíveis
        if (this._activeCount() < this.maxConcurrent) {
            const item = torrentInfoToDownloadItem(info, destinationFolder, addedAt);
            this.items.set(item.infoHash, item);
            this.emit('update', item);

            // Aplicar trackers globais automaticamente (não bloqueia o retorno)
            this._applyGlobalTrackers(item.infoHash);

            return item;
        }

        // Sem slots — pausar imediatamente e enfileirar
        await this.engine.pause(info.infoHash);

        const item: DownloadItem = {
            ...torrentInfoToDownloadItem(info, destinationFolder, addedAt),
            status: 'queued',
        };

        this.items.set(item.infoHash, item);
        this.queue.push(item.infoHash);
        this.emit('update', item);

        return item;
    }

    // ── addMagnetLink ───────────────────────────────────────────────────────────

    async addMagnetLink(magnetUri: string): Promise<DownloadItem> {
        // Validate destination folder before starting the transfer
        const destinationFolder = this.settings.get().destinationFolder;
        validateDestinationFolder(destinationFolder);

        // Extract infoHash from magnet URI for early duplicate detection
        const hashMatch = magnetUri.match(/xt=urn:btih:([a-fA-F0-9]{40})/i);
        if (hashMatch) {
            const infoHash = hashMatch[1].toLowerCase();
            if (this.items.has(infoHash)) {
                throw new Error('Torrent já existe na lista');
            }
        }

        // Verificar se há slots disponíveis
        const hasSlot = this._activeCount() < this.maxConcurrent;

        // Para magnet links sem slot, enfileirar sem adicionar ao engine
        // (evita resolver metadados desnecessariamente)
        if (!hasSlot && hashMatch) {
            const infoHash = hashMatch[1].toLowerCase();
            const addedAt = Date.now();
            const item: DownloadItem = {
                infoHash,
                name: infoHash,
                totalSize: 0,
                downloadedSize: 0,
                progress: 0,
                downloadSpeed: 0,
                uploadSpeed: 0,
                numPeers: 0,
                numSeeders: 0,
                timeRemaining: Infinity,
                status: 'queued',
                destinationFolder,
                addedAt,
                downloadSpeedLimitKBps: 0,
                uploadSpeedLimitKBps: 0,
            };

            this.items.set(item.infoHash, item);
            this.queuedMagnetUris.set(item.infoHash, magnetUri);
            this.queue.push(item.infoHash);
            this.emit('update', item);

            return item;
        }

        const info = await this.engine.addMagnetLink(magnetUri);

        // Post-add duplicate check (in case infoHash wasn't extractable before)
        const existing = this.items.get(info.infoHash);
        if (existing) {
            throw new Error('Torrent já existe na lista');
        }

        const addedAt = Date.now();

        if (hasSlot) {
            // Se o engine já resolveu os metadados (status 'downloading'),
            // usar esse status diretamente. Caso contrário, iniciar como
            // 'resolving-metadata' com timeout de 60s.
            const initialStatus =
                info.status === 'downloading' ? 'downloading' : 'resolving-metadata';
            const item: DownloadItem = {
                ...torrentInfoToDownloadItem(info, destinationFolder, addedAt),
                status: initialStatus,
            };

            this.items.set(item.infoHash, item);
            this.emit('update', item);

            // Só iniciar o timer de metadados se ainda estiver resolvendo
            if (initialStatus === 'resolving-metadata') {
                this._startMetadataTimer(item.infoHash);
            }

            // Aplicar trackers globais automaticamente (não bloqueia o retorno)
            this._applyGlobalTrackers(item.infoHash);

            return item;
        }

        // Sem slots e não conseguimos extrair o hash antes — pausar e enfileirar
        await this.engine.pause(info.infoHash);

        const item: DownloadItem = {
            ...torrentInfoToDownloadItem(info, destinationFolder, addedAt),
            status: 'queued',
        };

        this.items.set(item.infoHash, item);
        this.queue.push(item.infoHash);
        this.emit('update', item);

        return item;
    }

    // ── pause ───────────────────────────────────────────────────────────────────

    async pause(infoHash: string): Promise<void> {
        const existing = this.items.get(infoHash);

        // Se o item está na fila, apenas removê-lo da fila (não está no engine)
        if (existing && existing.status === 'queued') {
            const queueIdx = this.queue.indexOf(infoHash);
            if (queueIdx !== -1) {
                this.queue.splice(queueIdx, 1);
            }

            // Se o item está no engine (foi pausado ao enfileirar), pausar lá também
            // Se é um magnet enfileirado sem engine, apenas atualizar o status
            if (!this.queuedMagnetUris.has(infoHash)) {
                try {
                    await this.engine.pause(infoHash);
                } catch (pauseErr) {
                    this.log.warn(
                        '[DownloadManager] Falha ao pausar item enfileirado:',
                        infoHash,
                        (pauseErr as Error).message,
                    );
                }
            }

            const updated: DownloadItem = { ...existing, status: 'paused' };
            this.items.set(infoHash, updated);
            this.emit('update', updated);
            return;
        }

        await this.engine.pause(infoHash);

        if (existing) {
            const updated: DownloadItem = { ...existing, status: 'paused' };
            this.items.set(infoHash, updated);
            this.emit('update', updated);
        }

        // Um slot foi liberado — processar a fila
        this._processQueue();
    }

    // ── resume ──────────────────────────────────────────────────────────────────

    async resume(infoHash: string): Promise<void> {
        const existing = this.items.get(infoHash);
        if (!existing) {
            throw new Error(`Torrent não encontrado: ${infoHash}`);
        }

        // Se não há slots disponíveis, enfileirar em vez de retomar
        if (this._activeCount() >= this.maxConcurrent) {
            // Já está na fila? Não fazer nada
            if (existing.status === 'queued') return;

            const updated: DownloadItem = { ...existing, status: 'queued' };
            this.items.set(infoHash, updated);
            if (!this.queue.includes(infoHash)) {
                this.queue.push(infoHash);
            }
            this.emit('update', updated);
            return;
        }

        // Se é um magnet enfileirado que nunca foi adicionado ao engine
        if (this.queuedMagnetUris.has(infoHash)) {
            const magnetUri = this.queuedMagnetUris.get(infoHash)!;
            this.queuedMagnetUris.delete(infoHash);

            // Remover da fila
            const queueIdx = this.queue.indexOf(infoHash);
            if (queueIdx !== -1) this.queue.splice(queueIdx, 1);

            const info = await this.engine.addMagnetLink(magnetUri);

            const updated: DownloadItem = {
                ...existing,
                name: info.name || existing.name,
                totalSize: info.totalSize || existing.totalSize,
                status: 'resolving-metadata',
            };
            this.items.set(infoHash, updated);
            this.emit('update', updated);

            // Start metadata timeout
            this._startMetadataTimer(infoHash);
            return;
        }

        // Remover da fila se estava lá
        const queueIdx = this.queue.indexOf(infoHash);
        if (queueIdx !== -1) this.queue.splice(queueIdx, 1);

        await this.engine.resume(infoHash);

        const updated: DownloadItem = { ...existing, status: 'downloading' };
        this.items.set(infoHash, updated);
        this.emit('update', updated);
    }

    // ── setFileSelection ───────────────────────────────────────────────────────

    setFileSelection(infoHash: string, selectedIndices: number[]): TorrentFileInfo[] {
        const updatedFiles = this.engine.setFileSelection(infoHash, selectedIndices);

        // Track selected indices for persistence
        this.selectedFileIndicesMap.set(infoHash, [...selectedIndices]);

        // Update the DownloadItem with file selection info
        const existing = this.items.get(infoHash);
        if (existing) {
            const selectedFiles = updatedFiles.filter((f) => f.selected);
            const totalSize = selectedFiles.reduce((sum, f) => sum + f.length, 0);
            const downloadedSize = selectedFiles.reduce((sum, f) => sum + f.downloaded, 0);
            const progress = totalSize > 0 ? downloadedSize / totalSize : 0;

            const updated: DownloadItem = {
                ...existing,
                totalSize,
                downloadedSize,
                progress,
                selectedFileCount: selectedFiles.length,
                totalFileCount: updatedFiles.length,
            };
            this.items.set(infoHash, updated);
            this.emit('update', updated);
        }

        return updatedFiles;
    }

    // ── retryDownload ─────────────────────────────────────────────────────────

    async retryDownload(infoHash: string): Promise<DownloadItem> {
        const existing = this.items.get(infoHash);
        if (!existing) {
            throw new Error(`Torrent não encontrado: ${infoHash}`);
        }

        // Só permite retry de downloads em estado de erro
        if (existing.status !== 'error' && existing.status !== 'metadata-failed') {
            throw new Error(`Torrent não está em estado de erro: ${existing.status}`);
        }

        this.log.info('[DownloadManager] Retentando download:', infoHash, existing.name);

        // Limpar estado de erro
        const retrying: DownloadItem = {
            ...existing,
            status: 'queued',
            errorMessage: undefined,
        };
        this.items.set(infoHash, retrying);
        this.emit('update', retrying);

        // Tentar remover do engine (pode já ter sido removido)
        try {
            await this.engine.remove(infoHash, false);
        } catch {
            // Pode não estar no engine — ok
        }

        // Se há um magnet URI persistido, usar para re-adicionar
        const magnetUri = this.queuedMagnetUris.get(infoHash);
        if (magnetUri) {
            this.queuedMagnetUris.delete(infoHash);
        }

        // Verificar se há slots disponíveis
        if (this._activeCount() >= this.maxConcurrent) {
            // Sem slots — enfileirar
            if (!this.queue.includes(infoHash)) {
                this.queue.push(infoHash);
            }
            if (magnetUri) {
                this.queuedMagnetUris.set(infoHash, magnetUri);
            }
            this.emit('update', retrying);
            return retrying;
        }

        // Há slots — tentar re-adicionar com exponential backoff
        return this._retryWithBackoff(infoHash, retrying, magnetUri);
    }

    /**
     * Tenta re-adicionar um torrent ao engine com exponential backoff.
     * Faz até RETRY_MAX_ATTEMPTS tentativas com delays crescentes (1s, 4s, 16s).
     * Se todas falharem, marca o item como 'error' com a mensagem da última falha.
     */
    private async _retryWithBackoff(
        infoHash: string,
        retrying: DownloadItem,
        magnetUri: string | undefined,
    ): Promise<DownloadItem> {
        let lastError: string = '';

        for (let attempt = 0; attempt < RETRY_MAX_ATTEMPTS; attempt++) {
            // Delay com exponential backoff (0ms na primeira tentativa)
            if (attempt > 0) {
                const delayMs = RETRY_BASE_DELAY_MS * Math.pow(4, attempt - 1);
                this.log.info(
                    `[DownloadManager] Retry tentativa ${attempt + 1}/${RETRY_MAX_ATTEMPTS}`,
                    `aguardando ${delayMs}ms`,
                    infoHash,
                );
                await new Promise((resolve) => setTimeout(resolve, delayMs));

                // Verificar se o item ainda existe e está em estado retentável
                const current = this.items.get(infoHash);
                if (!current || (current.status !== 'queued' && current.status !== 'error')) {
                    // Item foi removido ou mudou de estado durante o delay — abortar
                    return current ?? retrying;
                }
            }

            if (magnetUri) {
                try {
                    const info = await this.engine.addMagnetLink(magnetUri);
                    const updated: DownloadItem = {
                        ...retrying,
                        name: info.name || retrying.name,
                        totalSize: info.totalSize || retrying.totalSize,
                        status:
                            info.status === 'downloading' ? 'downloading' : 'resolving-metadata',
                    };
                    this.items.set(infoHash, updated);
                    this.emit('update', updated);

                    if (updated.status === 'resolving-metadata') {
                        this._startMetadataTimer(infoHash);
                    }

                    this._applyGlobalTrackers(infoHash);
                    return updated;
                } catch (err) {
                    lastError = (err as Error).message;
                    this.log.warn(
                        `[DownloadManager] Retry tentativa ${attempt + 1}/${RETRY_MAX_ATTEMPTS} falhou:`,
                        infoHash,
                        lastError,
                    );
                }
            } else {
                // Sem magnet URI — tentar retomar via engine.resume
                try {
                    await this.engine.resume(infoHash);
                    const updated: DownloadItem = { ...retrying, status: 'downloading' };
                    this.items.set(infoHash, updated);
                    this.emit('update', updated);
                    return updated;
                } catch (err) {
                    lastError = (err as Error).message;
                    this.log.warn(
                        `[DownloadManager] Retry tentativa ${attempt + 1}/${RETRY_MAX_ATTEMPTS} falhou (resume):`,
                        infoHash,
                        lastError,
                    );
                }
            }
        }

        // Todas as tentativas falharam
        this.log.error(
            `[DownloadManager] Retry esgotado após ${RETRY_MAX_ATTEMPTS} tentativas:`,
            infoHash,
            lastError,
        );
        const errItem: DownloadItem = {
            ...retrying,
            status: 'error',
            errorMessage: lastError,
        };
        this.items.set(infoHash, errItem);
        this.emit('update', errItem);
        return errItem;
    }

    // ── remove ──────────────────────────────────────────────────────────────────

    async remove(infoHash: string, deleteFiles: boolean): Promise<void> {
        const wasActive = this._isActiveStatus(this.items.get(infoHash)?.status);
        const wasQueued = this.items.get(infoHash)?.status === 'queued';
        const hadQueuedMagnet = this.queuedMagnetUris.has(infoHash);

        // Remover da fila se estava lá
        const queueIdx = this.queue.indexOf(infoHash);
        if (queueIdx !== -1) this.queue.splice(queueIdx, 1);

        // Limpar referências de magnet enfileirados
        this.queuedMagnetUris.delete(infoHash);

        // Se era um magnet enfileirado que nunca foi adicionado ao engine, não chamar engine.remove
        if (!(wasQueued && hadQueuedMagnet)) {
            try {
                await this.engine.remove(infoHash, deleteFiles);
            } catch (removeErr) {
                this.log.warn(
                    '[DownloadManager] Falha ao remover do engine:',
                    infoHash,
                    (removeErr as Error).message,
                );
            }
        }

        this._clearMetadataTimer(infoHash);
        this.selectedFileIndicesMap.delete(infoHash);
        this.speedLimitsMap.delete(infoHash);
        this.items.delete(infoHash);
        this.emit('remove', infoHash);

        // Se um download ativo foi removido, processar a fila
        if (wasActive) {
            this._processQueue();
        }
    }

    // ── getAll ──────────────────────────────────────────────────────────────────

    getAll(): DownloadItem[] {
        const items = Array.from(this.items.values());
        return items.map((item) => {
            // Enriquecer com limites individuais do speedLimitsMap
            const limits = this.speedLimitsMap.get(item.infoHash);
            const enriched: DownloadItem = limits
                ? {
                    ...item,
                    downloadSpeedLimitKBps: limits.downloadSpeedLimitKBps,
                    uploadSpeedLimitKBps: limits.uploadSpeedLimitKBps,
                }
                : item;

            // Enrich with file count info if available
            try {
                const files = this.engine.getFiles(enriched.infoHash);
                if (files.length > 0) {
                    const selectedFiles = files.filter((f) => f.selected);
                    return {
                        ...enriched,
                        selectedFileCount: selectedFiles.length,
                        totalFileCount: files.length,
                    };
                }
            } catch {
                // getFiles pode falhar — retornar item sem enriquecimento
            }
            return enriched;
        });
    }

    // ── restoreSession ──────────────────────────────────────────────────────────

    async restoreSession(): Promise<void> {
        if (!this.store) return;

        // ── Migração de schema ────────────────────────────────────────────────
        // Verifica a versão do schema persistido e aplica migrações se necessário.
        // Dados sem versão (legado) são tratados como versão 1 (formato atual).
        const persistedVersion = this.store.get('downloadsSchemaVersion') ?? 1;

        if (persistedVersion > DOWNLOADS_SCHEMA_VERSION) {
            this.log.warn(
                '[DownloadManager] Schema de downloads mais recente que o esperado:',
                `persistido=${persistedVersion}`,
                `atual=${DOWNLOADS_SCHEMA_VERSION}`,
                '— tentando carregar mesmo assim',
            );
        }

        // Migrações futuras seriam aplicadas aqui:
        // if (persistedVersion < 2) { migrateV1toV2(store); }
        // if (persistedVersion < 3) { migrateV2toV3(store); }

        const persisted = this.store.get('downloads') ?? [];

        for (const persistedItem of persisted) {
            // ── Validação de integridade dos dados persistidos ─────────────────
            // Rejeita itens com campos obrigatórios inválidos ou corrompidos.
            if (
                typeof persistedItem.infoHash !== 'string' ||
                persistedItem.infoHash.length !== 40
            ) {
                this.log.warn(
                    '[DownloadManager] Item persistido com infoHash inválido, ignorando:',
                    String(persistedItem.infoHash),
                );
                continue;
            }

            const validStatuses: TorrentStatus[] = [
                'queued',
                'resolving-metadata',
                'downloading',
                'paused',
                'completed',
                'error',
                'metadata-failed',
                'files-not-found',
            ];
            if (!validStatuses.includes(persistedItem.status)) {
                this.log.warn(
                    '[DownloadManager] Item persistido com status inválido, ignorando:',
                    persistedItem.infoHash,
                    String(persistedItem.status),
                );
                continue;
            }

            if (
                persistedItem.magnetUri !== undefined &&
                (typeof persistedItem.magnetUri !== 'string' ||
                    !persistedItem.magnetUri.startsWith('magnet:'))
            ) {
                this.log.warn(
                    '[DownloadManager] Item persistido com magnetUri inválido, ignorando:',
                    persistedItem.infoHash,
                );
                continue;
            }

            if (
                persistedItem.torrentFilePath !== undefined &&
                (typeof persistedItem.torrentFilePath !== 'string' ||
                    persistedItem.torrentFilePath.length === 0)
            ) {
                this.log.warn(
                    '[DownloadManager] Item persistido com torrentFilePath inválido, ignorando:',
                    persistedItem.infoHash,
                );
                continue;
            }

            // Check if destination folder exists
            const folderExists = existsSync(persistedItem.destinationFolder);

            let status: TorrentStatus = persistedItem.status;
            if (!folderExists && persistedItem.status !== 'completed') {
                status = 'files-not-found';
            }

            // Restore the item into the in-memory map
            // Restaurar limites individuais de velocidade do item persistido
            const restoredDl = persistedItem.downloadSpeedLimitKBps ?? 0;
            const restoredUl = persistedItem.uploadSpeedLimitKBps ?? 0;

            const item: DownloadItem = {
                infoHash: persistedItem.infoHash,
                name: persistedItem.name,
                totalSize: persistedItem.totalSize,
                downloadedSize: persistedItem.downloadedSize,
                progress: persistedItem.progress,
                downloadSpeed: 0,
                uploadSpeed: 0,
                numPeers: 0,
                numSeeders: 0,
                timeRemaining: Infinity,
                status,
                destinationFolder: persistedItem.destinationFolder,
                addedAt: persistedItem.addedAt,
                completedAt: persistedItem.completedAt,
                elapsedMs: persistedItem.elapsedMs,
                downloadSpeedLimitKBps: restoredDl,
                uploadSpeedLimitKBps: restoredUl,
                errorMessage: persistedItem.errorMessage,
            };

            this.items.set(item.infoHash, item);
            this.emit('update', item);

            // Popular o speedLimitsMap com os limites restaurados
            if (restoredDl > 0 || restoredUl > 0) {
                this.speedLimitsMap.set(item.infoHash, {
                    downloadSpeedLimitKBps: restoredDl,
                    uploadSpeedLimitKBps: restoredUl,
                });
            }

            // Restore selected file indices into the map for later persistence
            if (persistedItem.selectedFileIndices) {
                this.selectedFileIndicesMap.set(item.infoHash, [
                    ...persistedItem.selectedFileIndices,
                ]);
            }

            // Auto-resume items that were downloading; re-queue items that were queued
            if (persistedItem.status === 'queued' && folderExists) {
                // Restaurar como queued — adicionar à fila sem iniciar
                const queued: DownloadItem = { ...item, status: 'queued' };
                this.items.set(item.infoHash, queued);

                if (persistedItem.magnetUri) {
                    this.queuedMagnetUris.set(item.infoHash, persistedItem.magnetUri);
                }

                this.queue.push(item.infoHash);
                this.emit('update', queued);
                continue;
            }

            const shouldResume = persistedItem.status === 'downloading' && folderExists;

            if (shouldResume) {
                // Verificar se há slots disponíveis
                // Nota: o item já está no mapa com status 'downloading' da sessão anterior,
                // mas ainda não foi adicionado ao engine. Não contá-lo como ativo.
                const activeExcludingSelf = this._activeCountExcluding(item.infoHash);
                if (activeExcludingSelf >= this.maxConcurrent) {
                    // Sem slots — enfileirar
                    const queued: DownloadItem = { ...item, status: 'queued' };
                    this.items.set(item.infoHash, queued);

                    // Guardar a referência para retomar depois
                    if (persistedItem.magnetUri) {
                        this.queuedMagnetUris.set(item.infoHash, persistedItem.magnetUri);
                    }

                    this.queue.push(item.infoHash);
                    this.emit('update', queued);
                    continue;
                }

                try {
                    // Re-add to engine using magnetUri or torrentFilePath
                    if (persistedItem.magnetUri) {
                        await this.engine.addMagnetLink(persistedItem.magnetUri);
                    } else if (persistedItem.torrentFilePath) {
                        await this.engine.addTorrentFile(persistedItem.torrentFilePath);
                    }

                    // Reapply file selection if persisted (ignoring invalid indices)
                    if (
                        persistedItem.selectedFileIndices &&
                        persistedItem.selectedFileIndices.length > 0
                    ) {
                        try {
                            const files = this.engine.getFiles(item.infoHash);
                            const maxIndex = files.length;
                            const validIndices = persistedItem.selectedFileIndices.filter(
                                (idx) => idx >= 0 && idx < maxIndex,
                            );
                            if (validIndices.length > 0) {
                                this.engine.setFileSelection(item.infoHash, validIndices);
                                this.selectedFileIndicesMap.set(item.infoHash, validIndices);
                            }
                        } catch (selectionErr) {
                            this.log.warn(
                                '[DownloadManager] Falha ao reaplicar seleção de arquivos:',
                                item.infoHash,
                                (selectionErr as Error).message,
                            );
                        }
                    }

                    // Update status to downloading after successful re-add
                    const updated: DownloadItem = { ...item, status: 'downloading' };
                    this.items.set(item.infoHash, updated);
                    this.emit('update', updated);

                    // Reaplicar limites individuais de velocidade ao engine
                    const restoredLimits = this.speedLimitsMap.get(item.infoHash);
                    if (restoredLimits) {
                        const globalSettings = this.settings.get();
                        const effectiveDl = calcularLimiteEfetivo(
                            restoredLimits.downloadSpeedLimitKBps,
                            globalSettings.downloadSpeedLimit,
                        );
                        const effectiveUl = calcularLimiteEfetivo(
                            restoredLimits.uploadSpeedLimitKBps,
                            globalSettings.uploadSpeedLimit,
                        );
                        this.engine.setTorrentDownloadSpeedLimit(item.infoHash, effectiveDl);
                        this.engine.setTorrentUploadSpeedLimit(item.infoHash, effectiveUl);
                    }
                } catch (restoreErr) {
                    // Falha ao re-adicionar — marcar como erro com mensagem
                    const errMsg = (restoreErr as Error).message;
                    this.log.error(
                        '[DownloadManager] Falha ao restaurar torrent:',
                        item.infoHash,
                        errMsg,
                    );
                    const errItem: DownloadItem = {
                        ...item,
                        status: 'error',
                        errorMessage: errMsg,
                    };
                    this.items.set(item.infoHash, errItem);
                    this.emit('update', errItem);
                }
            }
        }
    }

    // ── persistSession ──────────────────────────────────────────────────────────

    persistSession(): void {
        if (!this.store) return;

        const items = Array.from(this.items.values());
        const persisted: PersistedDownloadItem[] = items.map((item) => {
            const limits = this.speedLimitsMap.get(item.infoHash);
            return {
                infoHash: item.infoHash,
                name: item.name,
                totalSize: item.totalSize,
                downloadedSize: item.downloadedSize,
                progress: item.progress,
                status: item.status,
                destinationFolder: item.destinationFolder,
                addedAt: item.addedAt,
                completedAt: item.completedAt,
                elapsedMs: item.elapsedMs,
                selectedFileIndices: this.selectedFileIndicesMap.get(item.infoHash),
                magnetUri: this.queuedMagnetUris.get(item.infoHash),
                downloadSpeedLimitKBps: limits?.downloadSpeedLimitKBps,
                uploadSpeedLimitKBps: limits?.uploadSpeedLimitKBps,
                errorMessage: item.errorMessage,
            };
        });

        this.store.set('downloads', persisted);
        this.store.set('downloadsSchemaVersion', DOWNLOADS_SCHEMA_VERSION);
    }

    // ── setMaxConcurrentDownloads ───────────────────────────────────────────────

    setMaxConcurrentDownloads(max: number): void {
        this.maxConcurrent = max;
        // Se o novo limite é maior, processar a fila para iniciar downloads pendentes
        this._processQueue();
    }

    // ── setTorrentSpeedLimits ───────────────────────────────────────────────────

    setTorrentSpeedLimits(
        infoHash: string,
        downloadLimitKBps: number,
        uploadLimitKBps: number,
    ): DownloadItem {
        const existing = this.items.get(infoHash);
        if (!existing) {
            throw new Error('Torrent não encontrado');
        }

        // Armazenar limites individuais no mapa
        this.speedLimitsMap.set(infoHash, {
            downloadSpeedLimitKBps: downloadLimitKBps,
            uploadSpeedLimitKBps: uploadLimitKBps,
        });

        // Calcular limites efetivos considerando o limite global
        const globalSettings = this.settings.get();
        const effectiveDl = calcularLimiteEfetivo(
            downloadLimitKBps,
            globalSettings.downloadSpeedLimit,
        );
        const effectiveUl = calcularLimiteEfetivo(uploadLimitKBps, globalSettings.uploadSpeedLimit);

        // Aplicar no engine
        this.engine.setTorrentDownloadSpeedLimit(infoHash, effectiveDl);
        this.engine.setTorrentUploadSpeedLimit(infoHash, effectiveUl);

        // Atualizar o DownloadItem com os limites individuais
        const updated: DownloadItem = {
            ...existing,
            downloadSpeedLimitKBps: downloadLimitKBps,
            uploadSpeedLimitKBps: uploadLimitKBps,
        };
        this.items.set(infoHash, updated);
        this.emit('update', updated);

        return updated;
    }

    // ── getTorrentSpeedLimits ───────────────────────────────────────────────────

    getTorrentSpeedLimits(infoHash: string): {
        downloadSpeedLimitKBps: number;
        uploadSpeedLimitKBps: number;
    } {
        const limits = this.speedLimitsMap.get(infoHash);
        if (limits) {
            return { ...limits };
        }
        return { downloadSpeedLimitKBps: 0, uploadSpeedLimitKBps: 0 };
    }

    // ── onGlobalSpeedLimitChanged ───────────────────────────────────────────────

    onGlobalSpeedLimitChanged(): void {
        const globalSettings = this.settings.get();

        for (const [infoHash, limits] of this.speedLimitsMap.entries()) {
            const effectiveDl = calcularLimiteEfetivo(
                limits.downloadSpeedLimitKBps,
                globalSettings.downloadSpeedLimit,
            );
            const effectiveUl = calcularLimiteEfetivo(
                limits.uploadSpeedLimitKBps,
                globalSettings.uploadSpeedLimit,
            );

            this.engine.setTorrentDownloadSpeedLimit(infoHash, effectiveDl);
            this.engine.setTorrentUploadSpeedLimit(infoHash, effectiveUl);
        }
    }

    // ── Private helpers ─────────────────────────────────────────────────────────

    /**
     * Limpa recursos órfãos: entries em metadataTimers, speedLimitsMap,
     * selectedFileIndicesMap e queuedMagnetUris que não possuem item
     * correspondente no mapa de downloads. Isso pode acontecer se uma
     * remoção falhar parcialmente ou se houver um bug de sincronização.
     */
    private _cleanupOrphans(): void {
        let cleaned = 0;

        for (const infoHash of this.metadataTimers.keys()) {
            if (!this.items.has(infoHash)) {
                this._clearMetadataTimer(infoHash);
                cleaned++;
            }
        }

        for (const infoHash of this.speedLimitsMap.keys()) {
            if (!this.items.has(infoHash)) {
                this.speedLimitsMap.delete(infoHash);
                cleaned++;
            }
        }

        for (const infoHash of this.selectedFileIndicesMap.keys()) {
            if (!this.items.has(infoHash)) {
                this.selectedFileIndicesMap.delete(infoHash);
                cleaned++;
            }
        }

        for (const infoHash of this.queuedMagnetUris.keys()) {
            if (!this.items.has(infoHash)) {
                this.queuedMagnetUris.delete(infoHash);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.log.warn(`[DownloadManager] Limpeza periódica: ${cleaned} recurso(s) órfão(s) removido(s)`);
        }
    }

    /**
     * Aplica trackers globais automaticamente a um torrent recém-adicionado.
     * Só executa se a opção `autoApplyGlobalTrackers` estiver habilitada.
     * Erros individuais (ex: tracker duplicado) são silenciosamente ignorados
     * para não interromper a operação de adição do torrent.
     */
    private _applyGlobalTrackers(infoHash: string): void {
        try {
            const { autoApplyGlobalTrackers } = this.settings.get();
            if (!autoApplyGlobalTrackers) return;

            const globalTrackers = this.settings.getGlobalTrackers();
            if (globalTrackers.length === 0) return;

            for (const trackerUrl of globalTrackers) {
                try {
                    this.engine.addTracker(infoHash, trackerUrl);
                } catch (trackerErr) {
                    this.log.warn(
                        '[DownloadManager] Falha ao aplicar tracker global:',
                        infoHash,
                        trackerUrl,
                        (trackerErr as Error).message,
                    );
                }
            }
        } catch (err) {
            this.log.error(
                '[DownloadManager] Falha ao aplicar trackers globais:',
                infoHash,
                (err as Error).message,
            );
        }
    }

    /** Clears and removes the pending metadata-resolution timer for the given infoHash. */
    private _clearMetadataTimer(infoHash: string): void {
        const timer = this.metadataTimers.get(infoHash);
        if (timer !== undefined) {
            clearTimeout(timer);
            this.metadataTimers.delete(infoHash);
        }
    }

    /** Inicia o timer de 60s para resolução de metadados de magnet links. */
    private _startMetadataTimer(infoHash: string): void {
        const timer = setTimeout(() => {
            const current = this.items.get(infoHash);
            if (current && current.status === 'resolving-metadata') {
                const failed: DownloadItem = { ...current, status: 'metadata-failed' };
                this.items.set(infoHash, failed);
                this.metadataTimers.delete(infoHash);
                this.emit('update', failed);

                // Um slot foi liberado — processar a fila
                this._processQueue();
            }
        }, METADATA_TIMEOUT_MS);
        this.metadataTimers.set(infoHash, timer);
    }

    /** Retorna true se o status indica um download ativo (ocupando um slot). */
    private _isActiveStatus(status: TorrentStatus | undefined): boolean {
        return status === 'downloading' || status === 'resolving-metadata';
    }

    /** Conta quantos downloads estão ativos (ocupando slots). */
    private _activeCount(): number {
        let count = 0;
        for (const item of this.items.values()) {
            if (this._isActiveStatus(item.status)) {
                count++;
            }
        }
        return count;
    }

    /** Conta downloads ativos excluindo um infoHash específico (usado em restoreSession). */
    private _activeCountExcluding(excludeHash: string): number {
        let count = 0;
        for (const item of this.items.values()) {
            if (item.infoHash !== excludeHash && this._isActiveStatus(item.status)) {
                count++;
            }
        }
        return count;
    }

    /**
     * Processa a fila: inicia o próximo download enfileirado se há slots disponíveis.
     * Chamado automaticamente quando um download completa, falha, é pausado ou removido.
     */
    private _processQueue(): void {
        while (this.queue.length > 0 && this._activeCount() < this.maxConcurrent) {
            const infoHash = this.queue.shift()!;
            const item = this.items.get(infoHash);

            if (!item || item.status !== 'queued') {
                continue;
            }

            // Se é um magnet enfileirado que nunca foi adicionado ao engine
            if (this.queuedMagnetUris.has(infoHash)) {
                const magnetUri = this.queuedMagnetUris.get(infoHash)!;
                this.queuedMagnetUris.delete(infoHash);

                // Adicionar ao engine de forma assíncrona
                this.engine
                    .addMagnetLink(magnetUri)
                    .then((info) => {
                        const current = this.items.get(infoHash);
                        if (!current) return;

                        const updated: DownloadItem = {
                            ...current,
                            name: info.name || current.name,
                            totalSize: info.totalSize || current.totalSize,
                            status: 'resolving-metadata',
                        };
                        this.items.set(infoHash, updated);
                        this.emit('update', updated);

                        this._startMetadataTimer(infoHash);
                    })
                    .catch((err) => {
                        this.log.error(
                            '[DownloadManager] Falha ao iniciar torrent da fila:',
                            infoHash,
                            (err as Error).message,
                        );
                        const current = this.items.get(infoHash);
                        if (current) {
                            const errItem: DownloadItem = {
                                ...current,
                                status: 'error',
                                errorMessage: (err as Error).message,
                            };
                            this.items.set(infoHash, errItem);
                            this.emit('update', errItem);
                        }
                        // Tentar o próximo da fila
                        this._processQueue();
                    });

                continue;
            }

            // Torrent já está no engine (foi pausado ao enfileirar) — retomar
            this.engine
                .resume(infoHash)
                .then(() => {
                    const current = this.items.get(infoHash);
                    if (current) {
                        const updated: DownloadItem = { ...current, status: 'downloading' };
                        this.items.set(infoHash, updated);
                        this.emit('update', updated);
                    }
                })
                .catch((err) => {
                    this.log.error(
                        '[DownloadManager] Falha ao retomar torrent da fila:',
                        infoHash,
                        (err as Error).message,
                    );
                    const current = this.items.get(infoHash);
                    if (current) {
                        const errItem: DownloadItem = {
                            ...current,
                            status: 'error',
                            errorMessage: (err as Error).message,
                        };
                        this.items.set(infoHash, errItem);
                        this.emit('update', errItem);
                    }
                    // Tentar o próximo da fila
                    this._processQueue();
                });
        }
    }

    // ── EventEmitter overloads (type-safe) ──────────────────────────────────────

    on(event: 'update', listener: (item: DownloadItem) => void): this;
    on(event: 'remove', listener: (infoHash: string) => void): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a new DownloadManager instance.
 *
 * @param engine    TorrentEngine instance to delegate torrent operations to.
 * @param settings  SettingsManager instance to read configuration from.
 * @param store     Optional persisted store for session persistence (injectable for tests).
 * @param log       Optional logger instance (defaults to electron-log; injectable for tests).
 * @param options   Optional configuration (e.g., disableCleanupTimer for tests).
 */
export function createDownloadManager(
    engine: TorrentEngine,
    settings: SettingsManager,
    store?: PersistedStore,
    log?: Logger,
    options?: { disableCleanupTimer?: boolean },
): DownloadManager {
    return new DownloadManagerImpl(engine, settings, store, log, options);
}
