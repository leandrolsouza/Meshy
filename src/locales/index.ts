import ptBR from './pt-BR.json';
import enUS from './en-US.json';

export interface LocaleEntry {
    code: string; // BCP 47 identifier
    nativeName: string; // Display name in the locale's own language
    messages: Record<string, string>;
}

export const SUPPORTED_LOCALES: LocaleEntry[] = [
    { code: 'pt-BR', nativeName: 'Português (Brasil)', messages: ptBR },
    { code: 'en-US', nativeName: 'English (US)', messages: enUS },
];

export const DEFAULT_LOCALE = 'pt-BR';

export function getLocaleMessages(locale: string): Record<string, string> {
    const entry = SUPPORTED_LOCALES.find((l) => l.code === locale);
    return entry?.messages ?? SUPPORTED_LOCALES[0].messages;
}

export function isSupportedLocale(locale: string): boolean {
    return SUPPORTED_LOCALES.some((l) => l.code === locale);
}
