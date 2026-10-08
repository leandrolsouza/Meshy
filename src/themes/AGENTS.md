# Registro e aplicação de temas

Aplica-se a `src/themes/`, complementando [src/AGENTS.md](../AGENTS.md).

- `themeRegistry.ts` mantém definições e lookup sem side effects de DOM.
  `themeApplier.ts` aplica tokens em `document.documentElement` e `data-theme`.
  Preserve essa separação para uso/testes em ambientes sem navegador.
- Novos temas devem ter ID único estável, displayName e todos os tokens de
  `REQUIRED_TOKEN_KEYS`. Use o mecanismo de validação/registro existente.
- Preserve o fallback para `DEFAULT_THEME_ID` em IDs desconhecidos. Preferências
  antigas não devem impedir a inicialização da UI.
- Componentes consomem CSS custom properties. Ao criar um token obrigatório,
  atualize todos os temas, `src/styles/global.css`, usos e testes em conjunto.
- Aplicar tema deve atualizar tokens e `data-theme` sem recarregar a página ou
  remontar React. Mantenha retorno do ID efetivamente aplicado.
- IDs são persistidos em settings pelo main; revise validação, IPC e
  `Settings/ThemeSwitcher.tsx` ao mudar o formato/registro de identificadores.
  Não importe o aplicador DOM no main para validar preferências.
- Verifique contraste, foco e estados hover/disabled em temas claros, escuros e
  de alto contraste; não ajuste uma cor isolada sem verificar seus consumidores.

Use `themeRegistry.test.ts`, `themeApplier.test.ts`, `ThemeSwitcher.test.tsx`,
`settingsManagerTheme.test.ts` e `ipcHandlerTheme.test.ts` conforme o impacto.
