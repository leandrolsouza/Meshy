// shared/errorCodes.ts — constantes de códigos de erro estruturados
//
// O processo principal retorna estes códigos em vez de strings em português.
// O renderer resolve cada código para a string localizada via intl.formatMessage().

export const ErrorCodes = {
    // Torrent
    INVALID_FILE_PATH: 'error.torrent.invalidFilePath',
    INVALID_MAGNET_URI: 'error.torrent.invalidMagnetUri',
    TORRENT_DUPLICATE: 'error.torrent.duplicate',
    TORRENT_NOT_FOUND: 'error.torrent.notFound',

    // Engine
    ENGINE_RESTARTING: 'error.engine.restarting',
    ENGINE_NOT_AVAILABLE: 'error.engine.notAvailable',

    // Parâmetros / validação
    INVALID_PARAMS: 'error.params.invalid',
    INVALID_SPEED_LIMIT: 'error.params.invalidSpeedLimit',

    // Tracker
    INVALID_TRACKER_URL: 'error.tracker.invalidUrl',
    TRACKER_DUPLICATE: 'error.tracker.duplicate',
    TRACKER_NOT_FOUND: 'error.tracker.notFound',

    // Settings
    NO_FOLDER_SELECTED: 'error.settings.noFolderSelected',
    INVALID_SETTINGS_PAYLOAD: 'error.settings.invalidPayload',
    INVALID_LOCALE: 'error.settings.invalidLocale',

    // Seleção de arquivos
    FILE_SELECTION_EMPTY: 'error.files.selectionEmpty',
    FILE_INDEX_INVALID: 'error.files.indexInvalid',

    // Destino (pasta/arquivo)
    DESTINATION_FOLDER_NOT_FOUND: 'error.destination.folderNotFound',
    DESTINATION_FILE_NOT_FOUND: 'error.destination.fileNotFound',
    DESTINATION_OPEN_FAILED: 'error.destination.openFailed',
    DESTINATION_NOT_COMPLETED: 'error.destination.notCompleted',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
