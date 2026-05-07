/** @jest-environment jsdom */

/**
 * Testes de propriedade (PBT) para o componente GeneralTab do painel de detalhes.
 *
 * Propriedades testadas:
 *   - Property 3: Null metadata fields display fallback text
 *
 * Usa fast-check 3 com mínimo de 100 iterações por propriedade.
 */

import React from 'react';
import { render, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import { GeneralTab } from '../../../src/components/DownloadDetails/GeneralTab';
import { TorrentMetadata } from '../../../shared/types';
import { formatCreationDate } from '../../../src/utils/detailsFormatters';

// ═══════════════════════════════════════════════════════════════════════════════
// Property 3: Null metadata fields display fallback text
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: download-details-panel, Property 3: Null metadata fallback', () => {
    /**
     * Property 3: Null metadata fields display fallback text
     *
     * Para qualquer objeto TorrentMetadata onde um ou mais campos são null,
     * o GeneralTab renderizado SHALL exibir o texto de fallback correspondente:
     * "Desconhecido" para creator null, "Sem comentário" para comment null,
     * e "Desconhecida" para creationDate null.
     *
     * **Validates: Requirements 2.3, 2.4, 2.5**
     */

    // Timeout aumentado para acomodar 100 iterações assíncronas com renderização React
    jest.setTimeout(120_000);

    // Gerador de infoHash válido (40 hex chars)
    const infoHashArb: fc.Arbitrary<string> = fc
        .array(fc.integer({ min: 0, max: 15 }), { minLength: 40, maxLength: 40 })
        .map((nums) => nums.map((n) => n.toString(16)).join(''));

    // Gerador de creator: string alfanumérica não-vazia ou null
    const creatorArb: fc.Arbitrary<string | null> = fc.oneof(
        fc.constant(null),
        fc.stringMatching(/^[a-zA-Z0-9 ]{1,30}$/).filter((s) => s.trim().length > 0),
    );

    // Gerador de comment: string alfanumérica não-vazia ou null
    const commentArb: fc.Arbitrary<string | null> = fc.oneof(
        fc.constant(null),
        fc.stringMatching(/^[a-zA-Z0-9 ]{1,50}$/).filter((s) => s.trim().length > 0),
    );

    // Gerador de creationDate: timestamp positivo ou null
    const creationDateArb: fc.Arbitrary<number | null> = fc.oneof(
        fc.constant(null),
        fc.integer({ min: 86_400_000, max: 4_102_444_800_000 }), // 1 dia até ~2100
    );

    // Gerador de TorrentMetadata com combinações de campos null/não-null
    const metadataArb: fc.Arbitrary<Omit<TorrentMetadata, 'infoHash'>> = fc.record({
        creator: creatorArb,
        comment: commentArb,
        creationDate: creationDateArb,
    });

    beforeEach(() => {
        // Mock window.meshy.getMetadata
        (window as any).meshy = {
            getMetadata: jest.fn(),
        };
    });

    afterEach(() => {
        cleanup();
        jest.restoreAllMocks();
        delete (window as any).meshy;
    });

    it('campos null exibem texto de fallback correto e campos não-null exibem seus valores', async () => {
        await fc.assert(
            fc.asyncProperty(infoHashArb, metadataArb, async (infoHash, partialMetadata) => {
                cleanup();

                const metadata: TorrentMetadata = {
                    infoHash,
                    ...partialMetadata,
                };

                // Mock IPC para retornar os metadados gerados
                (window.meshy.getMetadata as jest.Mock).mockResolvedValue({
                    success: true,
                    data: metadata,
                });

                const { getByTestId } = render(
                    <GeneralTab infoHash={infoHash} status="downloading" />,
                );

                // Aguardar resposta assíncrona do IPC
                await waitFor(() => {
                    expect(getByTestId('creator-value')).toBeInTheDocument();
                });

                // Verificar campo creator
                const creatorEl = getByTestId('creator-value');
                if (metadata.creator === null) {
                    expect(creatorEl.textContent).toBe('Desconhecido');
                } else {
                    expect(creatorEl.textContent).toBe(metadata.creator);
                }

                // Verificar campo comment
                const commentEl = getByTestId('comment-value');
                if (metadata.comment === null) {
                    expect(commentEl.textContent).toBe('Sem comentário');
                } else {
                    expect(commentEl.textContent).toBe(metadata.comment);
                }

                // Verificar campo creationDate
                const dateEl = getByTestId('creation-date-value');
                if (metadata.creationDate === null) {
                    expect(dateEl.textContent).toBe('Desconhecida');
                } else {
                    expect(dateEl.textContent).toBe(
                        formatCreationDate(metadata.creationDate),
                    );
                }
            }),
            { numRuns: 100 },
        );
    });

    it('todos os campos null simultaneamente exibem todos os fallbacks', async () => {
        await fc.assert(
            fc.asyncProperty(infoHashArb, async (infoHash) => {
                cleanup();

                const metadata: TorrentMetadata = {
                    infoHash,
                    creator: null,
                    comment: null,
                    creationDate: null,
                };

                (window.meshy.getMetadata as jest.Mock).mockResolvedValue({
                    success: true,
                    data: metadata,
                });

                const { getByTestId } = render(
                    <GeneralTab infoHash={infoHash} status="downloading" />,
                );

                await waitFor(() => {
                    expect(getByTestId('creator-value')).toBeInTheDocument();
                });

                expect(getByTestId('creator-value').textContent).toBe('Desconhecido');
                expect(getByTestId('comment-value').textContent).toBe('Sem comentário');
                expect(getByTestId('creation-date-value').textContent).toBe('Desconhecida');
            }),
            { numRuns: 100 },
        );
    });

    it('todos os campos não-null exibem seus valores reais', async () => {
        await fc.assert(
            fc.asyncProperty(
                infoHashArb,
                fc.stringMatching(/^[a-zA-Z0-9 ]{1,30}$/).filter((s) => s.trim().length > 0),
                fc.stringMatching(/^[a-zA-Z0-9 ]{1,50}$/).filter((s) => s.trim().length > 0),
                fc.integer({ min: 86_400_000, max: 4_102_444_800_000 }),
                async (infoHash, creator, comment, creationDate) => {
                    cleanup();

                    const metadata: TorrentMetadata = {
                        infoHash,
                        creator,
                        comment,
                        creationDate,
                    };

                    (window.meshy.getMetadata as jest.Mock).mockResolvedValue({
                        success: true,
                        data: metadata,
                    });

                    const { getByTestId } = render(
                        <GeneralTab infoHash={infoHash} status="downloading" />,
                    );

                    await waitFor(() => {
                        expect(getByTestId('creator-value')).toBeInTheDocument();
                    });

                    expect(getByTestId('creator-value').textContent).toBe(creator);
                    expect(getByTestId('comment-value').textContent).toBe(comment);
                    expect(getByTestId('creation-date-value').textContent).toBe(
                        formatCreationDate(creationDate),
                    );
                },
            ),
            { numRuns: 100 },
        );
    });
});
