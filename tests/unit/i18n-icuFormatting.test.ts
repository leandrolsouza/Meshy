import fc from 'fast-check';
import { createIntl, createIntlCache } from 'react-intl';
import ptBR from '../../src/locales/pt-BR.json';
import enUS from '../../src/locales/en-US.json';
import { ErrorCodes } from '../../shared/errorCodes';
import { resolveErrorMessage } from '../../src/utils/resolveErrorMessage';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const cache = createIntlCache();

function makeIntl(locale: string, messages: Record<string, string>) {
    return createIntl({ locale, messages }, cache);
}

/**
 * Arbitrary that generates valid ICU placeholder names:
 * starts with a letter, followed by letters or digits, 1–12 chars.
 */
const placeholderNameArb = fc
    .tuple(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
        fc.stringOf(
            fc.constantFrom(
                ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''),
            ),
            { minLength: 0, maxLength: 11 },
        ),
    )
    .map(([first, rest]) => first + rest);

/**
 * Arbitrary that generates non-empty printable string values for interpolation.
 * Avoids ICU-special characters ({, }, #) to prevent parsing issues.
 */
const safeValueArb = fc
    .stringOf(
        fc.constantFrom(
            ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-.!@$%&*()+='.split(
                '',
            ),
        ),
        { minLength: 1, maxLength: 30 },
    )
    .filter((s) => s.trim().length > 0);

// ─── Property-Based Tests ─────────────────────────────────────────────────────

// Feature: i18n-support, Property 4: Interpolation resolution
describe('Property 4: Interpolation resolution', () => {
    // **Validates: Requirements 1.5, 2.3**

    it('formatting an ICU message with placeholders produces a string containing each provided value', () => {
        // Generate 1–4 unique placeholder names with corresponding values
        const placeholderSetArb = fc
            .uniqueArray(placeholderNameArb, { minLength: 1, maxLength: 4 })
            .chain((names) =>
                fc.tuple(fc.constant(names), fc.tuple(...names.map(() => safeValueArb))),
            );

        fc.assert(
            fc.property(placeholderSetArb, ([names, values]) => {
                // Build an ICU message like "Hello {name}, size is {size}"
                const messageParts = names.map((n) => `{${n}}`);
                const icuMessage = messageParts.join(' ');

                // Build the values object
                const valuesObj: Record<string, string> = {};
                names.forEach((name, i) => {
                    valuesObj[name] = values[i];
                });

                const intl = makeIntl('en-US', { 'test.interpolation': icuMessage });
                const result = intl.formatMessage({ id: 'test.interpolation' }, valuesObj);

                // Each provided value must appear in the formatted output
                for (const value of values) {
                    expect(result).toContain(value);
                }
            }),
            { numRuns: 100 },
        );
    });

    it('interpolation works with actual locale messages containing placeholders', () => {
        // Test with real keys that use interpolation (e.g., downloads.progress.label)
        const intl = makeIntl('en-US', enUS as Record<string, string>);

        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
                fc.integer({ min: 0, max: 100 }),
                (name, percent) => {
                    const result = intl.formatMessage(
                        { id: 'downloads.progress.label' },
                        { name, percent: String(percent) },
                    );
                    expect(result).toContain(name);
                    expect(result).toContain(String(percent));
                },
            ),
            { numRuns: 100 },
        );
    });
});

// Feature: i18n-support, Property 5: ICU MessageFormat pluralization
describe('Property 5: ICU MessageFormat pluralization', () => {
    // **Validates: Requirements 2.4, 8.1, 8.2, 8.3**

    it('formatting statusBar.activeDownloads in en-US produces a string containing the count with correct plural form', () => {
        const enUSMessages = enUS as Record<string, string>;
        const intl = makeIntl('en-US', enUSMessages);

        fc.assert(
            fc.property(fc.integer({ min: 0, max: 100_000 }), (count) => {
                const result = intl.formatMessage({ id: 'statusBar.activeDownloads' }, { count });

                // ICU # formats numbers with locale-specific grouping (e.g., 1,000 in en-US).
                // Use Intl.NumberFormat to get the expected formatted count.
                const formattedCount = new Intl.NumberFormat('en-US').format(count);
                expect(result).toContain(formattedCount);

                // English plural rules: 1 = singular ("download"), other = plural ("downloads")
                if (count === 1) {
                    expect(result).toContain('active download');
                    expect(result).not.toContain('active downloads');
                } else {
                    expect(result).toContain('active downloads');
                }
            }),
            { numRuns: 100 },
        );
    });

    it('formatting statusBar.activeDownloads in pt-BR produces a string containing the count with correct plural form', () => {
        const ptBRMessages = ptBR as Record<string, string>;
        const intl = makeIntl('pt-BR', ptBRMessages);

        fc.assert(
            fc.property(fc.integer({ min: 0, max: 100_000 }), (count) => {
                const result = intl.formatMessage({ id: 'statusBar.activeDownloads' }, { count });

                // ICU # formats numbers with locale-specific grouping (e.g., 1.000 in pt-BR).
                // Use Intl.NumberFormat to get the expected formatted count.
                const formattedCount = new Intl.NumberFormat('pt-BR').format(count);
                expect(result).toContain(formattedCount);

                // Portuguese plural rules: 0 and 1 = singular ("download ativo"),
                // other = plural ("downloads ativos")
                if (count === 0 || count === 1) {
                    expect(result).toContain('download ativo');
                    expect(result).not.toContain('downloads ativos');
                } else {
                    expect(result).toContain('downloads ativos');
                }
            }),
            { numRuns: 100 },
        );
    });
});

// Feature: i18n-support, Property 10: Error code resolution
describe('Property 10: Error code resolution', () => {
    // **Validates: Requirements 9.1, 9.2, 9.3**

    const allErrorCodeValues = Object.values(ErrorCodes);
    const ptBRMessages = ptBR as Record<string, string>;
    const enUSMessages = enUS as Record<string, string>;

    it('for any known error code, resolveErrorMessage returns the localized string (not the raw code)', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...allErrorCodeValues),
                fc.constantFrom(
                    { locale: 'pt-BR', messages: ptBRMessages },
                    { locale: 'en-US', messages: enUSMessages },
                ),
                (errorCode, { locale, messages }) => {
                    const intl = makeIntl(locale, messages);
                    const result = resolveErrorMessage(intl, errorCode);

                    // The error code has a translation in both locales,
                    // so the result must be the localized string (not the raw code)
                    expect(result).not.toBe(errorCode);
                    expect(result.length).toBeGreaterThan(0);

                    // Verify it matches the expected translation
                    expect(result).toBe(messages[errorCode]);
                },
            ),
            { numRuns: Math.max(100, allErrorCodeValues.length * 2) },
        );
    });

    it('for any unknown error code string, resolveErrorMessage returns the raw string as fallback', () => {
        // Generate random strings that are NOT in the error codes list
        const unknownCodeArb = fc
            .string({ minLength: 1, maxLength: 50 })
            .filter((s) => !allErrorCodeValues.includes(s as never))
            .filter((s) => !(s in ptBRMessages))
            .filter((s) => !(s in enUSMessages));

        fc.assert(
            fc.property(
                unknownCodeArb,
                fc.constantFrom(
                    { locale: 'pt-BR', messages: ptBRMessages },
                    { locale: 'en-US', messages: enUSMessages },
                ),
                (unknownCode, { locale, messages }) => {
                    const intl = makeIntl(locale, messages);
                    const result = resolveErrorMessage(intl, unknownCode);

                    // Unknown codes should be returned as-is
                    expect(result).toBe(unknownCode);
                },
            ),
            { numRuns: 100 },
        );
    });

    it('for a mix of known and unknown error codes, resolution is consistent', () => {
        // Mix: pick from actual error codes OR generate random strings
        const mixedCodeArb = fc.oneof(
            fc.constantFrom(...allErrorCodeValues),
            fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz.0123456789'.split('')), {
                minLength: 3,
                maxLength: 40,
            }),
        );

        fc.assert(
            fc.property(mixedCodeArb, (code) => {
                const intl = makeIntl('en-US', enUSMessages);
                const result = resolveErrorMessage(intl, code);

                if (code in enUSMessages) {
                    // Known key: should resolve to the translation
                    expect(result).toBe(enUSMessages[code]);
                } else {
                    // Unknown key: should return raw code
                    expect(result).toBe(code);
                }
            }),
            { numRuns: 100 },
        );
    });
});
