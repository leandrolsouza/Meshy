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
 * Rejeita strings vazias, apenas espaços, protocolos inválidos e IPs privados/loopback.
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

        let hostname: string;

        // Para http/https, usamos o construtor URL nativo
        if (protocol === 'http:' || protocol === 'https:') {
            const parsed = new URL(trimmed);
            if (parsed.hostname.length === 0) return false;
            hostname = parsed.hostname;
        } else {
            // Para udp://, extraímos o hostname manualmente
            const afterProtocol = trimmed.slice(protocolMatch[0].length);
            // Hostname é tudo antes de : ou / ou fim da string
            const hostnameMatch = afterProtocol.match(/^([^:/]+)/);
            if (!hostnameMatch || hostnameMatch[1].length === 0) return false;
            hostname = hostnameMatch[1];
        }

        // Rejeitar IPs privados, loopback e reservados (SSRF protection)
        if (isPrivateHost(hostname)) return false;

        return true;
    } catch {
        return false;
    }
}

/**
 * Verifica se um hostname é um IP privado, loopback ou reservado.
 * Bloqueia: 127.x.x.x, 10.x.x.x, 172.16-31.x.x, 192.168.x.x,
 * 169.254.x.x (link-local), 0.0.0.0, localhost, e IPv6 loopback (::1).
 */
function isPrivateHost(hostname: string): boolean {
    const lower = hostname.toLowerCase();

    // localhost e variantes
    if (lower === 'localhost' || lower === 'localhost.localdomain') return true;

    // IPv6 loopback
    if (lower === '::1' || lower === '[::1]') return true;

    // Verificar se é um endereço IPv4
    const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
        const [, a, b] = ipv4Match.map(Number);
        // 0.0.0.0/8
        if (a === 0) return true;
        // 10.0.0.0/8
        if (a === 10) return true;
        // 127.0.0.0/8 (loopback)
        if (a === 127) return true;
        // 169.254.0.0/16 (link-local)
        if (a === 169 && b === 254) return true;
        // 172.16.0.0/12
        if (a === 172 && b >= 16 && b <= 31) return true;
        // 192.168.0.0/16
        if (a === 192 && b === 168) return true;
    }

    return false;
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

// ─── Network toggle ───────────────────────────────────────────────────────────

/**
 * Valida se um valor é um booleano válido para configurações de rede (DHT/PEX/uTP).
 */
export function isValidNetworkToggle(value: unknown): boolean {
    return typeof value === 'boolean';
}

// ─── Theme ID ─────────────────────────────────────────────────────────────────

/**
 * Valida se um valor é um identificador de tema válido.
 * Deve ser uma string não-vazia.
 */
export function isValidThemeId(value: unknown): boolean {
    return typeof value === 'string' && value.length > 0;
}
