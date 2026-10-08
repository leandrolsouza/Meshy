import type { AppSettings, BandwidthSettings, BandwidthStatus } from './types';

export function createDefaultBandwidthSettings(): BandwidthSettings {
    return {
        manualEnabled: false,
        downloadLimit: 128,
        uploadLimit: 32,
        scheduleEnabled: false,
        days: [1, 2, 3, 4, 5],
        start: '09:00',
        end: '18:00',
    };
}

export function isValidBandwidthSettings(value: unknown): value is BandwidthSettings {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as BandwidthSettings;
    const time = (v: unknown) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
    const limit = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
    return (
        typeof candidate.manualEnabled === 'boolean' &&
        typeof candidate.scheduleEnabled === 'boolean' &&
        limit(candidate.downloadLimit) &&
        limit(candidate.uploadLimit) &&
        Array.isArray(candidate.days) &&
        candidate.days.length > 0 &&
        candidate.days.length <= 7 &&
        new Set(candidate.days).size === candidate.days.length &&
        candidate.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
        time(candidate.start) &&
        time(candidate.end) &&
        candidate.start !== candidate.end
    );
}

/** Intervalos incluem o início e excluem o fim; a madrugada pertence ao dia de início. */
export function getEffectiveBandwidth(settings: AppSettings, date = new Date()): BandwidthStatus {
    const config = settings.bandwidth ?? createDefaultBandwidthSettings();
    const minute = date.getHours() * 60 + date.getMinutes();
    const parse = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    const start = parse(config.start);
    const end = parse(config.end);
    const day = date.getDay();
    const scheduled =
        config.scheduleEnabled &&
        (start < end
            ? config.days.includes(day) && minute >= start && minute < end
            : (config.days.includes(day) && minute >= start) ||
              (config.days.includes((day + 6) % 7) && minute < end));
    const light = config.manualEnabled || scheduled;
    const cap = (normal: number, reduced: number) =>
        normal === 0 ? reduced : Math.min(normal, reduced);
    return {
        mode: config.manualEnabled ? 'manual' : scheduled ? 'scheduled' : 'normal',
        manualEnabled: config.manualEnabled,
        downloadLimit: light
            ? cap(settings.downloadSpeedLimit, config.downloadLimit)
            : settings.downloadSpeedLimit,
        uploadLimit: light
            ? cap(settings.uploadSpeedLimit, config.uploadLimit)
            : settings.uploadSpeedLimit,
    };
}
