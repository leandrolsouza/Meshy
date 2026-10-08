# Testes e verificação

Aplica-se a `tests/`, em complemento ao [guia da raiz](../AGENTS.md).

## Ambiente e organização

- Jest usa `ts-jest` com `tsconfig.jest.json` e ambiente padrão `node`.
  Para componentes/hooks que usam DOM, coloque `/** @jest-environment jsdom */`
  no início do arquivo. Use Testing Library e importe jest-dom quando necessário.
- `tests/setup.ts` é carregado em `setupFiles` e mocka electron-log/electron-store.
  Electron, WebTorrent e `window.meshy` precisam de mocks específicos ao teste.
- CSS Modules usam `identity-obj-proxy`; `@renderer/*` resolve para `src/*`.
- Unitários ficam em `unit/`, integração em `integration/`, e detalhes em
  `unit/downloadDetails/`. Arquivos `.pbt.test.ts(x)` usam fast-check.
- A integração atual verifica serviços/IPC com mocks; não é teste E2E de Electron
  nem teste de swarm ou download real. Não descreva seus resultados como tal.

## Como escrever e manter

- Teste comportamento observável e invariantes: respostas IPC, estados/ordem da
  fila, sessão restaurada, cleanup, validação e interação acessível. Para bugs,
  acrescente uma regressão que reproduza a falha; não replique a implementação.
- Reuse factories/dependências injetáveis. Não inicie Electron/WebTorrent real,
  não acesse trackers externos e não toque a sessão/pasta de downloads do usuário.
- Atualize mocks de `MeshyAPI`, managers, settings e engine quando os contratos
  mudarem. As fixtures devem respeitar unidades, estados e formatos de hash.
- Para lifecycle/rede, mocks devem reproduzir EventEmitter, discovery, trackers,
  wires e callbacks relevantes, incluindo atrasos e erros do cenário testado.
- Testes de UI devem verificar papéis, nomes, foco e ações; prefira consultas
  acessíveis a detalhes internos. Envolva componentes internacionalizados em
  `IntlProvider` e use mensagens adequadas ao locale testado.
- Restaure stores Zustand, mocks, timers, listeners e estado DOM entre testes.
  Use relógio controlado para polling/timeouts; restaure timers reais ao concluir.
- Propriedades fast-check devem ter invariantes independentes da implementação,
  geradores válidos e limites claros. Ao investigar falha, use seed/path informado
  para reproduzir; não reduza arbitrariamente a cobertura para obter sucesso.
- Não altere expectativas ou desabilite testes para esconder uma regressão.

## Execução

Da raiz, rode testes selecionados com `npm test -- --runInBand --runTestsByPath`
e os caminhos dos arquivos. Para mudanças amplas de contrato, fila, engine ou
persistência, rode a suíte completa com `npm test -- --runInBand`.

Use `npx --no-install tsc --noEmit -p tsconfig.jest.json` para os tipos dos testes,
além dos projetos node/web afetados. `npm run test:coverage` é opcional conforme
a tarefa: `collectCoverageFrom` atualmente cobre `main/**/*.ts` e `src/**/*.ts`,
exclui índices/declarações e não inclui shared, preload ou componentes TSX.
Não interprete esse relatório como cobertura completa do aplicativo.
