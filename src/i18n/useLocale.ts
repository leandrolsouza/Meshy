import { create } from 'zustand';
import { DEFAULT_LOCALE, isSupportedLocale } from '../locales';

// ─── Store interface ──────────────────────────────────────────────────────────

interface LocaleState {
    locale: string;
    setLocale: (locale: string) => void;
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useLocaleStore = create<LocaleState>((set) => ({
    locale: DEFAULT_LOCALE,

    /**
     * Atualiza o locale ativo.
     * Valida contra a lista de locales suportados; se não reconhecido, volta ao DEFAULT_LOCALE.
     */
    setLocale: (locale: string) => {
        if (isSupportedLocale(locale)) {
            set({ locale });
        } else {
            set({ locale: DEFAULT_LOCALE });
        }
    },
}));
