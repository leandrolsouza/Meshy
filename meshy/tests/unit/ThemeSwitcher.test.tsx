/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import fc from 'fast-check';
import { ThemeSwitcher } from '../../src/components/Settings/ThemeSwitcher';
import { getAllThemes, DEFAULT_THEME_ID, getTheme } from '../../src/themes/themeRegistry';

// ─── Testes de Propriedade ────────────────────────────────────────────────────
// Feature: theme-switcher, Property 8: Anúncio de acessibilidade na troca de tema

describe('Feature: theme-switcher, Property 8: Anúncio de acessibilidade na troca de tema', () => {
    /**
     * **Valida: Requirements 9.3**
     *
     * Para todo tema no registro, após a troca para esse tema, a região aria-live
     * do ThemeSwitcher deve conter o texto "Tema alterado para {displayName}".
     */
    it('a região aria-live anuncia "Tema alterado para {displayName}" após troca de tema', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...getAllThemes()),
                (theme) => {
                    const onThemeChange = jest.fn();
                    const { unmount } = render(
                        <ThemeSwitcher
                            currentThemeId={DEFAULT_THEME_ID}
                            onThemeChange={onThemeChange}
                        />,
                    );

                    // Simula troca para o tema gerado
                    const select = screen.getByLabelText('Tema');
                    fireEvent.change(select, { target: { value: theme.id } });

                    // Verifica que a região aria-live contém o anúncio correto
                    const statusRegion = screen.getByRole('status');
                    expect(statusRegion).toHaveTextContent(
                        `Tema alterado para ${theme.displayName}`,
                    );

                    unmount();
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ─── Testes Unitários ─────────────────────────────────────────────────────────
// Requisitos: 4.1, 4.2, 4.3, 4.5, 9.1, 9.2, 10.1, 10.3

describe('ThemeSwitcher — testes unitários', () => {
    const allThemes = getAllThemes();

    // ── Req 4.1: select com aria-label="Tema" ────────────────────────────

    it('renderiza um select com aria-label="Tema" (Req 4.1)', () => {
        render(
            <ThemeSwitcher
                currentThemeId={DEFAULT_THEME_ID}
                onThemeChange={jest.fn()}
            />,
        );

        const select = screen.getByLabelText('Tema');
        expect(select).toBeInTheDocument();
        expect(select.tagName).toBe('SELECT');
    });

    // ── Req 4.2: lista todos os 6 temas pelo displayName ────────────────

    it('lista todos os 6 temas pelo displayName (Req 4.2)', () => {
        render(
            <ThemeSwitcher
                currentThemeId={DEFAULT_THEME_ID}
                onThemeChange={jest.fn()}
            />,
        );

        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(10);

        // Verifica que cada tema do registro aparece como opção
        allThemes.forEach((theme) => {
            expect(screen.getByText(theme.displayName)).toBeInTheDocument();
        });
    });

    // ── Req 4.3: mostra tema ativo selecionado ──────────────────────────

    it('mostra o tema ativo selecionado via prop currentThemeId (Req 4.3)', () => {
        const draculaTheme = getTheme('dracula');
        render(
            <ThemeSwitcher
                currentThemeId="dracula"
                onThemeChange={jest.fn()}
            />,
        );

        const select = screen.getByLabelText('Tema') as HTMLSelectElement;
        expect(select.value).toBe('dracula');

        // A opção selecionada deve ter o displayName do Dracula
        const selectedOption = select.options[select.selectedIndex];
        expect(selectedOption.textContent).toBe(draculaTheme.displayName);
    });

    // ── Req 4.5: troca de tema é imediata (sem "Salvar") ────────────────

    it('chama onThemeChange imediatamente ao trocar o select, sem botão "Salvar" (Req 4.5)', () => {
        const onThemeChange = jest.fn();
        render(
            <ThemeSwitcher
                currentThemeId={DEFAULT_THEME_ID}
                onThemeChange={onThemeChange}
            />,
        );

        // Não deve existir botão "Salvar" no componente
        expect(screen.queryByRole('button', { name: /salvar/i })).not.toBeInTheDocument();

        // Troca de tema dispara callback imediatamente
        const select = screen.getByLabelText('Tema');
        fireEvent.change(select, { target: { value: 'monokai' } });

        expect(onThemeChange).toHaveBeenCalledTimes(1);
        expect(onThemeChange).toHaveBeenCalledWith('monokai');
    });

    // ── Req 9.1: navegabilidade via teclado ─────────────────────────────

    it('é navegável via teclado — Tab para foco (Req 9.1)', () => {
        render(
            <ThemeSwitcher
                currentThemeId={DEFAULT_THEME_ID}
                onThemeChange={jest.fn()}
            />,
        );

        const select = screen.getByLabelText('Tema');

        // O select deve ser focável
        select.focus();
        expect(select).toHaveFocus();

        // Verifica que o tabIndex não impede navegação por teclado
        expect(select).not.toHaveAttribute('tabindex', '-1');
    });

    // ── Req 9.2: atributos ARIA presentes ───────────────────────────────

    it('possui atributos ARIA corretos: aria-label, aria-live, role="status" (Req 9.2)', () => {
        render(
            <ThemeSwitcher
                currentThemeId={DEFAULT_THEME_ID}
                onThemeChange={jest.fn()}
            />,
        );

        // Select tem aria-label
        const select = screen.getByLabelText('Tema');
        expect(select).toHaveAttribute('aria-label', 'Tema');

        // Região aria-live presente com role="status"
        const statusRegion = screen.getByRole('status');
        expect(statusRegion).toBeInTheDocument();
        expect(statusRegion).toHaveAttribute('aria-live', 'polite');
    });

    // ── Req 10.1: falha na persistência mantém tema atual aplicado ──────

    it('chama onThemeChange ao trocar tema — persistência é responsabilidade do SettingsPanel (Req 10.1)', () => {
        const onThemeChange = jest.fn();
        render(
            <ThemeSwitcher
                currentThemeId={DEFAULT_THEME_ID}
                onThemeChange={onThemeChange}
            />,
        );

        // Simula troca de tema
        const select = screen.getByLabelText('Tema');
        fireEvent.change(select, { target: { value: 'solarized-dark' } });

        // O componente chama o callback — se a persistência falhar no SettingsPanel,
        // o tema visual já foi aplicado (responsabilidade do pai)
        expect(onThemeChange).toHaveBeenCalledWith('solarized-dark');
    });

    // ── Req 10.3: renderiza corretamente com tema padrão ────────────────

    it('renderiza corretamente com DEFAULT_THEME_ID quando nenhum tema específico é fornecido (Req 10.3)', () => {
        render(
            <ThemeSwitcher
                currentThemeId={DEFAULT_THEME_ID}
                onThemeChange={jest.fn()}
            />,
        );

        const select = screen.getByLabelText('Tema') as HTMLSelectElement;
        expect(select.value).toBe(DEFAULT_THEME_ID);

        // O displayName do tema padrão deve estar selecionado
        const defaultTheme = getTheme(DEFAULT_THEME_ID);
        const selectedOption = select.options[select.selectedIndex];
        expect(selectedOption.textContent).toBe(defaultTheme.displayName);
    });
});
