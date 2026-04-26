// ─── Shared formatters for Main Process and Renderer Process ─────────────────
//
// Funções de formatação reutilizáveis em ambos os processos.
// Evita duplicação entre main/notificationManager.ts e src/utils/formatters.ts.

/**
 * Formata um número de bytes em uma string legível com a unidade apropriada.
 *
 * @param n - Inteiro não-negativo representando bytes
 * @returns String legível, ex: "0 B", "1.50 KB", "1.00 MB", "2.50 GB"
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

/**
 * Formata duração em milissegundos para uma string legível.
 *
 * @param ms - Duração em milissegundos
 * @returns String legível, ex: "30 s", "2 min 30 s", "1 h 15 min"
 */
export function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds} s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 60) {
        return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}
