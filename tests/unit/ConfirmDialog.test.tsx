/**
 * @jest-environment jsdom
 *
 * Testes de acessibilidade e comportamento do componente ConfirmDialog.
 * Requisito 8.5:
 *  - role="dialog", aria-modal="true", aria-labelledby apontando para o título
 *  - Foco movido para o primeiro elemento focalizável ao abrir
 *  - Escape fecha o diálogo
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import '@testing-library/jest-dom';
import { ConfirmDialog } from '../../src/components/common/ConfirmDialog';
import ptBR from '../../src/locales/pt-BR.json';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderWithIntl(ui: React.ReactElement) {
    return render(
        <IntlProvider locale="pt-BR" defaultLocale="pt-BR" messages={ptBR}>
            {ui}
        </IntlProvider>,
    );
}

const defaultProps = {
    isOpen: true,
    title: 'Confirmar remoção',
    message: 'Deseja remover este download?',
    onConfirmKeepFiles: jest.fn(),
    onConfirmDeleteFiles: jest.fn(),
    onCancel: jest.fn(),
};

beforeEach(() => {
    jest.clearAllMocks();
    // Limpa animationFrame enfileirado entre testes
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

// ─── ARIA attributes ──────────────────────────────────────────────────────────
// Requisito 8.5

describe('ConfirmDialog — atributos ARIA', () => {
    it('possui role="dialog"', () => {
        renderWithIntl(<ConfirmDialog {...defaultProps} />);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('possui aria-modal="true"', () => {
        renderWithIntl(<ConfirmDialog {...defaultProps} />);
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('possui aria-labelledby apontando para o título', () => {
        renderWithIntl(<ConfirmDialog {...defaultProps} />);
        const dialog = screen.getByRole('dialog');
        const labelledById = dialog.getAttribute('aria-labelledby');
        expect(labelledById).toBeTruthy();

        const heading = document.getElementById(labelledById!);
        expect(heading).toBeInTheDocument();
        expect(heading?.textContent).toBe('Confirmar remoção');
    });

    it('não renderiza quando isOpen=false', () => {
        renderWithIntl(<ConfirmDialog {...defaultProps} isOpen={false} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});

// ─── Focus management ─────────────────────────────────────────────────────────
// Requisito 8.5 — foco movido para o primeiro elemento focalizável ao abrir

describe('ConfirmDialog — gestão de foco', () => {
    it('move o foco para o primeiro botão ao abrir', async () => {
        renderWithIntl(<ConfirmDialog {...defaultProps} />);

        // Dispara os requestAnimationFrame pendentes
        await act(async () => {
            jest.runAllTimers();
        });

        const cancelButton = screen.getByText('Cancelar');
        expect(document.activeElement).toBe(cancelButton);
    });

    it('não move foco quando isOpen muda para false', async () => {
        const { rerender } = renderWithIntl(<ConfirmDialog {...defaultProps} isOpen={false} />);

        await act(async () => {
            jest.runAllTimers();
        });

        // Nenhum elemento do diálogo deve estar focado (diálogo não está aberto)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(document.activeElement).toBe(document.body);

        // Reabre — o foco deve ser movido
        rerender(
            <IntlProvider locale="pt-BR" defaultLocale="pt-BR" messages={ptBR}>
                <ConfirmDialog {...defaultProps} isOpen={true} />
            </IntlProvider>,
        );

        await act(async () => {
            jest.runAllTimers();
        });

        expect(document.activeElement).not.toBe(document.body);
    });
});

// ─── Keyboard interaction ─────────────────────────────────────────────────────
// Requisito 8.5 — Escape fecha o diálogo

describe('ConfirmDialog — interação por teclado', () => {
    it('chama onCancel ao pressionar Escape', () => {
        renderWithIntl(<ConfirmDialog {...defaultProps} />);
        const dialog = screen.getByRole('dialog');

        fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

        expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('não chama onCancel ao pressionar outras teclas', () => {
        renderWithIntl(<ConfirmDialog {...defaultProps} />);
        const dialog = screen.getByRole('dialog');

        fireEvent.keyDown(dialog, { key: 'Enter', code: 'Enter' });
        fireEvent.keyDown(dialog, { key: 'Tab', code: 'Tab' });
        fireEvent.keyDown(dialog, { key: ' ', code: 'Space' });

        expect(defaultProps.onCancel).not.toHaveBeenCalled();
    });
});

// ─── Button actions ───────────────────────────────────────────────────────────

describe('ConfirmDialog — ações dos botões', () => {
    it('chama onCancel ao clicar em "Cancelar"', () => {
        renderWithIntl(<ConfirmDialog {...defaultProps} />);
        fireEvent.click(screen.getByText('Cancelar'));
        expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('chama onConfirmKeepFiles ao clicar em "Manter arquivos"', () => {
        renderWithIntl(<ConfirmDialog {...defaultProps} />);
        fireEvent.click(screen.getByText('Manter arquivos'));
        expect(defaultProps.onConfirmKeepFiles).toHaveBeenCalledTimes(1);
    });

    it('chama onConfirmDeleteFiles ao clicar em "Excluir arquivos"', () => {
        renderWithIntl(<ConfirmDialog {...defaultProps} />);
        fireEvent.click(screen.getByText('Excluir arquivos'));
        expect(defaultProps.onConfirmDeleteFiles).toHaveBeenCalledTimes(1);
    });

    it('chama onCancel ao clicar no overlay (fora do painel)', () => {
        const { container } = renderWithIntl(<ConfirmDialog {...defaultProps} />);
        // O overlay é o primeiro filho do container
        const overlay = container.firstChild as HTMLElement;
        fireEvent.click(overlay);
        expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('não chama onCancel ao clicar dentro do painel', () => {
        renderWithIntl(<ConfirmDialog {...defaultProps} />);
        const dialog = screen.getByRole('dialog');
        fireEvent.click(dialog);
        expect(defaultProps.onCancel).not.toHaveBeenCalled();
    });
});
