# Componentes e interação

Aplica-se a `src/components/`, complementando [src/AGENTS.md](../AGENTS.md).
`DownloadDetails/` possui instruções próprias.

- Use componentes funcionais tipados, CSS Modules ao lado do TSX e os padrões
  dos componentes `common/`. Reutilize controles existentes antes de duplicar UI.
- Preserve layout Activity Bar/editor, tokens dos temas e estilos de foco.
  Novos textos, inclusive `aria-label`, devem ser traduzidos com react-intl.
- Use controles semânticos, labels, nomes acessíveis para botões de ícone e
  associações ARIA corretas. Modais devem admitir teclado, gerenciar foco e
  devolver foco ao fechar. Não remova ARIA existente em progressbars e abas.
- Metadata, nomes de torrents, caminhos e comentários são dados externos.
  Renderize-os como texto; evite HTML arbitrário e navegação derivada desses dados.
- Ações assíncronas devem expor pending/erro e evitar cliques duplicados. Preserve
  a escolha explícita de exclusão de arquivos nos fluxos de remoção/confirmação.
- Arquivos arrastados de `.torrent` passam pelo fluxo de bytes/preload; não
  dependa de APIs Node ou propriedades de caminho não disponíveis no navegador.
- Na lista, diferencie índices de exibição filtrada e índices reais da fila.
  Reordenação aceita `newIndex` 0-based, enquanto `queuePosition` é 1-based.
  Preserve controles por teclado além do drag-and-drop.
- Considere atualizações de progresso a cada segundo. Use memoização quando
  houver custo/referências relevantes; não replique estado do main para otimizar.
- Em Settings, mantenha limites/unidades, defaults, loading e persistência via
  hooks. Uma opção nova também exige tipos e validação/persistência no main.

Valide a interação alterada com Testing Library e os testes existentes, incluindo
drag-and-drop, fila, seleção de arquivos ou abertura de destino quando pertinente.
Para mudanças visuais, inspecione temas claro/escuro, texto nos dois idiomas e
navegação por teclado; registre quando não houver runtime para inspeção manual.
