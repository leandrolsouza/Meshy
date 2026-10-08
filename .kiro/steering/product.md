# Meshy — Product Overview

Meshy is a cross-platform desktop BitTorrent client built with Electron, React, and WebTorrent. The UI is inspired by VS Code — dark theme, Activity Bar navigation, and a keyboard-friendly layout.

## Core Features

- Add torrents via `.torrent` file, magnet link, or drag-and-drop
- Pause, resume, remove downloads
- Per-torrent file selection (choose which files inside a torrent to download)
- Configurable download/upload speed limits and max concurrent downloads
- Real-time progress, speed, and peer count updates (pushed from main every second)
- Session persistence — downloads are restored on relaunch
- Tracker management (per-torrent and global favorites)
- Native OS notifications on download completion
- Customizable themes with dynamic application via CSS variables
- i18n support: `pt-BR` and `en-US`
- Metrics and observability (operation counters, renderer crash detection)
- Advanced network settings: DHT, PEX, uTP toggles

## Target Users

Developers and power users who want a modern, configurable torrent client that runs on the desktop.

## Version & License

v0.1.0 — MIT
