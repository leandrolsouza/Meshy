// ─── Abstração de propriedades internas do WebTorrent ─────────────────────────
//
// O WebTorrent 2.x expõe propriedades internas não tipadas (announce, _trackers,
// wires, addTracker) que o Meshy precisa acessar. Este módulo centraliza todos
// os acessos inseguros com type guards, evitando casts `as unknown as { ... }`
// espalhados pelo código.
//
// Se uma atualização do WebTorrent quebrar essas propriedades, apenas este
// módulo precisa ser atualizado.

import type { Torrent } from 'webtorrent';

// ─── Tipos internos ──────────────────────────────────────────────────────────

/** Representação interna de um tracker no WebTorrent */
export interface InternalTracker {
    destroyed?: boolean;
    destroy?: () => void;
}

/** Wire com extensão ut_pex */
export interface WireWithPex {
    destroy(): void;
    ut_pex?: {
        destroy?: () => void;
    };
}

// ─── Helper para cast seguro ──────────────────────────────────────────────────

/**
 * Cast de Torrent para Record<string, unknown> via `unknown`.
 * Necessário porque o @types/webtorrent não declara index signature,
 * e o tsconfig.jest.json é mais restritivo que o tsconfig.node.json.
 */
function asRecord(torrent: Torrent): Record<string, unknown> {
    return torrent as unknown as Record<string, unknown>;
}

// ─── Announce (lista de tracker URLs) ─────────────────────────────────────────

/**
 * Retorna a lista de tracker URLs (announce) de um torrent.
 * Retorna array vazio se a propriedade não existir.
 */
export function getAnnounceList(torrent: Torrent): string[] {
    const t = asRecord(torrent);
    if (Array.isArray(t.announce)) {
        return t.announce as string[];
    }
    return [];
}

/**
 * Define a lista de tracker URLs (announce) de um torrent.
 */
export function setAnnounceList(torrent: Torrent, urls: string[]): void {
    asRecord(torrent).announce = urls;
}

// ─── _trackers (mapa interno de conexões com trackers) ────────────────────────

/**
 * Retorna o mapa interno de trackers (_trackers) de um torrent.
 * Retorna objeto vazio se a propriedade não existir.
 */
export function getInternalTrackers(torrent: Torrent): Record<string, InternalTracker> {
    const t = asRecord(torrent);
    if (t._trackers && typeof t._trackers === 'object') {
        return t._trackers as Record<string, InternalTracker>;
    }
    return {};
}

/**
 * Remove um tracker do mapa interno e destrói a conexão.
 * Retorna true se o tracker foi encontrado e removido.
 */
export function destroyInternalTracker(
    torrent: Torrent,
    normalizedUrl: string,
    matchFn: (existingUrl: string) => string,
): boolean {
    const trackers = getInternalTrackers(torrent);

    for (const [key, tracker] of Object.entries(trackers)) {
        if (matchFn(key) === normalizedUrl) {
            if (typeof tracker.destroy === 'function') {
                tracker.destroy();
            }
            delete trackers[key];
            return true;
        }
    }
    return false;
}

// ─── addTracker (método nativo do WebTorrent) ─────────────────────────────────

/**
 * Tenta usar o método nativo `addTracker` do WebTorrent.
 * Se não disponível, adiciona manualmente ao array announce.
 * Retorna true se usou o método nativo, false se fez fallback.
 */
export function addTrackerToTorrent(torrent: Torrent, url: string): boolean {
    const t = asRecord(torrent);
    if (typeof t.addTracker === 'function') {
        (t.addTracker as (url: string) => void)(url);
        return true;
    }

    // Fallback: adiciona manualmente ao announce
    const announce = getAnnounceList(torrent);
    announce.push(url);
    setAnnounceList(torrent, announce);
    return false;
}

// ─── Wires (conexões de peers) ────────────────────────────────────────────────

/**
 * Retorna a lista de wires (conexões de peers) de um torrent.
 * Retorna array vazio se a propriedade não existir.
 */
export function getWires(torrent: Torrent): WireWithPex[] {
    const t = asRecord(torrent);
    if (Array.isArray(t.wires)) {
        return t.wires as WireWithPex[];
    }
    return [];
}

/**
 * Destrói todos os wires de um torrent (usado para pausar efetivamente).
 * Retorna o número de wires destruídos.
 */
export function destroyAllWires(torrent: Torrent): number {
    const wires = getWires(torrent);
    // Copia o array para evitar problemas de mutação durante iteração
    const wiresCopy = [...wires];
    for (const wire of wiresCopy) {
        wire.destroy();
    }
    return wiresCopy.length;
}

// ─── numSeeders ───────────────────────────────────────────────────────────────

/**
 * Retorna o número de seeders de um torrent.
 * A propriedade não é tipada no @types/webtorrent.
 */
export function getNumSeeders(torrent: Torrent): number {
    const t = asRecord(torrent);
    if (typeof t.numSeeders === 'number') {
        return t.numSeeders;
    }
    return 0;
}
