/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IntlProvider, useIntl } from 'react-intl';
import { within } from '@testing-library/dom';
import fc from 'fast-check';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LOCALE = 'pt-BR';

// ─── Helper component ─────────────────────────────────────────────────────────

/**
 * Renders a formatted message for the given translation key.
 * Uses the same pattern as production components: defaultMessage is the key
 * itself, so if the key is missing from all sources the raw key is displayed.
 */
function MessageRenderer({ id }: { id: string }): React.JSX.Element {
    const intl = useIntl();
    return <span data-testid="message">{intl.formatMessage({ id, defaultMessage: id })}</span>;
}

// ─── Generators ───────────────────────────────────────────────────────────────

/**
 * Generates a valid dot-separated translation key (e.g., "section.keyName").
 * Keys have 2-4 segments of lowercase alpha strings.
 */
const translationKeyArb = fc
    .array(fc.stringMatching(/^[a-z][a-zA-Z]{1,7}$/), { minLength: 2, maxLength: 4 })
    .map((segments) => segments.join('.'));

/**
 * Generates a non-empty translation value string that is visually distinct
 * from a translation key (contains spaces/uppercase to differentiate).
 * Avoids consecutive spaces since HTML collapses whitespace.
 */
const translationValueArb = fc
    .stringMatching(/^[A-Z][A-Za-z]{1,10}( [A-Za-z]{1,10}){0,3}$/)
    .filter((s) => s.length > 0);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Suppress MISSING_TRANSLATION errors, matching IntlWrapper behavior */
function suppressMissingTranslation(err: { code?: string }): void {
    if (err.code === 'MISSING_TRANSLATION') return;
    console.error('[IntlProvider]', err);
}

/**
 * Renders a MessageRenderer inside an IntlProvider configured to simulate
 * the fallback chain: active locale messages merged on top of pt-BR messages.
 *
 * Each call renders into a fresh container to avoid DOM pollution between
 * fast-check iterations (including shrink attempts that throw before cleanup).
 *
 * This mirrors how IntlWrapper + react-intl achieves the fallback:
 * - pt-BR messages serve as the base (default locale)
 * - Active locale messages override matching keys
 * - Missing keys in both catalogs fall through to defaultMessage (the raw key)
 */
function renderWithFallback(
    activeLocale: string,
    activeMessages: Record<string, string>,
    defaultMessages: Record<string, string>,
    messageId: string,
): { container: HTMLElement; unmount: () => void } {
    // Merge: pt-BR as base, active locale overlaid on top.
    // Keys present only in pt-BR remain as fallback.
    const mergedMessages = { ...defaultMessages, ...activeMessages };

    const container = document.createElement('div');
    document.body.appendChild(container);

    const result = render(
        <IntlProvider
            locale={activeLocale}
            defaultLocale={DEFAULT_LOCALE}
            messages={mergedMessages}
            onError={suppressMissingTranslation}
        >
            <MessageRenderer id={messageId} />
        </IntlProvider>,
        { container },
    );

    return { container: result.container, unmount: result.unmount };
}

// ─── Property-Based Tests ─────────────────────────────────────────────────────

// Feature: i18n-support, Property 8: Missing key fallback chain
describe('Property 8: Missing key fallback chain', () => {
    // **Validates: Requirements 3.4, 3.5**

    it('renders pt-BR string when key is missing from active locale but present in pt-BR', () => {
        fc.assert(
            fc.property(translationKeyArb, translationValueArb, (key, ptBrValue) => {
                // pt-BR catalog has the key; en-US catalog does NOT
                const ptBrMessages: Record<string, string> = { [key]: ptBrValue };
                const enUsMessages: Record<string, string> = {};

                const { container, unmount } = renderWithFallback(
                    'en-US',
                    enUsMessages,
                    ptBrMessages,
                    key,
                );

                try {
                    const el = within(container).getByTestId('message');
                    expect(el).toHaveTextContent(ptBrValue);
                } finally {
                    unmount();
                    container.remove();
                }
            }),
            { numRuns: 100 },
        );
    });

    it('renders the raw key string when key is missing from both active locale and pt-BR', () => {
        fc.assert(
            fc.property(translationKeyArb, (key) => {
                // Both catalogs are empty — key exists in neither
                const ptBrMessages: Record<string, string> = {};
                const enUsMessages: Record<string, string> = {};

                const { container, unmount } = renderWithFallback(
                    'en-US',
                    enUsMessages,
                    ptBrMessages,
                    key,
                );

                try {
                    const el = within(container).getByTestId('message');
                    // defaultMessage is the key itself, so the raw key is rendered
                    expect(el).toHaveTextContent(key);
                } finally {
                    unmount();
                    container.remove();
                }
            }),
            { numRuns: 100 },
        );
    });
});
