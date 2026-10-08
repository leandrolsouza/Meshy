# Atualização da Stack — Meshy

| Campo   | Valor                |
|---------|----------------------|
| Data    | 2026-10-08           |
| Node.js | v24.11.0 (ferramenta)|
| npm     | 11.16.0              |

---

## Runtimes Embutidos — Electron

| Electron   | Chromium                     | Node.js    | V8             |
|------------|------------------------------|------------|----------------|
| 41.10.7    | 146.0.7680.x (série 146)     | v24.18.x   | 14.6.202.34    |
| **44.7.0** | **152.0.7977.x (série 152)** | **v24.18.1** | **15.2.124.28** |

> Fonte: [releases.electronjs.org/release/v44.7.0](https://releases.electronjs.org/release/v44.7.0)
> e [electronjs.org/blog/electron-44-0](https://www.electronjs.org/blog/electron-44-0).

---

## Pacotes Atualizados

| Pacote | Versão anterior | Versão nova | Breaking changes | Solução aplicada |
|--------|:---------------:|:-----------:|------------------|-----------------|
| `electron` | 41.10.7 | 44.7.0 | Clipboard não exposto ao renderer; macOS 12 sem suporte; Node v24.18.1 e Chromium 152 embutidos | Nenhuma adaptação — Meshy não usa `clipboard` no renderer; `main/index.ts` usa apenas APIs estáveis (`BrowserWindow`, `app`, `dialog`, `ipcMain`, `session`, `webContents`) |
| `vite` | 7.3.2 | 8.3.4 | Rolldown (Rust) substitui esbuild + Rollup; `optimizeDeps.esbuildOptions` deprecated (auto-convertido); browser targets padrão atualizados | `electron.vite.config.ts` não usa `optimizeDeps.esbuildOptions` — sem ajustes. CVEs `GHSA-v6wh-96g9-6wx3` e `GHSA-fx2h-pf6j-xcff` eliminados |
| `typescript` | 5.9.3 | 6.0.3 | `baseUrl` deprecated (TS5101); `moduleResolution: node10` deprecated (TS5107); `Buffer` global indisponível sem `@types/node`; import side-effect de `*.css` gera TS2882 | (1) Removido `baseUrl`+`paths:{}` de `tsconfig.node.json`. (2) Removido `baseUrl`, corrigido path para `./src/*` em `tsconfig.web.json`. (3) Adicionado `ignoreDeprecations: "6.0"` em `tsconfig.jest.json`. (4) Adicionado `declare module '*.css'` em `src/css-modules.d.ts`. (5) `Buffer` → `Uint8Array` em `shared/validators.ts` |
| `webtorrent` | 2.8.5 | 3.0.21 | Node 22+ obrigatório; `@types/webtorrent` v3 substitui padrão de namespace — `WebTorrent.Instance` e `WebTorrent.TorrentOptions` não existem mais | Removido `WebTorrentInstanceWithThrottle extends WebTorrent.Instance`; `client` tipado como `WebTorrent` (classe); import nomeado `TorrentOptions`; 3 arquivos de teste adaptados (`WebTorrent.Instance` → `WebTorrent`) |
| `@types/webtorrent` | 0.109.7 | 3.0.0 | Padrão de namespace substituído por `export default class WebTorrent` | Incorporado na solução do `webtorrent` acima |
| `@testing-library/dom` | *(ausente)* | 10.4.2 | Peer dep declarada mas não instalada de `@testing-library/react@16` | Adicionado como `devDependency` explícita |
| `electron-log` | 5.4.3 | 5.4.4 | Nenhum | Atualização patch direta |
| `react` | 19.2.5 | 19.3.0 | Nenhum | Atualização minor direta |
| `react-dom` | 19.2.5 | 19.3.0 | Nenhum | Atualização minor direta |
| `react-icons` | 5.6.0 | 5.7.0 | Nenhum | Atualização minor direta |
| `zustand` | 5.0.12 | 5.0.15 | Nenhum | Atualização patch direta |
| `@testing-library/react` | 16.3.2 | 16.3.3 | Nenhum | Atualização patch direta |
| `eslint` | 10.2.1 | 10.12.0 | Nenhum | Atualização minor direta |
| `jest-environment-jsdom` | 30.3.0 | 30.5.2 | Nenhum | Atualização minor direta |
| `prettier` | 3.8.3 | 3.9.9 | Nenhum | Atualização minor direta |
| `ts-jest` | 29.4.9 | 29.4.14 | Nenhum | Atualização patch direta |
| `typescript-eslint` | 8.59.0 | 8.71.1 | Nenhum | Atualização minor direta |

---

## Pacotes Removidos

| Pacote | Tipo | Motivo |
|--------|------|--------|
| `speed-limiter` | `dependencies` | Nenhum import real no código de produção — `main/torrentEngine.ts` usa `WebTorrent.throttleDownload`/`throttleUpload` nativos. Removidos também `main/speed-limiter.d.ts` e o mock obsoleto em `tests/unit/torrentEngine.test.ts` |
| `@electron-toolkit/preload` | `devDependencies` | Zero imports em `src/`, `main/`, `shared/`, `electron/` e `tests/` — confirmado por varredura completa |
| `@electron-toolkit/utils` | `devDependencies` | Zero imports em `src/`, `main/`, `shared/`, `electron/` e `tests/` — confirmado por varredura completa |

---

## Pacotes Mantidos Fixos

| Pacote | Versão atual | Versão disponível | Motivo técnico |
|--------|:------------:|:-----------------:|----------------|
| `electron-vite` | 5.0.0 | 5.0.0 (latest stable) | Já em latest stable. `v6.0.0-beta.7` suporta Vite 8 formalmente, mas `v5.0.0` funciona em runtime com Vite 8.3.4 sem exigir atualização |
| `fast-check` | 3.23.2 | 4.10.2 | **v4 remove `fc.hexaString()`** — instalação do v4 produz dezenas de erros `TS2339: Property 'hexaString' does not exist`, confirmado empiricamente. Migração exigiria refatorar todos os testes de propriedade que usam hashes hex (infoHash, magnet, etc.) |
| `electron-store` | 8.2.0 | 11.0.2 | **ESM-only + incompatibilidade com `moduleResolution: node10`** — `electron-store` v9+ usa `conf@12` (ESM-only). `tsconfig.jest.json` requer `moduleResolution: node10` (obrigatório para `ts-jest@29`), que não resolve tipos de pacotes ESM-only. Confirmado com `TS2339: Property 'get' does not exist on type 'ElectronStore<...>'` |
| `react-intl` | 7.1.14 | 12.1.4 | Gap de 5 major versions (7 → 12). API de `IntlProvider`, hooks e padrões de Provider foram alterados em múltiplas versões. Migração exigiria refatoração abrangente de `src/i18n/`, catálogos de localização e todos os componentes com `useIntl` |
| `jest` | 29.7.0 | 30.5.2 | Requer atualização coordenada de `@types/jest`, `@testing-library/jest-dom` e `ts-jest`. Timer mock API renomeada (`useFakeTimers('modern')` removido); `ts-jest@29` não testado com `jest@30` |
| `@types/jest` | 29.5.14 | 30.0.0 | Tipos realinhados com `jest@30`; manter em sincronia com `jest@29` instalado |
| `@testing-library/jest-dom` | 6.9.1 | 7.0.1 | Exige `jest@30` como peer dependency |
| `@types/node` | 22.x | 26.x | Node.js 22 é a versão base compatível com Electron 44 + Vite 8. Gap de 4 major versions para v26 sem benefício concreto no contexto atual |
| `@vitejs/plugin-react` | 5.2.0 | 6.1.2 | `v5.2.0` já declara `vite: "^8.0.0"` como peer dep — suporte ao Vite 8 confirmado. `v6` exige dependências opcionais adicionais (`@rolldown/plugin-babel`, `oxc-transform-react`) sem nenhuma funcionalidade nova necessária para o Meshy |

---

## Verificação Final

| Verificação | Comando | Resultado |
|-------------|---------|-----------|
| Typecheck main | `npx tsc --noEmit -p tsconfig.node.json` | Exit 0, zero diagnósticos ✓ |
| Typecheck renderer | `npx tsc --noEmit -p tsconfig.web.json` | Exit 0, zero diagnósticos ✓ |
| Typecheck jest | `npx tsc --noEmit -p tsconfig.jest.json` | Exit 0, zero diagnósticos ✓ |
| Lint | `npm run lint` | 0 erros, 200 warnings pré-existentes ✓ |
| Testes | `npm test -- --runInBand` | 62 suítes, 1017 testes — todos passando ✓ |
| Build de produção | `npm run build` | main 1.942 MB, preload 6.44 kB, renderer 911 kB — exit 0 ✓ |
