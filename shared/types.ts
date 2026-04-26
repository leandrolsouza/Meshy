// ─── Shared types for Main Process and Renderer Process ──────────────────────
//
// Single source of truth for types used across both processes.
// Both tsconfig.node.json and tsconfig.web.json include this directory.

// ─── TrackerStatus ─────────────────────────────────────────────────────────────

/** Status de conexão de um tracker */
export type TrackerStatus = 'connected' | 'error' | 'pending';

/** Informações de um tracker associado a um torrent */
export interface TrackerInfo {
    url: string; // Tracker URL completa
    status: TrackerStatus; // Status de conexão atual
    message?: string; // Mensagem de erro (quando status === 'error')
}

// ─── TorrentStatus ────────────────────────────────────────────────────────────

export type TorrentStatus =
    | 'queued'
    | 'resolving-metadata'
    | 'downloading'
    | 'paused'
    | 'completed'
    | 'error'
    | 'metadata-failed'
    | 'files-not-found';

// ─── TorrentFileInfo ──────────────────────────────────────────────────────────

/** Representação de um arquivo individual dentro de um torrent */
export interface TorrentFileInfo {
    index: number; // índice no array torrent.files
    name: string; // nome do arquivo (ex: "video.mp4")
    path: string; // caminho relativo (ex: "Movie/video.mp4")
    length: number; // tamanho em bytes
    downloaded: number; // bytes já baixados
    selected: boolean; // se o arquivo está selecionado para download
}

// ─── DownloadItem ─────────────────────────────────────────────────────────────

export interface DownloadItem {
    infoHash: string;
    name: string;
    totalSize: number;
    downloadedSize: number;
    progress: number;
    downloadSpeed: number;
    uploadSpeed: number;
    numPeers: number;
    numSeeders: number;
    timeRemaining: number;
    status: TorrentStatus;
    destinationFolder: string;
    addedAt: number; // timestamp ms
    completedAt?: number; // timestamp ms
    elapsedMs?: number;
    selectedFileCount?: number; // quantidade de arquivos selecionados
    totalFileCount?: number; // quantidade total de arquivos
    errorMessage?: string; // mensagem de erro (quando status === 'error')
}

// ─── PersistedDownloadItem ────────────────────────────────────────────────────

export interface PersistedDownloadItem {
    infoHash: string;
    name: string;
    totalSize: number;
    downloadedSize: number;
    progress: number;
    status: TorrentStatus;
    destinationFolder: string;
    addedAt: number;
    completedAt?: number;
    elapsedMs?: number;
    magnetUri?: string;
    torrentFilePath?: string;
    selectedFileIndices?: number[]; // índices dos arquivos selecionados
    errorMessage?: string; // mensagem de erro (persistida)
}

// ─── AppSettings ──────────────────────────────────────────────────────────────

export interface AppSettings {
    destinationFolder: string;
    downloadSpeedLimit: number; // KB/s, 0 = sem limite
    uploadSpeedLimit: number; // KB/s, 0 = sem limite
    maxConcurrentDownloads: number; // máx downloads simultâneos (1–10, padrão 3)
    notificationsEnabled: boolean; // notificações nativas do OS (padrão: true)
    theme: string; // identificador do tema ativo (ex: "vs-code-dark")
    locale: string; // identificador de locale BCP 47 (ex: "pt-BR", "en-US")
    globalTrackers: string[]; // lista de Tracker URLs favoritas (padrão: [])
    autoApplyGlobalTrackers: boolean; // aplicar automaticamente a novos torrents (padrão: false)
    // Configurações avançadas de rede
    dhtEnabled: boolean; // DHT — Distributed Hash Table (padrão: true)
    pexEnabled: boolean; // PEX — Peer Exchange (padrão: true)
    utpEnabled: boolean; // uTP — Micro Transport Protocol (padrão: true)
}

// ─── IPCResponse ──────────────────────────────────────────────────────────────

export type IPCResponse<T> = { success: true; data: T } | { success: false; error: string };

// ─── MeshyAPI ─────────────────────────────────────────────────────────────────

export interface MeshyAPI {
    // Commands
    addTorrentFile(filePath: string): Promise<IPCResponse<DownloadItem>>;
    addTorrentFileBuffer(buffer: Uint8Array): Promise<IPCResponse<DownloadItem>>;
    addMagnetLink(magnetUri: string): Promise<IPCResponse<DownloadItem>>;
    pause(infoHash: string): Promise<IPCResponse<void>>;
    resume(infoHash: string): Promise<IPCResponse<void>>;
    remove(infoHash: string, deleteFiles: boolean): Promise<IPCResponse<void>>;
    getAll(): Promise<IPCResponse<DownloadItem[]>>;
    getSettings(): Promise<IPCResponse<AppSettings>>;
    setSettings(partial: Partial<AppSettings>): Promise<IPCResponse<AppSettings>>;
    selectFolder(): Promise<IPCResponse<string>>;
    selectTorrentFile(): Promise<IPCResponse<string>>;
    // File selection
    getFiles(infoHash: string): Promise<IPCResponse<TorrentFileInfo[]>>;
    setFileSelection(
        infoHash: string,
        selectedIndices: number[],
    ): Promise<IPCResponse<TorrentFileInfo[]>>;
    // Trackers (por torrent)
    getTrackers(infoHash: string): Promise<IPCResponse<TrackerInfo[]>>;
    addTracker(infoHash: string, url: string): Promise<IPCResponse<TrackerInfo[]>>;
    removeTracker(infoHash: string, url: string): Promise<IPCResponse<TrackerInfo[]>>;
    applyGlobalTrackers(infoHash: string): Promise<IPCResponse<TrackerInfo[]>>;
    // Trackers globais
    getGlobalTrackers(): Promise<IPCResponse<string[]>>;
    addGlobalTracker(url: string): Promise<IPCResponse<string[]>>;
    removeGlobalTracker(url: string): Promise<IPCResponse<string[]>>;
    // Retry
    retryDownload(infoHash: string): Promise<IPCResponse<DownloadItem>>;
    // Destino — abrir pasta ou arquivo
    openFolder(infoHash: string): Promise<IPCResponse<void>>;
    openFile(infoHash: string): Promise<IPCResponse<void>>;
    // Events
    onProgress(callback: (items: DownloadItem[]) => void): () => void;
    onError(callback: (data: { infoHash: string; message: string }) => void): () => void;
    // Observabilidade — reportar erros do renderer ao main process
    reportError(error: {
        message: string;
        source: string;
        stack?: string;
        componentStack?: string;
    }): void;
    // Observabilidade — obter métricas de operação do main process
    getMetrics(): Promise<IPCResponse<Record<string, unknown>>>;
}

// ─── Global window augmentation ───────────────────────────────────────────────

declare global {
    interface Window {
        meshy: MeshyAPI;
    }
}
