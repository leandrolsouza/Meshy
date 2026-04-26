# Meshy

Cliente torrent desktop multiplataforma construído com Electron, React e WebTorrent.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.0-green.svg)

## Sobre

Meshy é um cliente BitTorrent com interface moderna inspirada no VS Code. Roda inteiramente no desktop via Electron, usando WebTorrent como engine de download e React para a UI.

### Funcionalidades

- Adicionar torrents via arquivo `.torrent` ou magnet link
- Arrastar e soltar arquivos `.torrent` direto na interface
- Pausar, retomar e remover downloads
- Seleção individual de arquivos dentro de um torrent
- Limites configuráveis de velocidade de download e upload
- Barra de progresso em tempo real com velocidade e contagem de peers
- Persistência de sessão — downloads são restaurados ao reabrir o app
- Interface com tema escuro estilo VS Code
- Suporte a temas customizáveis com registro e aplicação dinâmica
- Internacionalização (i18n) com suporte a pt-BR e en-US
- Painel de trackers para gerenciamento de fontes
- Notificações nativas do sistema operacional
- Métricas e monitoramento de performance
- Filtros avançados na lista de downloads

## Stack

| Camada      | Tecnologia                                                         |
| ----------- | ------------------------------------------------------------------ |
| Framework   | [Electron](https://www.electronjs.org/) 33                         |
| Build       | [electron-vite](https://electron-vite.org/) + Vite 7               |
| UI          | [React](https://react.dev/) 19                                     |
| Estado      | [Zustand](https://zustand-demo.pmnd.rs/) 5                         |
| Torrent     | [WebTorrent](https://webtorrent.io/) 2                             |
| Persistência| [electron-store](https://github.com/sindresorhus/electron-store) 8 |
| i18n        | [react-intl](https://formatjs.io/docs/react-intl/) 7               |
| Linguagem   | TypeScript 5 (strict mode)                                         |
| Logging     | [electron-log](https://github.com/megahertz/electron-log) 5       |
| Testes      | Jest 29 + ts-jest + @testing-library/react                         |
| PBT         | [fast-check](https://fast-check.dev/) 3                            |
| Linting     | ESLint 10 + typescript-eslint 8                                    |
| Formatação  | Prettier 3                                                         |

## Arquitetura

```
meshy/
├── main/                   # Processo principal (Electron / Node.js)
│   ├── index.ts            # Entry point — cria BrowserWindow e inicializa serviços
│   ├── torrentEngine.ts    # Wrapper do WebTorrent (add, pause, resume, remove)
│   ├── downloadManager.ts  # Orquestra downloads, persistência e estado
│   ├── settingsManager.ts  # Configurações do app (pasta destino, limites de velocidade)
│   ├── settingsValidator.ts# Validação de configurações
│   ├── ipcHandler.ts       # Registro de handlers IPC (main ↔ renderer)
│   ├── validators.ts       # Validação server-side (magnet URIs, arquivos .torrent)
│   ├── payloadValidator.ts # Validação de payloads IPC
│   ├── notificationManager.ts # Notificações nativas do SO
│   ├── metrics.ts          # Métricas e monitoramento de performance
│   ├── logger.ts           # Logging via electron-log
│   └── webtorrentInternals.ts # Acesso a internals do WebTorrent
├── electron/
│   └── preload.ts          # Preload — expõe API segura via contextBridge
├── shared/                 # Código compartilhado entre main e renderer
│   ├── types.ts            # Interfaces e tipos (fonte única de verdade)
│   ├── validators.ts       # Validações compartilhadas (magnet, torrent, limites)
│   ├── formatters.ts       # Formatadores compartilhados
│   └── errorCodes.ts       # Códigos de erro padronizados
├── src/                    # Processo renderer (React)
│   ├── App.tsx             # Componente raiz (layout Activity Bar + Editor Area)
│   ├── main.tsx            # Entry point do React
│   ├── components/
│   │   ├── AddTorrent/     # Modal e DropZone para adicionar torrents
│   │   ├── DownloadList/   # Lista de downloads com itens individuais e toolbar
│   │   ├── FileSelector/   # Seleção de arquivos dentro de um torrent
│   │   ├── Settings/       # Painel de configurações (geral, rede, transferência, temas, idioma, trackers)
│   │   ├── TrackerPanel/   # Painel de gerenciamento de trackers
│   │   └── common/         # ProgressBar, ConfirmDialog, ErrorBoundary, SpeedDisplay
│   ├── hooks/              # useDownloads, useSettings, useTrackers
│   ├── store/              # Zustand stores (downloadStore, filterStore)
│   ├── i18n/               # IntlWrapper e hook useLocale
│   ├── locales/            # Arquivos de tradução (pt-BR, en-US)
│   ├── themes/             # Registro e aplicação de temas
│   ├── utils/              # Formatadores, filtros, resolução de erros
│   └── styles/             # CSS global
└── tests/
    ├── setup.ts            # Setup global do Jest
    ├── unit/               # Testes unitários (~35 arquivos)
    └── integration/        # Testes de integração (IPC, persistência de sessão)
```

### Padrões de Arquitetura

- **IPC com isolamento de contexto**: O renderer nunca acessa Node.js diretamente. Toda comunicação passa por `window.meshy` (definido em `preload.ts`) usando `ipcRenderer.invoke` / `ipcMain.handle`.
- **Factory functions**: Serviços do processo principal (`createTorrentEngine`, `createDownloadManager`, `createSettingsManager`) usam factory functions, não classes.
- **Respostas IPC tipadas**: Todos os handlers IPC retornam `IPCResponse<T>` — `{ success: true, data: T }` ou `{ success: false, error: string }`.
- **Zustand stores**: Store principal (`useDownloadStore`) para itens de download e `filterStore` para filtros. O hook `useDownloads` encapsula chamadas IPC e atualizações do store.
- **CSS Modules**: Estilos dos componentes usam arquivos `*.module.css` co-localizados.
- **Tipos compartilhados**: `shared/types.ts` é a fonte única de verdade para tipos usados em ambos os processos.
- **i18n com react-intl**: Suporte a múltiplos idiomas via ICU Message Format, com fallback chain e persistência de preferência de idioma.
- **Temas dinâmicos**: Sistema de registro e aplicação de temas com `themeRegistry` e `themeApplier`.

## Pré-requisitos

- [Node.js](https://nodejs.org/) >= 18
- npm >= 9

## Instalação

```bash
git clone <repository-url>
cd meshy
npm install
```

## Scripts

| Comando                 | Descrição                                |
| ----------------------- | ---------------------------------------- |
| `npm run dev`           | Inicia o app em modo de desenvolvimento  |
| `npm run build`         | Build de produção                        |
| `npm run preview`       | Preview do build de produção             |
| `npm start`             | Executa o app compilado                  |
| `npm test`              | Roda testes com Jest                     |
| `npm run test:watch`    | Roda testes em modo watch                |
| `npm run test:coverage` | Gera relatório de cobertura de testes    |
| `npm run typecheck`     | Type-check com TypeScript (`tsc --noEmit`) |
| `npm run lint`          | Roda ESLint                              |
| `npm run lint:fix`      | Roda ESLint com auto-fix                 |
| `npm run format`        | Formata código com Prettier              |
| `npm run format:check`  | Verifica formatação sem modificar arquivos |

## Desenvolvimento

```bash
npm run dev
```

Inicia o Electron com hot reload via electron-vite. Alterações no renderer (React) são refletidas instantaneamente; alterações no processo principal reiniciam o Electron automaticamente.

## Configuração TypeScript

O projeto usa referências de projeto compostas com três configs:

- `tsconfig.node.json` — processo principal + preload + shared (target ES2022, module ES2022)
- `tsconfig.web.json` — processo renderer + shared (target ES2020, JSX react-jsx)
- `tsconfig.jest.json` — ambiente de testes (CommonJS, resolução node)

O alias `@renderer/*` mapeia para `src/*` na config do renderer.

## Testes

```bash
npm test                # roda todos os testes
npm run test:watch      # modo watch
npm run test:coverage   # com relatório de cobertura
```

- Jest roda com preset `ts-jest` e `tsconfig.jest.json`
- Ambiente padrão `node`; `jsdom` disponível para testes de componentes
- CSS modules mockados via `identity-obj-proxy`
- Testes em `tests/unit/` e `tests/integration/`
- Testes de propriedade com `fast-check`

## Licença

[MIT](LICENSE)
