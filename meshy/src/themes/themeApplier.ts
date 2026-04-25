// Aplicador de tema no DOM — atualiza CSS custom properties em :root
// sem recarregar a página ou remontar componentes React.

import { getTheme } from './themeRegistry';

/**
 * Aplica um tema ao DOM, atualizando todas as CSS custom properties em :root
 * e o atributo data-theme no <html>.
 * Retorna o ID do tema efetivamente aplicado (pode ser o padrão se o ID não existir).
 */
export function applyTheme(themeId: string): string {
    const theme = getTheme(themeId);

    // Aplica cada token como CSS custom property em :root
    for (const [key, value] of Object.entries(theme.tokens)) {
        document.documentElement.style.setProperty(key, value);
    }

    // Define o atributo data-theme no <html> para identificar o tema ativo
    document.documentElement.dataset.theme = theme.id;

    return theme.id;
}

/**
 * Retorna o ID do tema atualmente ativo lendo o atributo data-theme do <html>.
 */
export function getCurrentThemeId(): string {
    return document.documentElement.dataset.theme ?? '';
}
