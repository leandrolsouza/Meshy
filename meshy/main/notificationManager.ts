import { Notification } from 'electron';
import type { DownloadManager } from './downloadManager';
import type { SettingsManager } from './settingsManager';
import type { DownloadItem } from '../shared/types';
import { logger as defaultLogger } from './logger';
import type { Logger } from './logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationManager {
    /** Para de escutar eventos do DownloadManager */
    dispose(): void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formata o tamanho em bytes para uma string legível (ex: "1.5 GB").
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Cria um NotificationManager que escuta eventos do DownloadManager
 * e exibe notificações nativas do OS quando um download completa ou falha.
 *
 * Respeita a configuração `notificationsEnabled` do SettingsManager.
 */
export function createNotificationManager(
    downloadManager: DownloadManager,
    settings: SettingsManager,
    log?: Logger,
): NotificationManager {
    const _log = log ?? defaultLogger;

    // Rastrear status anterior para detectar transições
    const previousStatus = new Map<string, string>();

    const onUpdate = (item: DownloadItem): void => {
        const prev = previousStatus.get(item.infoHash);
        previousStatus.set(item.infoHash, item.status);

        // Só notificar em transições de status
        if (prev === item.status) return;

        // Verificar se notificações estão habilitadas
        if (!settings.get().notificationsEnabled) return;

        // Verificar suporte a notificações
        if (!Notification.isSupported()) {
            _log.warn('[NotificationManager] Notificações não suportadas neste sistema');
            return;
        }

        if (item.status === 'completed') {
            const sizeStr = formatBytes(item.totalSize);
            const notification = new Notification({
                title: 'Download concluído',
                body: `${item.name} (${sizeStr})`,
                silent: false,
            });
            notification.show();
            _log.info(`[NotificationManager] Notificação: download concluído — ${item.name}`);
        }

        if (item.status === 'error') {
            const notification = new Notification({
                title: 'Erro no download',
                body: `Falha ao baixar "${item.name}"`,
                silent: false,
            });
            notification.show();
            _log.info(`[NotificationManager] Notificação: erro no download — ${item.name}`);
        }

        if (item.status === 'metadata-failed') {
            const notification = new Notification({
                title: 'Falha nos metadados',
                body: `Não foi possível obter metadados de "${item.name}"`,
                silent: false,
            });
            notification.show();
            _log.info(
                `[NotificationManager] Notificação: falha nos metadados — ${item.name}`,
            );
        }
    };

    downloadManager.on('update', onUpdate);

    return {
        dispose(): void {
            (downloadManager as NodeJS.EventEmitter).removeListener('update', onUpdate);
            previousStatus.clear();
        },
    };
}
