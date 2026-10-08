# Varredura de Código Morto — `src/components/`

**Tarefa:** 7.1  
**Requisito:** 5.1  
**Data de execução:** 2025-07-28  
**Escopo de busca:** `src/`, `main/`, `electron/`, `shared/`, `tests/`  
**Padrões varridos:** `export default`, `export function`, `export const`

---

## Metodologia

1. Listagem de todos os arquivos `.ts`/`.tsx` em `src/components/`.
2. Extração de todos os símbolos com `export default`, `export function` e `export const`.
3. Para cada símbolo: busca exaustiva (Select-String recursivo) em todos os arquivos
   `.ts`/`.tsx` dos diretórios `src/`, `main/`, `electron/`, `shared/` e `tests/`,
   excluindo o próprio arquivo de origem.
4. Símbolos sem nenhuma correspondência nos diretórios acima são listados como
   candidatos à remoção.

---

## Símbolos Varridos

| Símbolo | Arquivo | Tipo |
|---------|---------|------|
| `AddTorrentModal` | `src/components/AddTorrent/AddTorrentModal.tsx` | `export function` |
| `DropZone` | `src/components/AddTorrent/DropZone.tsx` | `export function` |
| `ConfirmDialog` | `src/components/common/ConfirmDialog.tsx` | `export function` |
| `ErrorBoundary` | `src/components/common/ErrorBoundary.tsx` | `export class` |
| `ProgressBar` | `src/components/common/ProgressBar.tsx` | `export const` |
| `SpeedDisplay` | `src/components/common/SpeedDisplay.tsx` | `export const` |
| `DetailsPanel` | `src/components/DownloadDetails/DetailsPanel.tsx` | `export const` |
| `isExpandable` | `src/components/DownloadDetails/DetailsPanel.tsx` | `export function` |
| `GeneralTab` | `src/components/DownloadDetails/GeneralTab.tsx` | `export const` |
| `PeersTab` | `src/components/DownloadDetails/PeersTab.tsx` | `export const` |
| `PieceGrid` | `src/components/DownloadDetails/PieceGrid.tsx` | `export const` |
| `PiecesTab` | `src/components/DownloadDetails/PiecesTab.tsx` | `export const` |
| `SpeedChart` | `src/components/DownloadDetails/SpeedChart.tsx` | `export const` |
| `SpeedTab` | `src/components/DownloadDetails/SpeedTab.tsx` | `export const` |
| `TabBar` | `src/components/DownloadDetails/TabBar.tsx` | `export const` |
| `DownloadItem` | `src/components/DownloadList/DownloadItem.tsx` | `export const` |
| `DownloadList` | `src/components/DownloadList/DownloadList.tsx` | `export const` |
| **`DownloadListToolbar`** | `src/components/DownloadList/DownloadListToolbar.tsx` | `export function` |
| `FilterSidebar` | `src/components/DownloadList/FilterSidebar.tsx` | `export function` |
| `SearchBar` | `src/components/DownloadList/SearchBar.tsx` | `export function` |
| `SortSelector` | `src/components/DownloadList/SortSelector.tsx` | `export function` |
| `StatusFilter` | `src/components/DownloadList/StatusFilter.tsx` | `export function` |
| `FileSelector` | `src/components/FileSelector/FileSelector.tsx` | `export function` |
| `GeneralSettings` | `src/components/Settings/GeneralSettings.tsx` | `export function` |
| `LanguageSelector` | `src/components/Settings/LanguageSelector.tsx` | `export function` |
| `NetworkSettings` | `src/components/Settings/NetworkSettings.tsx` | `export function` |
| `SettingsPanel` | `src/components/Settings/SettingsPanel.tsx` | `export function` |
| **`SETTINGS_TABS`** | `src/components/Settings/SettingsTabs.tsx` | `export const` |
| `SettingsTabs` | `src/components/Settings/SettingsTabs.tsx` | `export function` |
| `ThemeSwitcher` | `src/components/Settings/ThemeSwitcher.tsx` | `export function` |
| `TrackerSettings` | `src/components/Settings/TrackerSettings.tsx` | `export function` |
| `validateTransferFields` | `src/components/Settings/TransferSettings.tsx` | `export function` |
| `TransferSettings` | `src/components/Settings/TransferSettings.tsx` | `export function` |
| `TrackerPanel` | `src/components/TrackerPanel/TrackerPanel.tsx` | `export function` |

---

## Candidatos à Remoção

### 1. `DownloadListToolbar` ⚠️ CANDIDATO PRINCIPAL

**Arquivo:** `src/components/DownloadList/DownloadListToolbar.tsx`  
**Tipo:** `export function`

**Evidência de ausência de importadores em produção:**
- Não aparece em nenhum arquivo de `src/` fora do próprio arquivo de definição.
- Não aparece em `main/`, `electron/`, `shared/`.
- Único importador encontrado: `tests/unit/downloadListToolbar.test.tsx`.

**Contexto:**  
O componente agrega `SearchBar`, `SortSelector`, `StatusFilter` e um botão "Limpar
concluídos" com `ConfirmDialog`. Essa funcionalidade está integralmente coberta por
dois caminhos ativos no código de produção:

- **Filtros/busca/ordenação** → `FilterSidebar` (importado por `src/App.tsx`), que já
  renderiza `SearchBar`, `StatusFilter` e `SortSelector`.
- **"Limpar concluídos"** → `DownloadList` implementa o botão diretamente em sua
  própria JSX (linhas ~215-225), com lógica e `ConfirmDialog` inline, sem delegar ao
  `DownloadListToolbar`.

O componente foi aparentemente substituído pelas duas implementações acima e nunca
removido do repositório.

**Impacto da remoção:**  
- Remover `DownloadListToolbar.tsx` e `DownloadListToolbar.module.css`.
- Remover o bloco de testes em `tests/unit/downloadListToolbar.test.tsx`.
- Nenhum outro arquivo de produção precisará ser ajustado.

---

### 2. `SETTINGS_TABS` ⚠️ EXPORT DESNECESSÁRIO

**Arquivo:** `src/components/Settings/SettingsTabs.tsx`  
**Tipo:** `export const`

**Evidência de ausência de importadores:**
- A constante é exportada mas nenhum arquivo fora de `SettingsTabs.tsx` a importa.
- `SettingsPanel.tsx` importa apenas `SettingsTabs` (o componente função) e
  `SettingsTabId` (o tipo), não `SETTINGS_TABS`.
- Nenhuma referência a `SETTINGS_TABS` foi encontrada em `src/`, `main/`, `electron/`,
  `shared/` ou `tests/` fora do arquivo de origem.

**Contexto:**  
A constante é utilizada internamente pelo próprio `SettingsTabs` (navegação por
teclado e renderização de abas). O `export` é supérfluo — torná-la interna (`const`
sem `export`) não quebra nada.

**Impacto da remoção do `export`:**  
- Remover apenas a palavra-chave `export` da declaração; a constante permanece.
- Nenhum outro arquivo precisa ser ajustado.

---

## Símbolos Confirmados Como Utilizados

Todos os demais símbolos listados na tabela acima possuem pelo menos um importador
confirmado nos diretórios auditados:

| Símbolo | Importado por |
|---------|---------------|
| `AddTorrentModal` | `src/App.tsx` |
| `DropZone` | `src/App.tsx` |
| `ConfirmDialog` | `DownloadItem.tsx`, `DownloadList.tsx`, `DownloadListToolbar.tsx` |
| `ErrorBoundary` | `src/main.tsx` |
| `ProgressBar` | `DownloadItem.tsx` (src/), tests |
| `SpeedDisplay` | `DownloadItem.tsx` (src/) |
| `DetailsPanel` | `DownloadItem.tsx` (src/), tests |
| `isExpandable` | `DownloadItem.tsx` (src/), tests |
| `GeneralTab` | `DetailsPanel.tsx` (src/), tests |
| `PeersTab` | `DetailsPanel.tsx` (src/), tests |
| `PieceGrid` | `PiecesTab.tsx` (src/), tests |
| `PiecesTab` | `DetailsPanel.tsx` (src/), tests |
| `SpeedChart` | `SpeedTab.tsx` (src/), tests (mock) |
| `SpeedTab` | `DetailsPanel.tsx` (src/), tests |
| `TabBar` | `DetailsPanel.tsx` (src/), tests |
| `DownloadItem` | `DownloadList.tsx` (src/), tests |
| `DownloadList` | `src/App.tsx`, tests |
| `FilterSidebar` | `src/App.tsx` |
| `SearchBar` | `DownloadListToolbar.tsx`, `FilterSidebar.tsx` (src/), tests |
| `SortSelector` | `DownloadListToolbar.tsx`, `FilterSidebar.tsx` (src/), tests |
| `StatusFilter` | `DownloadListToolbar.tsx`, `FilterSidebar.tsx` (src/), tests |
| `FileSelector` | `AddTorrentModal.tsx`, `DownloadItem.tsx` (src/), tests |
| `GeneralSettings` | `SettingsPanel.tsx` (src/) |
| `LanguageSelector` | `GeneralSettings.tsx` (src/), tests |
| `NetworkSettings` | `SettingsPanel.tsx` (src/) |
| `SettingsPanel` | `src/App.tsx`, tests |
| `SettingsTabs` | `SettingsPanel.tsx` (src/) |
| `ThemeSwitcher` | `GeneralSettings.tsx` (src/), tests |
| `TrackerSettings` | `SettingsPanel.tsx` (src/) |
| `validateTransferFields` | `SettingsPanel.tsx` (src/) |
| `TransferSettings` | `SettingsPanel.tsx` (src/) |
| `TrackerPanel` | `DownloadItem.tsx` (src/) |

---

## Próximos Passos (Tarefa 7.3)

- **Remover `DownloadListToolbar`:** apagar `DownloadListToolbar.tsx` e
  `DownloadListToolbar.module.css`; atualizar/remover o arquivo de testes;
  executar `npm run typecheck` e `npm test -- --runInBand` para confirmar.
- **Corrigir `SETTINGS_TABS`:** remover a palavra-chave `export` da declaração da
  constante em `SettingsTabs.tsx`; executar `npm run typecheck` para confirmar.
