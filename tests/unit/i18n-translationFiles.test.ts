import fc from 'fast-check';
import ptBR from '../../src/locales/pt-BR.json';
import enUS from '../../src/locales/en-US.json';
import { SUPPORTED_LOCALES } from '../../src/locales';

// ─── Derived constants ────────────────────────────────────────────────────────

const ptBRCatalog = ptBR as Record<string, string>;
const enUSCatalog = enUS as Record<string, string>;

const ptBRKeys = Object.keys(ptBRCatalog);
const enUSKeys = Object.keys(enUSCatalog);
const allLocaleKeys = [...new Set([...ptBRKeys, ...enUSKeys])];

/**
 * Checks whether a string is in camelCase format:
 * starts with a lowercase letter, followed by alphanumeric characters only
 * (no underscores, no hyphens).
 */
function isCamelCase(segment: string): boolean {
    return /^[a-z][a-zA-Z0-9]*$/.test(segment);
}

// ─── Property-Based Tests ─────────────────────────────────────────────────────

// Feature: i18n-support, Property 1: Translation file structural integrity
describe('Property 1: Translation file structural integrity', () => {
    // **Validates: Requirements 1.1**

    it('every key in pt-BR.json is a non-empty string and every value is a non-empty string', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...ptBRKeys),
                (key) => {
                    expect(typeof key).toBe('string');
                    expect(key.length).toBeGreaterThan(0);

                    const value = ptBRCatalog[key];
                    expect(typeof value).toBe('string');
                    expect(value.length).toBeGreaterThan(0);
                },
            ),
            { numRuns: Math.max(100, ptBRKeys.length) },
        );
    });

    it('every key in en-US.json is a non-empty string and every value is a non-empty string', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...enUSKeys),
                (key) => {
                    expect(typeof key).toBe('string');
                    expect(key.length).toBeGreaterThan(0);

                    const value = enUSCatalog[key];
                    expect(typeof value).toBe('string');
                    expect(value.length).toBeGreaterThan(0);
                },
            ),
            { numRuns: Math.max(100, enUSKeys.length) },
        );
    });
});

// Feature: i18n-support, Property 3: Default locale completeness
describe('Property 3: Default locale completeness (superset invariant)', () => {
    // **Validates: Requirements 1.4, 6.1, 6.2**

    it('every key present in en-US.json also exists in pt-BR.json (default locale is superset)', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...enUSKeys),
                (key) => {
                    expect(key in ptBRCatalog).toBe(true);
                },
            ),
            { numRuns: Math.max(100, enUSKeys.length) },
        );
    });

    it('every key present in pt-BR.json also exists in en-US.json (completeness)', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...ptBRKeys),
                (key) => {
                    expect(key in enUSCatalog).toBe(true);
                },
            ),
            { numRuns: Math.max(100, ptBRKeys.length) },
        );
    });

    it('for any supported locale, every key exists in the default locale (pt-BR)', () => {
        const nonDefaultLocales = SUPPORTED_LOCALES.filter((l) => l.code !== 'pt-BR');

        for (const locale of nonDefaultLocales) {
            const localeKeys = Object.keys(locale.messages);

            fc.assert(
                fc.property(
                    fc.constantFrom(...localeKeys),
                    (key) => {
                        expect(key in ptBRCatalog).toBe(true);
                    },
                ),
                { numRuns: Math.max(100, localeKeys.length) },
            );
        }
    });
});

// Feature: i18n-support, Property 9: Translation key format convention
describe('Property 9: Translation key format convention', () => {
    // **Validates: Requirements 7.1, 7.2**

    it('every key in any locale file matches dot-separated segments with camelCase final segment', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...allLocaleKeys),
                (key) => {
                    const segments = key.split('.');

                    // Must have at least one segment
                    expect(segments.length).toBeGreaterThanOrEqual(1);

                    // Every segment must be a non-empty string
                    for (const segment of segments) {
                        expect(segment.length).toBeGreaterThan(0);
                    }

                    // The final segment must be in camelCase format
                    const finalSegment = segments[segments.length - 1];
                    expect(isCamelCase(finalSegment)).toBe(true);
                },
            ),
            { numRuns: Math.max(100, allLocaleKeys.length) },
        );
    });

    it('every key in pt-BR.json follows the dot-separated camelCase convention', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...ptBRKeys),
                (key) => {
                    const segments = key.split('.');
                    expect(segments.length).toBeGreaterThanOrEqual(1);

                    for (const segment of segments) {
                        expect(segment.length).toBeGreaterThan(0);
                    }

                    const finalSegment = segments[segments.length - 1];
                    expect(isCamelCase(finalSegment)).toBe(true);
                },
            ),
            { numRuns: Math.max(100, ptBRKeys.length) },
        );
    });

    it('every key in en-US.json follows the dot-separated camelCase convention', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...enUSKeys),
                (key) => {
                    const segments = key.split('.');
                    expect(segments.length).toBeGreaterThanOrEqual(1);

                    for (const segment of segments) {
                        expect(segment.length).toBeGreaterThan(0);
                    }

                    const finalSegment = segments[segments.length - 1];
                    expect(isCamelCase(finalSegment)).toBe(true);
                },
            ),
            { numRuns: Math.max(100, enUSKeys.length) },
        );
    });
});
