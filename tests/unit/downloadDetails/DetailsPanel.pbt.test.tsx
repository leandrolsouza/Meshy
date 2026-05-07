/** @jest-environment jsdom */

/**
 * Testes de propriedade (PBT) para o componente DetailsPanel do painel de detalhes.
 *
 * Propriedades testadas:
 *   - Property 2: Panel disabled for non-ready statuses
 *
 * Usa fast-check 3 com mínimo de 100 iterações por propriedade.
 */

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import { DetailsPanel, isExpandable } from '../../../src/components/DownloadDetails/DetailsPanel';
import { TorrentStatus } from '../../../shared/types';

// ═══════════════════════════════════════════════════════════════════════════════
// Property 2: Panel disabled for non-ready statuses
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: download-details-panel, Property 2: Panel disabled for non-ready statuses', () => {
    /**
     * Property 2: Panel disabled for non-ready statuses
     *
     * Para qualquer torrent com status em { "resolving-metadata", "queued" },
     * o botão de expansão SHALL estar desabilitado (não-interativo) e clicar nele
     * SHALL não alterar o estado colapsado do painel.
     *
     * **Validates: Requirements 1.7**
     */

    // Gerador de status não-expansíveis
    const nonExpandableStatusArb: fc.Arbitrary<TorrentStatus> = fc.constantFrom(
        'resolving-metadata' as TorrentStatus,
        'queued' as TorrentStatus,
    );

    // Gerador de infoHash válido (40 hex chars)
    const infoHashArb: fc.Arbitrary<string> = fc
        .array(fc.integer({ min: 0, max: 15 }), { minLength: 40, maxLength: 40 })
        .map((nums) => nums.map((n) => n.toString(16)).join(''));

    it('isExpandable retorna false para qualquer status não-expansível', () => {
        fc.assert(
            fc.property(nonExpandableStatusArb, (status) => {
                expect(isExpandable(status)).toBe(false);
            }),
            { numRuns: 100 },
        );
    });

    it('onToggle é chamado (auto-colapso) quando painel está expandido com status não-expansível', () => {
        fc.assert(
            fc.property(nonExpandableStatusArb, infoHashArb, (status, infoHash) => {
                const onToggle = jest.fn();

                const { unmount } = render(
                    <DetailsPanel
                        infoHash={infoHash}
                        status={status}
                        isExpanded={true}
                        onToggle={onToggle}
                    />,
                );

                // O useEffect de auto-colapso deve ter chamado onToggle
                expect(onToggle).toHaveBeenCalled();

                unmount();
            }),
            { numRuns: 100 },
        );
    });

    it('painel permanece colapsado e onToggle não é chamado quando já colapsado com status não-expansível', () => {
        fc.assert(
            fc.property(nonExpandableStatusArb, infoHashArb, (status, infoHash) => {
                const onToggle = jest.fn();

                const { container, unmount } = render(
                    <DetailsPanel
                        infoHash={infoHash}
                        status={status}
                        isExpanded={false}
                        onToggle={onToggle}
                    />,
                );

                // O painel deve estar colapsado
                const panel = container.querySelector('[data-testid="details-panel"]');
                expect(panel).toHaveClass('panelCollapsed');
                expect(panel).not.toHaveClass('panelExpanded');

                // onToggle não deve ser chamado (painel já está colapsado)
                expect(onToggle).not.toHaveBeenCalled();

                unmount();
            }),
            { numRuns: 100 },
        );
    });
});
