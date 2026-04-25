// ─── Shared validators for Main Process and Renderer Process ─────────────────
//
// Single source of truth for validation logic used across both processes.
// Avoids duplication of regex patterns and validation functions.

// ─── Magnet URI ───────────────────────────────────────────────────────────────

// The hash must be exactly 40 hex chars; any additional query params must start with '&'
const MAGNET_REGEX = /^magnet:\?xt=urn:btih:[a-fA-F0-9]{40}(&[a-zA-Z0-9&=%.+:?_-]*)?$/i;

/**
 * Valida se uma string é um magnet URI válido.
 * Requer o prefixo `magnet:?xt=urn:btih:` seguido de exatamente 40 caracteres hexadecimais.
 */
export function isValidMagnetUri(uri: string): boolean {
    return MAGNET_REGEX.test(uri.trim());
}

// ─── Torrent file ─────────────────────────────────────────────────────────────

/**
 * Valida se um caminho de arquivo possui a extensão `.torrent`.
 */
export function isValidTorrentFile(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.torrent');
}

/**
 * Valida o conteúdo de um buffer verificando os magic bytes do formato bencode.
 * Um arquivo .torrent válido começa com 'd' (0x64) — dicionário bencode.
 */
export function hasTorrentMagicBytes(buffer: Buffer): boolean {
    return buffer.length > 0 && buffer[0] === 0x64;
}

// ─── Speed limit ──────────────────────────────────────────────────────────────

/**
 * Valida se um valor é um limite de velocidade válido.
 * Deve ser um inteiro não-negativo (KB/s), onde 0 indica sem limite.
 */
export function isValidSpeedLimit(value: unknown): boolean {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

// ─── Max concurrent downloads ─────────────────────────────────────────────────

/** Limite mínimo de downloads simultâneos */
export const MIN_CONCURRENT_DOWNLOADS = 1;

/** Limite máximo de downloads simultâneos */
export const MAX_CONCURRENT_DOWNLOADS = 10;

/** Valor padrão de downloads simultâneos */
export const DEFAULT_MAX_CONCURRENT_DOWNLOADS = 3;

/**
 * Valida se um valor é um limite de downloads simultâneos válido.
 * Deve ser um inteiro entre MIN_CONCURRENT_DOWNLOADS e MAX_CONCURRENT_DOWNLOADS (inclusive).
 */
export function isValidMaxConcurrentDownloads(value: unknown): boolean {
    return (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= MIN_CONCURRENT_DOWNLOADS &&
        value <= MAX_CONCURRENT_DOWNLOADS
    );
}

// ─── Tracker URL ──────────────────────────────────────────────────────────────

/**
 * Protocolos aceitos para Tracker URLs.
 */
const VALID_TRACKER_PROTOCOLS = ['http:', 'https:', 'udp:'];

/**
 * Valida se uma string é uma Tracker URL válida.
 * Aceita protocolos http://, https://, udp:// com hostname não-vazio.
 * Rejeita strings vazias, apenas espaços, e protocolos inválidos.
 */
export function isValidTrackerUrl(url: string): boolean {
    if (typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (trimmed.length === 0) return false;

    try {
        // URL não suporta udp://, então tratamos manualmente
        const protocolMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//);
        if (!protocolMatch) return false;

        const protocol = protocolMatch[1].toLowerCase() + ':';
        if (!VALID_TRACKER_PROTOCOLS.includes(protocol)) return false;

        // Para http/https, usamos o construtor URL nativo
        if (protocol === 'http:' || protocol === 'https:') {
            const parsed = new URL(trimmed);
            return parsed.hostname.length > 0;
        }

        // Para udp://, extraímos o hostname manualmente
        const afterProtocol = trimmed.slice(protocolMatch[0].length);
        // Hostname é tudo antes de : ou / ou fim da string
        const hostnameMatch = afterProtocol.match(/^([^:/]+)/);
        return hostnameMatch !== null && hostnameMatch[1].length > 0;
    } catch {
        return false;
    }
}

/**
 * Normaliza uma Tracker URL: remove espaços, converte protocolo para minúsculas,
 * e remove barras finais duplicadas.
 */
export function normalizeTrackerUrl(url: string): string {
    const trimmed = url.trim();

    // Converte protocolo para minúsculas
    const normalized = trimmed.replace(/^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)/, (match) =>
        match.toLowerCase(),
    );

    // Remove barras finais duplicadas (mantém no máximo uma)
    return normalized.replace(/\/+$/, '');
}

// ─── Theme ID ─────────────────────────────────────────────────────────────────

/**
 * Valida se um valor é um identificador de tema válido.
 * Deve ser uma string não-vazia.
 */
export function isValidThemeId(value: unknown): boolean {
    return typeof value === 'string' && value.length > 0;
}
