import { useState, useEffect, useCallback } from 'react';
import type { AppSettings } from '../../shared/types';

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages application settings by:
 * - Loading settings via `window.meshy.getSettings()` on mount.
 * - Exposing `updateSettings` to persist partial changes.
 * - Exposing `selectFolder` to open the OS folder picker and update `destinationFolder`.
 */
export function useSettings() {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ── Load settings on mount ────────────────────────────────────────────────

    useEffect(() => {
        let cancelled = false;

        async function loadSettings() {
            try {
                const response = await window.meshy.getSettings();
                if (cancelled) return;

                if (response.success) {
                    setSettings(response.data);
                } else {
                    setError(response.error);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : String(err));
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadSettings();

        return () => {
            cancelled = true;
        };
    }, []);

    // ── updateSettings ────────────────────────────────────────────────────────

    /**
     * Persists a partial settings update via `window.meshy.setSettings(partial)`.
     * On success, merges the returned settings into local state.
     */
    const updateSettings = useCallback(async (partial: Partial<AppSettings>): Promise<boolean> => {
        try {
            const response = await window.meshy.setSettings(partial);
            if (response.success) {
                setSettings(response.data);
                return true;
            } else {
                setError(response.error);
                return false;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            return false;
        }
    }, []);

    // ── selectFolder ──────────────────────────────────────────────────────────

    /**
     * Opens the OS folder picker via `window.meshy.selectFolder()`.
     * On success, updates `destinationFolder` in settings.
     * Returns the selected folder path, or null if cancelled/failed.
     */
    const selectFolder = useCallback(async (): Promise<string | null> => {
        try {
            const response = await window.meshy.selectFolder();
            if (response.success) {
                const folder = response.data;
                await updateSettings({ destinationFolder: folder });
                return folder;
            } else {
                // User cancelled the dialog — not an error worth surfacing
                return null;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            return null;
        }
    }, [updateSettings]);

    // ── Trackers globais ──────────────────────────────────────────────────────

    /**
     * Retorna a lista de trackers globais favoritos via IPC.
     */
    const getGlobalTrackers = useCallback(async (): Promise<string[]> => {
        try {
            const response = await window.meshy.getGlobalTrackers();
            if (response.success) {
                return response.data;
            } else {
                setError(response.error);
                return [];
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            return [];
        }
    }, []);

    /**
     * Adiciona uma URL de tracker à lista global de favoritos.
     * Atualiza o estado local de settings em caso de sucesso.
     */
    const addGlobalTracker = useCallback(async (url: string): Promise<boolean> => {
        try {
            const response = await window.meshy.addGlobalTracker(url);
            if (response.success) {
                setSettings((prev) => (prev ? { ...prev, globalTrackers: response.data } : prev));
                return true;
            } else {
                setError(response.error);
                return false;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            return false;
        }
    }, []);

    /**
     * Remove uma URL de tracker da lista global de favoritos.
     * Atualiza o estado local de settings em caso de sucesso.
     */
    const removeGlobalTracker = useCallback(async (url: string): Promise<boolean> => {
        try {
            const response = await window.meshy.removeGlobalTracker(url);
            if (response.success) {
                setSettings((prev) => (prev ? { ...prev, globalTrackers: response.data } : prev));
                return true;
            } else {
                setError(response.error);
                return false;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            return false;
        }
    }, []);

    return {
        settings,
        loading,
        error,
        updateSettings,
        selectFolder,
        getGlobalTrackers,
        addGlobalTracker,
        removeGlobalTracker,
    };
}
