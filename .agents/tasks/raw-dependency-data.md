# Dados Brutos — Diagnóstico de Dependências (Tarefa 1.1)

> Gerado para uso na Tarefa 1.2 (relatório `dependency-audit.md`).
> Não editar manualmente — substituído a cada re-execução da Tarefa 1.1.

---

## Metadados de Execução

| Campo         | Valor                    |
|---------------|--------------------------|
| Data          | 2026-10-08T12:10:00-03:00 |
| Node.js       | v24.11.0                 |
| npm           | 11.16.0                  |

---

## 1. Versões Instaladas vs. Mais Recentes

Fonte: `package-lock.json` (versões instaladas) + `npm outdated --json` + consulta individual `npm view`.

### dependencies (runtime)

| Pacote          | Instalado  | `package.json` declara | Mais recente (npm) | Delta         |
|-----------------|------------|------------------------|--------------------|---------------|
| electron-log    | 5.4.3      | ^5.2.4                 | 5.4.4              | patch         |
| electron-store  | 8.2.0      | ^8.2.0                 | 11.0.2             | **MAJOR v8→v11** |
| react           | 19.2.5     | 19.2.5                 | 19.3.0             | minor         |
| react-dom       | 19.2.5     | 19.2.5                 | 19.3.0             | minor         |
| react-icons     | 5.6.0      | ^5.6.0                 | 5.7.0              | minor         |
| react-intl      | 7.1.14     | ^7.1.14                | 12.1.4             | **MAJOR v7→v12** |
| speed-limiter   | 1.0.2      | ^1.0.2                 | 1.0.2              | up-to-date    |
| webtorrent      | 2.8.5      | ^2.8.5                 | 3.0.21             | **MAJOR v2→v3** |
| zustand         | 5.0.12     | ^5.0.12                | 5.0.15             | patch         |

### devDependencies

| Pacote                       | Instalado   | `package.json` declara | Mais recente (npm) | Delta             |
|------------------------------|-------------|------------------------|--------------------|-------------------|
| @electron-toolkit/preload    | 3.0.2       | ^3.0.1                 | 3.0.2              | up-to-date        |
| @electron-toolkit/utils      | 3.0.0       | ^3.0.0                 | 4.0.0              | **MAJOR v3→v4**   |
| @eslint/js                   | 10.0.1      | ^10.0.1                | 10.0.1             | up-to-date        |
| @testing-library/jest-dom    | 6.9.1       | ^6.9.1                 | 7.0.1              | **MAJOR v6→v7**   |
| @testing-library/react       | 16.3.2      | ^16.3.2                | 16.3.3             | patch             |
| @types/jest                  | 29.5.14     | ^29.5.14               | 30.0.0             | **MAJOR v29→v30** |
| @types/node                  | 22.19.17    | ^22.10.7               | 26.6.4             | **MAJOR v22→v26** |
| @types/react                 | 19.2.14     | 19.2.14                | 19.2.14            | up-to-date        |
| @types/react-dom             | 19.2.3      | 19.2.3                 | 19.2.3             | up-to-date        |
| @types/webtorrent            | 0.109.10    | ^0.109.7               | 0.109.10           | up-to-date        |
| @vitejs/plugin-react         | 5.2.0       | ^5.2.0                 | 6.1.2              | **MAJOR v5→v6**   |
| electron                     | 41.10.7     | ^41.10.7               | 44.7.0             | **MAJOR v41→v44** |
| electron-vite                | 5.0.0       | ^5.0.0                 | 5.0.0              | up-to-date        |
| eslint                       | 10.2.1      | ^10.2.1                | 10.12.0            | minor             |
| eslint-config-prettier       | 10.1.8      | ^10.1.8                | 10.1.8             | up-to-date        |
| eslint-plugin-react-hooks    | 7.1.1       | ^7.1.1                 | 7.1.1              | up-to-date        |
| fast-check                   | 3.23.2      | ^3.23.2                | 4.10.2             | **MAJOR v3→v4**   |
| identity-obj-proxy           | 3.0.0       | ^3.0.0                 | 3.0.0              | up-to-date        |
| jest                         | 29.7.0      | ^29.7.0                | 30.5.2             | **MAJOR v29→v30** |
| jest-environment-jsdom       | 30.3.0      | ^30.3.0                | 30.5.2             | minor             |
| prettier                     | 3.8.3       | ^3.8.3                 | 3.9.9              | minor             |
| ts-jest                      | 29.4.9      | ^29.2.5                | 29.4.14            | patch             |
| typescript                   | 5.9.3       | ~5.9.3                 | 7.0.2              | **MAJOR v5→v7**   |
| typescript-eslint            | 8.59.0      | ^8.59.0                | 8.71.1             | minor             |
| vite                         | 7.3.2       | ^7.3.2                 | 8.3.4              | **MAJOR v7→v8**   |

---

## 2. Resumo do `npm audit`

```
info:     0
low:      2
moderate: 3
high:     45
critical: 0
total:    50
```

### Vulnerabilidades em dependências DIRETAS

| Pacote        | Severidade | Título / Advisory                                                                  | URL                                                    | Fix disponível         |
|---------------|------------|------------------------------------------------------------------------------------|--------------------------------------------------------|------------------------|
| `vite`        | high       | launch-editor: NTLMv2 hash disclosure via UNC path on Windows                      | https://github.com/advisories/GHSA-v6wh-96g9-6wx3      | Sim (atualizar vite)   |
| `vite`        | high       | vite: `server.fs.deny` bypass on Windows alternate paths                           | https://github.com/advisories/GHSA-fx2h-pf6j-xcff      | Sim (atualizar vite)   |
| `jest`        | high       | Vulnerabilidade transitiva via `@jest/core` e `jest-cli`                           | —                                                      | v30.5.2 (major bump)   |
| `@types/jest` | high       | Vulnerabilidade transitiva via `expect`                                            | —                                                      | v30.0.0 (major bump)   |
| `webtorrent`  | high       | Vulnerabilidade transitiva via `torrent-discovery`                                 | —                                                      | v0.7.3¹ (major bump)   |

¹ A "fix" v0.7.3 indicada pelo npm para webtorrent é inapropriada (versão muito antiga); o correto é avaliar v3.0.21.

### Vulnerabilidades transitivas notáveis (pacotes internos de devDeps)

| Pacote transitivo   | Severidade | Advisories (seleção)                                                   |
|---------------------|------------|------------------------------------------------------------------------|
| `brace-expansion`   | high       | GHSA-jxxr-4gwj-5jf2, GHSA-3jxr-9vmj-r5cp, GHSA-mh99-v99m-4gvg, +5   |
| `browserslist`      | high       | GHSA-c83g-rgw3-j3cx, GHSA-73wf-gq98-2v4g                              |
| `fast-uri`          | high       | GHSA-v2hh-gcrm-f6hx, GHSA-7p8r-x3mc-p8w7, +6                         |
| `ip-address`        | high       | GHSA-v2v4-37r5-5v8g, GHSA-mwp4-54f8-5fhr, +3                         |
| `js-yaml`           | high       | GHSA-h67p-54hq-rp68, GHSA-52cp-r559-cp3m, +2                          |
| `nanoid`            | high       | GHSA-28wg-ghj8-5hjv, GHSA-2v37-7h3g-55p8, GHSA-xwg4-73v4-xw9w        |
| `postcss`           | high       | GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849        |
| `ip`                | high       | GHSA-2p57-rm9w-gvfp                                                    |
| `ws`                | high       | GHSA-58qx-3vcg-4xpx, GHSA-96hv-2xvq-fx4p                             |
| `source-map-js`     | high       | GHSA-68fv-2mgg-jv7q                                                    |
| `@babel/core`       | low        | GHSA-4x5r-pxfx-6jf8                                                    |
| `esbuild`           | low        | GHSA-g7r4-m6w7-qqqr                                                    |
| `baseline-browser-mapping` | moderate | GHSA-w5vr-8v7q-w6rv                                           |
| `sprintf-js`        | moderate   | GHSA-hp3w-g68c-fv3c                                                    |

> Nota: praticamente todas as vulnerabilidades altas são transitivas de `jest` e `webtorrent`.
> Atualizar esses dois pacotes para as versões major mais recentes resolve a maioria.

---

## 3. Varredura de Imports

Diretórios varridos: `src/`, `main/`, `shared/`, `electron/`, `tests/`  
Padrão: `(from|require)\s*['"]<pacote>(/.*)?['"]`

### Resultado por pacote

#### dependencies — runtime

| Pacote          | Importado nos dirs | Observação                                                                 |
|-----------------|--------------------|----------------------------------------------------------------------------|
| electron-log    | ✅ sim             | `main/*.ts` via `import { logger } from './logger'` (wrapper interno)      |
| electron-store  | ✅ sim             | `main/settingsManager.ts`                                                  |
| react           | ✅ sim             | múltiplos arquivos em `src/`                                               |
| react-dom       | ✅ sim             | `src/main.tsx`                                                             |
| react-icons     | ✅ sim             | múltiplos componentes em `src/components/`                                 |
| react-intl      | ✅ sim             | múltiplos componentes em `src/`                                            |
| **speed-limiter** | ❌ **não**       | Apenas `main/speed-limiter.d.ts` (type decl. local) e mock em `tests/unit/torrentEngine.test.ts` — nenhum `import` real |
| webtorrent      | ✅ sim             | `main/torrentEngine.ts`                                                    |
| zustand         | ✅ sim             | `src/store/*.ts`, hooks                                                    |

#### devDependencies — tooling

| Pacote                       | Importado nos dirs | Observação                                                                          |
|------------------------------|--------------------|-------------------------------------------------------------------------------------|
| @electron-toolkit/preload    | ❌ não             | Não encontrado em nenhum arquivo de src/, main/, shared/, electron/, tests/ nem em config de raiz |
| @electron-toolkit/utils      | ❌ não             | Idem — sem nenhuma referência além de package.json e package-lock.json              |
| @eslint/js                   | ❌ (config)        | Usado em `eslint.config.mjs` (raiz) — fora do escopo de varredura, mas é tooling essencial |
| @testing-library/jest-dom    | ✅ sim             | 25 arquivos de teste importam `@testing-library/jest-dom`                           |
| @testing-library/react       | ✅ sim             | Múltiplos arquivos de teste em `tests/`                                             |
| @types/jest                  | ❌ (implícito)     | Tipagem TypeScript — consumida implicitamente pelo compilador                       |
| @types/node                  | ❌ (implícito)     | Tipagem TypeScript — consumida implicitamente                                       |
| @types/react                 | ❌ (implícito)     | Tipagem TypeScript — consumida implicitamente                                       |
| @types/react-dom             | ❌ (implícito)     | Tipagem TypeScript — consumida implicitamente                                       |
| @types/webtorrent            | ❌ (implícito)     | Tipagem TypeScript — consumida implicitamente                                       |
| @vitejs/plugin-react         | ❌ (config)        | Importado em `electron.vite.config.ts` (raiz) — tooling essencial                  |
| electron                     | ✅ sim             | `electron/preload.ts`, `main/index.ts`, outros                                      |
| electron-vite                | ❌ (config)        | Importado em `electron.vite.config.ts` (raiz) e invocado via scripts npm            |
| eslint                       | ❌ (scripts)       | Invocado via `npm run lint` — tooling                                               |
| eslint-config-prettier       | ❌ (config)        | Importado em `eslint.config.mjs` (raiz)                                             |
| eslint-plugin-react-hooks    | ❌ (config)        | Importado em `eslint.config.mjs` (raiz)                                             |
| fast-check                   | ✅ sim             | Múltiplos arquivos PBT em `tests/unit/`                                             |
| identity-obj-proxy           | ❌ (config)        | Referenciado em `jest.config.js` como moduleNameMapper                              |
| jest                         | ❌ (scripts)       | Invocado via `npm test` — tooling                                                   |
| jest-environment-jsdom       | ❌ (config)        | Referenciado em `jest.config.js`                                                    |
| prettier                     | ❌ (scripts)       | Invocado via `npm run format` — tooling                                             |
| ts-jest                      | ❌ (config)        | Preset em `jest.config.js`                                                          |
| typescript                   | ❌ (scripts)       | Invocado via `npx tsc` — tooling                                                    |
| typescript-eslint            | ❌ (config)        | Importado em `eslint.config.mjs` (raiz)                                             |
| vite                         | ❌ (peer/bundled)  | Peer dep de electron-vite; bundler invocado via electron-vite                       |

---

## 4. Candidatos à Remoção

| Pacote                    | Tipo    | Evidência de ausência de uso                                              |
|---------------------------|---------|---------------------------------------------------------------------------|
| `speed-limiter`           | dep     | Nenhum `import` em src/, main/, shared/, electron/, tests/. Apenas `.d.ts` local e mock em teste. O throttle no `torrentEngine` usa API nativa do WebTorrent (`throttleDownload`/`throttleUpload`), não `speed-limiter`. |
| `@electron-toolkit/preload` | devDep | Nenhum `import` em qualquer arquivo de código-fonte ou config de raiz.     |
| `@electron-toolkit/utils`   | devDep | Idem — zero referências além de declarações em package.json.               |

---

## 5. Notas para a Tarefa 1.2

- `speed-limiter` está declarado em `dependencies` (runtime) mas nunca é importado — candidato a `remover`.
- `@electron-toolkit/preload` e `@electron-toolkit/utils` aparecem em devDeps sem qualquer uso — candidatos a `remover`.
- `jest`/`@types/jest`: atualização para v30 é breaking change (renomeações de API, mudanças de comportamento de fakes/timers). Requer revisão dos mocks existentes.
- `vite` 7.3.2 tem 2 CVEs altas em ambiente Windows; fix requer bump para v8.x (breaking change).
- `webtorrent` v3 é MAJOR — requer análise do changelog para adaptações em `main/torrentEngine.ts` e `main/webtorrentInternals.ts`.
- `electron-store` v11 é MAJOR (v8→v11) — API mudou (ESM-only e mudança de instanciação).
- `react-intl` v12 é MAJOR (v7→v12) — 5 versões major de gap; requer análise profunda do changelog.
- `typescript` v7 é MAJOR — avaliar breaking changes do compilador antes de atualizar.
- `fast-check` v4 é MAJOR — verificar se há mudanças de API nos geradores usados nos PBT tests.
- `electron` v44 é MAJOR (v41→v44) — 3 releases major; verificar compatibilidade com electron-vite e node/chromium bundled.
