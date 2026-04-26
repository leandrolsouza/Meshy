/**
 * Formats a byte count into a human-readable string with the appropriate unit suffix.
 *
 * @param n - Non-negative integer representing a number of bytes
 * @returns Human-readable string, e.g. "0 B", "1.50 KB", "1.00 MB", "2.50 GB"
 */
export function formatBytes(n: number): string {
    const GB = 1024 ** 3;
    const MB = 1024 ** 2;
    const KB = 1024;

    if (n >= GB) {
        return `${(n / GB).toFixed(2)} GB`;
    }
    if (n >= MB) {
        return `${(n / MB).toFixed(2)} MB`;
    }
    if (n >= KB) {
        return `${(n / KB).toFixed(2)} KB`;
    }
    return `${n} B`;
}
