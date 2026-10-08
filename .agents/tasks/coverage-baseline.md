# Baseline de Cobertura — Módulos Críticos

> Tarefa 4.1 — Medição executada com `npm run test:coverage -- --runInBand`
>
> Suíte: **1017 testes**, **62 suítes**, todos aprovados.
> Data: 2025-07

---

## Resumo executivo

| Módulo | Stmts | Branch | Funcs | Lines | Linhas não cobertas |
|--------|------:|-------:|------:|------:|---------------------|
| `main/torrentEngine.ts` | 64.09 % | 45.57 % | 63.15 % | 65.58 % | 106 / 308 |
| `main/ipcHandler.ts` | 81.91 % | 63.23 % | 87.09 % | 80.84 % | 82 / 428 |
| `shared/validators.ts` | 67.50 %¹ | 34.78 %¹ | 81.81 %¹ | 80.95 %¹ | 62, 140-155, 193 |

¹ `shared/` não está incluído no `collectCoverageFrom` do `jest.config.js` (cobre apenas `main/**` e `src/**`).
  Os valores foram obtidos rodando `validators.test.ts` isoladamente com `--collectCoverageFrom=shared/**/*.ts`.
  Para incluir `shared/` na métrica padrão, adicionar `"shared/**/*.ts"` ao array `collectCoverageFrom`.

---

## 1. `main/torrentEngine.ts`

### Métricas LCOV brutas

| Métrica | Total | Cobertos | Não cobertos |
|---------|------:|--------:|-------------:|
| Funções (FNF/FNH) | 76 | 48 | **28** |
| Linhas (LF/LH) | 308 | 202 | **106** |
| Branches (BRF/BRH) | 147 | 67 | **80** |

### Funções e regiões não cobertas

| Função / Área | Linhas aprox. | Razão da ausência de cobertura |
|---|---|---|
| `networkBudget.torrents` (arrow fn) | 154 | Accessor usado pelo speed-limiter nunca invocado nos testes |
| `_configureClient` — callback `client.on('error', ...)` | 191 | Erro global do WebTorrent nunca disparado nos testes |
| `addTorrentFile` — bloco `catch` (falha no `readFile`) | 200–208 | Caminho de erro de leitura de arquivo nunca simulado |
| `addTorrentBuffer` — caminhos internos de erro (`finish` com erro, `try/catch`) | ~215, 225–228 | Cenários de falha do `client.add` e timeout de 20 s não testados |
| `resume` — lançamento quando torrent não encontrado | ~329 | Guard `if (!torrent) throw` nunca atingido nos testes |
| `remove` — corpo completo | 335–371 | Nenhum teste exercita remoção de torrent |
| `getMetadata` — corpo completo | 533–540 | Método nunca chamado na suíte |
| `getPeers` — corpo completo | 551–579 | Método nunca chamado na suíte |
| `getPieces` — corpo completo | 590–604 | Método nunca chamado na suíte |
| `healthCheck` — bloco `catch` | 620–634 | Falha de `this.client.torrents` nunca simulada |
| `restart` / `_doRestart` | 649–730 | Funcionalidade de reinício não testada |
| `_initSelectionMap` — ramo "restaurar seleção anterior" | 756–760 | Caminho onde `selectionMap` já existe nunca exercitado |
| `_attachTorrentListeners` — callbacks `'warning'`, `'done'`, `'error'` | 771–803 | Eventos de torrent nunca disparados nos testes unitários |

### Branches não cobertos (seleção)

- Ramo `ENGINE_RESTARTING` em vários pontos de entrada.
- `addMagnetLink`: ramo `torrent already exists` e ramo `magnet URI inválida`.
- `addTorrentBuffer`: ramo de timeout 20 s e ramo `client.add` lançando exceção.
- `remove`: todos os ramos internos (torrent encontrado vs. não encontrado, `deleteFiles`, erro de `destroy`).
- `pause` / `resume`: ramos de timeout `PAUSE_RESUME_TIMEOUT_MS`.
- `_attachTorrentListeners.done`: ramo de `_stopNetwork` rejeitando.

---

## 2. `main/ipcHandler.ts`

### Métricas LCOV brutas

| Métrica | Total | Cobertos | Não cobertos |
|---------|------:|--------:|-------------:|
| Funções (FNF/FNH) | 62 | 54 | **8** |
| Linhas (LF/LH) | 428 | 346 | **82** |
| Branches (BRF/BRH) | 136 | 86 | **50** |

### Funções e regiões não cobertas

| Função / Área | Linhas aprox. | Razão da ausência de cobertura |
|---|---|---|
| `failWithLog` — ramo `scopedLog.error(...)` | 50 | Nenhum teste chama `failWithLog` com `scopedLog` definido |
| `hasWritePermission` — bloco `catch` (sem permissão) | 68 | Caminho de negação de acesso nunca testado |
| `ChannelRateLimiter.tryConsume` — `return false` (limite excedido) | 101 | Limiar de 500 chamadas/s nunca atingido nos testes |
| `ChannelRateLimiter.tryConsume` — limpeza de timestamps expirados (`calls.shift()`) | ~100–104 | Janela deslizante de 1 s nunca expira dentro dos testes |
| `withTimeout` — callback de rejeição (timeout expirado) | 141 | Timeout de 30 s nunca atingido nos testes |
| `attachWindowEvents` — callbacks `mainWindow.on('closed', ...)` (×2) | 208–211, 217 | Evento de fechamento de janela nunca disparado nos testes |
| `trackedHandle` — ramo `rateLimiter.tryConsume` retornando `false` | 251–252 | Rate limiter nunca rejeita chamada nos testes |
| `torrent:add-file-buffer` — ramo `raw instanceof ArrayBuffer` | ~312–319 | Payload com `ArrayBuffer` nunca enviado nos testes |
| `torrent:retry` — handler completo | 538–550 | Canal `torrent:retry` nunca invocado nos testes |
| Segundo handler não coberto (linhas 648–662) | 648–662 | Handler registrado mas nunca exercitado (provável `tracker:announce` ou variante) |
| `renderer:report-error` — handler completo | 830–866 | Canal de reporte de erros do renderer nunca invocado |
| `app:get-metrics` — handler completo | 1014–1018 | Canal de métricas nunca invocado nos testes |
| `torrent:get-metadata` / `get-peers` / `get-pieces` — ramo `ENGINE_RESTARTING` | 904, 939, 968 | Condição `torrentEngine.isRestarting()` sempre `false` nos testes |
| `torrent:get-metadata` / `get-peers` / `get-pieces` — ramos de erro final | 1041, 1068, 1095 | Caminhos de erro nunca alcançados |

### Branches não cobertos (seleção)

- `ENGINE_NOT_AVAILABLE` (quando `torrentEngine` é `undefined`) em vários handlers de tracker e torrent.
- `ENGINE_RESTARTING` em todos os handlers de detalhe (`get-metadata`, `get-peers`, `get-pieces`).
- `torrent:add-file-buffer` — ramos `Uint8Array`, `ArrayBuffer` e payload inválido.
- `renderer:report-error` — todos os ramos (handler completamente não coberto).
- `withTimeout` — ramo de timeout (promise não resolve dentro do prazo).
- `hasWritePermission` — ramo `false` (diretório sem permissão de escrita).

---

## 3. `shared/validators.ts`

> ⚠️ **Atenção:** `shared/` está **fora** do `collectCoverageFrom` padrão.
> Os dados abaixo refletem apenas a execução de `tests/unit/validators.test.ts`.
> Outros arquivos que importam de `shared/validators` (ex.: `main/`, `src/hooks/`) podem
> aumentar a cobertura real; para medi-la com precisão, adicionar `"shared/**/*.ts"` ao
> `collectCoverageFrom` em `jest.config.js`.

### Métricas (execução isolada de `validators.test.ts`)

| Métrica | Total | Cobertos | Não cobertos |
|---------|------:|--------:|-------------:|
| Funções | 11 | ~9 | **2** |
| Linhas | — | — | 3 regiões |
| Branches | — | — | alta lacuna (34.78 %) |

### Funções e regiões não cobertas

| Função / Área | Linhas | Razão da ausência de cobertura |
|---|---|---|
| `isValidMaxConcurrentDownloads` — corpo completo | 62–67 | Função nunca chamada em `validators.test.ts`; sem teste para limite de downloads simultâneos |
| `isPrivateHost` — bloco IPv4: faixas 10.x, 169.254.x, 172.16–31.x, 192.168.x | 140–155 | `isValidTrackerUrl` é testada com localhost/IPv6, mas não com IPs privados IPv4 |
| `isValidThemeId` — corpo completo | 193 | Função nunca chamada em `validators.test.ts`; sem teste para validação de ID de tema |

### Branches não cobertos (seleção)

- Retornos de curto-circuito em `isValidMaxConcurrentDownloads`: `value > MAX_CONCURRENT_DOWNLOADS` nunca testado.
- Faixas de IP em `isPrivateHost`: `0.0.0.0/8`, `10.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.168.0.0/16` não cobertas.
- `isValidThemeId`: ramo `typeof !== 'string'` e `value.length === 0` nunca testados.
- `normalizeTrackerUrl`: ramo da regex de protocolo — caso sem protocolo reconhecível não coberto.

---

## Ação recomendada (próximos passos)

1. **Corrigir `collectCoverageFrom`** em `jest.config.js` para incluir `"shared/**/*.ts"` e monitorar `shared/validators.ts` continuamente.
2. **`torrentEngine.ts`** — Prioridade: `remove()`, `getMetadata/getPeers/getPieces`, callbacks de eventos de torrent (`done`, `error`, `warning`) e `restart`.
3. **`ipcHandler.ts`** — Prioridade: `renderer:report-error`, `app:get-metrics`, `torrent:retry`, e os ramos `ENGINE_NOT_AVAILABLE` / `ENGINE_RESTARTING`.
4. **`shared/validators.ts`** — Adicionar testes para `isValidMaxConcurrentDownloads`, `isValidThemeId`, e faixas de IP privado em `isPrivateHost`.
