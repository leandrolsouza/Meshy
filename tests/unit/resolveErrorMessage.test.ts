import { createIntl, createIntlCache } from 'react-intl';
import { resolveErrorMessage } from '../../src/utils/resolveErrorMessage';

const cache = createIntlCache();

function makeIntl(messages: Record<string, string>) {
    return createIntl({ locale: 'pt-BR', messages }, cache);
}

describe('resolveErrorMessage', () => {
    it('returns the localized string when the error code has a translation', () => {
        const intl = makeIntl({ 'error.torrent.duplicate': 'Torrent já existe na lista.' });
        expect(resolveErrorMessage(intl, 'error.torrent.duplicate')).toBe(
            'Torrent já existe na lista.',
        );
    });

    it('returns the raw error code when no translation exists', () => {
        const intl = makeIntl({});
        expect(resolveErrorMessage(intl, 'error.unknown.code')).toBe('error.unknown.code');
    });

    it('returns the raw string for legacy non-code error strings', () => {
        const intl = makeIntl({ 'error.torrent.duplicate': 'Torrent já existe na lista.' });
        expect(resolveErrorMessage(intl, 'Some legacy error string')).toBe(
            'Some legacy error string',
        );
    });

    it('handles all known error codes from the translation file', () => {
        const messages = {
            'error.torrent.invalidFilePath': 'Caminho de arquivo inválido.',
            'error.engine.restarting': 'Motor de torrents está reiniciando.',
            'error.params.invalid': 'Parâmetros inválidos.',
        };
        const intl = makeIntl(messages);

        expect(resolveErrorMessage(intl, 'error.torrent.invalidFilePath')).toBe(
            'Caminho de arquivo inválido.',
        );
        expect(resolveErrorMessage(intl, 'error.engine.restarting')).toBe(
            'Motor de torrents está reiniciando.',
        );
        expect(resolveErrorMessage(intl, 'error.params.invalid')).toBe('Parâmetros inválidos.');
    });
});
