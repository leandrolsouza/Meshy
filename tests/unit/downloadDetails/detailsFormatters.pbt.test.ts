/**
 * Testes de propriedade (PBT) para formatadores do painel de detalhes.
 *
 * Propriedades testadas:
 *   - Property 4: Date formatting matches pt-BR locale pattern
 *   - Property 5: Peer speed formatting uses correct unit tiers
 *   - Property 6: Peer progress formatting produces integer percentage
 *   - Property 7: Piece summary counts match boolean array
 *   - Property 8: Piece grouping algorithm respects block limit and coverage
 *   - Property 10: Y-axis auto-scale uses correct unit tier with minimum
 *
 * Usa fast-check 3 com mínimo de 100 iterações por propriedade.
 */

import * as fc from 'fast-check';
import {
    formatPeerSpeed,
    formatPeerProgress,
    formatCreationDate,
    computePieceSummary,
    computeYAxisScale,
    groupPieces,
} from '../../../src/utils/detailsFormatters';
import { SpeedSample } from '../../../src/hooks/useSpeedHistory';

// ═══════════════════════════════════════════════════════════════════════════════
// Property 4: Date formatting matches pt-BR locale pattern
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: download-details-panel, Property 4: Date formatting', () => {
    /**
     * Property 4: Date formatting matches pt-BR locale pattern
     *
     * Para qualquer timestamp positivo (inteiro representando milissegundos desde epoch),
     * formatCreationDate SHALL produzir uma string no padrão dd/MM/yyyy HH:mm onde
     * dd é 01-31, MM é 01-12, yyyy é um ano de 4 dígitos, HH é 00-23, e mm é 00-59.
     *
     * **Validates: Requirements 2.6**
     */
    it('sempre produz string no formato dd/MM/yyyy HH:mm com intervalos válidos', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 4_102_444_800_000 }), // 0 até ~2100-01-01
                (timestamp) => {
                    const result = formatCreationDate(timestamp);

                    // Verifica formato geral com regex
                    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);

                    // Extrai componentes
                    const [datePart, timePart] = result.split(' ');
                    const [dd, MM, yyyy] = datePart.split('/').map(Number);
                    const [HH, mm] = timePart.split(':').map(Number);

                    // dd: 01-31
                    expect(dd).toBeGreaterThanOrEqual(1);
                    expect(dd).toBeLessThanOrEqual(31);

                    // MM: 01-12
                    expect(MM).toBeGreaterThanOrEqual(1);
                    expect(MM).toBeLessThanOrEqual(12);

                    // yyyy: 4-digit year
                    expect(yyyy).toBeGreaterThanOrEqual(1969);
                    expect(yyyy).toBeLessThanOrEqual(2100);

                    // HH: 00-23
                    expect(HH).toBeGreaterThanOrEqual(0);
                    expect(HH).toBeLessThanOrEqual(23);

                    // mm: 00-59
                    expect(mm).toBeGreaterThanOrEqual(0);
                    expect(mm).toBeLessThanOrEqual(59);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 5: Peer speed formatting uses correct unit tiers
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: download-details-panel, Property 5: Peer speed formatting', () => {
    /**
     * Property 5: Peer speed formatting uses correct unit tiers
     *
     * Para qualquer número não-negativo representando bytes por segundo,
     * formatPeerSpeed SHALL retornar:
     * - "{n} B/s" quando valor < 1024
     * - "{n.d} KB/s" (1 casa decimal) quando 1024 <= valor < 1048576
     * - "{n.d} MB/s" (1 casa decimal) quando valor >= 1048576
     *
     * **Validates: Requirements 3.6**
     */
    it('valores < 1024 terminam com " B/s"', () => {
        fc.assert(
            fc.property(fc.integer({ min: 0, max: 1023 }), (value) => {
                const result = formatPeerSpeed(value);
                expect(result).toMatch(/ B\/s$/);
                expect(result).toBe(`${value} B/s`);
            }),
            { numRuns: 100 },
        );
    });

    it('valores >= 1024 e < 1048576 terminam com " KB/s"', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1024, max: 1_048_575 }), (value) => {
                const result = formatPeerSpeed(value);
                expect(result).toMatch(/ KB\/s$/);
                expect(result).toMatch(/^\d+\.\d KB\/s$/);
            }),
            { numRuns: 100 },
        );
    });

    it('valores >= 1048576 terminam com " MB/s"', () => {
        fc.assert(
            fc.property(fc.integer({ min: 1_048_576, max: 1_073_741_824 }), (value) => {
                const result = formatPeerSpeed(value);
                expect(result).toMatch(/ MB\/s$/);
                expect(result).toMatch(/^\d+\.\d MB\/s$/);
            }),
            { numRuns: 100 },
        );
    });

    it('a unidade correta é usada para qualquer valor não-negativo', () => {
        fc.assert(
            fc.property(fc.nat(), (value) => {
                const result = formatPeerSpeed(value);

                if (value < 1024) {
                    expect(result).toMatch(/ B\/s$/);
                } else if (value < 1_048_576) {
                    expect(result).toMatch(/ KB\/s$/);
                } else {
                    expect(result).toMatch(/ MB\/s$/);
                }
            }),
            { numRuns: 100 },
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 6: Peer progress formatting produces integer percentage
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: download-details-panel, Property 6: Peer progress formatting', () => {
    /**
     * Property 6: Peer progress formatting produces integer percentage
     *
     * Para qualquer número no intervalo [0.0, 1.0], formatPeerProgress SHALL produzir
     * uma string no formato "{n}%" onde n é um inteiro entre 0 e 100 inclusive
     * (i.e., Math.round(value * 100)).
     *
     * **Validates: Requirements 3.7**
     */
    it('deve produzir porcentagem inteira entre 0% e 100% para qualquer progresso em [0.0, 1.0]', () => {
        fc.assert(
            fc.property(
                fc.double({ min: 0, max: 1, noNaN: true }),
                (progress) => {
                    const result = formatPeerProgress(progress);

                    // Verifica formato "{n}%" com n inteiro
                    expect(result).toMatch(/^\d+%$/);

                    // Extrai o número e verifica intervalo 0-100
                    const numericValue = parseInt(result.replace('%', ''), 10);
                    expect(numericValue).toBeGreaterThanOrEqual(0);
                    expect(numericValue).toBeLessThanOrEqual(100);

                    // Verifica que o valor é Math.round(progress * 100)
                    expect(numericValue).toBe(Math.round(progress * 100));
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 7: Piece summary counts match boolean array
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: download-details-panel, Property 7: Piece summary', () => {
    /**
     * Property 7: Piece summary counts match boolean array
     *
     * Para qualquer array booleano representando status de peças,
     * o texto de resumo SHALL exibir "{c}/{t} peças baixadas"
     * onde c = contagem de valores true e t = comprimento do array.
     *
     * **Validates: Requirements 4.5**
     */
    it('should produce "{count}/{total} peças baixadas" matching true count and array length', () => {
        fc.assert(
            fc.property(fc.array(fc.boolean()), (pieces) => {
                const result = computePieceSummary(pieces);

                const expectedCount = pieces.filter((p) => p).length;
                const expectedTotal = pieces.length;
                const expected = `${expectedCount}/${expectedTotal} peças baixadas`;

                expect(result).toBe(expected);
            }),
            { numRuns: 100 },
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 8: Piece grouping algorithm respects block limit and coverage
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: download-details-panel, Property 8: Piece grouping', () => {
    /**
     * Property 8: Piece grouping algorithm respects block limit and coverage
     *
     * Para qualquer array booleano com length > 1000, groupPieces(pieces, 500) SHALL:
     * - Retornar no máximo 500 blocos
     * - Cobrir todos os índices contiguamente (sem gaps, sem overlaps):
     *   - blocks[0].startIndex === 0
     *   - blocks[i+1].startIndex === blocks[i].endIndex
     *   - blocks[last].endIndex === pieces.length
     *
     * **Validates: Requirements 4.6**
     */
    it('groupPieces respeita limite de blocos e cobertura contígua para arrays > 1000', () => {
        fc.assert(
            fc.property(
                fc.array(fc.boolean(), { minLength: 1001, maxLength: 5000 }),
                (pieces) => {
                    const blocks = groupPieces(pieces, 500);

                    // Máximo de 500 blocos
                    expect(blocks.length).toBeLessThanOrEqual(500);

                    // Deve ter pelo menos 1 bloco
                    expect(blocks.length).toBeGreaterThanOrEqual(1);

                    // Primeiro bloco começa no índice 0
                    expect(blocks[0].startIndex).toBe(0);

                    // Blocos são contíguos (sem gaps, sem overlaps)
                    for (let i = 1; i < blocks.length; i++) {
                        expect(blocks[i].startIndex).toBe(blocks[i - 1].endIndex);
                    }

                    // Último bloco termina no comprimento total do array
                    expect(blocks[blocks.length - 1].endIndex).toBe(pieces.length);
                },
            ),
            { numRuns: 100 },
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 10: Y-axis auto-scale uses correct unit tier with minimum
// ═══════════════════════════════════════════════════════════════════════════════

describe('Feature: download-details-panel, Property 10: Y-axis scale', () => {
    /**
     * Property 10: Y-axis auto-scale uses correct unit tier with minimum
     *
     * Para qualquer array de SpeedSample, o valor máximo do eixo Y computado:
     * - Deve ser >= o maior valor de velocidade entre ambas as séries
     * - Deve ser >= 1024 (mínimo de 1 KB/s)
     *
     * **Validates: Requirements 5.3**
     */
    it('o máximo Y deve ser >= max speed e >= 1024 (mínimo)', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        downloadSpeed: fc.nat(),
                        uploadSpeed: fc.nat(),
                    }),
                ),
                (samples: SpeedSample[]) => {
                    const result = computeYAxisScale(samples);

                    // Deve ser >= 1024 (mínimo de 1 KB/s)
                    expect(result).toBeGreaterThanOrEqual(1024);

                    // Deve ser >= o maior valor de velocidade entre ambas as séries
                    const maxSpeed = samples.reduce((max, s) => {
                        return Math.max(max, s.downloadSpeed, s.uploadSpeed);
                    }, 0);
                    expect(result).toBeGreaterThanOrEqual(maxSpeed);
                },
            ),
            { numRuns: 100 },
        );
    });
});
