# Varredura de Código Morto — `shared/`

**Tarefa:** 7.2  
**Requisitos:** 5.2, 5.3  
**Data de execução:** 2025-07-29  
**Escopo de busca:** `src/`, `main/`, `electron/`, `shared/`, `tests/`  
**Extensões auditadas:** `.ts`, `.tsx`  
**Arquivos varridos:** `shared/validators.ts`, `shared/formatters.ts`, `shared/types.ts`, `shared/errorCodes.ts`

---

## Metodologia

1. Leitura completa dos quatro arquivos de `shared/` para extração de todos os símbolos exportados.
2. Para cada símbolo: busca por referências (grep recursivo) em todos os arquivos `.ts`/`.tsx`
   dos diretórios `src/`, `main/`, `electron/`, `shared/` e `tests/`, excluindo o próprio arquivo
   de origem.
3. Observação especial: `main/validators.ts` é uma ponte de re-exportação de todos os símbolos de
   `shared/validators.ts`. Qualquer import via essa ponte conta como referência ao símbolo original.
4. Símbolos com zero referências externas são listados como candidatos à remoção.

---

## `shared/errorCodes.ts`

| Símbolo | Tipo | Referências externas | Status |
|---------|------|----------------------|--------|
| `ErrorCodes` | `const` | `main/settingsValidator.ts`, `main/ipcHandler.ts`, 9 arquivos de test | ✅ Utilizado |
| `ErrorCode` | `type` | — | ❌ **ZERO referências** |

### Detalhe — `ErrorCodes` (utilizado)

Importado como valor em múltiplos arquivos do main process e de testes:

- `main/settingsValidator.ts` — usa todos os códigos de erro de settings
- `main/ipcHandler.ts` — usa em todos os handlers para montar `IPCResponse` de falha
- `tests/integration/ipc-payload-validation.test.ts`
- `tests/unit/ipcHandler.test.ts`
- `tests/unit/ipcHandlerQueuePriority.test.ts`
- `tests/unit/ipcHandlerOpenDestination.test.ts`
- `tests/unit/ipcHandlerOpenDestination.pbt.test.ts`
- `tests/unit/fileSelectionIpc.test.ts`
- `tests/unit/downloadDetails/ipcHandlerDetails.test.ts`
- `tests/unit/downloadDetails/ipcHandlerDetails.pbt.test.ts`
- `tests/unit/i18n-icuFormatting.test.ts`
- `tests/unit/i18n-localePersistence.test.ts`

### Detalhe — `ErrorCode` (candidato à remoção)

O tipo `ErrorCode` é definido como:

```typescript
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
```

Nenhum arquivo fora de `shared/errorCodes.ts` o importa (`import type { ErrorCode }`).
Nos arquivos que usam `ErrorCodes`, o campo `error` das respostas IPC é sempre tipado como
`string` — nenhuma função pública recebe ou retorna `ErrorCode` como tipo nomeado.

**Evidência de ausência:**
- Nenhum `import type { ErrorCode }` encontrado em `src/`, `main/`, `electron/`, `shared/` ou `tests/`.
- Os campos `errorCode` visíveis nas buscas são variáveis locais tipadas como `string`, não como `ErrorCode`.

---

## `shared/formatters.ts`

| Símbolo | Tipo | Referências externas | Status |
|---------|------|----------------------|--------|
| `formatBytes` | `function` | `main/notificationManager.ts`, `src/utils/formatters.ts` (re-export) | ✅ Utilizado |
| `formatDuration` | `function` | `main/notificationManager.ts`, `src/utils/formatters.ts` (re-export) | ✅ Utilizado |

### Observação sobre a ponte `src/utils/formatters.ts`

```typescript
// src/utils/formatters.ts
export { formatBytes, formatDuration } from '../../shared/formatters';
```

O renderer **nunca** importa diretamente de `shared/formatters`. Todos os componentes
(`SpeedDisplay`, `DownloadItem`, `FileSelector`, `App.tsx`) e testes do renderer importam
via `src/utils/formatters.ts`. Isso é intencional — a ponte foi criada para manter
compatibilidade de imports do renderer enquanto a implementação canônica permanece em `shared/`.

---

## `shared/validators.ts`

| Símbolo | Tipo | Referências externas | Status |
|---------|------|----------------------|--------|
| `isValidMagnetUri` | `function` | `main/torrentEngine.ts`, `src/components/AddTorrent/AddTorrentModal.tsx`, `src/components/AddTorrent/DropZone.tsx`, `tests/unit/validators.test.ts` + via `main/validators.ts` | ✅ Utilizado |
| `isValidTorrentFile` | `function` | `main/ipcHandler.ts` + via `main/validators.ts` | ✅ Utilizado |
| `hasTorrentMagicBytes` | `function` | `main/torrentEngine.ts`, `main/ipcHandler.ts` + via `main/validators.ts` | ✅ Utilizado |
| `isValidSpeedLimit` | `function` | `main/settingsValidator.ts`, `main/settingsManager.ts`, `src/components/Settings/TransferSettings.tsx` + via `main/validators.ts` | ✅ Utilizado |
| `MIN_CONCURRENT_DOWNLOADS` | `const` | `src/components/Settings/TransferSettings.tsx` + via `main/validators.ts` | ✅ Utilizado |
| `MAX_CONCURRENT_DOWNLOADS` | `const` | `src/components/Settings/TransferSettings.tsx` + via `main/validators.ts` | ✅ Utilizado |
| `DEFAULT_MAX_CONCURRENT_DOWNLOADS` | `const` | `main/downloadManager.ts`, `main/settingsManager.ts` + via `main/validators.ts` | ✅ Utilizado |
| `isValidMaxConcurrentDownloads` | `function` | `main/settingsValidator.ts`, `main/settingsManager.ts`, `src/components/Settings/TransferSettings.tsx` + via `main/validators.ts` | ✅ Utilizado |
| `isValidTrackerUrl` | `function` | `main/ipcHandler.ts`, `main/torrentEngine.ts`, `main/settingsManager.ts` + via `main/validators.ts` | ✅ Utilizado |
| `normalizeTrackerUrl` | `function` | `main/torrentEngine.ts`, `main/settingsManager.ts` + via `main/validators.ts` | ✅ Utilizado |
| `isValidNetworkToggle` | `function` | `main/settingsValidator.ts` + via `main/validators.ts` | ✅ Utilizado |
| `isValidThemeId` | `function` | `main/settingsValidator.ts` + via `main/validators.ts` | ✅ Utilizado |

### Observação — `main/validators.ts` como ponte

O arquivo `main/validators.ts` re-exporta todos os símbolos de `shared/validators.ts`:

```typescript
// main/validators.ts — re-export para compatibilidade de imports legados em main/
export { isValidMagnetUri, isValidTorrentFile, hasTorrentMagicBytes, isValidSpeedLimit,
         isValidMaxConcurrentDownloads, isValidThemeId, isValidTrackerUrl, normalizeTrackerUrl,
         isValidNetworkToggle, MIN_CONCURRENT_DOWNLOADS, MAX_CONCURRENT_DOWNLOADS,
         DEFAULT_MAX_CONCURRENT_DOWNLOADS } from '../shared/validators';
```

Arquivos de main/ que importam de `'./validators'` (a ponte) contam como consumidores de
`shared/validators.ts`. Arquivos que importam diretamente de `'../shared/validators'` também
existem (`main/torrentEngine.ts`, `main/settingsManager.ts`, `main/downloadManager.ts`).

### Observação — dois `isValidThemeId` no repositório

Existe uma homônima em `src/themes/themeRegistry.ts`:

```typescript
export function isValidThemeId(id: string): boolean {
    return themeMap.has(id); // verifica se o tema existe no registro
}
```

A versão de `shared/validators.ts` apenas verifica `typeof value === 'string' && value.length > 0`.
São funções distintas com propósitos diferentes:
- `shared/validators.ts#isValidThemeId` → valida formato (string não-vazia); usada no main process em `settingsValidator.ts`
- `src/themes/themeRegistry.ts#isValidThemeId` → valida existência no registro; usada no renderer em `SettingsPanel.tsx`

Ambas são utilizadas e nenhuma é candidata a remoção.

---

## `shared/types.ts`

| Símbolo | Tipo | Referências externas | Status |
|---------|------|----------------------|--------|
| `TrackerStatus` | `type` | `main/webtorrentInternals.ts`, `main/torrentEngine.ts` | ✅ Utilizado |
| `TrackerInfo` | `interface` | `electron/preload.ts`, `main/ipcHandler.ts`, `main/torrentEngine.ts` | ✅ Utilizado |
| `TorrentStatus` | `type` | `main/downloadManager.ts`, `main/torrentEngine.ts`, múltiplos testes | ✅ Utilizado |
| `TorrentFileInfo` | `interface` | `electron/preload.ts`, `main/ipcHandler.ts`, `main/torrentEngine.ts`, `main/downloadManager.ts` | ✅ Utilizado |
| `DownloadItem` | `interface` | `electron/preload.ts`, `main/ipcHandler.ts`, `main/notificationManager.ts`, `main/downloadManager.ts`, múltiplos testes e componentes | ✅ Utilizado |
| `PersistedDownloadItem` | `interface` | `main/downloadManager.ts` (importa e re-exporta), múltiplos testes via `main/downloadManager` | ✅ Utilizado |
| `AppSettings` | `interface` | `electron/preload.ts`, `main/settingsValidator.ts`, `main/settingsManager.ts`, `src/components/Settings/*`, múltiplos testes | ✅ Utilizado |
| `TorrentMetadata` | `interface` | `electron/preload.ts`, `main/ipcHandler.ts`, `main/torrentEngine.ts`, `tests/unit/downloadDetails/` | ✅ Utilizado |
| `PeerInfo` | `interface` | `electron/preload.ts`, `main/ipcHandler.ts`, `main/torrentEngine.ts`, `tests/unit/downloadDetails/` | ✅ Utilizado |
| `PieceStatus` | `type` | `electron/preload.ts`, `main/ipcHandler.ts`, `main/torrentEngine.ts`, testes | ✅ Utilizado |
| `IPCResponse` | `type` | `electron/preload.ts`, `main/ipcHandler.ts`, múltiplos testes | ✅ Utilizado |
| `MeshyAPI` | `interface` | `electron/preload.ts` | ✅ Utilizado |
| `Window` (augmentation) | global | efeito de importar o módulo; utilizada por todo o renderer via `window.meshy` | ✅ Utilizado |

---

## Resumo dos Candidatos à Remoção

| Símbolo | Arquivo | Tipo | Referências externas |
|---------|---------|------|----------------------|
| **`ErrorCode`** | `shared/errorCodes.ts` | `type` | **0** |

**Total de símbolos varridos:** 39 (4 + 2 + 12 + 13 + augmentation)  
**Candidatos à remoção:** 1  
**Símbolos com importadores confirmados:** 38

---

## Próximos Passos (Tarefa 7.3)

### Remoção confirmada — `ErrorCode` (type)

**Ação:** remover a linha:
```typescript
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
```

**Verificação pós-remoção:**
```sh
npx --no-install tsc --noEmit -p tsconfig.node.json
npx --no-install tsc --noEmit -p tsconfig.web.json
npx --no-install tsc --noEmit -p tsconfig.jest.json
npm test -- --runInBand
```

Se qualquer verificação falhar, restaurar com `git checkout shared/errorCodes.ts` e
sinalizar para revisão manual.

### Nenhuma ação para os demais símbolos

Todos os outros 38 símbolos varridos possuem pelo menos um importador confirmado
e **não devem ser removidos**.
