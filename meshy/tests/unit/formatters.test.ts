import fc from 'fast-check';
import { formatBytes } from '../../src/utils/formatters';

// ─── Unit tests (example-based) ───────────────────────────────────────────────

describe('formatBytes — unit tests', () => {
    it('returns "0 B" for 0 bytes', () => {
        expect(formatBytes(0)).toBe('0 B');
    });

    it('returns bytes without decimals for values < 1024', () => {
        expect(formatBytes(1)).toBe('1 B');
        expect(formatBytes(512)).toBe('512 B');
        expect(formatBytes(1023)).toBe('1023 B');
    });

    it('returns KB with 2 decimal places for values in [1024, 1024²)', () => {
        expect(formatBytes(1024)).toBe('1.00 KB');
        expect(formatBytes(1536)).toBe('1.50 KB');
        expect(formatBytes(1024 * 1023)).toBe('1023.00 KB');
    });

    it('returns MB with 2 decimal places for values in [1024², 1024³)', () => {
        expect(formatBytes(1024 ** 2)).toBe('1.00 MB');
        expect(formatBytes(1024 ** 2 * 1.5)).toBe('1.50 MB');
    });

    it('returns GB with 2 decimal places for values >= 1024³', () => {
        expect(formatBytes(1024 ** 3)).toBe('1.00 GB');
        expect(formatBytes(1024 ** 3 * 2.5)).toBe('2.50 GB');
    });
});

// ─── Property-based test ──────────────────────────────────────────────────────

// Feature: meshy-torrent-client, Property 7: Formatação de bytes produz unidade legível correta
describe('formatBytes — property tests', () => {
    /**
     * Validates: Requirements 3.3
     *
     * For any non-negative integer n, formatBytes(n) SHALL return a string that:
     *   1. Contains exactly one of the suffixes 'B', 'KB', 'MB', or 'GB'
     *   2. Uses the correct unit based on the magnitude of n
     *   3. The numeric value displayed is mathematically correct for the chosen unit
     *      (within 2 decimal places)
     */
    it('always returns a string with exactly one valid unit suffix and a correct numeric value', () => {
        fc.assert(
            fc.property(
                // Generate non-negative safe integers (up to ~4 GB to keep tests fast)
                fc.integer({ min: 0, max: 4 * 1024 ** 3 }),
                (n) => {
                    const result = formatBytes(n);

                    const GB = 1024 ** 3;
                    const MB = 1024 ** 2;
                    const KB = 1024;

                    // Determine expected unit
                    let expectedSuffix: string;
                    let expectedValue: number;

                    if (n >= GB) {
                        expectedSuffix = 'GB';
                        expectedValue = n / GB;
                    } else if (n >= MB) {
                        expectedSuffix = 'MB';
                        expectedValue = n / MB;
                    } else if (n >= KB) {
                        expectedSuffix = 'KB';
                        expectedValue = n / KB;
                    } else {
                        expectedSuffix = 'B';
                        expectedValue = n;
                    }

                    // 1. Result must end with the expected suffix
                    if (!result.endsWith(` ${expectedSuffix}`)) return false;

                    // 2. Exactly one suffix must appear at the end of the result
                    const suffixes = ['GB', 'MB', 'KB', 'B'];
                    const matchedSuffixes = suffixes.filter((s) => result.endsWith(` ${s}`));
                    if (matchedSuffixes.length !== 1) return false;

                    // 3. Numeric value must be correct within 2 decimal places
                    const numericPart = parseFloat(result);
                    const roundedExpected = parseFloat(expectedValue.toFixed(2));
                    return Math.abs(numericPart - roundedExpected) < 0.005;
                }
            ),
            { numRuns: 100 }
        );
    });
});
