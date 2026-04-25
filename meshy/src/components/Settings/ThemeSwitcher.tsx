import React, { useState, useCallback } from 'react';
import { getAllThemes, getTheme } from '../../themes/themeRegistry';
import styles from './ThemeSwitcher.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ThemeSwitcherProps {
    currentThemeId: string;
    onThemeChange: (themeId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Seletor de tema com acessibilidade completa.
 *
 * Renderiza um `<select>` listando todos os temas do registro pelo displayName.
 * A troca é imediata (sem botão "Salvar") — o onChange chama onThemeChange com o novo ID.
 * Inclui região aria-live para anunciar mudanças aos leitores de tela.
 */
export function ThemeSwitcher({
    currentThemeId,
    onThemeChange,
}: ThemeSwitcherProps): React.JSX.Element {
    // Texto anunciado pela região aria-live após troca de tema
    const [announcement, setAnnouncement] = useState('');

    const themes = getAllThemes();

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            const newId = e.target.value;
            const theme = getTheme(newId);
            onThemeChange(newId);
            setAnnouncement(`Tema alterado para ${theme.displayName}`);
        },
        [onThemeChange],
    );

    return (
        <div className={styles.themeSwitcher}>
            <select
                aria-label="Tema"
                value={currentThemeId}
                onChange={handleChange}
                className={styles.themeSelect}
            >
                {themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                        {theme.displayName}
                    </option>
                ))}
            </select>
            {/* Região aria-live — anuncia mudanças de tema para leitores de tela */}
            <span aria-live="polite" role="status" className={styles.srOnly}>
                {announcement}
            </span>
        </div>
    );
}
