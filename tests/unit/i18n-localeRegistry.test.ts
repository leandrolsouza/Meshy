import fc from 'fast-check';
import { SUPPORTED_LOCALES, getLocaleMessages, isSupportedLocale } from '../../src/locales';

// ─── Derived constants ────────────────────────────────────────────────────────

const supportedCodes = SUPPORTED_LOCALES.map((entry) => entry.code);

const catalogByCode = new Map(SUPPORTED_LOCALES.map((entry) => [entry.code, entry.messages]));

// ─── Property-Based Tests ─────────────────────────────────────────────────────

// Feature: i18n-support, Property 2: Locale registry round-trip
describe('Property 2: Locale registry round-trip', () => {
    // **Validates: Requirements 1.3**

    it('getLocaleMessages(code) returns the exact message catalog for any supported locale', () => {
        fc.assert(
            fc.property(fc.constantFrom(...supportedCodes), (code) => {
                const messages = getLocaleMessages(code);
                const expected = catalogByCode.get(code);

                expect(messages).toBe(expected);
            }),
            { numRuns: 100 },
        );
    });

    it('isSupportedLocale(code) returns true for any supported locale', () => {
        fc.assert(
            fc.property(fc.constantFrom(...supportedCodes), (code) => {
                expect(isSupportedLocale(code)).toBe(true);
            }),
            { numRuns: 100 },
        );
    });

    it('isSupportedLocale returns false for random non-supported strings', () => {
        fc.assert(
            fc.property(
                fc
                    .string({ minLength: 1, maxLength: 30 })
                    .filter((s) => !supportedCodes.includes(s)),
                (randomStr) => {
                    expect(isSupportedLocale(randomStr)).toBe(false);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('getLocaleMessages falls back to pt-BR messages for non-supported strings', () => {
        const ptBrMessages = catalogByCode.get('pt-BR');

        fc.assert(
            fc.property(
                fc
                    .string({ minLength: 1, maxLength: 30 })
                    .filter((s) => !supportedCodes.includes(s)),
                (randomStr) => {
                    const messages = getLocaleMessages(randomStr);

                    expect(messages).toBe(ptBrMessages);
                },
            ),
            { numRuns: 100 },
        );
    });
});
