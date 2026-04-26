import React, { useCallback, useRef } from 'react';
import { useIntl } from 'react-intl';
import { VscClose } from 'react-icons/vsc';
import { useFilterStore } from '../../store/filterStore';
import styles from './SearchBar.module.css';

// ─── Componente SearchBar ─────────────────────────────────────────────────────

/**
 * Barra de busca por nome de download.
 *
 * Dispara `setSearchTerm` no filterStore a cada keystroke.
 * O botão de limpar (×) aparece quando o campo não está vazio.
 * Pressionar Escape limpa o termo de busca.
 */
export function SearchBar(): React.JSX.Element {
    const intl = useIntl();
    const searchTerm = useFilterStore((state) => state.searchTerm);
    const setSearchTerm = useFilterStore((state) => state.setSearchTerm);
    const inputRef = useRef<HTMLInputElement>(null);

    // Atualiza o termo de busca a cada keystroke
    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setSearchTerm(e.target.value);
        },
        [setSearchTerm],
    );

    // Limpa o campo e devolve o foco ao input
    const handleClear = useCallback(() => {
        setSearchTerm('');
        inputRef.current?.focus();
    }, [setSearchTerm]);

    // Escape limpa o termo de busca
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Escape') {
                setSearchTerm('');
            }
        },
        [setSearchTerm],
    );

    return (
        <div className={styles.container}>
            <input
                ref={inputRef}
                type="text"
                className={styles.input}
                value={searchTerm}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={intl.formatMessage({ id: 'filter.search.placeholder' })}
                aria-label={intl.formatMessage({ id: 'filter.search.ariaLabel' })}
            />
            {searchTerm !== '' && (
                <button
                    type="button"
                    className={styles.clearButton}
                    onClick={handleClear}
                    aria-label={intl.formatMessage({ id: 'filter.search.clearAriaLabel' })}
                >
                    <VscClose />
                </button>
            )}
        </div>
    );
}
