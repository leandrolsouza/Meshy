import log from 'electron-log';

// ─── Logger ───────────────────────────────────────────────────────────────────
//
// Thin wrapper around electron-log for the main process.
// Logs are written to:
//   Windows: %APPDATA%/Meshy/logs/
//   macOS:   ~/Library/Logs/Meshy/
//   Linux:   ~/.config/Meshy/logs/

export interface Logger {
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}

/**
 * Default logger backed by electron-log.
 * Can be replaced with a mock in tests via dependency injection.
 */
export const logger: Logger = {
    info(message: string, ...args: unknown[]): void {
        log.info(message, ...args);
    },
    warn(message: string, ...args: unknown[]): void {
        log.warn(message, ...args);
    },
    error(message: string, ...args: unknown[]): void {
        log.error(message, ...args);
    },
};
