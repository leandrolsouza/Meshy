// Testes do registro de temas — propriedades universais e exemplos específicos.
// Feature: theme-switcher

import * as fc from 'fast-check';
import {
    ThemeDefinition,
    REQUIRED_TOKEN_KEYS,
    DEFAULT_THEME_ID,
    getAllThemes,
    getTheme,
    serializeTheme,
    deserializeTheme,
    validateThemeTokens,
} from '../../src/themes/themeRegistry';

// IDs válidos de temas registrados
const VALID_THEME_IDS = [
    'vs-code-dark',
    'vs-code-light',
    'dracula',
    'one-dark-pro',
    'monokai',
    'solarized-dark',
];

// ─── Propriedade 1: Estrutura válida de todos os temas ───────────────────────
// Feature: theme-switcher, Property 1: Estrutura válida de todos os temas
// **Valida: Requisitos 1.1, 7.5**
describe('Propriedade 1: Estrutura válida de todos os temas', () => {
    it('todo tema deve ter id, displayName não-vazios e todos os tokens obrigatórios', () => {
        const temas = getAllThemes();

        fc.assert(
            fc.property(fc.constantFrom(...temas), (tema: ThemeDefinition) => {
                // id deve ser string não-vazia
                expect(typeof tema.id).toBe('string');
                expect(tema.id.length).toBeGreaterThan(0);

                // displayName deve ser string não-vazia
                expect(typeof tema.displayName).toBe('string');
                expect(tema.displayName.length).toBeGreaterThan(0);

                // tokens deve conter todas as chaves obrigatórias com valores string não-vazios
                for (const key of REQUIRED_TOKEN_KEYS) {
                    const valor = tema.tokens[key];
                    expect(typeof valor).toBe('string');
                    expect(valor.length).toBeGreaterThan(0);
                }
            }),
            { numRuns: 100 },
        );
    });
});

// ─── Propriedade 2: Fallback para tema padrão com ID inválido ────────────────
// Feature: theme-switcher, Property 2: Fallback para tema padrão com ID inválido
// **Valida: Requisitos 1.4, 2.3**
describe('Propriedade 2: Fallback para tema padrão com ID inválido', () => {
    it('getTheme com ID inválido deve retornar o tema padrão', () => {
        fc.assert(
            fc.property(
                fc.string().filter((s) => !VALID_THEME_IDS.includes(s)),
                (idInvalido: string) => {
                    const tema = getTheme(idInvalido);
                    expect(tema.id).toBe(DEFAULT_THEME_ID);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ─── Propriedade 6: Round-trip de serialização de tema ───────────────────────
// Feature: theme-switcher, Property 6: Round-trip de serialização de tema
// **Valida: Requisito 8.3**
describe('Propriedade 6: Round-trip de serialização de tema', () => {
    // Gerador customizado de ThemeDefinition com todas as chaves obrigatórias
    const themeDefinitionArb = fc
        .record({
            id: fc.string({ minLength: 1 }),
            displayName: fc.string({ minLength: 1 }),
            tokenValues: fc.array(fc.hexaString({ minLength: 1 }), {
                minLength: REQUIRED_TOKEN_KEYS.length,
                maxLength: REQUIRED_TOKEN_KEYS.length,
            }),
        })
        .map(({ id, displayName, tokenValues }) => {
            const tokens: Record<string, string> = {};
            for (let i = 0; i < REQUIRED_TOKEN_KEYS.length; i++) {
                tokens[REQUIRED_TOKEN_KEYS[i]] = tokenValues[i];
            }
            return { id, displayName, tokens } as ThemeDefinition;
        });

    it('deserializeTheme(serializeTheme(tema)) deve produzir objeto igual ao original', () => {
        fc.assert(
            fc.property(themeDefinitionArb, (tema: ThemeDefinition) => {
                const serializado = serializeTheme(tema);
                const desserializado = deserializeTheme(serializado);
                expect(desserializado).toEqual(tema);
            }),
            { numRuns: 100 },
        );
    });
});

// ─── Propriedade 7: Validação rejeita tokens incompletos ─────────────────────
// Feature: theme-switcher, Property 7: Validação rejeita tokens incompletos
// **Valida: Requisito 10.2**
describe('Propriedade 7: Validação rejeita tokens incompletos', () => {
    // Gerador que remove um subconjunto aleatório (não-vazio) de chaves obrigatórias
    const temaIncompletoArb = fc
        .record({
            id: fc.string({ minLength: 1 }),
            displayName: fc.string({ minLength: 1 }),
            tokenValues: fc.array(fc.hexaString({ minLength: 1 }), {
                minLength: REQUIRED_TOKEN_KEYS.length,
                maxLength: REQUIRED_TOKEN_KEYS.length,
            }),
            // Gera subarray de índices para remover (pelo menos 1 chave removida)
            indicesToRemove: fc
                .subarray(
                    Array.from({ length: REQUIRED_TOKEN_KEYS.length }, (_, i) => i),
                    { minLength: 1 },
                ),
        })
        .map(({ id, displayName, tokenValues, indicesToRemove }) => {
            const tokens: Record<string, string> = {};
            const removedKeys: string[] = [];

            for (let i = 0; i < REQUIRED_TOKEN_KEYS.length; i++) {
                if (indicesToRemove.includes(i)) {
                    removedKeys.push(REQUIRED_TOKEN_KEYS[i]);
                } else {
                    tokens[REQUIRED_TOKEN_KEYS[i]] = tokenValues[i];
                }
            }

            const tema: ThemeDefinition = { id, displayName, tokens };
            return { tema, removedKeys };
        });

    it('validateThemeTokens deve retornar valid: false e listar as chaves removidas', () => {
        fc.assert(
            fc.property(temaIncompletoArb, ({ tema, removedKeys }) => {
                const resultado = validateThemeTokens(tema);
                expect(resultado.valid).toBe(false);
                expect(resultado.missingKeys.sort()).toEqual(removedKeys.sort());
            }),
            { numRuns: 100 },
        );
    });
});

// ─── Testes Unitários do Registro de Temas ───────────────────────────────────
// Requisitos: 1.2, 1.3, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 8.2
describe('Testes unitários do registro de temas', () => {
    it('o registro deve conter exatamente 10 temas', () => {
        const temas = getAllThemes();
        expect(temas).toHaveLength(10);
    });

    it('o tema padrão deve ser "vs-code-dark"', () => {
        expect(DEFAULT_THEME_ID).toBe('vs-code-dark');
        const temaPadrao = getTheme(DEFAULT_THEME_ID);
        expect(temaPadrao.id).toBe('vs-code-dark');
        expect(temaPadrao.displayName).toBe('VS Code Dark');
    });

    // ─── Cores características de cada tema ──────────────────────────────

    describe('VS Code Light — cores claras para fundo e escuras para texto', () => {
        const tema = getTheme('vs-code-light');

        it('deve ter fundo claro (#ffffff)', () => {
            expect(tema.tokens['--color-bg']).toBe('#ffffff');
        });

        it('deve ter texto escuro (#333333)', () => {
            expect(tema.tokens['--color-text']).toBe('#333333');
        });

        it('deve ter barra de status com fundo na cor primária (#007acc)', () => {
            expect(tema.tokens['--color-statusbar-bg']).toBe('#007acc');
        });
    });

    describe('Dracula — cores características', () => {
        const tema = getTheme('dracula');

        it('deve ter fundo #282a36', () => {
            expect(tema.tokens['--color-bg']).toBe('#282a36');
        });

        it('deve ter texto #f8f8f2', () => {
            expect(tema.tokens['--color-text']).toBe('#f8f8f2');
        });

        it('deve ter cor primária #bd93f9', () => {
            expect(tema.tokens['--color-primary']).toBe('#bd93f9');
        });
    });

    describe('One Dark Pro — cores características', () => {
        const tema = getTheme('one-dark-pro');

        it('deve ter fundo #282c34', () => {
            expect(tema.tokens['--color-bg']).toBe('#282c34');
        });

        it('deve ter texto #abb2bf', () => {
            expect(tema.tokens['--color-text']).toBe('#abb2bf');
        });

        it('deve ter cor primária #61afef', () => {
            expect(tema.tokens['--color-primary']).toBe('#61afef');
        });
    });

    describe('Monokai — cores características', () => {
        const tema = getTheme('monokai');

        it('deve ter fundo #272822', () => {
            expect(tema.tokens['--color-bg']).toBe('#272822');
        });

        it('deve ter texto #f8f8f2', () => {
            expect(tema.tokens['--color-text']).toBe('#f8f8f2');
        });

        it('deve ter cor primária #a6e22e', () => {
            expect(tema.tokens['--color-primary']).toBe('#a6e22e');
        });
    });

    describe('Solarized Dark — cores características', () => {
        const tema = getTheme('solarized-dark');

        it('deve ter fundo #002b36', () => {
            expect(tema.tokens['--color-bg']).toBe('#002b36');
        });

        it('deve ter texto #839496', () => {
            expect(tema.tokens['--color-text']).toBe('#839496');
        });

        it('deve ter cor primária #268bd2', () => {
            expect(tema.tokens['--color-primary']).toBe('#268bd2');
        });
    });

    describe('Dark Modern — cores características', () => {
        const tema = getTheme('dark-modern');

        it('deve ter fundo #1f1f1f', () => {
            expect(tema.tokens['--color-bg']).toBe('#1f1f1f');
        });

        it('deve ter texto #cccccc', () => {
            expect(tema.tokens['--color-text']).toBe('#cccccc');
        });

        it('deve ter cor primária #0078d4', () => {
            expect(tema.tokens['--color-primary']).toBe('#0078d4');
        });
    });

    describe('Light Modern — cores características', () => {
        const tema = getTheme('light-modern');

        it('deve ter fundo claro (#ffffff)', () => {
            expect(tema.tokens['--color-bg']).toBe('#ffffff');
        });

        it('deve ter texto escuro (#3b3b3b)', () => {
            expect(tema.tokens['--color-text']).toBe('#3b3b3b');
        });

        it('deve ter Activity Bar clara (#f8f8f8)', () => {
            expect(tema.tokens['--color-activitybar-bg']).toBe('#f8f8f8');
        });
    });

    describe('Dark High Contrast — cores características', () => {
        const tema = getTheme('dark-high-contrast');

        it('deve ter fundo preto (#000000)', () => {
            expect(tema.tokens['--color-bg']).toBe('#000000');
        });

        it('deve ter texto branco (#ffffff)', () => {
            expect(tema.tokens['--color-text']).toBe('#ffffff');
        });

        it('deve ter bordas com alto contraste (#6fc3df)', () => {
            expect(tema.tokens['--color-border']).toBe('#6fc3df');
        });
    });

    describe('Light High Contrast — cores características', () => {
        const tema = getTheme('light-high-contrast');

        it('deve ter fundo branco (#ffffff)', () => {
            expect(tema.tokens['--color-bg']).toBe('#ffffff');
        });

        it('deve ter texto preto (#000000)', () => {
            expect(tema.tokens['--color-text']).toBe('#000000');
        });

        it('deve ter bordas com alto contraste (#0f4a85)', () => {
            expect(tema.tokens['--color-border']).toBe('#0f4a85');
        });
    });

    // ─── Desserialização com JSON inválido ───────────────────────────────

    describe('desserialização com JSON inválido', () => {
        it('deve lançar erro descritivo para JSON malformado', () => {
            expect(() => deserializeTheme('{ invalido')).toThrow(
                'Erro ao desserializar tema: JSON inválido.',
            );
        });

        it('deve lançar erro descritivo para valor que não é objeto', () => {
            expect(() => deserializeTheme('"apenas uma string"')).toThrow(
                'Erro ao desserializar tema: o valor deve ser um objeto.',
            );
        });

        it('deve lançar erro descritivo para array', () => {
            expect(() => deserializeTheme('[]')).toThrow(
                'Erro ao desserializar tema: o valor deve ser um objeto.',
            );
        });
    });
});
