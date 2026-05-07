import { groupPieces, PieceBlock } from '../../../src/utils/detailsFormatters';

describe('groupPieces', () => {
    describe('quando pieces.length <= maxBlocks (sem agrupamento)', () => {
        it('retorna um bloco por peça', () => {
            const pieces = [true, false, true];
            const result = groupPieces(pieces, 500);

            expect(result).toHaveLength(3);
            expect(result[0]).toEqual({
                startIndex: 0,
                endIndex: 1,
                completedCount: 1,
                totalCount: 1,
            });
            expect(result[1]).toEqual({
                startIndex: 1,
                endIndex: 2,
                completedCount: 0,
                totalCount: 1,
            });
            expect(result[2]).toEqual({
                startIndex: 2,
                endIndex: 3,
                completedCount: 1,
                totalCount: 1,
            });
        });

        it('retorna array vazio para array vazio', () => {
            const result = groupPieces([], 500);
            expect(result).toHaveLength(0);
        });

        it('funciona com exatamente maxBlocks peças', () => {
            const pieces = new Array(500).fill(true);
            const result = groupPieces(pieces, 500);
            expect(result).toHaveLength(500);
        });
    });

    describe('quando pieces.length > maxBlocks (com agrupamento)', () => {
        it('agrupa peças adjacentes respeitando o limite de blocos', () => {
            // 1000 peças com maxBlocks=500 → groupSize=2
            const pieces = new Array(1000).fill(false);
            pieces[0] = true;
            pieces[1] = true;

            const result = groupPieces(pieces, 500);

            expect(result.length).toBeLessThanOrEqual(500);
            expect(result[0]).toEqual({
                startIndex: 0,
                endIndex: 2,
                completedCount: 2,
                totalCount: 2,
            });
        });

        it('cobre todas as peças sem gaps ou overlaps', () => {
            const pieces = new Array(1500).fill(true).map((_, i) => i % 3 === 0);
            const result = groupPieces(pieces, 500);

            // Verifica cobertura contígua
            expect(result[0].startIndex).toBe(0);
            for (let i = 1; i < result.length; i++) {
                expect(result[i].startIndex).toBe(result[i - 1].endIndex);
            }
            expect(result[result.length - 1].endIndex).toBe(pieces.length);
        });

        it('conta corretamente peças completas em cada bloco', () => {
            // 1001 peças, todas completas, maxBlocks=500
            const pieces = new Array(1001).fill(true);
            const result = groupPieces(pieces, 500);

            const totalCompleted = result.reduce((sum, b) => sum + b.completedCount, 0);
            expect(totalCompleted).toBe(1001);
        });

        it('usa maxBlocks padrão de 500', () => {
            const pieces = new Array(1500).fill(false);
            const result = groupPieces(pieces);
            expect(result.length).toBeLessThanOrEqual(500);
        });

        it('último bloco pode ter menos peças que groupSize', () => {
            // 1001 peças, maxBlocks=500 → groupSize=3, último bloco terá 2 peças
            const pieces = new Array(1001).fill(false);
            const result = groupPieces(pieces, 500);

            const lastBlock = result[result.length - 1];
            expect(lastBlock.endIndex).toBe(1001);
            expect(lastBlock.totalCount).toBeLessThanOrEqual(3);
        });
    });
});
