/**
 * Smoke test — verifica que o ambiente de testes está configurado corretamente.
 */
describe('Ambiente de testes', () => {
    it('Jest está configurado com ts-jest', () => {
        expect(true).toBe(true);
    });

    it('fast-check está disponível', async () => {
        const fc = await import('fast-check');
        expect(typeof fc.assert).toBe('function');
        expect(typeof fc.property).toBe('function');
        expect(typeof fc.string).toBe('function');
    });
});
