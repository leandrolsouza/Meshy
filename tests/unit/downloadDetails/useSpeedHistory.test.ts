/**
 * @jest-environment jsdom
 */
/**
 * Testes unitários para o hook useSpeedHistory.
 *
 * Cobre: adição de amostras, limite de 60 amostras, preenchimento de gaps com zeros,
 * e uso de refs para evitar re-renders.
 */
import { renderHook, act } from '@testing-library/react';

import { useSpeedHistory } from '../../../src/hooks/useSpeedHistory';

describe('useSpeedHistory', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('addSample', () => {
        it('adiciona uma amostra ao buffer', () => {
            const { result } = renderHook(() => useSpeedHistory());

            act(() => {
                result.current.addSample(1024, 512);
            });

            const samples = result.current.getSamples();
            expect(samples).toHaveLength(1);
            expect(samples[0]).toEqual({ downloadSpeed: 1024, uploadSpeed: 512 });
        });

        it('adiciona múltiplas amostras sequencialmente', () => {
            const { result } = renderHook(() => useSpeedHistory());

            act(() => {
                result.current.addSample(100, 50);
                jest.advanceTimersByTime(1000);
                result.current.addSample(200, 100);
                jest.advanceTimersByTime(1000);
                result.current.addSample(300, 150);
            });

            const samples = result.current.getSamples();
            expect(samples).toHaveLength(3);
            expect(samples[0]).toEqual({ downloadSpeed: 100, uploadSpeed: 50 });
            expect(samples[2]).toEqual({ downloadSpeed: 300, uploadSpeed: 150 });
        });
    });

    describe('limite de 60 amostras', () => {
        it('descarta amostras mais antigas quando excede 60', () => {
            const { result } = renderHook(() => useSpeedHistory());

            act(() => {
                for (let i = 0; i < 65; i++) {
                    jest.advanceTimersByTime(1000);
                    result.current.addSample(i, i * 2);
                }
            });

            const samples = result.current.getSamples();
            expect(samples).toHaveLength(60);
            // A primeira amostra deve ser a 6ª adicionada (índice 5)
            expect(samples[0]).toEqual({ downloadSpeed: 5, uploadSpeed: 10 });
            // A última amostra deve ser a 65ª adicionada (índice 64)
            expect(samples[59]).toEqual({ downloadSpeed: 64, uploadSpeed: 128 });
        });

        it('nunca excede 60 amostras independente do número de chamadas', () => {
            const { result } = renderHook(() => useSpeedHistory());

            act(() => {
                for (let i = 0; i < 200; i++) {
                    jest.advanceTimersByTime(1000);
                    result.current.addSample(i, i);
                }
            });

            expect(result.current.getSamples().length).toBeLessThanOrEqual(60);
        });
    });

    describe('preenchimento de gaps com zeros', () => {
        it('preenche gaps de pausa com amostras zero', () => {
            const { result } = renderHook(() => useSpeedHistory());

            act(() => {
                result.current.addSample(1000, 500);
                // Simula pausa de 5 segundos
                jest.advanceTimersByTime(5000);
                result.current.addSample(2000, 1000);
            });

            const samples = result.current.getSamples();
            // 1 amostra original + 4 zeros (gap de 5s - 1) + 1 nova amostra = 6
            expect(samples).toHaveLength(6);
            expect(samples[0]).toEqual({ downloadSpeed: 1000, uploadSpeed: 500 });
            // Amostras de gap devem ser zeros
            for (let i = 1; i <= 4; i++) {
                expect(samples[i]).toEqual({ downloadSpeed: 0, uploadSpeed: 0 });
            }
            expect(samples[5]).toEqual({ downloadSpeed: 2000, uploadSpeed: 1000 });
        });

        it('não preenche gap quando intervalo é de 1 segundo (normal)', () => {
            const { result } = renderHook(() => useSpeedHistory());

            act(() => {
                result.current.addSample(100, 50);
                jest.advanceTimersByTime(1000);
                result.current.addSample(200, 100);
            });

            const samples = result.current.getSamples();
            // Sem gap: apenas 2 amostras
            expect(samples).toHaveLength(2);
        });

        it('limita zeros de gap ao máximo de 60 amostras', () => {
            const { result } = renderHook(() => useSpeedHistory());

            act(() => {
                result.current.addSample(100, 50);
                // Simula pausa muito longa (100 segundos)
                jest.advanceTimersByTime(100000);
                result.current.addSample(200, 100);
            });

            const samples = result.current.getSamples();
            // Não deve exceder 60 amostras
            expect(samples.length).toBeLessThanOrEqual(60);
        });
    });

    describe('getSamples', () => {
        it('retorna array vazio quando nenhuma amostra foi adicionada', () => {
            const { result } = renderHook(() => useSpeedHistory());

            expect(result.current.getSamples()).toEqual([]);
        });

        it('retorna referência ao array interno (sem cópia)', () => {
            const { result } = renderHook(() => useSpeedHistory());

            act(() => {
                result.current.addSample(100, 50);
            });

            const samples1 = result.current.getSamples();
            const samples2 = result.current.getSamples();
            expect(samples1).toBe(samples2);
        });
    });

    describe('estabilidade de referência', () => {
        it('addSample e getSamples mantêm referência estável entre renders', () => {
            const { result, rerender } = renderHook(() => useSpeedHistory());

            const addSample1 = result.current.addSample;
            const getSamples1 = result.current.getSamples;

            rerender();

            expect(result.current.addSample).toBe(addSample1);
            expect(result.current.getSamples).toBe(getSamples1);
        });
    });
});
