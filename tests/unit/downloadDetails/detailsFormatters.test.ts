import {
    formatPeerSpeed,
    formatPeerProgress,
    formatCreationDate,
    computePieceSummary,
} from '../../../src/utils/detailsFormatters';

describe('detailsFormatters', () => {
    describe('formatPeerSpeed', () => {
        it('retorna B/s para valores abaixo de 1024', () => {
            expect(formatPeerSpeed(0)).toBe('0 B/s');
            expect(formatPeerSpeed(512)).toBe('512 B/s');
            expect(formatPeerSpeed(1023)).toBe('1023 B/s');
        });

        it('retorna KB/s para valores entre 1024 e 1048575', () => {
            expect(formatPeerSpeed(1024)).toBe('1.0 KB/s');
            expect(formatPeerSpeed(1536)).toBe('1.5 KB/s');
            expect(formatPeerSpeed(1048575)).toBe('1024.0 KB/s');
        });

        it('retorna MB/s para valores >= 1048576', () => {
            expect(formatPeerSpeed(1048576)).toBe('1.0 MB/s');
            expect(formatPeerSpeed(1572864)).toBe('1.5 MB/s');
            expect(formatPeerSpeed(10485760)).toBe('10.0 MB/s');
        });
    });

    describe('formatPeerProgress', () => {
        it('converte 0.0 para 0%', () => {
            expect(formatPeerProgress(0)).toBe('0%');
        });

        it('converte 1.0 para 100%', () => {
            expect(formatPeerProgress(1.0)).toBe('100%');
        });

        it('converte 0.5 para 50%', () => {
            expect(formatPeerProgress(0.5)).toBe('50%');
        });

        it('arredonda corretamente valores fracionários', () => {
            expect(formatPeerProgress(0.333)).toBe('33%');
            expect(formatPeerProgress(0.666)).toBe('67%');
            expect(formatPeerProgress(0.995)).toBe('100%');
        });
    });

    describe('formatCreationDate', () => {
        it('formata timestamp no padrão dd/MM/yyyy HH:mm', () => {
            // 15/03/2023 14:30 (UTC)
            const timestamp = new Date(2023, 2, 15, 14, 30).getTime();
            expect(formatCreationDate(timestamp)).toBe('15/03/2023 14:30');
        });

        it('adiciona zeros à esquerda para dia e mês de um dígito', () => {
            // 05/01/2020 09:05
            const timestamp = new Date(2020, 0, 5, 9, 5).getTime();
            expect(formatCreationDate(timestamp)).toBe('05/01/2020 09:05');
        });

        it('formata meia-noite corretamente', () => {
            // 01/01/2000 00:00
            const timestamp = new Date(2000, 0, 1, 0, 0).getTime();
            expect(formatCreationDate(timestamp)).toBe('01/01/2000 00:00');
        });
    });

    describe('computePieceSummary', () => {
        it('retorna 0/0 para array vazio', () => {
            expect(computePieceSummary([])).toBe('0/0 peças baixadas');
        });

        it('conta peças completas corretamente', () => {
            expect(computePieceSummary([true, true, false, true, false])).toBe(
                '3/5 peças baixadas',
            );
        });

        it('retorna total quando todas completas', () => {
            expect(computePieceSummary([true, true, true])).toBe('3/3 peças baixadas');
        });

        it('retorna 0 quando nenhuma completa', () => {
            expect(computePieceSummary([false, false, false])).toBe('0/3 peças baixadas');
        });
    });
});
