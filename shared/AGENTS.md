# Contratos compartilhados

Aplica-se a `shared/`, em complemento ao [guia da raiz](../AGENTS.md).

Esta árvore é incluída nos projetos TypeScript node e web. Mantenha tipos e funções
compatíveis com os consumidores dos dois processos, sem side effects de runtime.

- `types.ts` é a fonte dos contratos: `MeshyAPI`, `IPCResponse`, settings,
  downloads, estados e DTOs de detalhes. Não duplique interfaces no renderer/main.
- Preserve o discriminante `success` de `IPCResponse<T>` e verifique-o antes de
  acessar `data` ou `error`. DTOs IPC devem ser serializáveis, sem instâncias
  WebTorrent, objetos Electron, funções ou eventos de Node.
- Não adicione dependências de Electron, React, DOM, filesystem ou serviços do
  main. O helper `hasTorrentMagicBytes` atualmente recebe `Buffer`; isso não
  autoriza exigir Buffer global em código executado no renderer.
- Validação de magnet, tracker, limites e toggles fica em `validators.ts`.
  `main/validators.ts` é uma reexportação por compatibilidade; altere a origem.
  A checagem de extensão/magic byte é superficial, não um parser de bencode.
- Preserve protocolos de trackers aceitos, normalização, rejeições existentes
  e limites de concorrência, salvo mudança explícita de comportamento.
- Códigos estáveis de falha ficam em `errorCodes.ts`; novos códigos exibidos na
  UI precisam de traduções e resolução via `src/utils/resolveErrorMessage.ts`.
- Use unidades explícitas: tamanhos e velocidades observadas em bytes/bytes por
  segundo; limites de settings em KB/s; progresso fracionário de 0 a 1; timestamps
  e durações em milissegundos. Documente exceções ao acrescentar campos.

Mudanças de tipos/estados exigem revisar IPC, stores, filtros, UI, persistência e
mocks afetados. Verifique os três tsconfigs e testes de validadores/formatadores,
além dos testes dos consumidores alterados.
