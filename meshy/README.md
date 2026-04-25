# Meshy

Cliente torrent desktop multiplataforma, construído com Electron, React e WebTorrent.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.0-green.svg)

## Sobre

Meshy é um cliente BitTorrent com interface moderna inspirada no VS Code. Ele roda inteiramente no desktop via Electron, usando WebTorrent como engine de download e React para a interface do usuário.

### Funcionalidades

- Adicionar torrents via arquivo `.torrent` ou magnet link
- Drag & drop de arquivos `.torrent` direto na interface
- Pausar, retomar e remover downloads
- Seleção individual de arquivos dentro de um torrent
- Limites configuráveis de velocidade de download e upload
- Barra de progresso em tempo real com velocidade e peers
- Persistência de sessão — downloads são restaurados ao reabrir o app
- Interface com tema escuro estilo VS Code

## Stack

| Camada       | Tecnologia                                                         |
| ------------ | ------------------------------------------------------------------ |
| Framework    | [Electron](https://www.electronjs.org/) 33                         |
| Build        | [electron-vite](https://electron-vite.org/) + Vite 6               |
| UI           | [React](https://react.dev/) 18                                     |
| Estado       | [Zustand](https://zustand-demo.pmnd.rs/) 5                         |
| Torrent      | [WebTorrent](https://webtorrent.io/) 2                             |
| Persistência | [electron-store](https://github.com/sindresorhus/electron-store) 8 |
| Linguagem    | TypeScript 5                                                       |

## Arquitetura

```
meshy/
├── main/               # Processo principal (Electron)
│   ├── index.ts        # Entry point — cria janela e inicializa serviços
│   ├── torrentEngine.ts    # Wrapper sobre WebTorrent (add, pause, resume, remove)
│   ├── downloadManager.ts  # Orquestra downloads, persistência e eventos
│   ├── settingsManager.ts  # Configurações do app (pasta destino, limites)
│   ├── ipcHandler.ts       # Handlers IPC entre main ↔ renderer
│   ├── validators.ts       # Validação de magnet URIs e arquivos .torrent
│   └── logger.ts           # Logging via electron-log
├── electron/
│   └── preload.ts      # Preload script — expõe API segura via contextBridge
├── shared/
│   └── types.ts        # Tipos compartilhados entre main e renderer
├── src/                # Processo renderer (React)
│   ├── App.tsx         # Componente raiz com layout Activity Bar + Editor Area
│   ├── components/
│   │   ├── AddTorrent/     # Modal e DropZone para adicionar torrents
│   │   ├── DownloadList/   # Lista de downloads com itens individuais
│   │   ├── FileSelector/   # Seleção de arquivos dentro de um torrent
│   │   ├── Settings/       # Painel de configurações
│   │   └── common/         # ProgressBar, ConfirmDialog, ErrorBoundary, SpeedDisplay
│   ├── hooks/          # useDownloads, useSettings
│   ├── store/          # Zustand store (downloadStore)
│   ├── utils/          # Formatadores (bytes, tempo)
│   └── styles/         # CSS global
└── tests/
    ├── unit/           # Testes unitários (Jest + Testing Library)
    └── integration/    # Testes de integração (IPC, persistência)
```

A comunicação entre processos usa IPC com `contextIsolation: true` — o renderer nunca acessa Node.js diretamente. A API é exposta via `window.meshy` no preload script.

## Pré-requisitos

- [Node.js](https://nodejs.org/) >= 18
- npm >= 9

## Instalação

```bash
git clone <url-do-repositorio>
cd meshy
npm install
```

## Scripts

| Comando                 | Descrição                                |
| ----------------------- | ---------------------------------------- |
| `npm run dev`           | Inicia o app em modo desenvolvimento     |
| `npm run build`         | Compila o app para produção              |
| `npm run preview`       | Preview do build de produção             |
| `npm start`             | Executa o app compilado                  |
| `npm test`              | Roda os testes com Jest                  |
| `npm run test:watch`    | Roda os testes em modo watch             |
| `npm run test:coverage` | Gera relatório de cobertura de testes    |
| `npm run typecheck`     | Verifica tipos com TypeScript            |
| `npm run lint`          | Roda o ESLint                            |
| `npm run lint:fix`      | Roda o ESLint e corrige automaticamente  |
| `npm run format`        | Formata o código com Prettier            |
| `npm run format:check`  | Verifica formatação sem alterar arquivos |

## Desenvolvimento

```bash
npm run dev
```

Isso inicia o Electron com hot reload via electron-vite. Alterações no renderer (React) são refletidas instantaneamente; alterações no main process reiniciam o Electron automaticamente.

## Licença

[MIT](LICENSE)
