import { createSettingsManager, SettingsStore } from '../../main/settingsManager';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates an in-memory store that satisfies the SettingsStore interface.
 * Avoids touching the file system or requiring a running Electron app.
 */
function createFakeStore(initial: Record<string, unknown> = {}): SettingsStore {
    const data = new Map<string, unknown>(Object.entries(initial));
    return {
        get: (key) => data.get(key) as any,
        set: (key, value) => { data.set(key, value); },
    };
}

const FAKE_DOWNLOADS_PATH = '/home/testuser/Downloads';

function makeManager(storeData: Record<string, unknown> = {}) {
    return createSettingsManager({
        store: createFakeStore(storeData),
        getDownloadsPath: () => FAKE_DOWNLOADS_PATH,
    });
}

// ─── get() ────────────────────────────────────────────────────────────────────

describe('SettingsManager.get()', () => {
    it('returns default speed limits of 0 when store is empty', () => {
        const manager = makeManager();
        const settings = manager.get();
        expect(settings.downloadSpeedLimit).toBe(0);
        expect(settings.uploadSpeedLimit).toBe(0);
    });

    it('returns the default downloads folder as destinationFolder when store is empty', () => {
        const manager = makeManager();
        const settings = manager.get();
        expect(settings.destinationFolder).toBe(FAKE_DOWNLOADS_PATH);
    });

    it('returns previously stored destinationFolder', () => {
        const manager = makeManager({ destinationFolder: '/custom/path' });
        expect(manager.get().destinationFolder).toBe('/custom/path');
    });

    it('returns previously stored speed limits', () => {
        const manager = makeManager({ downloadSpeedLimit: 512, uploadSpeedLimit: 256 });
        const settings = manager.get();
        expect(settings.downloadSpeedLimit).toBe(512);
        expect(settings.uploadSpeedLimit).toBe(256);
    });

    it('returns an object with exactly the expected keys', () => {
        const manager = makeManager();
        const settings = manager.get();
        expect(Object.keys(settings).sort()).toEqual(
            ['destinationFolder', 'downloadSpeedLimit', 'uploadSpeedLimit'].sort()
        );
    });
});

// ─── set() ────────────────────────────────────────────────────────────────────

describe('SettingsManager.set()', () => {
    it('persists a new destinationFolder', () => {
        const manager = makeManager();
        manager.set({ destinationFolder: '/new/path' });
        expect(manager.get().destinationFolder).toBe('/new/path');
    });

    it('persists a new downloadSpeedLimit', () => {
        const manager = makeManager();
        manager.set({ downloadSpeedLimit: 1024 });
        expect(manager.get().downloadSpeedLimit).toBe(1024);
    });

    it('persists a new uploadSpeedLimit', () => {
        const manager = makeManager();
        manager.set({ uploadSpeedLimit: 256 });
        expect(manager.get().uploadSpeedLimit).toBe(256);
    });

    it('performs a partial update without overwriting unrelated fields', () => {
        const manager = makeManager({ downloadSpeedLimit: 100, uploadSpeedLimit: 50 });
        manager.set({ downloadSpeedLimit: 200 });
        const settings = manager.get();
        expect(settings.downloadSpeedLimit).toBe(200);
        expect(settings.uploadSpeedLimit).toBe(50);
    });

    it('allows setting speed limits back to 0 (no limit)', () => {
        const manager = makeManager({ downloadSpeedLimit: 500 });
        manager.set({ downloadSpeedLimit: 0 });
        expect(manager.get().downloadSpeedLimit).toBe(0);
    });

    it('persists multiple fields in a single call', () => {
        const manager = makeManager();
        manager.set({ downloadSpeedLimit: 300, uploadSpeedLimit: 150 });
        const settings = manager.get();
        expect(settings.downloadSpeedLimit).toBe(300);
        expect(settings.uploadSpeedLimit).toBe(150);
    });
});

// ─── getDefaultDownloadFolder() ───────────────────────────────────────────────

describe('SettingsManager.getDefaultDownloadFolder()', () => {
    it('returns a non-empty string', () => {
        const manager = makeManager();
        const folder = manager.getDefaultDownloadFolder();
        expect(typeof folder).toBe('string');
        expect(folder.length).toBeGreaterThan(0);
    });

    it('returns the injected downloads path', () => {
        const manager = makeManager();
        expect(manager.getDefaultDownloadFolder()).toBe(FAKE_DOWNLOADS_PATH);
    });
});
