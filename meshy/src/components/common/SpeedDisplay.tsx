import React from 'react';
import { formatBytes } from '../../utils/formatters';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SpeedDisplayProps {
    /** Velocidade em bytes por segundo */
    speedBytesPerSec: number;
    /** Ícone opcional exibido antes da velocidade */
    icon?: React.ReactNode;
    /** @deprecated Use `icon` em vez de `label`. Prefixo de texto, ex: "↓" ou "↑" */
    label?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Exibe uma velocidade de transferência em formato legível (KB/s ou MB/s).
 * Converte bytes/s para a unidade apropriada usando `formatBytes`.
 *
 * @example
 * import { VscArrowDown } from 'react-icons/vsc';
 * <SpeedDisplay speedBytesPerSec={1572864} icon={<VscArrowDown />} />
 * // renderiza: [↓ icon] 1.50 MB/s
 */
export function SpeedDisplay({ speedBytesPerSec, icon, label }: SpeedDisplayProps): React.JSX.Element {
    const formatted = `${formatBytes(speedBytesPerSec)}/s`;

    return (
        <span className="speed-display">
            {icon && <>{icon} </>}
            {!icon && label && <>{label} </>}
            {formatted}
        </span>
    );
}
