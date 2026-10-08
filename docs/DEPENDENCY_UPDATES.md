# Atualização de dependências — outubro de 2026

As versões resolvidas estão em `package-lock.json`. Para instalar a mesma árvore,
use `npm ci` com Node.js compatível; a validação desta migração usou Node 22.17.0.

## Versões atualizadas

| Pacote                                       | Versão resolvida |
| -------------------------------------------- | ---------------- |
| `@testing-library/jest-dom`                  | 7.0.1            |
| `@types/jest`                                | 30.0.0           |
| `@types/node`                                | 26.6.4           |
| `@types/react`                               | 19.3.0           |
| `@types/react-dom`                           | 19.3.0           |
| `electron-store`                             | 11.0.2           |
| `fast-check`                                 | 4.10.2           |
| `jest`                                       | 30.5.2           |
| `react-intl`                                 | 12.1.4           |
| `@typescript/native` (alias de `typescript`) | 7.0.2            |

## Compatibilidade

- **Build:** `electron-vite` 5.0.0, Vite 7.3.7 e `@vitejs/plugin-react` 5.2.0
  permanecem. O electron-vite estável declara suporte até Vite 7; o plugin React 6
  exige Vite 8. A migração dos dois fica adiada até haver suporte estável.
- **TypeScript:** o compilador nativo 7 não fornece a API JavaScript usada por Jest
  e ESLint. A instalação segue a [orientação do ts-jest](https://github.com/kulshekhar/ts-jest/blob/main/website/docs/guides/typescript-7.md):
  `@typescript/native` aponta para `typescript@~7.0.2`, enquanto `typescript` aponta
  para `@typescript/typescript6@~6.0.2`. `tsc` usa a versão nativa; `tsc6` usa a
  API compatível. `npm run typecheck` verifica node, web e testes explicitamente.
- **Jest:** `tsconfig.jest.json` usa `NodeNext` e `isolatedModules`, substituindo
  `node10`, removido no TypeScript 7. Os arquivos TypeScript continuam executando
  como CommonJS no Jest. O smoke test de fast-check usa import estático.
- **React Intl:** a versão 12 e as dependências FormatJS são ESM. `babel-jest` e
  `@babel/plugin-transform-modules-commonjs` transformam esses pacotes para os
  testes; o build da aplicação usa o suporte ESM existente no Vite.
- **fast-check:** os geradores `stringOf` e `hexaString` foram migrados para
  `string({ unit, ... })`, preservando os alfabetos e os limites de comprimento.
  O gerador de lista vazia de downloads tem tipo explícito para evitar inferência
  de array imutável na versão 4.
- **electron-store:** a versão 11 é ESM, compatível com o main emitido em `.mjs`.
  O nome do arquivo, defaults e schema da aplicação permanecem os mesmos.

## Verificação

```sh
npm run typecheck
npm test -- --runInBand
npm run lint
npm run build
npm run format:check
```

Os testes de serviços usam mocks de Electron/WebTorrent. O build e os testes não
comprovam execução desktop nem download real. A instalação durante a migração
usou `npm install --ignore-scripts`, preservando os binários nativos já disponíveis.

Resultado desta migração: 70 suítes e 1.288 testes passaram; tipos e build passaram;
lint terminou com 294 avisos e nenhum erro. A formatação dos arquivos alterados
passou. O `format:check` global ainda acusa 76 arquivos fora desta alteração, com
problemas de formatação preexistentes. O `npm audit` informa 27 vulnerabilidades
na árvore completa (1 baixa, 21 moderadas e 5 altas), pendentes de tratamento.
