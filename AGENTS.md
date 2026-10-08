# Instruções para agentes — Meshy

## Escopo e leitura

Este arquivo orienta todo o repositório. Os `AGENTS.md` de subdiretórios acrescentam
instruções para suas respectivas árvores; em conflitos locais, use o documento mais
próximo do arquivo alterado. Instruções explícitas do usuário têm precedência.

Leia os arquivos envolvidos e os testes existentes antes de editar. Use o código,
`package.json`, `package-lock.json` e as configurações como referência do estado atual.
O README contém informações históricas, como Electron 33 e factories sem classes;
o manifesto atual usa Electron 41 e há implementações internas em classes.

## Projeto e fronteiras

Meshy é um cliente BitTorrent desktop multiplataforma, com Electron, WebTorrent,
React 19, Zustand, react-intl e TypeScript em modo strict.

| Área | Responsabilidade | Instruções locais |
| --- | --- | --- |
| `main/` | Electron, engine, fila, persistência, IPC, logs e métricas | [main/AGENTS.md](main/AGENTS.md) |
| `electron/` | Ponte segura entre main e renderer | [electron/AGENTS.md](electron/AGENTS.md) |
| `shared/` | Tipos, códigos de erro, validação e formatação comuns | [shared/AGENTS.md](shared/AGENTS.md) |
| `src/` | Renderer React, hooks, stores e estilos | [src/AGENTS.md](src/AGENTS.md) |
| `src/components/` | Componentes, interação e acessibilidade | [components/AGENTS.md](src/components/AGENTS.md) |
| `src/components/DownloadDetails/` | Abas, polling e visualização do torrent | [DownloadDetails/AGENTS.md](src/components/DownloadDetails/AGENTS.md) |
| `src/locales/` | Catálogos e registro de idiomas | [locales/AGENTS.md](src/locales/AGENTS.md) |
| `src/themes/` | Registro de temas e aplicação de tokens no DOM | [themes/AGENTS.md](src/themes/AGENTS.md) |
| `tests/` | Jest, Testing Library e fast-check | [tests/AGENTS.md](tests/AGENTS.md) |
| `docs/` | Documentação e roteiros de manutenção | [docs/AGENTS.md](docs/AGENTS.md) |

Fluxo principal: componentes/hooks → `window.meshy` → preload → handlers IPC →
serviços do main. Contratos públicos ficam em `shared/types.ts`. O main envia
snapshots de downloads ao renderer pelo evento `torrent:progress` a cada segundo.

## Preparação e comandos

Use npm e mantenha `package-lock.json` coerente com alterações de dependências.
Para instalar a árvore existente, use `npm ci`. Os engines do lockfile atual
exigem Node compatível com Vite, electron-vite e ESLint; Node 22.13+ na linha 22
atende essas exigências. O requisito Node >=18 do README está desatualizado.
Dependências nativas de WebTorrent/Electron podem exigir preparação específica.

Execute os comandos a partir da raiz:

```sh
npm run dev
npm run build
npm test -- --runInBand
npm run lint
npm run format:check
```

`npm start` executa o build existente em `out/`; não compila as fontes.
`npm run build` gera bundles, mas não há script de instalador/distribuição no manifesto.

O script `npm run typecheck` executa `tsc --noEmit` sobre uma configuração raiz com
`files: []` e referências. Não o considere prova de que main e renderer foram
verificados. Para verificar os projetos e os testes explicitamente:

```sh
npx --no-install tsc --noEmit -p tsconfig.node.json
npx --no-install tsc --noEmit -p tsconfig.web.json
npx --no-install tsc --noEmit -p tsconfig.jest.json
```

Para selecionar testes, use `npm test -- --runInBand --runTestsByPath` seguido dos
arquivos relevantes. Para formatar, use Prettier apenas nos arquivos alterados;
`npm run format` e `npm run lint:fix` atuam em todo o repositório.

## Convenções e fluxo de alteração

- Preserve alterações locais do usuário. Confira `git status --short` antes e depois;
  não restaure, exclua ou reformate arquivos fora do escopo da tarefa.
- Escreva documentação e comunique resultados em português, mantendo nomes de
  símbolos e APIs existentes. Evite refatorações amplas em correções pontuais.
- Siga `.prettierrc`: quatro espaços, aspas simples em TS, ponto e vírgula,
  trailing commas e largura de 100 caracteres. Use `import type` para tipos.
- Preserve as factories públicas `create*`, a injeção de dependências para testes
  e as fronteiras de processo. Classes internas já existentes são parte do padrão.
- Em mudanças de contrato IPC, revise tipos compartilhados, preload, handler,
  consumidor e mocks/testes em conjunto.
- Em novos campos de configuração, revise `AppSettings`, defaults/persistência,
  validação do main, IPC, hooks, UI e traduções. Planeje migração quando necessário.
- Não edite artefatos gerados em `out/`, `dist/`, `coverage/` ou `*.tsbuildinfo`.
  `.kiro/` é ignorado pelo Git; não faça instruções essenciais dependerem dele.
- Verifique conforme o impacto: documentação exige revisão de links e comandos;
  código exige testes relevantes, tipos e lint; mudanças de build ou das fronteiras
  Electron também exigem build. Não instale dependências só para validar Markdown.
- Ao concluir, informe o resultado, verificações executadas e limitações reais.
  Se faltarem dependências ou runtime Electron, registre a limitação sem afirmar
  que testes ou execução desktop foram validados.
