/**
 * @jest-environment jsdom
 */

/**
 * Testes de componente para os campos de limite de velocidade no DownloadItem.
 *
 * Feature: per-torrent-speed-limit
 * Valida: Requisitos 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import '@testing-library/jest-dom';
import type { DownloadItem as DownloadItemType } from '../../shared/types';

// ─── Mock child components ────────────────────────────────────────────────────

jest.mock('../../src/components/FileSelector/FileSelector', () => ({
    FileSelector: () => <div data-testid="file-selector">FileSelector</div>,
}));

jest.mock('../../src/components/TrackerPanel/TrackerPanel', () => ({
    TrackerPanel: () => <div data-testid="tracker-panel">TrackerPanel</div>,
}));

jest.mock('../../src/components/common/ProgressBar', () => ({
    ProgressBar: () => <div data-testid="progress-bar">ProgressBar</div>,
}));

jest.mock('../../src/components/common/SpeedDisplay', () => ({
    SpeedDisplay: () => <span data-testid="speed-display">SpeedDisplay</span>,
}));

jest.mock('../../src/components/common/ConfirmDialog', () => ({
    ConfirmDialog: () => null,
}));

// ─── Mock window.meshy ───────────────────────────────────────────────────────

const mockMeshy = {
    getFiles: jest.fn().mockResolvedValue({ success: true, data: [] }),
    setFileSelection: jest.fn().mockResolvedValue({ success: true, data: [] }),
};

beforeAll(() => {
    Object.defineProperty(window, 'meshy', {
        value: mockMeshy,
        writable: true,
    });
});

// ─── Import after mocks ──────────────────────────────────────────────────────

import { DownloadItem } from '../../src/components/DownloadList/DownloadItem';
import ptBR from '../../src/locales/pt-BR.json';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderWithIntl(ui: React.ReactElement) {
    return render(
        <IntlProvider locale="pt-BR" defaultLocale="pt-BR" messages={ptBR}>
            {ui}
        </IntlProvider>,
    );
}

function createItem(overrides: Partial<DownloadItemType> = {}): DownloadItemType {
    return {
        infoHash: 'abc123def456abc123def456abc123def456abc1',
        name: 'Test Torrent',
        totalSize: 1024 * 1024 * 100,
        downloadedSize: 1024 * 1024 * 50,
        progress: 0.5,
        downloadSpeed: 1024 * 100,
        uploadSpeed: 1024 * 50,
        numPeers: 10,
        numSeeders: 5,
        timeRemaining: 60000,
        status: 'downloading',
        destinationFolder: '/tmp/downloads',
        addedAt: Date.now(),
        downloadSpeedLimitKBps: 0,
        uploadSpeedLimitKBps: 0,
        ...overrides,
    };
}

const defaultProps = {
    onPause: jest.fn(),
    onResume: jest.fn(),
    onRemove: jest.fn(),
    onSetSpeedLimits: jest.fn().mockResolvedValue({ success: true, data: createItem() }),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DownloadItem — campos de limite de velocidade', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        defaultProps.onSetSpeedLimits.mockResolvedValue({ success: true, data: createItem() });
    });

    // ── 8.1: Renderização dos campos na seção expandida ──────────────────

    describe('renderização dos campos de limite (Req 8.1)', () => {
        it('não exibe campos de limite quando o item não está expandido', () => {
            renderWithIntl(<DownloadItem item={createItem()} {...defaultProps} />);

            expect(screen.queryByTestId('speed-limits-section')).not.toBeInTheDocument();
        });

        it('exibe campos de limite de download e upload ao expandir', () => {
            renderWithIntl(<DownloadItem item={createItem()} {...defaultProps} />);

            // Expandir o item
            fireEvent.click(screen.getByRole('button', { name: /Expandir lista de arquivos/i }));

            expect(screen.getByTestId('speed-limits-section')).toBeInTheDocument();
            expect(screen.getByLabelText('Limite de download (KB/s)')).toBeInTheDocument();
            expect(screen.getByLabelText('Limite de upload (KB/s)')).toBeInTheDocument();
        });

        it('exibe os valores atuais nos campos de limite', () => {
            const item = createItem({
                downloadSpeedLimitKBps: 500,
                uploadSpeedLimitKBps: 200,
            });
            renderWithIntl(<DownloadItem item={item} {...defaultProps} />);

            fireEvent.click(screen.getByRole('button', { name: /Expandir lista de arquivos/i }));

            const dlInput = screen.getByLabelText('Limite de download (KB/s)') as HTMLInputElement;
            const ulInput = screen.getByLabelText('Limite de upload (KB/s)') as HTMLInputElement;

            expect(dlInput.value).toBe('500');
            expect(ulInput.value).toBe('200');
        });

        it('exibe botão "Aplicar" para confirmar alterações', () => {
            renderWithIntl(<DownloadItem item={createItem()} {...defaultProps} />);

            fireEvent.click(screen.getByRole('button', { name: /Expandir lista de arquivos/i }));

            expect(
                screen.getByRole('button', { name: 'Aplicar limites de velocidade' }),
            ).toBeInTheDocument();
        });
    });

    // ── 8.2: Validação client-side com isValidSpeedLimit ─────────────────

    describe('validação client-side (Req 8.2)', () => {
        it('exibe erro de validação para valor negativo de download', async () => {
            renderWithIntl(<DownloadItem item={createItem()} {...defaultProps} />);

            fireEvent.click(screen.getByRole('button', { name: /Expandir lista de arquivos/i }));

            const dlInput = screen.getByLabelText('Limite de download (KB/s)');
            fireEvent.change(dlInput, { target: { value: '-5' } });

            fireEvent.click(screen.getByRole('button', { name: 'Aplicar limites de velocidade' }));

            expect(
                screen.getByText('Valor inválido: deve ser um inteiro não-negativo'),
            ).toBeInTheDocument();
            expect(defaultProps.onSetSpeedLimits).not.toHaveBeenCalled();
        });

        it('exibe erro de validação para valor decimal de upload', async () => {
            renderWithIntl(<DownloadItem item={createItem()} {...defaultProps} />);

            fireEvent.click(screen.getByRole('button', { name: /Expandir lista de arquivos/i }));

            const ulInput = screen.getByLabelText('Limite de upload (KB/s)');
            fireEvent.change(ulInput, { target: { value: '3.5' } });

            fireEvent.click(screen.getByRole('button', { name: 'Aplicar limites de velocidade' }));

            expect(
                screen.getByText('Valor inválido: deve ser um inteiro não-negativo'),
            ).toBeInTheDocument();
            expect(defaultProps.onSetSpeedLimits).not.toHaveBeenCalled();
        });

        it('não exibe erro e chama IPC para valores válidos', async () => {
            renderWithIntl(<DownloadItem item={createItem()} {...defaultProps} />);

            fireEvent.click(screen.getByRole('button', { name: /Expandir lista de arquivos/i }));

            const dlInput = screen.getByLabelText('Limite de download (KB/s)');
            const ulInput = screen.getByLabelText('Limite de upload (KB/s)');
            fireEvent.change(dlInput, { target: { value: '100' } });
            fireEvent.change(ulInput, { target: { value: '50' } });

            await act(async () => {
                fireEvent.click(
                    screen.getByRole('button', { name: 'Aplicar limites de velocidade' }),
                );
            });

            expect(
                screen.queryByText('Valor inválido: deve ser um inteiro não-negativo'),
            ).not.toBeInTheDocument();
            expect(defaultProps.onSetSpeedLimits).toHaveBeenCalledWith(
                'abc123def456abc123def456abc123def456abc1',
                100,
                50,
            );
        });
    });

    // ── 8.3: Estados de loading e erro ───────────────────────────────────

    describe('estados de loading e erro (Req 8.3, 8.4)', () => {
        it('exibe "Aplicando..." e desabilita inputs durante chamada IPC', async () => {
            // Criar uma promise que podemos controlar
            let resolveIpc: (value: { success: boolean; data: DownloadItemType }) => void;
            const ipcPromise = new Promise<{ success: boolean; data: DownloadItemType }>(
                (resolve) => {
                    resolveIpc = resolve;
                },
            );
            defaultProps.onSetSpeedLimits.mockReturnValue(ipcPromise);

            renderWithIntl(<DownloadItem item={createItem()} {...defaultProps} />);

            fireEvent.click(screen.getByRole('button', { name: /Expandir lista de arquivos/i }));

            await act(async () => {
                fireEvent.click(
                    screen.getByRole('button', { name: 'Aplicar limites de velocidade' }),
                );
            });

            // Verificar estado de loading
            expect(screen.getByText('Aplicando...')).toBeInTheDocument();
            expect(screen.getByLabelText('Limite de download (KB/s)')).toBeDisabled();
            expect(screen.getByLabelText('Limite de upload (KB/s)')).toBeDisabled();

            // Resolver a promise
            await act(async () => {
                resolveIpc!({ success: true, data: createItem() });
            });

            // Verificar que loading terminou
            expect(screen.queryByText('Aplicando...')).not.toBeInTheDocument();
            expect(screen.getByLabelText('Limite de download (KB/s)')).not.toBeDisabled();
        });

        it('exibe mensagem de erro quando IPC retorna erro', async () => {
            defaultProps.onSetSpeedLimits.mockResolvedValue({
                success: false,
                error: 'Torrent não encontrado',
            });

            renderWithIntl(<DownloadItem item={createItem()} {...defaultProps} />);

            fireEvent.click(screen.getByRole('button', { name: /Expandir lista de arquivos/i }));

            await act(async () => {
                fireEvent.click(
                    screen.getByRole('button', { name: 'Aplicar limites de velocidade' }),
                );
            });

            await waitFor(() => {
                expect(screen.getByTestId('speed-limits-error')).toHaveTextContent(
                    'Torrent não encontrado',
                );
            });
        });

        it('exibe mensagem de erro quando IPC lança exceção', async () => {
            defaultProps.onSetSpeedLimits.mockRejectedValue(new Error('Falha de conexão'));

            renderWithIntl(<DownloadItem item={createItem()} {...defaultProps} />);

            fireEvent.click(screen.getByRole('button', { name: /Expandir lista de arquivos/i }));

            await act(async () => {
                fireEvent.click(
                    screen.getByRole('button', { name: 'Aplicar limites de velocidade' }),
                );
            });

            await waitFor(() => {
                expect(screen.getByTestId('speed-limits-error')).toHaveTextContent(
                    'Falha de conexão',
                );
            });
        });
    });

    // ── 8.4: Indicação visual quando limite é 0 ─────────────────────────

    describe('indicação visual para limite 0 (Req 8.5)', () => {
        it('exibe "Usando limite global" quando ambos os limites são 0', () => {
            renderWithIntl(<DownloadItem item={createItem()} {...defaultProps} />);

            fireEvent.click(screen.getByRole('button', { name: /Expandir lista de arquivos/i }));

            const hints = screen.getAllByText('Usando limite global');
            expect(hints).toHaveLength(2);
        });

        it('não exibe "Usando limite global" quando limites são maiores que 0', () => {
            const item = createItem({
                downloadSpeedLimitKBps: 100,
                uploadSpeedLimitKBps: 50,
            });
            renderWithIntl(<DownloadItem item={item} {...defaultProps} />);

            fireEvent.click(screen.getByRole('button', { name: /Expandir lista de arquivos/i }));

            expect(screen.queryByText('Usando limite global')).not.toBeInTheDocument();
        });

        it('exibe "Usando limite global" apenas para o campo com valor 0', () => {
            const item = createItem({
                downloadSpeedLimitKBps: 100,
                uploadSpeedLimitKBps: 0,
            });
            renderWithIntl(<DownloadItem item={item} {...defaultProps} />);

            fireEvent.click(screen.getByRole('button', { name: /Expandir lista de arquivos/i }));

            const hints = screen.getAllByText('Usando limite global');
            expect(hints).toHaveLength(1);
        });
    });

    // ── Não exibe campos para torrents que não podem expandir ────────────

    describe('estados que não permitem expansão', () => {
        it('não exibe botão de expandir para torrent em resolving-metadata', () => {
            const item = createItem({ status: 'resolving-metadata' });
            renderWithIntl(<DownloadItem item={item} {...defaultProps} />);

            expect(
                screen.queryByRole('button', { name: /Expandir lista de arquivos/i }),
            ).not.toBeInTheDocument();
        });

        it('não exibe botão de expandir para torrent na fila', () => {
            const item = createItem({ status: 'queued' });
            renderWithIntl(<DownloadItem item={item} {...defaultProps} />);

            expect(
                screen.queryByRole('button', { name: /Expandir lista de arquivos/i }),
            ).not.toBeInTheDocument();
        });
    });
});
