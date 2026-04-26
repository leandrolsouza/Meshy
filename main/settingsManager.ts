import ElectronStoreDefault from 'electron-store';
import type { AppSettings } from '../shared/types';
import {
    DEFAULT_MAX_CONCURRENT_DOWNLOADS,
    isValidTrackerUrl,
    normalizeTrackerUrl,
} from '../shared/validators';

export type { AppSettings } from '../shared/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PersistedSettings {
    destinationFolder: string;
    downloadSpeedLimit: number;
    uploadSpeedLimit: number;
    maxConcurrentDownloads: number;
    notificationsEnabled: boolean;
    theme: string; // identificador do tema ativo (ex: "vs-code-dark")
    locale: string; // identificador de locale BCP 47 (ex: "pt-BR", "en-US")
    globalTrackers: string[]; // lista de Tracker URLs favoritas
    autoApplyGlobalTrackers: boolean; // aplicar automaticamente a novos torrents
    // Configurações avançadas de rede
    dhtEnabled: boolean; // DHT — Distributed Hash Table (padrão: true)
    pexEnabled: boolean; // PEX — Peer Exchange (padrão: true)
    utpEnabled: boolean; // uTP — Micro Transport Protocol (padrão: true)
    schemaVersion: number; // para migrações futuras
}

export interface SettingsManager {
    get(): AppSettings;
    set(partial: Partial<AppSettings>): void;
    getDefaultDownloadFolder(): string;
    getGlobalTrackers(): string[];
    addGlobalTracker(url: string): void;
    removeGlobalTracker(url: string): void;
    setAutoApplyGlobalTrackers(enabled: boolean): void;
}

// ─── Store interface (subset used by SettingsManager) ─────────────────────────

/**
 * Minimal interface for the store, allowing injection of a mock in tests.
 */
export interface SettingsStore {
    get<K extends keyof PersistedSettings>(key: K): PersistedSettings[K];
    set<K extends keyof PersistedSettings>(key: K, value: PersistedSettings[K]): void;
}

// ─── Factory options ──────────────────────────────────────────────────────────

export interface CreateSettingsManagerOptions {
    /**
     * Injectable store instance. When omitted, a real `electron-store` is created.
     * Provide a mock here in tests to avoid touching the file system or requiring Electron.
     */
    store?: SettingsStore;

    /**
     * Injectable function that returns the OS default downloads folder.
     * Defaults to `app.getPath('downloads')` from Electron.
     * Override in tests to avoid requiring a running Electron app.
     */
    getDownloadsPath?: () => string;
}

// ─── Current schema version ───────────────────────────────────────────────────

const SCHEMA_VERSION = 1;

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a `SettingsManager` instance.
 *
 * @example
 * // Production usage (Electron main process):
 * const settings = createSettingsManager();
 *
 * @example
 * // Test usage (no Electron required):
 * const fakeStore = new Map<string, unknown>();
 * const settings = createSettingsManager({
 *   store: {
 *     get: (key) => fakeStore.get(key) as any,
 *     set: (key, value) => fakeStore.set(key, value),
 *   },
 *   getDownloadsPath: () => '/home/user/Downloads',
 * });
 */
export function createSettingsManager(options: CreateSettingsManagerOptions = {}): SettingsManager {
    // ── Resolve the store ──────────────────────────────────────────────────────
    const store: SettingsStore = options.store ?? createElectronStore();

    // ── Resolve the downloads-path getter ─────────────────────────────────────
    const getDownloadsPath: () => string =
        options.getDownloadsPath ?? getDefaultDownloadsPathFromElectron;

    // ── Ensure destinationFolder is initialised ────────────────────────────────
    const currentFolder = store.get('destinationFolder');
    if (!currentFolder) {
        store.set('destinationFolder', getDownloadsPath());
    }

    // ── Ensure schemaVersion is initialised ───────────────────────────────────
    const currentVersion = store.get('schemaVersion');
    if (!currentVersion) {
        store.set('schemaVersion', SCHEMA_VERSION);
    }

    // ── Public API ────────────────────────────────────────────────────────────
    return {
        get(): AppSettings {
            return {
                destinationFolder: store.get('destinationFolder'),
                downloadSpeedLimit: store.get('downloadSpeedLimit') ?? 0,
                uploadSpeedLimit: store.get('uploadSpeedLimit') ?? 0,
                maxConcurrentDownloads:
                    store.get('maxConcurrentDownloads') ?? DEFAULT_MAX_CONCURRENT_DOWNLOADS,
                notificationsEnabled: store.get('notificationsEnabled') ?? true,
                theme: store.get('theme') ?? 'vs-code-dark',
                locale: store.get('locale') ?? 'pt-BR',
                globalTrackers: store.get('globalTrackers') ?? [],
                autoApplyGlobalTrackers: store.get('autoApplyGlobalTrackers') ?? false,
                dhtEnabled: store.get('dhtEnabled') ?? true,
                pexEnabled: store.get('pexEnabled') ?? true,
                utpEnabled: store.get('utpEnabled') ?? true,
            };
        },

        set(partial: Partial<AppSettings>): void {
            const settableKeys: (keyof AppSettings)[] = [
                'destinationFolder',
                'downloadSpeedLimit',
                'uploadSpeedLimit',
                'maxConcurrentDownloads',
                'notificationsEnabled',
                'theme',
                'locale',
                'globalTrackers',
                'autoApplyGlobalTrackers',
                'dhtEnabled',
                'pexEnabled',
                'utpEnabled',
            ];

            for (const key of settableKeys) {
                if (partial[key] !== undefined) {
                    // O cast é seguro: cada chave de AppSettings mapeia para o tipo
                    // correspondente em PersistedSettings.
                    store.set(key as keyof PersistedSettings, partial[key] as never);
                }
            }
        },

        getDefaultDownloadFolder(): string {
            return getDownloadsPath();
        },

        getGlobalTrackers(): string[] {
            return store.get('globalTrackers') ?? [];
        },

        addGlobalTracker(url: string): void {
            if (!isValidTrackerUrl(url)) {
                throw new Error('URL de tracker inválida');
            }

            const normalized = normalizeTrackerUrl(url);
            const current = store.get('globalTrackers') ?? [];

            if (current.includes(normalized)) {
                throw new Error('Tracker já existe na lista global');
            }

            store.set('globalTrackers', [...current, normalized]);
        },

        removeGlobalTracker(url: string): void {
            const normalized = normalizeTrackerUrl(url);
            const current = store.get('globalTrackers') ?? [];
            store.set(
                'globalTrackers',
                current.filter((t) => t !== normalized),
            );
        },

        setAutoApplyGlobalTrackers(enabled: boolean): void {
            store.set('autoApplyGlobalTrackers', enabled);
        },
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a real `electron-store` instance with the PersistedSettings schema.
 * This is only called in the Electron main process.
 */
function createElectronStore(): SettingsStore {
    const store = new ElectronStoreDefault<PersistedSettings>({
        name: 'settings',
        defaults: {
            destinationFolder: '',
            downloadSpeedLimit: 0,
            uploadSpeedLimit: 0,
            maxConcurrentDownloads: DEFAULT_MAX_CONCURRENT_DOWNLOADS,
            notificationsEnabled: true,
            theme: 'vs-code-dark',
            locale: 'pt-BR',
            globalTrackers: [],
            autoApplyGlobalTrackers: false,
            dhtEnabled: true,
            pexEnabled: true,
            utpEnabled: true,
            schemaVersion: SCHEMA_VERSION,
        },
    });

    return {
        get<K extends keyof PersistedSettings>(key: K): PersistedSettings[K] {
            return store.get(key) as PersistedSettings[K];
        },
        set<K extends keyof PersistedSettings>(key: K, value: PersistedSettings[K]): void {
            store.set(key, value);
        },
    };
}

/**
 * Returns the OS default downloads folder using Electron's `app.getPath`.
 * Falls back to the home directory if `app` is not available.
 */
function getDefaultDownloadsPathFromElectron(): string {
    try {
        const electron = require('electron');
        return electron.app.getPath('downloads');
    } catch {
        // Fallback when Electron is not available (e.g., unit tests without injection)
        const os = require('os');
        return os.homedir();
    }
}
