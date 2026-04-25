// ─── Shared types for Main Process and Renderer Process ──────────────────────
//
// Single source of truth for types used across both processes.
// Both tsconfig.node.json and tsconfig.web.json include this directory.

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
    index: number;        // índice no array torrent.files
    name: string;         // nome do arquivo (ex: "video.mp4")
    path: string;         // caminho relativo (ex: "Movie/video.mp4")
    length: number;       // tamanho em bytes
    downloaded: number;   // bytes já baixados
    selected: boolean;    // se o arquivo está selecionado para download
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
    addedAt: number;       // timestamp ms
    completedAt?: number;  // timestamp ms
    elapsedMs?: number;
    selectedFileCount?: number;   // quantidade de arquivos selecionados
    totalFileCount?: number;      // quantidade total de arquivos
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
    selectedFileIndices?: number[];  // índices dos arquivos selecionados
}

// ─── AppSettings ──────────────────────────────────────────────────────────────

export interface AppSettings {
    destinationFolder: string;
    downloadSpeedLimit: number; // KB/s, 0 = sem limite
    uploadSpeedLimit: number;   // KB/s, 0 = sem limite
    maxConcurrentDownloads: number; // máx downloads simultâneos (1–10, padrão 3)
}

// ─── IPCResponse ──────────────────────────────────────────────────────────────

export type IPCResponse<T> =
    | { success: true; data: T }
    | { success: false; error: string };

// ─── MeshyAPI ─────────────────────────────────────────────────────────────────

export interface MeshyAPI {
    // Commands
    addTorrentFile(filePath: string): Promise<IPCResponse<DownloadItem>>;
    addMagnetLink(magnetUri: string): Promise<IPCResponse<DownloadItem>>;
    pause(infoHash: string): Promise<IPCResponse<void>>;
    resume(infoHash: string): Promise<IPCResponse<void>>;
    remove(infoHash: string, deleteFiles: boolean): Promise<IPCResponse<void>>;
    getAll(): Promise<IPCResponse<DownloadItem[]>>;
    getSettings(): Promise<IPCResponse<AppSettings>>;
    setSettings(partial: Partial<AppSettings>): Promise<IPCResponse<AppSettings>>;
    selectFolder(): Promise<IPCResponse<string>>;
    // File selection
    getFiles(infoHash: string): Promise<IPCResponse<TorrentFileInfo[]>>;
    setFileSelection(infoHash: string, selectedIndices: number[]): Promise<IPCResponse<TorrentFileInfo[]>>;
    // Events
    onProgress(callback: (items: DownloadItem[]) => void): () => void;
    onError(callback: (data: { infoHash: string; message: string }) => void): () => void;
}

// ─── Global window augmentation ───────────────────────────────────────────────

declare global {
    interface Window {
        meshy: MeshyAPI;
    }
}
