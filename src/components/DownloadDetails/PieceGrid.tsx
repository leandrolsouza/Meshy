import React, { useMemo } from 'react';
import { groupPieces, PieceBlock } from '../../utils/detailsFormatters';
import styles from './PieceGrid.module.css';

export interface PieceGridProps {
    pieces: boolean[];
}

/**
 * Calcula a cor de fundo de um bloco de peças com base na proporção de peças completas.
 * - Todas completas: cor de destaque (--color-primary)
 * - Nenhuma completa: cor neutra (--color-surface)
 * - Parcialmente completas: cor de destaque com opacidade proporcional
 */
function getBlockStyle(block: PieceBlock): React.CSSProperties {
    const { completedCount, totalCount } = block;

    if (completedCount === totalCount) {
        return { backgroundColor: 'var(--color-primary)' };
    }

    if (completedCount === 0) {
        return { backgroundColor: 'var(--color-border-light)' };
    }

    const opacity = completedCount / totalCount;
    return {
        backgroundColor: `color-mix(in srgb, var(--color-primary) ${Math.round(opacity * 100)}%, var(--color-surface))`,
    };
}

/**
 * Grade visual de peças do torrent.
 * Renderiza blocos coloridos representando o progresso de download de cada peça.
 * Usa `groupPieces` para agrupar peças adjacentes quando o total excede 1000.
 */
export function PieceGrid({ pieces }: PieceGridProps): React.JSX.Element {
    const blocks = useMemo(() => groupPieces(pieces), [pieces]);

    return (
        <div className={styles.grid}>
            {blocks.map((block) => (
                <div key={block.startIndex} className={styles.block} style={getBlockStyle(block)} />
            ))}
        </div>
    );
}
