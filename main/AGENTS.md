# Processo principal

Aplica-se a `main/`, em complemento ao [guia da raiz](../AGENTS.md).

## Organização

- `index.ts` cria a janela, inicializa serviços, restaura sessão e trata lifecycle/crashes.
- `torrentEngine.ts` adapta WebTorrent; `webtorrentInternals.ts` concentra acesso a
  discovery, trackers, wires e outros detalhes privados da biblioteca.
- `downloadManager.ts` é a autoridade sobre estados, slots, fila e sessão persistida.
- `settingsManager.ts` gerencia defaults, validação/persistência e trackers globais.
- `ipcHandler.ts` registra comandos e eventos; `payloadValidator.ts` e
  `settingsValidator.ts` validam entradas. `validators.ts` reexporta `shared/validators.ts`.
- `logger.ts`, `metrics.ts` e `notificationManager.ts` dão suporte à operação.

Preserve interfaces públicas e factories `create*`, com dependências injetáveis.
`TorrentEngineImpl` e `DownloadManagerImpl` são classes internas com EventEmitter;
não substitua esse padrão apenas para uniformizar o estilo.

## Electron e IPC

- Preserve `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`,
  bloqueio de navegação/popups e CSP diferenciada entre desenvolvimento e produção.
- Registre `registerIpcHandlers` uma vez por lifecycle do aplicativo. Ao recriar
  uma janela no macOS, use `attachWindowEvents`, liberando intervalos e listeners
  no evento `closed`. Preserve o lock de instância única.
- Valide payloads em runtime antes de operar; tipos TypeScript não validam IPC.
  Reutilize schemas e regras existentes, acrescentando validação para novos campos.
- Use `trackedHandle` para novos comandos, preservando rate limiting e métricas.
  Retorne `IPCResponse<T>` com os helpers existentes e códigos de `ErrorCodes`
  quando aplicável. Preserve tratamento de rejeições e timeouts das operações.
- O renderer deve identificar destinos por `infoHash`; resolva arquivos/pastas
  a partir dos serviços. Em alterações de abertura/exclusão, verifique existência,
  permissões e contenção do caminho, incluindo caminhos absolutos e travessia.
  Não exponha uma API de shell ou filesystem arbitrária.

## Fila, sessão e rede

- Downloads `downloading` e `resolving-metadata`, além de adições pendentes,
  ocupam slots. Preserve reservas e bloqueios contra operações concorrentes,
  hashes duplicados e eventos tardios após pause/remove/restart.
- Atualize o estado usado pelos snapshots no ponto apropriado antes de aguardar
  operações da engine; preserve rollback/tratamento de falhas. Confira consumidores
  e testes ao mudar a ordem dos eventos.
- `queuePosition` é 1-based para exibição; `newIndex` de reordenação é 0-based.
  Preserve ordem da fila ao persistir/restaurar e seleção de arquivos por índices.
- Settings usam `schemaVersion`; downloads usam `downloadsSchemaVersion`.
  Alterações incompatíveis exigem migração e casos de sessão antiga/corrompida.
- Pausar deve interromper os recursos de rede pertinentes, preservando dados para
  retomar. Reuse helpers de `webtorrentInternals.ts` para parar/recriar discovery,
  trackers e conexões; preserve limites existentes de conexões e trackers.
- Mudanças DHT/PEX/uTP podem reiniciar a engine. Preserve guards de restart,
  timeouts, liberação dos recursos antigos e restauração dos downloads.
- Limites nas configurações são KB/s e `0` significa ilimitado. Preserve conversões
  para a unidade esperada pela engine e limpeza de timers/listeners.
- Use `logger`/logger de escopo e métricas existentes. Evite incluir magnet URIs,
  caminhos completos ou dados de peers em logs novos sem necessidade.

## Verificação

Selecione testes de engine, manager, settings e IPC conforme o fluxo alterado.
Para rede, inclua `tests/unit/networkLifecycle.test.ts`; para fila, os testes
`*QueuePriority*` e `downloadQueuePriority*`; para persistência/IPC, inclua os testes
em `tests/integration/`. Esses testes usam mocks; não comprovam download real.
Verifique `tsconfig.node.json`, e os demais projetos quando contratos mudarem.
