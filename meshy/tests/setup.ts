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
