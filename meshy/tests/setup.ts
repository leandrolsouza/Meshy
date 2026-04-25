// ─── Global test setup ────────────────────────────────────────────────────────
// Mocks for modules that require Electron runtime and are not available in Jest.

jest.mock('electron-log', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

jest.mock('electron-store', () => {
    return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => {
            const data = new Map<string, unknown>();
            return {
                get: jest.fn((key: string) => data.get(key)),
                set: jest.fn((key: string, value: unknown) => data.set(key, value)),
            };
        }),
    };
});
