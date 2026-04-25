import React from 'react';
import { formatBytes } from '../../utils/formatters';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SpeedDisplayProps {
    /** Speed in bytes per second */
    speedBytesPerSec: number;
    /** Optional label prefix, e.g. "↓" or "↑" */
    label?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Displays a transfer speed in a human-readable format (KB/s or MB/s).
 * Converts bytes/s to the appropriate unit using `formatBytes`.
 *
 * @example
 * <SpeedDisplay speedBytesPerSec={1572864} label="↓" />
 * // renders: "↓ 1.50 MB/s"
 */
export function SpeedDisplay({ speedBytesPerSec, label }: SpeedDisplayProps): React.JSX.Element {
    const formatted = formatBytes(speedBytesPerSec);
    const display = label ? `${label} ${formatted}/s` : `${formatted}/s`;

    return <span className="speed-display">{display}</span>;
}
