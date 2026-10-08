# Project Structure

## Top-Level Layout

```
meshy/
├── main/           # Electron main process (Node.js)
├── electron/       # Preload script
├── shared/         # Code shared between main and renderer
├── src/            # Renderer process (React)
├── tests/          # All tests (unit + integration)
├── docs/           # Project documentation
└── out/            # Build output (gitignored)
```

## Main Process (`main/`)

| File | Role |
|------|------|
| `index.ts` | Entry point — creates `BrowserWindow` (CSP, sandbox, navigation guards), wires up services via factory functions, restores session, registers IPC handlers |
| `torrentEngine.ts` | WebTorrent wrapper (`createTorrentEngine`) — add, pause, resume, remove |
| `downloadManager.ts` | Download orchestration, queue, persistence (`createDownloadManager`) |
| `settingsManager.ts` | Read/write `AppSettings` via `electron-store` (`createSettingsManager`) |
| `settingsValidator.ts` | Validates settings before saving |
| `ipcHandler.ts` | Registers all `ipcMain.handle(...)` handlers; `attachWindowEvents` starts the 1-second progress push |
| `payloadValidator.ts` | Validates IPC payloads before handler logic runs |
| `validators.ts` | Server-side validation (magnet URIs, `.torrent` files) |
| `notificationManager.ts` | Native OS notifications on download completion |
| `metrics.ts` | Operation counters and renderer crash tracking |
| `logger.ts` | `electron-log` wrapper |
| `webtorrentInternals.ts` | Access to WebTorrent internals |

## Preload (`electron/preload.ts`)

Exposes the complete `MeshyAPI` to the renderer via `contextBridge.exposeInMainWorld('meshy', ...)`. All methods are thin wrappers over `ipcRenderer.invoke`. Two push subscriptions (`onProgress`, `onError`) return cleanup functions.

## Shared Layer (`shared/`)

| File | Role |
|------|------|
| `types.ts` | **Single source of truth** for all cross-process types: `DownloadItem`, `AppSettings`, `IPCResponse<T>`, `MeshyAPI`, `TorrentStatus`, and all supporting interfaces. Also augments `Window` with `meshy: MeshyAPI`. |
| `validators.ts` | Shared validation logic (magnet URIs, torrent files, speed limits) |
| `formatters.ts` | Shared formatters |
| `errorCodes.ts` | Standardized error codes |

Both `tsconfig.node.json` and `tsconfig.web.json` include `shared/**/*` — no duplication needed.

## Renderer (`src/`)

```
src/
├── App.tsx             # Root component — VS Code-style layout
├── main.tsx            # React entry point
├── components/
│   ├── AddTorrent/     # AddTorrentModal, DropZone
│   ├── DownloadList/   # DownloadList, DownloadItem, toolbar, filters, search, sort
│   ├── DownloadDetails/# DetailsPanel with tabs: General, Speed, Peers, Pieces
│   ├── FileSelector/   # File selection UI inside a torrent
│   ├── Settings/       # SettingsPanel with sub-panels (General, Network, Themes, etc.)
│   ├── TrackerPanel/   # Tracker management UI
│   └── common/         # ProgressBar, ConfirmDialog, ErrorBoundary, SpeedDisplay
├── hooks/              # useDownloads, useSettings, useTrackers
├── store/              # Zustand stores: downloadStore, filterStore
├── i18n/               # IntlWrapper, useLocale hook
├── locales/            # pt-BR.json, en-US.json
├── themes/             # themeRegistry (definitions), themeApplier (CSS variable injection)
├── utils/              # Formatters, filters, error resolution
└── styles/             # Global CSS
```

## Tests (`tests/`)

```
tests/
├── setup.ts            # Global Jest setup
├── unit/               # Unit tests (~35 files)
└── integration/        # Integration tests (IPC, session persistence)
```

## Architecture Patterns

**IPC isolation**: The renderer never accesses Node.js directly. All communication goes through `window.meshy` (defined in `preload.ts`).

**Factory functions**: Main process services use factory functions (`createTorrentEngine`, `createDownloadManager`, `createSettingsManager`), not classes.

**IPCResponse pattern**: Every IPC handler returns `IPCResponse<T>` — `{ success: true, data: T }` or `{ success: false, error: string }`. Callers always check `response.success` before using `response.data`.

**IPC channel naming**: `domain:action` kebab-case — e.g., `torrent:add-file`, `settings:get`, `tracker:add`, `queue:reorder`.

**Push events**: `torrent:progress` (every 1 second, sends `DownloadItem[]`) and `torrent:error` are pushed from main to renderer via `webContents.send(...)`.

**CSS Modules**: Every component has a co-located `ComponentName.module.css` file.

**Zustand selectors**: Select individual state slices in components to minimize re-renders.

**Shared types**: Any type crossing the process boundary lives only in `shared/types.ts`.

**Comment banners**: Section dividers use `// ─── Section Name ────` style throughout main process files.

**i18n**: All user-facing strings use `react-intl` — never hardcoded. Use `intl.formatMessage({ id: '...' })` or `<FormattedMessage>`.
