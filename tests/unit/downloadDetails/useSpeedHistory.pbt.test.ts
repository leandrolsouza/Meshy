/** @jest-environment jsdom */
/**
 * Testes de propriedade para o hook useSpeedHistory.
 *
 * Feature: download-details-panel, Property 9: Buffer cap
 *
 * Validates: Requirements 5.2
 */
import { renderHook, act } from '@testing-library/react';
import * as fc from 'fast-check';

import { useSpeedHistory } from '../../../src/hooks/useSpeedHistory';

describe('Feature: download-details-panel, Property 9: Buffer cap', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    /**
     * **Validates: Requirements 5.2**
     *
     * Property 9: Speed history buffer never exceeds 60 samples
     *
     * Para qualquer sequência de chamadas addSample (independente da quantidade),
     * o buffer de histórico de velocidade SHALL conter no máximo 60 amostras em
     * qualquer ponto.
     */
    it('o buffer nunca excede 60 amostras para qualquer sequência de addSample', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        download: fc.nat({ max: 10_000_000 }),
                        upload: fc.nat({ max: 10_000_000 }),
                        delayMs: fc.integer({ min: 500, max: 5000 }),
                    }),
                    { minLength: 1, maxLength: 200 },
                ),
                (sampleSequence) => {
                    const { result } = renderHook(() => useSpeedHistory());

                    for (const { download, upload, delayMs } of sampleSequence) {
                        act(() => {
                            jest.advanceTimersByTime(delayMs);
                            result.current.addSample(download, upload);
                        });

                        // Verificar invariante após cada chamada addSample
                        const samples = result.current.getSamples();
                        expect(samples.length).toBeLessThanOrEqual(60);
                    }
                },
            ),
            { numRuns: 100 },
        );
    });
});

describe('Feature: download-details-panel, Property 11: Gap-filling', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    /**
     * **Validates: Requirements 5.7**
     *
     * Property 11: Gap-filling on resume inserts correct zero samples
     *
     * Para qualquer pausa de duração `g` segundos (onde g >= 2), quando a coleta
     * é retomada, o histórico de velocidade SHALL conter exatamente `g - 1`
     * amostras com valor zero inseridas para representar o intervalo de pausa,
     * seguidas pela nova amostra.
     */
    it('insere exatamente g-1 amostras zero para uma pausa de g segundos', () => {
        fc.assert(
            fc.property(
                fc.record({
                    initialDownload: fc.nat({ max: 10_000_000 }),
                    initialUpload: fc.nat({ max: 10_000_000 }),
                    gapSeconds: fc.integer({ min: 2, max: 55 }),
                    resumeDownload: fc.nat({ max: 10_000_000 }),
                    resumeUpload: fc.nat({ max: 10_000_000 }),
                }),
                ({ initialDownload, initialUpload, gapSeconds, resumeDownload, resumeUpload }) => {
                    const { result } = renderHook(() => useSpeedHistory());

                    // Primeira amostra — estabelece o lastCollectTime
                    act(() => {
                        result.current.addSample(initialDownload, initialUpload);
                    });

                    // Simular pausa de gapSeconds avançando o tempo
                    act(() => {
                        jest.advanceTimersByTime(gapSeconds * 1000);
                        result.current.addSample(resumeDownload, resumeUpload);
                    });

                    const samples = result.current.getSamples();

                    // O buffer deve conter:
                    // 1 amostra inicial + (g-1) zeros + 1 amostra de retomada
                    const expectedLength = 1 + (gapSeconds - 1) + 1;
                    expect(samples.length).toBe(expectedLength);

                    // Verificar que a primeira amostra é a inicial
                    expect(samples[0]).toEqual({
                        downloadSpeed: initialDownload,
                        uploadSpeed: initialUpload,
                    });

                    // Verificar que as amostras intermediárias são zeros
                    for (let i = 1; i <= gapSeconds - 1; i++) {
                        expect(samples[i]).toEqual({
                            downloadSpeed: 0,
                            uploadSpeed: 0,
                        });
                    }

                    // Verificar que a última amostra é a de retomada
                    expect(samples[samples.length - 1]).toEqual({
                        downloadSpeed: resumeDownload,
                        uploadSpeed: resumeUpload,
                    });
                },
            ),
            { numRuns: 100 },
        );
    });
});
