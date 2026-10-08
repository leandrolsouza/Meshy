# Tech Stack

## Runtime Dependencies

| Package | Version | Role |
|---------|---------|------|
| `electron` | ^41 | Desktop shell (main + renderer host) |
| `webtorrent` | ^2 | BitTorrent engine |
| `react` / `react-dom` | 19 | UI framework |
| `zustand` | ^5 | Client-side state management |
| `react-intl` | ^7 | i18n (ICU Message Format) |
| `react-icons` | ^5 | Icon set (VS Code icons via `VscXxx`) |
| `electron-store` | ^8 | Persistent settings and session storage |
| `electron-log` | ^5 | Structured logging in main process |
| `speed-limiter` | ^1 | Download/upload speed throttling |

## Dev Dependencies

| Package | Version | Role |
|---------|---------|------|
| `electron-vite` | ^5 | Build orchestrator for all three Electron targets |
| `vite` | ^7 | Renderer bundler |
| `typescript` | ~5.9 | Language — strict mode throughout |
| `jest` | ^29 | Test runner |
| `ts-jest` | ^29 | TypeScript transform for Jest |
| `@testing-library/react` | ^16 | Component testing |
| `fast-check` | ^3 | Property-based testing |
| `eslint` | ^10 | Linter (flat config) |
| `typescript-eslint` | ^8 | TypeScript-aware lint rules |
| `eslint-plugin-react-hooks` | ^7 | React hooks lint rules |
| `prettier` | ^3 | Code formatter |
| `identity-obj-proxy` | ^3 | CSS Modules mock for Jest |

## TypeScript Configuration

Four tsconfig files with project references:

- `tsconfig.json` — root references config; used by `tsc --noEmit` for typechecking
- `tsconfig.node.json` — main process + preload + shared; `target: ES2022`, `module: ES2022`, `moduleResolution: bundler`, `strict: true`
- `tsconfig.web.json` — renderer + shared; `target: ES2020`, `jsx: react-jsx`, `@renderer/*` → `src/*` alias
- `tsconfig.jest.json` — tests; `module: CommonJS`, `moduleResolution: node` (Jest compatibility)

All configs enable `strict: true`, `esModuleInterop`, `allowSyntheticDefaultImports`.

## Code Style

Enforced by Prettier (`.prettierrc`):
- Single quotes
- 4-space indentation
- Semicolons
- Trailing commas everywhere
- 100-character print width
- Arrow functions always parenthesized

ESLint rules (notable):
- `@typescript-eslint/no-unused-vars`: warn (ignores `_`-prefixed)
- `@typescript-eslint/no-explicit-any`: warn
- React hooks rules enforced only in `src/**`
- `eslint-config-prettier` applied last

## Common Commands

```bash
npm run dev             # Start app in development mode with hot reload
npm run build           # Production build (output in out/)
npm run preview         # Preview the production build
npm start               # Run compiled output directly (electron .)

npm test                # Run all Jest tests
npm run test:watch      # Jest in watch mode
npm run test:coverage   # Jest with coverage report

npm run typecheck       # tsc --noEmit (type-check all projects)
npm run lint            # ESLint
npm run lint:fix        # ESLint with auto-fix
npm run format          # Prettier --write
npm run format:check    # Prettier --check (CI)
```

Build output: `out/main/index.mjs` (main), `out/renderer/` (renderer), `out/preload/` (preload).
