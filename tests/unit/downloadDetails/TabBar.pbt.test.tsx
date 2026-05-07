/** @jest-environment jsdom */

/**
 * Testes de propriedade (PBT) para o componente TabBar do painel de detalhes.
 *
 * Propriedades testadas:
 *   - Property 1: Tab exclusivity (single active tab)
 *   - Property 12: Circular keyboard navigation
 *
 * Usa fast-check 3 com mínimo de 100 iterações por propriedade.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import { TabBar, TabDefinition } from '../../../src/components/DownloadDetails/TabBar';

// ═══════════════════════════════════════════════════════════════════════════════
// Property 1: Tab exclusivity (single active tab)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: download-details-panel, Property 1: Tab exclusivity', () => {
    /**
     * Property 1: Tab exclusivity (single active tab)
     *
     * Para qualquer sequência de seleções de aba no TabBar, exatamente uma aba
     * SHALL ter `aria-selected="true"` e todas as outras abas SHALL ter
     * `aria-selected="false"` em qualquer ponto no tempo.
     *
     * **Validates: Requirements 1.6, 6.2**
     */

    const defaultTabs: TabDefinition[] = [
        { id: 'general', label: 'Geral' },
        { id: 'peers', label: 'Peers' },
        { id: 'pieces', label: 'Peças' },
        { id: 'speed', label: 'Velocidade' },
    ];

    it('exatamente uma aba tem aria-selected="true" após qualquer sequência de seleções', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.integer({ min: 0, max: defaultTabs.length - 1 }),
                    { minLength: 1, maxLength: 20 },
                ),
                (selectionSequence) => {
                    // Simula o componente controlado: aplica cada seleção da sequência
                    let activeTab = defaultTabs[0].id;
                    const onTabChange = jest.fn((tabId: string) => {
                        activeTab = tabId;
                    });

                    const { rerender, unmount } = render(
                        <TabBar
                            tabs={defaultTabs}
                            activeTab={activeTab}
                            onTabChange={onTabChange}
                            panelIdPrefix="test"
                        />,
                    );

                    // Aplica cada seleção da sequência e verifica a propriedade
                    for (const selectedIndex of selectionSequence) {
                        activeTab = defaultTabs[selectedIndex].id;

                        rerender(
                            <TabBar
                                tabs={defaultTabs}
                                activeTab={activeTab}
                                onTabChange={onTabChange}
                                panelIdPrefix="test"
                            />,
                        );

                        const allTabs = screen.getAllByRole('tab');

                        // Exatamente uma aba com aria-selected="true"
                        const selectedTabs = allTabs.filter(
                            (tab) => tab.getAttribute('aria-selected') === 'true',
                        );
                        expect(selectedTabs).toHaveLength(1);

                        // Todas as outras com aria-selected="false"
                        const unselectedTabs = allTabs.filter(
                            (tab) => tab.getAttribute('aria-selected') === 'false',
                        );
                        expect(unselectedTabs).toHaveLength(defaultTabs.length - 1);
                    }

                    unmount();
                },
            ),
            { numRuns: 100 },
        );
    });

    it('exclusividade se mantém para qualquer número de abas e qualquer aba ativa', () => {
        fc.assert(
            fc.property(
                // Gera um número variável de abas (2 a 8)
                fc.integer({ min: 2, max: 8 }).chain((numTabs) => {
                    const tabs: TabDefinition[] = Array.from({ length: numTabs }, (_, i) => ({
                        id: `tab-${i}`,
                        label: `Tab ${i}`,
                    }));
                    // Gera uma sequência de seleções para essas abas
                    return fc
                        .array(fc.integer({ min: 0, max: numTabs - 1 }), {
                            minLength: 1,
                            maxLength: 15,
                        })
                        .map((selections) => ({ tabs, selections }));
                }),
                ({ tabs, selections }) => {
                    let activeTab = tabs[0].id;
                    const onTabChange = jest.fn((tabId: string) => {
                        activeTab = tabId;
                    });

                    const { rerender, unmount } = render(
                        <TabBar
                            tabs={tabs}
                            activeTab={activeTab}
                            onTabChange={onTabChange}
                            panelIdPrefix="dynamic"
                        />,
                    );

                    // Aplica cada seleção e verifica a propriedade
                    for (const selectedIndex of selections) {
                        activeTab = tabs[selectedIndex].id;

                        rerender(
                            <TabBar
                                tabs={tabs}
                                activeTab={activeTab}
                                onTabChange={onTabChange}
                                panelIdPrefix="dynamic"
                            />,
                        );

                        const allTabs = screen.getAllByRole('tab');

                        // Verifica que o número total de abas renderizadas é correto
                        expect(allTabs).toHaveLength(tabs.length);

                        // Exatamente uma aba com aria-selected="true"
                        const selectedTabElements = allTabs.filter(
                            (tab) => tab.getAttribute('aria-selected') === 'true',
                        );
                        expect(selectedTabElements).toHaveLength(1);

                        // Todas as outras com aria-selected="false"
                        const unselectedTabs = allTabs.filter(
                            (tab) => tab.getAttribute('aria-selected') === 'false',
                        );
                        expect(unselectedTabs).toHaveLength(tabs.length - 1);

                        // Cada aba tem exatamente um dos dois valores de aria-selected
                        allTabs.forEach((tab) => {
                            const ariaSelected = tab.getAttribute('aria-selected');
                            expect(['true', 'false']).toContain(ariaSelected);
                        });
                    }

                    unmount();
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 12: Circular keyboard navigation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: download-details-panel, Property 12: Circular navigation', () => {
    const tabs = [
        { id: 'general', label: 'Geral' },
        { id: 'peers', label: 'Peers' },
        { id: 'pieces', label: 'Peças' },
        { id: 'speed', label: 'Velocidade' },
    ];
    const n = tabs.length;

    /**
     * Property 12: Circular keyboard navigation
     *
     * Para qualquer índice de aba inicial `s` (0-based) em uma TabBar com `n` abas,
     * pressionar ArrowRight `k` vezes SHALL mover o foco para o índice `(s + k) % n`,
     * e pressionar ArrowLeft `k` vezes SHALL mover o foco para o índice `(s - k + n*k) % n`.
     *
     * **Validates: Requirements 6.3**
     */
    it('ArrowRight k vezes a partir do índice s resulta no índice (s + k) % n', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: n - 1 }),
                fc.integer({ min: 1, max: 20 }),
                (startIndex, k) => {
                    let activeTab = tabs[startIndex].id;
                    const onTabChange = jest.fn((tabId: string) => {
                        activeTab = tabId;
                    });

                    const { rerender, container } = render(
                        <TabBar
                            tabs={tabs}
                            activeTab={activeTab}
                            onTabChange={onTabChange}
                            panelIdPrefix="test"
                        />,
                    );

                    const tablist = container.querySelector('[role="tablist"]')!;

                    // Pressionar ArrowRight k vezes
                    for (let i = 0; i < k; i++) {
                        fireEvent.keyDown(tablist, { key: 'ArrowRight' });

                        // Re-render com o novo activeTab para simular componente controlado
                        rerender(
                            <TabBar
                                tabs={tabs}
                                activeTab={activeTab}
                                onTabChange={onTabChange}
                                panelIdPrefix="test"
                            />,
                        );
                    }

                    const expectedIndex = (startIndex + k) % n;
                    expect(activeTab).toBe(tabs[expectedIndex].id);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('ArrowLeft k vezes a partir do índice s resulta no índice (s - k + n*k) % n', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: n - 1 }),
                fc.integer({ min: 1, max: 20 }),
                (startIndex, k) => {
                    let activeTab = tabs[startIndex].id;
                    const onTabChange = jest.fn((tabId: string) => {
                        activeTab = tabId;
                    });

                    const { rerender, container } = render(
                        <TabBar
                            tabs={tabs}
                            activeTab={activeTab}
                            onTabChange={onTabChange}
                            panelIdPrefix="test"
                        />,
                    );

                    const tablist = container.querySelector('[role="tablist"]')!;

                    // Pressionar ArrowLeft k vezes
                    for (let i = 0; i < k; i++) {
                        fireEvent.keyDown(tablist, { key: 'ArrowLeft' });

                        // Re-render com o novo activeTab para simular componente controlado
                        rerender(
                            <TabBar
                                tabs={tabs}
                                activeTab={activeTab}
                                onTabChange={onTabChange}
                                panelIdPrefix="test"
                            />,
                        );
                    }

                    const expectedIndex = (startIndex - k + n * k) % n;
                    expect(activeTab).toBe(tabs[expectedIndex].id);
                },
            ),
            { numRuns: 100 },
        );
    });
});
