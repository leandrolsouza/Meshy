/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import '@testing-library/jest-dom';
import { LanguageSelector } from '../../src/components/Settings/LanguageSelector';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../../src/locales';
import { useLocaleStore } from '../../src/i18n/useLocale';
import ptBR from '../../src/locales/pt-BR.json';

// ─── Helper ───────────────────────────────────────────────────────────────────

function renderWithIntl(ui: React.ReactElement) {
    return render(
        <IntlProvider locale="pt-BR" defaultLocale="pt-BR" messages={ptBR}>
            {ui}
        </IntlProvider>,
    );
}

// ─── Testes Unitários ─────────────────────────────────────────────────────────
// Requisitos: 5.2, 5.3

describe('LanguageSelector — testes unitários', () => {
    beforeEach(() => {
        // Reseta o store para o locale padrão antes de cada teste
        useLocaleStore.setState({ locale: DEFAULT_LOCALE });
    });

    // ── Req 5.2: lista todos os locales suportados com nomes nativos ────

    it('renderiza todos os locales suportados como opções com nomes nativos (Req 5.2)', () => {
        renderWithIntl(<LanguageSelector onLocaleChange={jest.fn()} />);

        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(SUPPORTED_LOCALES.length);

        SUPPORTED_LOCALES.forEach((entry) => {
            const option = screen.getByText(entry.nativeName);
            expect(option).toBeInTheDocument();
            expect(option).toHaveAttribute('value', entry.code);
        });
    });

    // ── Req 5.2: select com aria-label="Language" ───────────────────────

    it('renderiza um select com aria-label="Language" (Req 5.2)', () => {
        renderWithIntl(<LanguageSelector onLocaleChange={jest.fn()} />);

        const select = screen.getByLabelText('Language');
        expect(select).toBeInTheDocument();
        expect(select.tagName).toBe('SELECT');
    });

    // ── Req 5.3: locale atual selecionado por padrão ────────────────────

    it('mostra o locale atual selecionado por padrão (Req 5.3)', () => {
        renderWithIntl(<LanguageSelector onLocaleChange={jest.fn()} />);

        const select = screen.getByLabelText('Language') as HTMLSelectElement;
        expect(select.value).toBe(DEFAULT_LOCALE);

        const defaultEntry = SUPPORTED_LOCALES.find((l) => l.code === DEFAULT_LOCALE)!;
        const selectedOption = select.options[select.selectedIndex];
        expect(selectedOption.textContent).toBe(defaultEntry.nativeName);
    });

    // ── Req 5.3: selecionar locale diferente chama onLocaleChange ───────

    it('chama onLocaleChange com o código do locale ao selecionar um locale diferente (Req 5.3)', () => {
        const onLocaleChange = jest.fn();
        renderWithIntl(<LanguageSelector onLocaleChange={onLocaleChange} />);

        const select = screen.getByLabelText('Language');
        fireEvent.change(select, { target: { value: 'en-US' } });

        expect(onLocaleChange).toHaveBeenCalledTimes(1);
        expect(onLocaleChange).toHaveBeenCalledWith('en-US');
    });

    // ── Req 5.3: selecionar locale atualiza o store ─────────────────────

    it('atualiza o locale no store ao selecionar um novo locale (Req 5.3)', () => {
        renderWithIntl(<LanguageSelector onLocaleChange={jest.fn()} />);

        const select = screen.getByLabelText('Language');
        fireEvent.change(select, { target: { value: 'en-US' } });

        expect(useLocaleStore.getState().locale).toBe('en-US');
    });
});
