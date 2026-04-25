import React from 'react';
import styles from './ProgressBar.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProgressBarProps {
    /** Current progress value (0–100 by default, or 0–max if max is provided) */
    value: number;
    /** Maximum value; defaults to 100 */
    max?: number;
    /** Accessible label describing what is being measured */
    label?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Accessible progress bar component.
 *
 * Uses `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, and
 * `aria-valuemax` for screen-reader compatibility.
 */
export function ProgressBar({ value, max = 100, label }: ProgressBarProps): React.JSX.Element {
    const clampedValue = Math.min(Math.max(value, 0), max);
    const percentage = max > 0 ? (clampedValue / max) * 100 : 0;

    return (
        <div
            className={styles.container}
            role="progressbar"
            aria-valuenow={clampedValue}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-label={label}
        >
            <div
                className={styles.fill}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
}
