# Catálogos de tradução

Aplica-se a `src/locales/`, complementando [src/AGENTS.md](../AGENTS.md).

- `index.ts` registra `SUPPORTED_LOCALES`; o default atual é `pt-BR`, seguido de
  `en-US`. Use códigos BCP 47 e nome nativo para novos idiomas.
- Catálogos JSON são mapas planos de IDs para strings, não objetos aninhados.
  Siga namespaces separados por ponto e segmentos em camelCase, como nos IDs
  existentes. Preserve IDs em uso e evite chaves duplicadas.
- Para novos textos, acrescente versões pt-BR/en-US com os mesmos placeholders.
  O catálogo default deve conter todas as chaves dos demais idiomas.
- Use ICU Message Format para variáveis, plural e seleção; preserve nomes/tipos
  dos argumentos e a opção `other`. Evite concatenar frases traduzidas.
- Códigos `error.*` usados pela UI devem existir nos catálogos e ser compatíveis
  com `shared/errorCodes.ts` e `resolveErrorMessage`.
- `getLocaleMessages` faz fallback do catálogo para o default quando o locale
  é desconhecido; não presuma mesclagem por chave. Preserve o comportamento do
  provider/defaultMessage e revise testes ao alterar a cadeia de fallback.
- Persistência fica em settings no main, com carregamento por `IntlWrapper` e
  seleção em `useLocaleStore`/`LanguageSelector`. Não crie armazenamento próprio.

Verifique JSON válido e os testes `i18n-*`, `LanguageSelector.test.tsx` e
`resolveErrorMessage.test.ts` conforme a alteração. Teste formatação ICU com
valores reais e confira os componentes que usam os IDs modificados.
