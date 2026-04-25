import ElectronStoreDefault from 'electron-store';
import type { AppSettings } from '../shared/types';
import { DEFAULT_MAX_CONCURRENT_DOWNLOADS } from '../shared/validators';

export type { AppSettings } from '../shared/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PersistedSettings {
    destinationFolder: string;
    downloadSpeedLimit: number;
    uploadSpeedLimit: number;
    maxConcurrentDownloads: number;
    notificationsEnabled: boolean;
    schemaVersion: number; // para migrações futuras
}

export interface SettingsManager {
    get(): AppSettings;
    set(partial: Partial<AppSettings>): void;
    getDefaultDownloadFolder(): string;
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
            };
        },

        set(partial: Partial<AppSettings>): void {
            if (partial.destinationFolder !== undefined) {
                store.set('destinationFolder', partial.destinationFolder);
            }
            if (partial.downloadSpeedLimit !== undefined) {
                store.set('downloadSpeedLimit', partial.downloadSpeedLimit);
            }
            if (partial.uploadSpeedLimit !== undefined) {
                store.set('uploadSpeedLimit', partial.uploadSpeedLimit);
            }
            if (partial.maxConcurrentDownloads !== undefined) {
                store.set('maxConcurrentDownloads', partial.maxConcurrentDownloads);
            }
            if (partial.notificationsEnabled !== undefined) {
                store.set('notificationsEnabled', partial.notificationsEnabled);
            }
        },

        getDefaultDownloadFolder(): string {
            return getDownloadsPath();
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
