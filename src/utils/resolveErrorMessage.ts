import type { IntlShape } from 'react-intl';

/**
 * Resolve um código de erro do processo principal para uma string localizada.
 * Se o código de erro possui uma chave de tradução correspondente, retorna a string localizada.
 * Caso contrário, retorna o código de erro bruto como fallback.
 */
export function resolveErrorMessage(intl: IntlShape, errorCode: string): string {
    if (intl.messages[errorCode]) {
        return intl.formatMessage({ id: errorCode });
    }
    return errorCode;
}
