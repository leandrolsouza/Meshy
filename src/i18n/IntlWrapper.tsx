import React, { useEffect } from 'react';
import { IntlProvider } from 'react-intl';
import { useLocaleStore } from './useLocale';
import { getLocaleMessages, DEFAULT_LOCALE } from '../locales';

interface IntlWrapperProps {
    children: React.ReactNode;
}

export function IntlWrapper({ children }: IntlWrapperProps): React.JSX.Element {
    const locale = useLocaleStore((s) => s.locale);
    const setLocale = useLocaleStore((s) => s.setLocale);
    const messages = getLocaleMessages(locale);

    // Load persisted locale on mount
    useEffect(() => {
        async function loadPersistedLocale() {
            try {
                const response = await window.meshy.getSettings();
                if (response.success && response.data.locale) {
                    setLocale(response.data.locale);
                }
            } catch {
                // Fall back to default locale
            }
        }
        loadPersistedLocale();
    }, [setLocale]);

    return (
        <IntlProvider
            locale={locale}
            defaultLocale={DEFAULT_LOCALE}
            messages={messages}
            onError={(err) => {
                // Suppress missing translation warnings in development;
                // the fallback chain handles missing keys gracefully.
                if (err.code === 'MISSING_TRANSLATION') return;
                console.error('[IntlProvider]', err);
            }}
        >
            {children}
        </IntlProvider>
    );
}
