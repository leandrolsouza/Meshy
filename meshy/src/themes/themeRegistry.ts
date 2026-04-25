// Registro centralizado de temas — módulo puro sem side effects.
// Cada tema é um objeto imutável contendo id, displayName e mapa de tokens CSS.

/** Mapa de propriedade CSS → valor */
export type ThemeTokens = Record<string, string>;

/** Definição completa de um tema */
export interface ThemeDefinition {
    id: string;
    displayName: string;
    tokens: ThemeTokens;
}

/** Lista de propriedades CSS obrigatórias que todo tema deve definir (27 tokens de cor) */
export const REQUIRED_TOKEN_KEYS: readonly string[] = [
    '--color-primary',
    '--color-primary-light',
    '--color-primary-dark',
    '--color-danger',
    '--color-danger-light',
    '--color-bg',
    '--color-surface',
    '--color-border',
    '--color-border-light',
    '--color-border-input',
    '--color-text',
    '--color-text-secondary',
    '--color-text-muted',
    '--color-text-placeholder',
    '--color-titlebar-bg',
    '--color-activitybar-bg',
    '--color-statusbar-bg',
    '--color-statusbar-text',
    '--color-hover',
    '--color-activitybar-hover',
    '--color-selection',
    '--color-success',
    '--color-input-bg',
    '--color-input-readonly-bg',
    '--color-scrollbar-thumb',
    '--color-scrollbar-thumb-hover',
    '--color-scrollbar-thumb-active',
] as const;

/** ID do tema padrão */
export const DEFAULT_THEME_ID = 'vs-code-dark';

// ─── Definições de Tema ──────────────────────────────────────────────────────

/** VS Code Dark — valores extraídos diretamente do global.css :root */
const vsCodeDark: ThemeDefinition = {
    id: 'vs-code-dark',
    displayName: 'VS Code Dark',
    tokens: {
        '--color-primary': '#007acc',
        '--color-primary-light': '#264f78',
        '--color-primary-dark': '#005a9e',
        '--color-danger': '#f44747',
        '--color-danger-light': 'rgba(244, 71, 71, 0.2)',
        '--color-bg': '#1e1e1e',
        '--color-surface': '#252526',
        '--color-border': '#474747',
        '--color-border-light': '#3c3c3c',
        '--color-border-input': '#474747',
        '--color-text': '#cccccc',
        '--color-text-secondary': '#969696',
        '--color-text-muted': '#969696',
        '--color-text-placeholder': '#6e6e6e',
        '--color-titlebar-bg': '#3c3c3c',
        '--color-activitybar-bg': '#333333',
        '--color-statusbar-bg': '#007acc',
        '--color-statusbar-text': '#ffffff',
        '--color-hover': '#2a2d2e',
        '--color-activitybar-hover': '#505050',
        '--color-selection': '#264f78',
        '--color-success': '#89d185',
        '--color-input-bg': '#3c3c3c',
        '--color-input-readonly-bg': '#2d2d2d',
        '--color-scrollbar-thumb': '#424242',
        '--color-scrollbar-thumb-hover': '#4f4f4f',
        '--color-scrollbar-thumb-active': '#5a5a5a',
    },
};

/** VS Code Light — fundos claros, texto escuro, statusbar com cor primária */
const vsCodeLight: ThemeDefinition = {
    id: 'vs-code-light',
    displayName: 'VS Code Light',
    tokens: {
        '--color-primary': '#007acc',
        '--color-primary-light': '#c2e0ff',
        '--color-primary-dark': '#005a9e',
        '--color-danger': '#e51400',
        '--color-danger-light': 'rgba(229, 20, 0, 0.15)',
        '--color-bg': '#ffffff',
        '--color-surface': '#f3f3f3',
        '--color-border': '#cecece',
        '--color-border-light': '#e0e0e0',
        '--color-border-input': '#cecece',
        '--color-text': '#333333',
        '--color-text-secondary': '#616161',
        '--color-text-muted': '#767676',
        '--color-text-placeholder': '#a0a0a0',
        '--color-titlebar-bg': '#dddddd',
        '--color-activitybar-bg': '#2c2c2c',
        '--color-statusbar-bg': '#007acc',
        '--color-statusbar-text': '#ffffff',
        '--color-hover': '#e8e8e8',
        '--color-activitybar-hover': '#505050',
        '--color-selection': '#add6ff',
        '--color-success': '#388a34',
        '--color-input-bg': '#ffffff',
        '--color-input-readonly-bg': '#f3f3f3',
        '--color-scrollbar-thumb': '#c1c1c1',
        '--color-scrollbar-thumb-hover': '#a8a8a8',
        '--color-scrollbar-thumb-active': '#999999',
    },
};

/** Dracula — fundo #282a36, texto #f8f8f2, destaque #bd93f9 */
const dracula: ThemeDefinition = {
    id: 'dracula',
    displayName: 'Dracula',
    tokens: {
        '--color-primary': '#bd93f9',
        '--color-primary-light': '#6272a4',
        '--color-primary-dark': '#9b6dff',
        '--color-danger': '#ff5555',
        '--color-danger-light': 'rgba(255, 85, 85, 0.2)',
        '--color-bg': '#282a36',
        '--color-surface': '#343746',
        '--color-border': '#44475a',
        '--color-border-light': '#3a3d4e',
        '--color-border-input': '#44475a',
        '--color-text': '#f8f8f2',
        '--color-text-secondary': '#bfbfbf',
        '--color-text-muted': '#6272a4',
        '--color-text-placeholder': '#6272a4',
        '--color-titlebar-bg': '#21222c',
        '--color-activitybar-bg': '#21222c',
        '--color-statusbar-bg': '#bd93f9',
        '--color-statusbar-text': '#282a36',
        '--color-hover': '#343746',
        '--color-activitybar-hover': '#44475a',
        '--color-selection': '#44475a',
        '--color-success': '#50fa7b',
        '--color-input-bg': '#343746',
        '--color-input-readonly-bg': '#2e303e',
        '--color-scrollbar-thumb': '#44475a',
        '--color-scrollbar-thumb-hover': '#565a6e',
        '--color-scrollbar-thumb-active': '#686d82',
    },
};

/** One Dark Pro — fundo #282c34, texto #abb2bf, destaque #61afef */
const oneDarkPro: ThemeDefinition = {
    id: 'one-dark-pro',
    displayName: 'One Dark Pro',
    tokens: {
        '--color-primary': '#61afef',
        '--color-primary-light': '#3b4f6b',
        '--color-primary-dark': '#4d8cc7',
        '--color-danger': '#e06c75',
        '--color-danger-light': 'rgba(224, 108, 117, 0.2)',
        '--color-bg': '#282c34',
        '--color-surface': '#2c313a',
        '--color-border': '#3e4452',
        '--color-border-light': '#353b45',
        '--color-border-input': '#3e4452',
        '--color-text': '#abb2bf',
        '--color-text-secondary': '#7f848e',
        '--color-text-muted': '#5c6370',
        '--color-text-placeholder': '#5c6370',
        '--color-titlebar-bg': '#21252b',
        '--color-activitybar-bg': '#21252b',
        '--color-statusbar-bg': '#61afef',
        '--color-statusbar-text': '#282c34',
        '--color-hover': '#2c313a',
        '--color-activitybar-hover': '#3e4452',
        '--color-selection': '#3e4452',
        '--color-success': '#98c379',
        '--color-input-bg': '#2c313a',
        '--color-input-readonly-bg': '#262a31',
        '--color-scrollbar-thumb': '#3e4452',
        '--color-scrollbar-thumb-hover': '#4b5263',
        '--color-scrollbar-thumb-active': '#585e6b',
    },
};

/** Monokai — fundo #272822, texto #f8f8f2, destaque #a6e22e */
const monokai: ThemeDefinition = {
    id: 'monokai',
    displayName: 'Monokai',
    tokens: {
        '--color-primary': '#a6e22e',
        '--color-primary-light': '#4d6617',
        '--color-primary-dark': '#86b31e',
        '--color-danger': '#f92672',
        '--color-danger-light': 'rgba(249, 38, 114, 0.2)',
        '--color-bg': '#272822',
        '--color-surface': '#2d2e27',
        '--color-border': '#49483e',
        '--color-border-light': '#3e3d32',
        '--color-border-input': '#49483e',
        '--color-text': '#f8f8f2',
        '--color-text-secondary': '#b3b3a6',
        '--color-text-muted': '#75715e',
        '--color-text-placeholder': '#75715e',
        '--color-titlebar-bg': '#1e1f1c',
        '--color-activitybar-bg': '#1e1f1c',
        '--color-statusbar-bg': '#a6e22e',
        '--color-statusbar-text': '#272822',
        '--color-hover': '#3e3d32',
        '--color-activitybar-hover': '#49483e',
        '--color-selection': '#49483e',
        '--color-success': '#a6e22e',
        '--color-input-bg': '#3e3d32',
        '--color-input-readonly-bg': '#333428',
        '--color-scrollbar-thumb': '#49483e',
        '--color-scrollbar-thumb-hover': '#5b5a4f',
        '--color-scrollbar-thumb-active': '#6d6c60',
    },
};

/** Solarized Dark — fundo #002b36, texto #839496, destaque #268bd2 */
const solarizedDark: ThemeDefinition = {
    id: 'solarized-dark',
    displayName: 'Solarized Dark',
    tokens: {
        '--color-primary': '#268bd2',
        '--color-primary-light': '#1a4a6e',
        '--color-primary-dark': '#1e6faa',
        '--color-danger': '#dc322f',
        '--color-danger-light': 'rgba(220, 50, 47, 0.2)',
        '--color-bg': '#002b36',
        '--color-surface': '#073642',
        '--color-border': '#2a5460',
        '--color-border-light': '#1a4450',
        '--color-border-input': '#2a5460',
        '--color-text': '#839496',
        '--color-text-secondary': '#657b83',
        '--color-text-muted': '#586e75',
        '--color-text-placeholder': '#586e75',
        '--color-titlebar-bg': '#00212b',
        '--color-activitybar-bg': '#00212b',
        '--color-statusbar-bg': '#268bd2',
        '--color-statusbar-text': '#fdf6e3',
        '--color-hover': '#073642',
        '--color-activitybar-hover': '#2a5460',
        '--color-selection': '#2a5460',
        '--color-success': '#859900',
        '--color-input-bg': '#073642',
        '--color-input-readonly-bg': '#04303c',
        '--color-scrollbar-thumb': '#2a5460',
        '--color-scrollbar-thumb-hover': '#3a6470',
        '--color-scrollbar-thumb-active': '#4a7480',
    },
};

/** Dark Modern — tema escuro padrão atual do VS Code, tons mais azulados */
const darkModern: ThemeDefinition = {
    id: 'dark-modern',
    displayName: 'Dark Modern',
    tokens: {
        '--color-primary': '#0078d4',
        '--color-primary-light': '#264f78',
        '--color-primary-dark': '#005a9e',
        '--color-danger': '#f85149',
        '--color-danger-light': 'rgba(248, 81, 73, 0.2)',
        '--color-bg': '#1f1f1f',
        '--color-surface': '#181818',
        '--color-border': '#2b2b2b',
        '--color-border-light': '#2b2b2b',
        '--color-border-input': '#3c3c3c',
        '--color-text': '#cccccc',
        '--color-text-secondary': '#9d9d9d',
        '--color-text-muted': '#7d7d7d',
        '--color-text-placeholder': '#6e6e6e',
        '--color-titlebar-bg': '#1f1f1f',
        '--color-activitybar-bg': '#181818',
        '--color-statusbar-bg': '#0078d4',
        '--color-statusbar-text': '#ffffff',
        '--color-hover': '#2a2d2e',
        '--color-activitybar-hover': '#2b2b2b',
        '--color-selection': '#264f78',
        '--color-success': '#89d185',
        '--color-input-bg': '#313131',
        '--color-input-readonly-bg': '#272727',
        '--color-scrollbar-thumb': '#424242',
        '--color-scrollbar-thumb-hover': '#4f4f4f',
        '--color-scrollbar-thumb-active': '#5a5a5a',
    },
};

/** Light Modern — tema claro moderno do VS Code, Activity Bar clara */
const lightModern: ThemeDefinition = {
    id: 'light-modern',
    displayName: 'Light Modern',
    tokens: {
        '--color-primary': '#005fb8',
        '--color-primary-light': '#c2e0ff',
        '--color-primary-dark': '#004e9a',
        '--color-danger': '#cd3131',
        '--color-danger-light': 'rgba(205, 49, 49, 0.15)',
        '--color-bg': '#ffffff',
        '--color-surface': '#f8f8f8',
        '--color-border': '#e5e5e5',
        '--color-border-light': '#e5e5e5',
        '--color-border-input': '#cecece',
        '--color-text': '#3b3b3b',
        '--color-text-secondary': '#616161',
        '--color-text-muted': '#767676',
        '--color-text-placeholder': '#a0a0a0',
        '--color-titlebar-bg': '#f8f8f8',
        '--color-activitybar-bg': '#f8f8f8',
        '--color-statusbar-bg': '#005fb8',
        '--color-statusbar-text': '#ffffff',
        '--color-hover': '#e8e8e8',
        '--color-activitybar-hover': '#d6d6d6',
        '--color-selection': '#add6ff',
        '--color-success': '#388a34',
        '--color-input-bg': '#ffffff',
        '--color-input-readonly-bg': '#f8f8f8',
        '--color-scrollbar-thumb': '#c1c1c1',
        '--color-scrollbar-thumb-hover': '#a8a8a8',
        '--color-scrollbar-thumb-active': '#999999',
    },
};

/** Dark High Contrast — alto contraste escuro para acessibilidade */
const darkHighContrast: ThemeDefinition = {
    id: 'dark-high-contrast',
    displayName: 'Dark High Contrast',
    tokens: {
        '--color-primary': '#6fc3df',
        '--color-primary-light': '#264f78',
        '--color-primary-dark': '#4daccc',
        '--color-danger': '#f48771',
        '--color-danger-light': 'rgba(244, 135, 113, 0.3)',
        '--color-bg': '#000000',
        '--color-surface': '#000000',
        '--color-border': '#6fc3df',
        '--color-border-light': '#6fc3df',
        '--color-border-input': '#6fc3df',
        '--color-text': '#ffffff',
        '--color-text-secondary': '#ffffff',
        '--color-text-muted': '#d4d4d4',
        '--color-text-placeholder': '#d4d4d4',
        '--color-titlebar-bg': '#000000',
        '--color-activitybar-bg': '#000000',
        '--color-statusbar-bg': '#6fc3df',
        '--color-statusbar-text': '#000000',
        '--color-hover': '#0f4a85',
        '--color-activitybar-hover': '#0f4a85',
        '--color-selection': '#0f4a85',
        '--color-success': '#89d185',
        '--color-input-bg': '#000000',
        '--color-input-readonly-bg': '#0a0a0a',
        '--color-scrollbar-thumb': '#6fc3df',
        '--color-scrollbar-thumb-hover': '#8fd4e8',
        '--color-scrollbar-thumb-active': '#a0dff0',
    },
};

/** Light High Contrast — alto contraste claro para acessibilidade */
const lightHighContrast: ThemeDefinition = {
    id: 'light-high-contrast',
    displayName: 'Light High Contrast',
    tokens: {
        '--color-primary': '#0f4a85',
        '--color-primary-light': '#c2e0ff',
        '--color-primary-dark': '#0a3163',
        '--color-danger': '#b5200d',
        '--color-danger-light': 'rgba(181, 32, 13, 0.15)',
        '--color-bg': '#ffffff',
        '--color-surface': '#ffffff',
        '--color-border': '#0f4a85',
        '--color-border-light': '#0f4a85',
        '--color-border-input': '#0f4a85',
        '--color-text': '#000000',
        '--color-text-secondary': '#000000',
        '--color-text-muted': '#292929',
        '--color-text-placeholder': '#292929',
        '--color-titlebar-bg': '#ffffff',
        '--color-activitybar-bg': '#ffffff',
        '--color-statusbar-bg': '#0f4a85',
        '--color-statusbar-text': '#ffffff',
        '--color-hover': '#b8d6f2',
        '--color-activitybar-hover': '#b8d6f2',
        '--color-selection': '#b8d6f2',
        '--color-success': '#166d0b',
        '--color-input-bg': '#ffffff',
        '--color-input-readonly-bg': '#f5f5f5',
        '--color-scrollbar-thumb': '#0f4a85',
        '--color-scrollbar-thumb-hover': '#1a5fa0',
        '--color-scrollbar-thumb-active': '#2570b5',
    },
};

// ─── Registro Interno ────────────────────────────────────────────────────────

/** Mapa interno de temas indexado por ID */
const themeMap: ReadonlyMap<string, ThemeDefinition> = new Map([
    [vsCodeDark.id, vsCodeDark],
    [vsCodeLight.id, vsCodeLight],
    [darkModern.id, darkModern],
    [lightModern.id, lightModern],
    [darkHighContrast.id, darkHighContrast],
    [lightHighContrast.id, lightHighContrast],
    [dracula.id, dracula],
    [oneDarkPro.id, oneDarkPro],
    [monokai.id, monokai],
    [solarizedDark.id, solarizedDark],
]);

// ─── Funções Públicas ────────────────────────────────────────────────────────

/** Retorna todos os temas disponíveis */
export function getAllThemes(): readonly ThemeDefinition[] {
    return Array.from(themeMap.values());
}

/**
 * Retorna um tema pelo ID.
 * Se o ID não for encontrado, retorna o tema padrão (vs-code-dark).
 */
export function getTheme(id: string): ThemeDefinition {
    return themeMap.get(id) ?? themeMap.get(DEFAULT_THEME_ID)!;
}

/** Verifica se um ID de tema existe no registro */
export function isValidThemeId(id: string): boolean {
    return themeMap.has(id);
}

/** Serializa uma ThemeDefinition para JSON */
export function serializeTheme(theme: ThemeDefinition): string {
    return JSON.stringify({
        id: theme.id,
        displayName: theme.displayName,
        tokens: theme.tokens,
    });
}

/**
 * Desserializa JSON para ThemeDefinition.
 * Lança erro descritivo em pt-BR se o JSON for inválido ou a estrutura estiver incorreta.
 */
export function deserializeTheme(json: string): ThemeDefinition {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new Error('Erro ao desserializar tema: JSON inválido.');
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Erro ao desserializar tema: o valor deve ser um objeto.');
    }

    const obj = parsed as Record<string, unknown>;

    if (typeof obj.id !== 'string' || obj.id.length === 0) {
        throw new Error('Erro ao desserializar tema: campo "id" deve ser uma string não-vazia.');
    }

    if (typeof obj.displayName !== 'string' || obj.displayName.length === 0) {
        throw new Error(
            'Erro ao desserializar tema: campo "displayName" deve ser uma string não-vazia.',
        );
    }

    if (typeof obj.tokens !== 'object' || obj.tokens === null || Array.isArray(obj.tokens)) {
        throw new Error('Erro ao desserializar tema: campo "tokens" deve ser um objeto.');
    }

    const tokens = obj.tokens as Record<string, unknown>;
    const resultTokens: ThemeTokens = {};

    for (const [key, value] of Object.entries(tokens)) {
        if (typeof value !== 'string') {
            throw new Error(
                `Erro ao desserializar tema: token "${key}" deve ter valor do tipo string.`,
            );
        }
        resultTokens[key] = value;
    }

    return {
        id: obj.id,
        displayName: obj.displayName,
        tokens: resultTokens,
    };
}

/**
 * Valida se uma ThemeDefinition possui todos os tokens obrigatórios.
 * Retorna um objeto indicando se é válido e quais chaves estão faltando.
 */
export function validateThemeTokens(
    theme: ThemeDefinition,
): { valid: boolean; missingKeys: string[] } {
    const missingKeys = REQUIRED_TOKEN_KEYS.filter((key) => {
        const value = theme.tokens[key];
        return typeof value !== 'string' || value.length === 0;
    });

    return {
        valid: missingKeys.length === 0,
        missingKeys,
    };
}
