import { useState, useCallback } from 'react';
import type { TrackerInfo } from '../../shared/types';

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Encapsula chamadas IPC para operações de tracker por torrent.
 * Gerencia estado local de loading e erros.
 *
 * @param infoHash — identificador do torrent
 */
export function useTrackers(infoHash: string) {
    const [trackers, setTrackers] = useState<TrackerInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── loadTrackers ──────────────────────────────────────────────────────────

    /** Carrega a lista de trackers do torrent via IPC. */
    const loadTrackers = useCallback(async (): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            const response = await window.meshy.getTrackers(infoHash);
            if (response.success) {
                setTrackers(response.data);
            } else {
                setError(response.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, [infoHash]);

    // ── addTracker ────────────────────────────────────────────────────────────

    /** Adiciona um tracker ao torrent e atualiza a lista local. */
    const addTracker = useCallback(
        async (url: string): Promise<boolean> => {
            setLoading(true);
            setError(null);
            try {
                const response = await window.meshy.addTracker(infoHash, url);
                if (response.success) {
                    setTrackers(response.data);
                    return true;
                } else {
                    setError(response.error);
                    return false;
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
                return false;
            } finally {
                setLoading(false);
            }
        },
        [infoHash],
    );

    // ── removeTracker ─────────────────────────────────────────────────────────

    /** Remove um tracker do torrent e atualiza a lista local. */
    const removeTracker = useCallback(
        async (url: string): Promise<boolean> => {
            setLoading(true);
            setError(null);
            try {
                const response = await window.meshy.removeTracker(infoHash, url);
                if (response.success) {
                    setTrackers(response.data);
                    return true;
                } else {
                    setError(response.error);
                    return false;
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
                return false;
            } finally {
                setLoading(false);
            }
        },
        [infoHash],
    );

    // ── applyGlobalTrackers ───────────────────────────────────────────────────

    /** Aplica os trackers globais favoritos ao torrent. */
    const applyGlobalTrackers = useCallback(async (): Promise<boolean> => {
        setLoading(true);
        setError(null);
        try {
            const response = await window.meshy.applyGlobalTrackers(infoHash);
            if (response.success) {
                setTrackers(response.data);
                return true;
            } else {
                setError(response.error);
                return false;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            return false;
        } finally {
            setLoading(false);
        }
    }, [infoHash]);

    return {
        trackers,
        loading,
        error,
        loadTrackers,
        addTracker,
        removeTracker,
        applyGlobalTrackers,
    };
}
