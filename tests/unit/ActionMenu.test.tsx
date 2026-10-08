/** @jest-environment jsdom */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ActionMenu } from '../../src/components/common/ActionMenu';

test('abre por botão, foca a primeira ação disponível e Escape devolve foco', () => {
    render(
        <ActionMenu label="Mais ações">
            <button disabled>Indisponível</button>
            <button>Gerenciar</button>
        </ActionMenu>,
    );
    const trigger = screen.getByRole('button', { name: 'Mais ações' });
    expect(screen.queryByRole('button', { name: 'Gerenciar' })).not.toBeInTheDocument();
    fireEvent.click(trigger);
    const action = screen.getByRole('button', { name: 'Gerenciar' });
    expect(action).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(action, { key: 'Escape' });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('ação fecha o popover e deixa foco na origem antes de abrir um diálogo', () => {
    const focusAtAction = jest.fn();
    render(
        <ActionMenu label="Mais ações">
            <button onClick={() => focusAtAction(document.activeElement)}>Remover</button>
        </ActionMenu>,
    );
    const trigger = screen.getByRole('button', { name: 'Mais ações' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(focusAtAction).toHaveBeenCalledWith(trigger);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
});

test('fecha ao clicar fora ou ao sair com teclado', () => {
    render(
        <>
            <ActionMenu label="Mais ações">
                <button>Ação</button>
            </ActionMenu>
            <button>Fora</button>
        </>,
    );
    const trigger = screen.getByRole('button', { name: 'Mais ações' });
    const outside = screen.getByRole('button', { name: 'Fora' });
    fireEvent.click(trigger);
    fireEvent.pointerDown(outside);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    act(() => outside.focus());
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
});
