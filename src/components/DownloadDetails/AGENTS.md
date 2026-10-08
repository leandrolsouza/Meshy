# Painel de detalhes do torrent

Aplica-se a esta árvore e complementa [components/AGENTS.md](../AGENTS.md).

- `DetailsPanel` coordena expansão e abas Geral, Peers, Peças e Velocidade.
  Os painéis permanecem montados e são ocultados por CSS para conservar estado.
- Preserve a regra de expansão: `queued` e `resolving-metadata` impedem abrir o
  painel e provocam colapso. Ao expandir novamente, a aba ativa volta para Geral.
- Preserve IDs por `infoHash`, relações `aria-labelledby`/`aria-controls`, papéis
  de tab/tablist/tabpanel e navegação por teclado implementada em `TabBar`.
- Geral/Peers/Peças usam métodos tipados do preload. Peers e Peças fazem polling
  de 2 segundos quando `downloading`; confira guards de erro e de status antes
  de mudar ativação. Como abas ficam montadas, visibilidade não interrompe polling
  automaticamente. Trate respostas atrasadas ao trocar torrent/status.
- Velocidade usa `useSpeedHistory`, limitado a 60 amostras, e `isCollecting`
  acompanha expansão. Preserve preenchimento de pausas e limite de memória.
- `PieceStatus` é um array booleano; `groupPieces` em `utils/detailsFormatters.ts`
  agrupa a visualização com limite padrão de 500 blocos. Não renderize uma célula
  por peça sem considerar torrents grandes.
- Metadata e peers podem estar ausentes ou mudar durante polling. Preserve estados
  vazios/erro e formatação de unidades; não exponha objetos WebTorrent na UI.
- Há labels e formatadores legados em português literal. Para novos textos use
  react-intl; alterações de internacionalização devem ajustar os testes afetados.

Use os testes em `tests/unit/downloadDetails/`, incluindo polling, histórico,
agrupamento, propriedades e IPC. Hooks/formatadores ficam fora desta árvore;
respeite também suas instruções ancestrais ao alterá-los.
