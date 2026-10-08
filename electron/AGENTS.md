# Preload e ponte IPC

Aplica-se a `electron/`, em complemento ao [guia da raiz](../AGENTS.md).

`preload.ts` expõe somente `window.meshy` por `contextBridge.exposeInMainWorld`.
O objeto é tipado como `MeshyAPI`, definido em `shared/types.ts`.

- Exponha métodos específicos e canais fixos; nunca exponha `ipcRenderer`,
  `require`, `process`, filesystem ou envio/invocação de canais arbitrários.
- Para um comando novo, alinhe `MeshyAPI`, implementação do preload, handler do
  main, payload, consumidor e mocks. Comandos retornam `Promise<IPCResponse<T>>`;
  `reportError` é a exceção atual, sem retorno e com rejeição tratada internamente.
- Em eventos, passe apenas o payload ao callback, sem expor o evento Electron.
  Toda assinatura deve devolver uma função que remove exatamente seu listener.
  Evite `removeAllListeners`, que interfere em outros consumidores.
- O preload deve permanecer pequeno: regras de negócio e validação autoritativa
  ficam no main. Não importe módulos de serviços ou componentes React aqui.
- No fluxo de arquivo vindo do navegador, preserve transporte de `Uint8Array`
  para o handler de buffer, sem depender de acesso Node no renderer.
- Preserve compatibilidade com sandbox e os caminhos de saída do build:
  `main/index.ts` carrega `out/preload/index.js`.

Confira `tests/integration/ipc-channels.test.ts` e os testes de handlers ligados
ao contrato alterado. Verifique os projetos node/web, os tipos dos testes e o
build; inspecione o código do preload, pois mocks de IPC não validam sua execução.
