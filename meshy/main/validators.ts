// Re-export all validators from the shared module.
// This file exists for backward compatibility with existing imports in main/.
export {
    isValidMagnetUri,
    isValidTorrentFile,
    hasTorrentMagicBytes,
    isValidSpeedLimit,
    isValidMaxConcurrentDownloads,
    MIN_CONCURRENT_DOWNLOADS,
    MAX_CONCURRENT_DOWNLOADS,
    DEFAULT_MAX_CONCURRENT_DOWNLOADS,
} from '../shared/validators';
