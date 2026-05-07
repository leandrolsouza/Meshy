// ─── Formatadores para o Painel de Detalhes do Download ─────────────────────
//
// Funções utilitárias de formatação usadas pelas abas do painel de detalhes.

import { SpeedSample } from '../hooks/useSpeedHistory';

/**
 * Formata velocidade de um peer em bytes/segundo para string legível.
 * - < 1024: "{n} B/s"
 * - >= 1024 e < 1048576: "{n.d} KB/s" (1 casa decimal)
 * - >= 1048576: "{n.d} MB/s" (1 casa decimal)
 *
 * @param bytesPerSec - Velocidade em bytes por segundo (>= 0)
 * @returns String formatada com unidade apropriada
 */
export function formatPeerSpeed(bytesPerSec: number): string {
    if (bytesPerSec < 1024) return `${bytesPerSec} B/s`;
    if (bytesPerSec < 1_048_576) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / 1_048_576).toFixed(1)} MB/s`;
}

/**
 * Converte progresso de 0.0-1.0 para string de porcentagem inteira.
 *
 * @param progress - Valor entre 0.0 e 1.0
 * @returns String no formato "{n}%" com n inteiro arredondado
 */
export function formatPeerProgress(progress: number): string {
    return `${Math.round(progress * 100)}%`;
}

/**
 * Formata timestamp em milissegundos para data no formato pt-BR (dd/MM/yyyy HH:mm).
 *
 * @param timestamp - Timestamp Unix em milissegundos
 * @returns String no formato "dd/MM/yyyy HH:mm"
 */
export function formatCreationDate(timestamp: number): string {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Calcula resumo textual de peças baixadas.
 *
 * @param pieces - Array booleano onde true = peça completa, false = pendente
 * @returns String no formato "{completas}/{total} peças baixadas"
 */
export function computePieceSummary(pieces: boolean[]): string {
    const completed = pieces.filter((p) => p).length;
    return `${completed}/${pieces.length} peças baixadas`;
}

export interface PieceBlock {
    startIndex: number;
    endIndex: number; // exclusivo
    completedCount: number;
    totalCount: number;
}

export function groupPieces(pieces: boolean[], maxBlocks: number = 500): PieceBlock[] {
    if (pieces.length <= maxBlocks) {
        return pieces.map((complete, i) => ({
            startIndex: i,
            endIndex: i + 1,
            completedCount: complete ? 1 : 0,
            totalCount: 1,
        }));
    }

    const groupSize = Math.ceil(pieces.length / maxBlocks);
    const blocks: PieceBlock[] = [];

    for (let i = 0; i < pieces.length; i += groupSize) {
        const end = Math.min(i + groupSize, pieces.length);
        let completed = 0;
        for (let j = i; j < end; j++) {
            if (pieces[j]) completed++;
        }
        blocks.push({
            startIndex: i,
            endIndex: end,
            completedCount: completed,
            totalCount: end - i,
        });
    }

    return blocks;
}

/**
 * Calcula o valor máximo do eixo Y para o gráfico de velocidade.
 *
 * Percorre todas as amostras e encontra o maior valor entre downloadSpeed e uploadSpeed.
 * Retorna no mínimo 1024 (1 KB/s) quando ambas as séries são 0 ou o máximo é inferior a 1024.
 *
 * @param samples - Array de amostras de velocidade (downloadSpeed e uploadSpeed em bytes/s)
 * @returns Valor máximo do eixo Y (>= 1024)
 */
export function computeYAxisScale(samples: SpeedSample[]): number {
    let max = 0;

    for (const sample of samples) {
        if (sample.downloadSpeed > max) {
            max = sample.downloadSpeed;
        }
        if (sample.uploadSpeed > max) {
            max = sample.uploadSpeed;
        }
    }

    // Mínimo de 1024 (1 KB/s) quando ambas as séries são 0 ou max < 1024
    if (max < 1024) {
        return 1024;
    }

    return max;
}
