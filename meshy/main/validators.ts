// Re-export all validators from the shared module.
// This file exists for backward compatibility with existing imports in main/.
export {
    isValidMagnetUri,
    isValidTorrentFile,
    hasTorrentMagicBytes,
    isValidSpeedLimit,
} from '../shared/validators';
