# Auditoria de Dependências — Meshy

| Campo     | Valor                     |
|-----------|---------------------------|
| Data      | 2026-10-08                |
| Node.js   | v24.11.0                  |
| npm       | 11.16.0                   |
| Fonte     | `raw-dependency-data.md` (gerado pela Tarefa 1.1) |

---

## Sumário Executivo

| Classificação        | Runtime (`dependencies`) | Dev (`devDependencies`) | Total |
|----------------------|:------------------------:|:------------------------:|:-----:|
| `atualização-segura` | 5                        | 14                       | 19    |
| `breaking-change`    | 3                        | 9                        | 12    |
| `remover`            | 1                        | 2                        | 3     |
| **Total auditado**   | **9**                    | **25**                   | **34**|

Vulnerabilidades identificadas pelo `npm audit`: **50 total** — 0 críticas, 45 altas,
3 moderadas, 2 baixas. Praticamente todas as altas são transitivas de `jest` e
`webtorrent`; a atualização de ambos para as versões major mais recentes resolve a
maioria.

---

## Tabela Completa de Auditoria

### dependencies (runtime)

| Pacote | Versão atual | Última versão | Classificação | Vulnerabilidades | Breaking changes |
|--------|:------------:|:-------------:|:-------------:|:----------------:|-----------------|
| `electron-log` | 5.4.3 | 5.4.4 | `atualização-segura` | nenhuma | nenhuma (patch) |
| `electron-store` | 8.2.0 | 11.0.2 | `breaking-change` | nenhuma direta | v9: ESM-only; API de instanciação alterada (ver §BC-1) |
| `react` | 19.2.5 | 19.3.0 | `atualização-segura` | nenhuma | nenhuma (minor) |
| `react-dom` | 19.2.5 | 19.3.0 | `atualização-segura` | nenhuma | nenhuma (minor) |
| `react-icons` | 5.6.0 | 5.7.0 | `atualização-segura` | nenhuma | nenhuma (minor) |
| `react-intl` | 7.1.14 | 12.1.4 | `breaking-change` | nenhuma direta | gap de 5 major; API de Provider e hooks alterada (ver §BC-2) |
| `speed-limiter` | 1.0.2 | 1.0.2 | `remover` | nenhuma | n/a — sem uso (ver §REM-1) |
| `webtorrent` | 2.8.5 | 3.0.21 | `breaking-change` | alta transitiva via `torrent-discovery` | reescrita major; API de `add`, eventos e `files` alterada (ver §BC-3) |
| `zustand` | 5.0.12 | 5.0.15 | `atualização-segura` | nenhuma | nenhuma (patch) |

### devDependencies

| Pacote | Versão atual | Última versão | Classificação | Vulnerabilidades | Breaking changes |
|--------|:------------:|:-------------:|:-------------:|:----------------:|-----------------|
| `@electron-toolkit/preload` | 3.0.2 | 3.0.2 | `remover` | nenhuma | n/a — sem uso (ver §REM-2) |
| `@electron-toolkit/utils` | 3.0.0 | 4.0.0 | `remover` | nenhuma | n/a — sem uso (ver §REM-3) |
| `@eslint/js` | 10.0.1 | 10.0.1 | `atualização-segura` | nenhuma | up-to-date |
| `@testing-library/jest-dom` | 6.9.1 | 7.0.1 | `breaking-change` | nenhuma direta | matchers removidos; setup de importação alterado (ver §BC-4) |
| `@testing-library/react` | 16.3.2 | 16.3.3 | `atualização-segura` | nenhuma | nenhuma (patch) |
| `@types/jest` | 29.5.14 | 30.0.0 | `breaking-change` | alta transitiva via `expect` | tipos realinhados com jest v30; timer mock APIs alteradas (ver §BC-5) |
| `@types/node` | 22.19.17 | 26.6.4 | `breaking-change` | nenhuma direta | gap de 4 major; globals e tipos de módulo Node.js atualizados (ver §BC-6) |
| `@types/react` | 19.2.14 | 19.2.14 | `atualização-segura` | nenhuma | up-to-date |
| `@types/react-dom` | 19.2.3 | 19.2.3 | `atualização-segura` | nenhuma | up-to-date |
| `@types/webtorrent` | 0.109.10 | 0.109.10 | `atualização-segura` | nenhuma | up-to-date |
| `@vitejs/plugin-react` | 5.2.0 | 6.1.2 | `breaking-change` | nenhuma direta | opções de configuração do plugin alteradas (ver §BC-7) |
| `electron` | 41.10.7 | 44.7.0 | `breaking-change` | nenhuma direta | 3 releases major; Node.js/Chromium embutidos atualizados; APIs deprecadas removidas (ver §BC-8) |
| `electron-vite` | 5.0.0 | 5.0.0 | `atualização-segura` | nenhuma | up-to-date |
| `eslint` | 10.2.1 | 10.12.0 | `atualização-segura` | nenhuma | nenhuma (minor) |
| `eslint-config-prettier` | 10.1.8 | 10.1.8 | `atualização-segura` | nenhuma | up-to-date |
| `eslint-plugin-react-hooks` | 7.1.1 | 7.1.1 | `atualização-segura` | nenhuma | up-to-date |
| `fast-check` | 3.23.2 | 4.10.2 | `breaking-change` | nenhuma direta | APIs de arbitrários renomeadas; comportamento de shrinking alterado (ver §BC-9) |
| `identity-obj-proxy` | 3.0.0 | 3.0.0 | `atualização-segura` | nenhuma | up-to-date |
| `jest` | 29.7.0 | 30.5.2 | `breaking-change` | alta transitiva via `@jest/core` e `jest-cli` | timer mock renomeado; formato de configuração alterado (ver §BC-10) |
| `jest-environment-jsdom` | 30.3.0 | 30.5.2 | `atualização-segura` | nenhuma | nenhuma (minor) |
| `prettier` | 3.8.3 | 3.9.9 | `atualização-segura` | nenhuma | nenhuma (minor) |
| `ts-jest` | 29.4.9 | 29.4.14 | `atualização-segura` | nenhuma | nenhuma (patch) |
| `typescript` | 5.9.3 | 7.0.2 | `breaking-change` | nenhuma direta | gap de 2 major; inferência de tipos mais estrita; resolução de módulos alterada (ver §BC-11) |
| `typescript-eslint` | 8.59.0 | 8.71.1 | `atualização-segura` | nenhuma | nenhuma (minor) |
| `vite` | 7.3.2 | 8.3.4 | `breaking-change` | **2× alta** — GHSA-v6wh-96g9-6wx3, GHSA-fx2h-pf6j-xcff (Windows) | API de configuração alterada; peer deps de plugins atualizados (ver §BC-12) |

---

## Vulnerabilidades Detalhadas

### Dependências diretas com CVEs

| Pacote | Advisory | Severidade | Descrição resumida | Fix |
|--------|----------|:----------:|--------------------|-----|
| `vite` 7.3.2 | [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) | **alta** | `launch-editor`: divulgação de hash NTLMv2 via caminho UNC no Windows | Atualizar para vite ≥ 8.x |
| `vite` 7.3.2 | [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) | **alta** | `server.fs.deny`: bypass por caminhos alternativos no Windows | Atualizar para vite ≥ 8.x |
| `jest` 29.7.0 | transitiva via `@jest/core`/`jest-cli` | **alta** | — | Atualizar para jest v30.5.2 |
| `@types/jest` 29.5.14 | transitiva via `expect` | **alta** | — | Atualizar para @types/jest v30.0.0 |
| `webtorrent` 2.8.5 | transitiva via `torrent-discovery` | **alta** | — | Atualizar para webtorrent v3.0.21 |

> **Nota:** a correção sugerida pelo `npm audit` para `webtorrent` aponta para uma versão
> muito antiga (`torrent-discovery` 0.7.3); a resolução correta é atualizar para
> `webtorrent` v3.0.21, que usa versões internas atualizadas das dependências transitivas.

### Dependências transitivas com vulnerabilidades altas (seleção)

| Pacote transitivo | Severidade | Advisories (amostra) | Origem |
|-------------------|:----------:|----------------------|--------|
| `brace-expansion` | alta | GHSA-jxxr-4gwj-5jf2, +7 | jest |
| `browserslist` | alta | GHSA-c83g-rgw3-j3cx, GHSA-73wf-gq98-2v4g | jest |
| `fast-uri` | alta | GHSA-v2hh-gcrm-f6hx, +7 | jest |
| `ip-address` | alta | GHSA-v2v4-37r5-5v8g, +3 | jest |
| `js-yaml` | alta | GHSA-h67p-54hq-rp68, +3 | jest |
| `nanoid` | alta | GHSA-28wg-ghj8-5hjv, +2 | jest |
| `postcss` | alta | GHSA-6g55-p6wh-862q, +2 | jest / vite |
| `ws` | alta | GHSA-58qx-3vcg-4xpx, GHSA-96hv-2xvq-fx4p | webtorrent |
| `source-map-js` | alta | GHSA-68fv-2mgg-jv7q | vite |
| `@babel/core` | baixa | GHSA-4x5r-pxfx-6jf8 | jest |
| `esbuild` | baixa | GHSA-g7r4-m6w7-qqqr | vite |
| `baseline-browser-mapping` | moderada | GHSA-w5vr-8v7q-w6rv | jest |
| `sprintf-js` | moderada | GHSA-hp3w-g68c-fv3c | jest |

---

## Breaking Changes — Detalhamento por Pacote

### §BC-1 — `electron-store` v8 → v11

**Arquivos Meshy afetados:** `main/settingsManager.ts`

A partir da v9, `electron-store` tornou-se **ESM-only** — abandonou o suporte a
`require()` (CommonJS). O `main/` do Meshy compila com `"module": "ES2022"` e
`"moduleResolution": "bundler"` (ver `tsconfig.node.json`), o que em princípio é
compatível com imports ESM; porém, o `electron-vite` empacota o main em formato
`.mjs`, então o alinhamento precisa ser verificado em runtime.

Mudanças concretas de API entre v8 e v11:

| Área | v8 | v11 |
|------|----|----|
| Import | `import Store from 'electron-store'` | inalterado |
| Instanciação | `new Store<T>({ schema, ... })` | `new Store<T>({ schema, ... })` — mesma superfície, mas algumas opções de schema foram renomeadas |
| Opção `migrations` | objeto com chaves de versão | API de migração refatorada em v10; confirmar compatibilidade |
| `store.get` com `defaultValue` | `store.get(key, default)` | inalterado |
| `store.set` | `store.set(key, value)` | inalterado |

**Ação requerida:** revisar changelog v8→v11 e testar instanciação do `Store` em
`createSettingsManager`. Verificar se as opções de schema `AppSettings` ainda são
válidas. Executar `npm run build` e smoke-test de leitura/escrita de configurações
antes de confirmar a atualização.

---

### §BC-2 — `react-intl` v7 → v12

**Arquivos Meshy afetados:** múltiplos componentes em `src/` que usam
`<FormattedMessage>`, `useIntl()`, `IntlProvider`, `defineMessages`.

Gap de **5 versões major** (v7 → v8 → v9 → v10 → v11 → v12). As mudanças mais
relevantes ao longo dessas versões:

| Área | Impacto provável no Meshy |
|------|--------------------------|
| `IntlProvider` — prop `messages` | Formato dos objetos de mensagens pode ter sido alterado; verificar compatibilidade com `pt-BR.json` e `en-US.json` |
| `defineMessages` / `defineMessage` | Algumas sobrecargas foram removidas em versões intermediárias |
| Tipos TypeScript exportados | Nomes de tipos internos (`MessageDescriptor`, `FormatXMLElementFn`) podem ter mudado, causando erros de compilação |
| `FormattedMessage` — prop `values` | A aceitação de elementos React em `values` pode exigir assinaturas genéricas diferentes |
| Integração com `@formatjs/intl` | O pacote base foi reorganizado; as re-exportações de `react-intl` podem diferir |

**Ação requerida:** revisar breaking changes de cada release major individual
(`react-intl` v8 → v9 → v10 → v11 → v12) na documentação do repositório
`formatjs/formatjs`. Executar `npx tsc --noEmit -p tsconfig.web.json` após a
instalação e corrigir todos os erros de tipo. Testar renderização de componentes
traduzidos com os dois catálogos antes de confirmar.

---

### §BC-3 — `webtorrent` v2 → v3

**Arquivos Meshy afetados:** `main/torrentEngine.ts`, `main/webtorrentInternals.ts`

O WebTorrent v3 é uma **reescrita significativa** em relação ao v2:

| Área | v2 | v3 |
|------|----|----|
| Import | `import WebTorrent from 'webtorrent'` | inalterado (ESM) |
| `client.add(input, opts, callback)` | callback como terceiro argumento | pode ter migrado para Promise ou alterado assinatura; confirmar no changelog |
| Evento `torrent.on('done', ...)` | emite sem argumentos | verificar se emite o torrent como argumento em v3 |
| Evento `torrent.on('error', ...)` | emite `Error` | verificar assinatura |
| `torrent.files` | `TorrentFile[]` | verificar se a estrutura de `TorrentFile` mudou (campos `name`, `path`, `length`, `progress`) |
| `client.destroy(callback)` | callback opcional | verificar se migrou para Promise |
| `client.throttleDownload` / `client.throttleUpload` | métodos na instância | verificar se foram removidos ou renomeados |
| Dependência `torrent-discovery` | versão antiga com CVE alta | v3 usa versão atualizada — CVE resolvido |

**Ação requerida (obrigatória antes de instalar):** revisar o changelog do repositório
`webtorrent/webtorrent` entre `v2.8.5` e `v3.0.21`. Adaptar `main/torrentEngine.ts`
(métodos `add`, `pause`, `resume`, `remove`, listeners `done` e `error`) e
`main/webtorrentInternals.ts` antes de executar `npm install`. Executar
`npm run build` e os testes em `tests/unit/torrentEngine.test.ts` imediatamente após.

---

### §BC-4 — `@testing-library/jest-dom` v6 → v7

**Arquivos Meshy afetados:** 25 arquivos de teste em `tests/` que importam
`@testing-library/jest-dom`; `tests/setup.ts`

| Área | v6 | v7 |
|------|----|----|
| Setup de importação | `import '@testing-library/jest-dom'` | inalterado |
| `toBeInTheDocument` | disponível | inalterado |
| Matchers deprecados | presentes | alguns podem ter sido removidos |
| Export de tipos TypeScript | `@testing-library/jest-dom/extend-expect` | verificar se o módulo de tipos mudou de caminho |
| Compatibilidade com `@types/jest` | v6 alinhado com jest 29 | v7 alinhado com jest 30; incompatível com @types/jest v29 |

> **Dependência:** `@testing-library/jest-dom` v7 deve ser atualizado **junto com**
> `jest` e `@types/jest` v30 para evitar conflitos de tipos entre as versões.

**Ação requerida:** atualizar em conjunto com `jest` v30. Verificar `tests/setup.ts`
para ajustar o caminho de importação, se necessário. Executar
`npm test -- --runInBand` e confirmar zero falhas.

---

### §BC-5 — `@types/jest` v29 → v30

**Arquivos Meshy afetados:** todos os arquivos em `tests/` (tipagem implícita do
compilador TypeScript)

| Área | v29 | v30 |
|------|-----|-----|
| Timer mock | `jest.useFakeTimers({ legacy: true })` | opção `legacy` removida; usar API moderna de timers |
| `jest.spyOn` tipos | algumas sobrecargas | verificar se sobrecargas de módulos ESM mudaram |
| `expect.assertions(n)` | inalterado | inalterado |
| Tipos de mocks (`jest.MockedFunction`, etc.) | presentes | verificar renomeações |

**Ação requerida:** atualizar junto com `jest` v30. Executar
`npx tsc --noEmit -p tsconfig.jest.json` após a instalação e corrigir erros.

---

### §BC-6 — `@types/node` v22 → v26

**Arquivos Meshy afetados:** `main/*.ts` (tipagem implícita do compilador)

Gap de 4 versões major (v22 → v23 → v24 → v25 → v26). O impacto principal é o
alinhamento dos tipos com as novas APIs do Node.js introduzidas nessas versões — não
há remoção de APIs existentes usadas no Meshy. Os arquivos que usam `fs`, `path`,
`net`, `crypto`, `stream` continuam compatíveis.

**Ação requerida:** executar `npx tsc --noEmit -p tsconfig.node.json` após a
instalação. Corrigir qualquer erro de tipo novo; tipicamente são adições de campos
opcionais em interfaces existentes, que não quebram código existente.

---

### §BC-7 — `@vitejs/plugin-react` v5 → v6

**Arquivos Meshy afetados:** `electron.vite.config.ts` (importa e usa o plugin)

| Área | v5 | v6 |
|------|----|----|
| Import | `import react from '@vitejs/plugin-react'` | inalterado |
| Opções do plugin | `{ babel: {...}, jsxRuntime: 'automatic' }` | verificar se campos foram renomeados ou removidos |
| Compatibilidade com Vite | alinhado com Vite 7 | v6 pode exigir Vite 8 como peer dep |

> **Dependência:** atualizar **junto com** Vite 8 para garantir alinhamento de peer deps.

**Ação requerida:** verificar peer deps de `@vitejs/plugin-react` v6 antes de
instalar. Confirmar que `electron.vite.config.ts` não requer ajustes após a
atualização. Executar `npm run build`.

---

### §BC-8 — `electron` v41 → v44

**Arquivos Meshy afetados:** `main/index.ts`, `electron/preload.ts`, e indiretamente
todo o `main/` que usa APIs do Electron

Gap de **3 versões major** (v41 → v42 → v43 → v44). Pontos críticos:

| Área | Impacto potencial no Meshy |
|------|---------------------------|
| Node.js embutido | Cada release major do Electron atualiza o Node.js embutido; confirmar compatibilidade com dependências nativas |
| Chromium embutido | Atualização de engine V8 — sem impacto direto no main process |
| APIs deprecadas | Verificar `BrowserWindow`, `session`, `protocol` e `net` por remoções de APIs avisadas como deprecated em v41 |
| `contextBridge` / `ipcRenderer` | API estável; improvável quebra |
| `app.getPath` / `app.setPath` | Verificar se algum comportamento padrão de path mudou |
| Integração com `electron-store` | Se `electron-store` v11 exige remoção de `remote`, confirmar que `main/settingsManager.ts` não usa esse módulo |

**Ação requerida:** consultar os changelogs do Electron v42, v43 e v44 em
`releases.electronjs.org`. Registrar versões de Node.js e Chromium em
`.agents/tasks/stack-update.md` antes de instalar. Executar `npm run build` e
confirmar código de saída 0.

---

### §BC-9 — `fast-check` v3 → v4

**Arquivos Meshy afetados:** múltiplos arquivos PBT em `tests/unit/`
(qualquer arquivo que usa `fc.property`, `fc.assert`, `fc.string`, etc.)

| Área | v3 | v4 |
|------|----|----|
| `fc.string()` | gera strings arbitrárias incluindo surrogates | comportamento pode ter sido restrito |
| Arbitrários renomeados | `fc.lorem()`, etc. | verificar nomes no changelog |
| `fc.assert` opções | `{ numRuns, verbose, ... }` | verificar se `verbose` continua como booleano ou passou a ser enum |
| Shrinking | algoritmo de encolhimento pode diferir | contrarexemplos minimizados podem ter forma diferente |
| Tipos TypeScript | sobrecargas de `fc.property` | verificar se sobrecargas para 1–N argumentos mudaram |

**Ação requerida:** revisar o changelog v3→v4 no repositório `dubzzz/fast-check`.
Executar `npm test -- --runInBand` após instalação e verificar se algum PBT falha
por mudança de comportamento dos arbitrários.

---

### §BC-10 — `jest` v29 → v30

**Arquivos Meshy afetados:** `jest.config.js`, `tests/setup.ts`, todos os arquivos
em `tests/unit/` e `tests/integration/`

| Área | v29 | v30 |
|------|-----|-----|
| Timer mock | `jest.useFakeTimers('legacy')` | forma string deprecated ou removida; usar `{ legacyFakeTimers: true }` no config |
| `jest.config.js` | `testEnvironment: 'jsdom'` | verificar se o campo continua válido ou foi renomeado |
| `expect.extend` | inalterado | inalterado |
| Módulos ESM | suporte experimental | suporte melhorado, mas transform via `ts-jest` pode exigir ajuste de preset |
| `moduleNameMapper` | inalterado | inalterado |
| `jest-environment-jsdom` | peerDep separado | continua como peerDep separado em v30 |

> **Dependência:** `jest` v30 deve ser atualizado **junto com** `@types/jest` v30 e
> `@testing-library/jest-dom` v7 para consistência de tipos.

**Ação requerida:** revisar `jest.config.js` após a atualização. Executar
`npm test -- --runInBand` e corrigir falhas de configuração antes de prosseguir.

---

### §BC-11 — `typescript` v5 → v7

**Arquivos Meshy afetados:** todos os `.ts`/`.tsx` sob `main/`, `src/`, `shared/`,
`electron/`, `tests/`; `tsconfig.node.json`, `tsconfig.web.json`, `tsconfig.jest.json`

Gap de **2 versões major** (v5.9 → v6 → v7). O TypeScript v6 e v7 introduzem
mudanças de inferência mais rígidas:

| Área | Impacto provável |
|------|-----------------|
| Inferência de tipos condicionais | Alguns padrões de tipo condicional podem deixar de ser aceitos sem anotação explícita |
| Decorators (TC39 Stage 3) | O comportamento de decorators pode ter mudado; Meshy não usa decorators — baixo risco |
| Resolução de módulos | `"moduleResolution": "bundler"` continua suportado; verificar comportamento com imports de `.json` |
| `--target` e `--lib` | Verificar se `ES2022` e `ES2020` continuam como targets válidos |
| Tipos de namespace | Alguns padrões de namespace podem exigir ajuste |
| Erros de tipo novos | O compilador pode emitir novos erros em código que antes era aceito sem erros |

**Ação requerida:** executar os três `tsc --noEmit` (`tsconfig.node.json`,
`tsconfig.web.json`, `tsconfig.jest.json`) imediatamente após a instalação. Corrigir
**todos** os erros antes de prosseguir. Esta atualização deve ocorrer isolada das
demais para facilitar a triagem dos erros.

---

### §BC-12 — `vite` v7 → v8

**Arquivos Meshy afetados:** `electron.vite.config.ts` (configuração do bundler);
indiretamente, o processo de build do renderer

| Área | v7 | v8 |
|------|----|----|
| `define` | substituição em tempo de build | verificar se o comportamento de substituição de strings mudou |
| Opções de `build.rollupOptions` | inalterado na maioria dos casos | verificar peer deps de plugins Rollup usados |
| `server.fs.deny` | CVE GHSA-fx2h-pf6j-xcff presente | corrigido em v8 |
| `launch-editor` | CVE GHSA-v6wh-96g9-6wx3 presente | corrigido em v8 |
| API de plugins | estável, mas verificar assinatura de hooks | confirmar que `@vitejs/plugin-react` v6 é compatível |
| `optimizeDeps` | comportamento inalterado | inalterado |

> **Prioridade alta:** as duas CVEs altas em `vite` v7 afetam Windows — o ambiente
> de desenvolvimento do Meshy. A atualização para v8 é **recomendada com urgência**
> para o ambiente de build (não afeta o bundle de produção distribuído).

**Ação requerida:** atualizar junto com `@vitejs/plugin-react` v6 (ver §BC-7).
Executar `npm run build` e confirmar código de saída 0 após a instalação.

---

## Pacotes para Remoção — Evidências

### §REM-1 — `speed-limiter` (dependency)

**Classificação:** `remover`

**Declarado em:** `package.json` → `dependencies`

**Evidência de ausência de uso:**

Varredura com `grep -rn "speed-limiter" src/ main/ shared/ electron/ tests/` nos
diretórios auditados produziu **zero resultados** de `import` ou `require` reais:

| Caminho encontrado | Tipo de referência | É um import real? |
|--------------------|--------------------|:-----------------:|
| `main/speed-limiter.d.ts` | Declaração de tipo local (`.d.ts`) — não é um import | **não** |
| `tests/unit/torrentEngine.test.ts` | Mock `jest.mock('webtorrent', ...)` com comentário referenciando a lib | **não** |

O throttling de velocidade em `main/torrentEngine.ts` é implementado via
`client.throttleDownload(bytes)` e `client.throttleUpload(bytes)` — métodos nativos
da API do WebTorrent — sem nenhuma chamada a `speed-limiter`.

**Ação:** executar `npm uninstall speed-limiter` e remover `main/speed-limiter.d.ts`.
Confirmar que `npm run build`, `npm run typecheck` e `npm test -- --runInBand` passam
sem erros após a remoção.

---

### §REM-2 — `@electron-toolkit/preload` (devDependency)

**Classificação:** `remover`

**Declarado em:** `package.json` → `devDependencies`

**Evidência de ausência de uso:**

Varredura com `grep -rn "@electron-toolkit/preload" src/ main/ shared/ electron/ tests/`
nos diretórios auditados produziu **zero resultados**. O pacote não é referenciado em
nenhum arquivo de código-fonte, nem em configurações de build (`electron.vite.config.ts`,
`jest.config.js`, `eslint.config.mjs`).

**Ação:** executar `npm uninstall --save-dev @electron-toolkit/preload`. Confirmar
que o build permanece funcional.

---

### §REM-3 — `@electron-toolkit/utils` (devDependency)

**Classificação:** `remover`

**Declarado em:** `package.json` → `devDependencies`

**Evidência de ausência de uso:**

Varredura com `grep -rn "@electron-toolkit/utils" src/ main/ shared/ electron/ tests/`
nos diretórios auditados produziu **zero resultados**. O pacote não é referenciado em
nenhum arquivo de código-fonte nem em configurações.

**Ação:** executar `npm uninstall --save-dev @electron-toolkit/utils`. Confirmar que
o build permanece funcional.

---

## Prioridade de Ação

| Prioridade | Ação | Justificativa |
|:----------:|------|---------------|
| 🔴 Alta | Atualizar `vite` v7 → v8 | 2 CVEs altas que afetam Windows (ambiente de dev) |
| 🔴 Alta | Atualizar `jest` + `@types/jest` + `@testing-library/jest-dom` (v30/v7) | CVEs altas transitivas nos 3 pacotes; devem ser atualizados juntos |
| 🔴 Alta | Atualizar `webtorrent` v2 → v3 | CVE alta transitiva; requer revisão de API antes de instalar |
| 🟡 Média | Remover `speed-limiter`, `@electron-toolkit/preload`, `@electron-toolkit/utils` | Pacotes mortos em `package.json`; reduzem superfície de dependência |
| 🟡 Média | Atualizar `electron` v41 → v44 | 3 releases major; node/chromium embutidos desatualizados |
| 🟡 Média | Atualizar `electron-store` v8 → v11 | Mudança para ESM-only; requer validação do `main/settingsManager.ts` |
| 🟡 Média | Atualizar `typescript` v5 → v7 | Compilador desatualizado; erros potenciais de tipo ocultos |
| 🟢 Baixa | Atualizar `react-intl` v7 → v12 | Gap de 5 major; requer revisão extensa do changelog |
| 🟢 Baixa | Atualizar `fast-check` v3 → v4 | Afeta apenas testes; baixo risco de regressão em produção |
| 🟢 Baixa | Atualizar pacotes `atualização-segura` em lote | Risco mínimo; `npx npm-check-updates --target minor` |

---

*Relatório gerado pela Tarefa 1.2 do plano de manutenção do Meshy.*
*Dados coletados em `.agents/tasks/raw-dependency-data.md`.*
