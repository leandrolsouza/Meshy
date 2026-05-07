import { useCallback, useEffect, useRef } from 'react';

/**
 * Executa polling condicional com cleanup automático.
 *
 * - Mantém referência estável da função via ref (evita re-criação do intervalo).
 * - Executa chamada inicial imediata quando `enabled` muda para true.
 * - Limpa o intervalo no cleanup do useEffect.
 *
 * @param fn - Função assíncrona a ser executada periodicamente.
 * @param intervalMs - Intervalo entre execuções em milissegundos.
 * @param enabled - Controla se o polling está ativo.
 */
export function usePolling(
    fn: () => Promise<void>,
    intervalMs: number,
    enabled: boolean,
): void {
    const fnRef = useRef(fn);

    // Atualizar ref dentro de um efeito para satisfazer a regra react-hooks/refs
    useEffect(() => {
        fnRef.current = fn;
    });

    const stableFn = useCallback(() => fnRef.current(), []);

    useEffect(() => {
        if (!enabled) return;

        // Chamada inicial imediata
        stableFn();

        const id = setInterval(stableFn, intervalMs);

        return () => clearInterval(id);
    }, [intervalMs, enabled, stableFn]);
}
