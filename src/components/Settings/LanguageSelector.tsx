import React, { useCallback } from 'react';
import { useIntl } from 'react-intl';
import { SUPPORTED_LOCALES } from '../../locales';
import { useLocaleStore } from '../../i18n/useLocale';
import styles from './LanguageSelector.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface LanguageSelectorProps {
    onLocaleChange: (locale: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Seletor de idioma com acessibilidade completa.
 *
 * Renderiza um `<select>` listando todos os locales suportados pelo nome nativo.
 * A troca é imediata — o onChange atualiza o store e chama onLocaleChange para persistir via IPC.
 */
export function LanguageSelector({
    onLocaleChange,
}: LanguageSelectorProps): React.JSX.Element {
    const intl = useIntl();
    const locale = useLocaleStore((s) => s.locale);
    const setLocale = useLocaleStore((s) => s.setLocale);

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            const newLocale = e.target.value;
            setLocale(newLocale);
            onLocaleChange(newLocale);
        },
        [setLocale, onLocaleChange],
    );

    return (
        <select
            aria-label={intl.formatMessage({ id: 'settings.general.languageAriaLabel' })}
            value={locale}
            onChange={handleChange}
            className={styles.languageSelect}
        >
            {SUPPORTED_LOCALES.map((entry) => (
                <option key={entry.code} value={entry.code}>
                    {entry.nativeName}
                </option>
            ))}
        </select>
    );
}
