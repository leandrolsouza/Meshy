/**
 * @jest-environment jsdom
 */

// Testes do aplicador de tema — propriedade de aplicação completa no DOM
// e testes unitários de comportamento.
// Feature: theme-switcher

import * as fc from 'fast-check';
import { applyTheme, getCurrentThemeId } from '../../src/themes/themeApplier';
import { getAllThemes, DEFAULT_THEME_ID } from '../../src/themes/themeRegistry';

// ─── Limpeza do DOM entre testes ─────────────────────────────────────────────

beforeEach(() => {
    // Remove todos os estilos inline e o atributo data-theme do <html>
    document.documentElement.removeAttribute('style');
    delete document.documentElement.dataset.theme;
});

afterEach(() => {
    document.documentElement.removeAttribute('style');
    delete document.documentElement.dataset.theme;
});

// ─── Propriedade 3: Aplicação completa de tema no DOM ────────────────────────
// Feature: theme-switcher, Property 3: Aplicação completa de tema no DOM
// **Valida: Requisitos 3.1, 3.3**
describe('Propriedade 3: Aplicação completa de tema no DOM', () => {
    it('após applyTheme, cada token deve estar definido em document.documentElement.style e data-theme deve corresponder ao id', () => {
        const temas = getAllThemes();

        fc.assert(
            fc.property(fc.constantFrom(...temas), (tema) => {
                // Aplica o tema
                applyTheme(tema.id);

                // Verifica que cada token CSS está definido no estilo inline do :root
                for (const [chave, valor] of Object.entries(tema.tokens)) {
                    const valorAplicado = document.documentElement.style.getPropertyValue(chave);
                    expect(valorAplicado).toBe(valor);
                }

                // Verifica que data-theme corresponde ao id do tema
                expect(document.documentElement.dataset.theme).toBe(tema.id);
            }),
            { numRuns: 100 },
        );
    });
});

// ─── Testes Unitários do Aplicador de Tema ───────────────────────────────────
// Requisitos: 3.2, 1.4
describe('Testes unitários do aplicador de tema', () => {
    // Requisito 3.2: aplicação sem recarregar a página
    it('applyTheme não deve recarregar a página', () => {
        // Marca o DOM com um atributo antes de aplicar o tema.
        // Se a página fosse recarregada, esse atributo desapareceria.
        document.documentElement.setAttribute('data-test-marker', 'presente');

        applyTheme(DEFAULT_THEME_ID);

        // O marcador ainda está presente — a página não foi recarregada
        expect(document.documentElement.getAttribute('data-test-marker')).toBe('presente');
        // O tema foi aplicado normalmente no mesmo documento
        expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME_ID);

        document.documentElement.removeAttribute('data-test-marker');
    });

    // Requisito 1.4: ID inválido aplica tema padrão e retorna DEFAULT_THEME_ID
    it('applyTheme com ID inválido deve aplicar tema padrão e retornar DEFAULT_THEME_ID', () => {
        const resultado = applyTheme('non-existent-theme');

        expect(resultado).toBe(DEFAULT_THEME_ID);
        expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME_ID);
    });

    // Requisito 3.2: getCurrentThemeId retorna o ID do tema ativo
    it('getCurrentThemeId deve retornar o ID do tema ativo após aplicação', () => {
        const temas = getAllThemes();
        // Aplica um tema diferente do padrão para garantir que o valor muda
        const temaDracula = temas.find((t) => t.id === 'dracula')!;

        applyTheme(temaDracula.id);

        expect(getCurrentThemeId()).toBe('dracula');
    });
});
