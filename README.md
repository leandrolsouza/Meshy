# Meshy

Cross-platform desktop torrent client built with Electron, React, and WebTorrent.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.0-green.svg)

## About

Meshy is a BitTorrent client with a modern, VS Code-inspired interface. It runs entirely on the desktop via Electron, using WebTorrent as the download engine and React for the UI.

### Features

- Add torrents via `.torrent` file or magnet link
- Drag & drop `.torrent` files directly into the interface
- Pause, resume, and remove downloads
- Per-file selection within a torrent
- Configurable download and upload speed limits
- Real-time progress bar with speed and peer count
- Session persistence — downloads are restored when the app is reopened
- VS Code-style dark theme interface

## Stack

| Layer       | Technology                                                         |
| ----------- | ------------------------------------------------------------------ |
| Framework   | [Electron](https://www.electronjs.org/) 33                         |
| Build       | [electron-vite](https://electron-vite.org/) + Vite 6               |
| UI          | [React](https://react.dev/) 18                                     |
| State       | [Zustand](https://zustand-demo.pmnd.rs/) 5                         |
| Torrent     | [WebTorrent](https://webtorrent.io/) 2                             |
| Persistence | [electron-store](https://github.com/sindresorhus/electron-store) 8 |
| Language    | TypeScript 5                                                       |

## Architecture

```
meshy/
├── main/               # Main process (Electron)
│   ├── index.ts        # Entry point — creates window and initializes services
│   ├── torrentEngine.ts    # WebTorrent wrapper (add, pause, resume, remove)
│   ├── downloadManager.ts  # Orchestrates downloads, persistence, and events
│   ├── settingsManager.ts  # App settings (destination folder, speed limits)
│   ├── ipcHandler.ts       # IPC handlers between main ↔ renderer
│   ├── validators.ts       # Magnet URI and .torrent file validation
│   └── logger.ts           # Logging via electron-log
├── electron/
│   └── preload.ts      # Preload script — exposes secure API via contextBridge
├── shared/
│   └── types.ts        # Types shared between main and renderer
├── src/                # Renderer process (React)
│   ├── App.tsx         # Root component with Activity Bar + Editor Area layout
│   ├── components/
│   │   ├── AddTorrent/     # Modal and DropZone for adding torrents
│   │   ├── DownloadList/   # Download list with individual items
│   │   ├── FileSelector/   # File selection within a torrent
│   │   ├── Settings/       # Settings panel
│   │   └── common/         # ProgressBar, ConfirmDialog, ErrorBoundary, SpeedDisplay
│   ├── hooks/          # useDownloads, useSettings
│   ├── store/          # Zustand store (downloadStore)
│   ├── utils/          # Formatters (bytes, time)
│   └── styles/         # Global CSS
└── tests/
    ├── unit/           # Unit tests (Jest + Testing Library)
    └── integration/    # Integration tests (IPC, persistence)
```

Inter-process communication uses IPC with `contextIsolation: true` — the renderer never accesses Node.js directly. The API is exposed via `window.meshy` in the preload script.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- npm >= 9

## Installation

```bash
git clone <repository-url>
cd meshy
npm install
```

## Scripts

| Command                 | Description                              |
| ----------------------- | ---------------------------------------- |
| `npm run dev`           | Start the app in development mode        |
| `npm run build`         | Build the app for production             |
| `npm run preview`       | Preview the production build             |
| `npm start`             | Run the compiled app                     |
| `npm test`              | Run tests with Jest                      |
| `npm run test:watch`    | Run tests in watch mode                  |
| `npm run test:coverage` | Generate test coverage report            |
| `npm run typecheck`     | Type-check with TypeScript               |
| `npm run lint`          | Run ESLint                               |
| `npm run lint:fix`      | Run ESLint with auto-fix                 |
| `npm run format`        | Format code with Prettier                |
| `npm run format:check`  | Check formatting without modifying files |

## Development

```bash
npm run dev
```

This starts Electron with hot reload via electron-vite. Changes to the renderer (React) are reflected instantly; changes to the main process restart Electron automatically.

## License

[MIT](LICENSE)
