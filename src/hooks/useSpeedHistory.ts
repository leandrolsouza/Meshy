import { useRef, useCallback } from 'react';

const MAX_SAMPLES = 60;

export interface SpeedSample {
    downloadSpeed: number;
    uploadSpeed: number;
}

/**
 * Gerencia um buffer circular de amostras de velocidade (máximo 60).
 *
 * - `addSample(download, upload)`: adiciona uma amostra, preenche gaps de pausa
 *   com zeros e descarta as mais antigas se exceder o limite.
 * - `getSamples()`: retorna o array atual de amostras.
 *
 * Usa refs para evitar re-renders desnecessários.
 */
export function useSpeedHistory() {
    const samplesRef = useRef<SpeedSample[]>([]);
    const lastCollectTimeRef = useRef<number | null>(null);

    const addSample = useCallback((download: number, upload: number) => {
        const now = Date.now();

        // Preencher intervalo de pausa com zeros
        if (lastCollectTimeRef.current !== null) {
            const gap = Math.floor((now - lastCollectTimeRef.current) / 1000) - 1;
            for (let i = 0; i < gap && samplesRef.current.length < MAX_SAMPLES; i++) {
                samplesRef.current.push({ downloadSpeed: 0, uploadSpeed: 0 });
            }
        }

        samplesRef.current.push({ downloadSpeed: download, uploadSpeed: upload });

        // Descartar amostras mais antigas se exceder limite
        if (samplesRef.current.length > MAX_SAMPLES) {
            samplesRef.current = samplesRef.current.slice(-MAX_SAMPLES);
        }

        lastCollectTimeRef.current = now;
    }, []);

    const getSamples = useCallback((): SpeedSample[] => {
        return samplesRef.current;
    }, []);

    return { addSample, getSamples };
}
