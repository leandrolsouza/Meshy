# Renderer React

Aplica-se a `src/`, em complemento ao [guia da raiz](../AGENTS.md).
Há instruções adicionais em `components/`, `locales/` e `themes/`.

## Fronteiras e estado

- O renderer roda com isolamento e sandbox. Acesso a downloads, configurações,
  diálogos e recursos do sistema passa por `window.meshy`; não importe Electron,
  WebTorrent, filesystem ou módulos de `main/`.
- Use os hooks existentes: `useDownloads`, `useSettings` e `useTrackers`
  encapsulam fluxos IPC. Confira `response.success` e trate também rejeições.
- `useDownloadStore` guarda snapshots por `infoHash`; o main é a autoridade dos
  estados. Preserve a reconciliação de `mergeItems`, incluindo o erro local que
  pode chegar antes do snapshot remoto. Não mantenha uma segunda fila de negócio.
- `filterStore` mantém busca, status e ordenação; use o pipeline em
  `utils/downloadFilters.ts`. Prefira seletores Zustand focados em dados usados.
- Preserve deduplicação de operações por hash e cleanup das assinaturas
  `onProgress`/`onError`. Não acrescente listeners a cada render.
- Em efeitos assíncronos, impeça atualizações obsoletas após unmount ou troca de
  hash. Libere timers/listeners. `React.StrictMode` está ativo em `main.tsx`.
- Use `usePolling` para polling condicional; trate rejeições na operação chamada.
  Não multiplique intervalos ao recriar callbacks ou alterar abas.

## Idiomas, temas e apresentação

- Novos textos visíveis e nomes acessíveis devem usar `react-intl` com IDs
  estáveis e traduções em `locales/pt-BR.json` e `locales/en-US.json`.
  Há textos literais legados, principalmente em detalhes; não amplie essa prática.
- Use `resolveErrorMessage` para traduzir códigos de erro. Preserve o fallback
  para erros sem tradução; não apresente sucesso após uma falha IPC.
- `IntlWrapper` carrega o locale persistido; `useLocaleStore` valida o registro
  e retorna ao default para locale desconhecido. Evite persistência paralela.
- Configurações são persistidas pelo main e o hook recebe os valores confirmados.
  Em idioma/tema, mantenha UI, preferência persistida e fallback coerentes.
- Componentes usam CSS Modules co-localizados. Cores vêm de tokens `--color-*`
  definidos nos temas e em `styles/global.css`; evite cores novas fixas no JSX/CSS.
- O alias `@renderer/*` aponta para `src/*` em Vite, TS web e Jest. Para contratos
  em `shared/`, siga as importações existentes e não invente aliases sem configurar
  os três ambientes.

## Verificação

Use testes de hooks, stores, filtros e componentes envolvidos, com jsdom quando
houver DOM. Verifique `tsconfig.web.json`, tipos dos testes e lint. Mudanças de
integração devem verificar também o projeto node/build. Um preview no navegador
precisa de mock de `window.meshy`; ele não comprova funcionamento em Electron.
