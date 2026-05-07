/** @jest-environment jsdom */

/**
 * Testes unitários para o componente GeneralTab.
 *
 * Verifica: exibição de metadados completos, fallbacks para campos null,
 * loading state, erro de IPC, botão copiar, e loading indicators em resolving-metadata.
 *
 * Requirements: 2.1, 2.3, 2.4, 2.5, 2.7, 2.8, 2.9, 2.10
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GeneralTab } from '../../../src/components/DownloadDetails/GeneralTab';
import { IPCResponse, TorrentMetadata } from '../../../shared/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetMetadata = jest.fn<Promise<IPCResponse<TorrentMetadata>>, [string]>();

beforeAll(() => {
    Object.defineProperty(window, 'meshy', {
        value: {
            getMetadata: mockGetMetadata,
        },
        writable: true,
    });
});

// Mock navigator.clipboard
const mockWriteText = jest.fn<Promise<void>, [string]>();

beforeAll(() => {
    Object.defineProperty(navigator, 'clipboard', {
        value: {
            writeText: mockWriteText,
        },
        writable: true,
    });
});

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockWriteText.mockResolvedValue(undefined);
});

afterEach(() => {
    jest.useRealTimers();
});

// ─── Dados de teste ───────────────────────────────────────────────────────────

const TEST_INFO_HASH = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

const COMPLETE_METADATA: TorrentMetadata = {
    infoHash: TEST_INFO_HASH,
    creator: 'Autor do Torrent',
    comment: 'Este é um comentário de teste',
    creationDate: 1700000000000, // 14/11/2023
};

const NULL_METADATA: TorrentMetadata = {
    infoHash: TEST_INFO_HASH,
    creator: null,
    comment: null,
    creationDate: null,
};

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('GeneralTab', () => {
    describe('exibição de metadados completos', () => {
        it('exibe criador, comentário, data de criação e info hash quando todos os campos estão presentes', async () => {
            mockGetMetadata.mockResolvedValue({
                success: true,
                data: COMPLETE_METADATA,
            });

            render(<GeneralTab infoHash={TEST_INFO_HASH} status="downloading" />);

            await waitFor(() => {
                expect(screen.getByTestId('creator-value')).toBeInTheDocument();
            });

            expect(screen.getByTestId('creator-value')).toHaveTextContent(
                'Autor do Torrent',
            );
            expect(screen.getByTestId('comment-value')).toHaveTextContent(
                'Este é um comentário de teste',
            );
            expect(screen.getByTestId('creation-date-value')).toBeInTheDocument();
            expect(screen.getByTestId('info-hash-value')).toHaveTextContent(
                TEST_INFO_HASH,
            );
        });

        it('formata a data de criação no formato dd/MM/yyyy HH:mm', async () => {
            mockGetMetadata.mockResolvedValue({
                success: true,
                data: COMPLETE_METADATA,
            });

            render(<GeneralTab infoHash={TEST_INFO_HASH} status="downloading" />);

            await waitFor(() => {
                expect(screen.getByTestId('creation-date-value')).toBeInTheDocument();
            });

            // O timestamp 1700000000000 corresponde a uma data específica
            // Verificamos que o formato segue dd/MM/yyyy HH:mm
            const dateText = screen.getByTestId('creation-date-value').textContent!;
            expect(dateText).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
        });
    });

    describe('fallbacks para campos null', () => {
        it('exibe "Desconhecido" quando creator é null', async () => {
            mockGetMetadata.mockResolvedValue({
                success: true,
                data: NULL_METADATA,
            });

            render(<GeneralTab infoHash={TEST_INFO_HASH} status="downloading" />);

            await waitFor(() => {
                expect(screen.getByTestId('creator-value')).toBeInTheDocument();
            });

            expect(screen.getByTestId('creator-value')).toHaveTextContent(
                'Desconhecido',
            );
        });

        it('exibe "Sem comentário" quando comment é null', async () => {
            mockGetMetadata.mockResolvedValue({
                success: true,
                data: NULL_METADATA,
            });

            render(<GeneralTab infoHash={TEST_INFO_HASH} status="downloading" />);

            await waitFor(() => {
                expect(screen.getByTestId('comment-value')).toBeInTheDocument();
            });

            expect(screen.getByTestId('comment-value')).toHaveTextContent(
                'Sem comentário',
            );
        });

        it('exibe "Desconhecida" quando creationDate é null', async () => {
            mockGetMetadata.mockResolvedValue({
                success: true,
                data: NULL_METADATA,
            });

            render(<GeneralTab infoHash={TEST_INFO_HASH} status="downloading" />);

            await waitFor(() => {
                expect(screen.getByTestId('creation-date-value')).toBeInTheDocument();
            });

            expect(screen.getByTestId('creation-date-value')).toHaveTextContent(
                'Desconhecida',
            );
        });

        it('exibe info hash normalmente mesmo quando outros campos são null', async () => {
            mockGetMetadata.mockResolvedValue({
                success: true,
                data: NULL_METADATA,
            });

            render(<GeneralTab infoHash={TEST_INFO_HASH} status="downloading" />);

            await waitFor(() => {
                expect(screen.getByTestId('info-hash-value')).toBeInTheDocument();
            });

            expect(screen.getByTestId('info-hash-value')).toHaveTextContent(
                TEST_INFO_HASH,
            );
        });
    });

    describe('loading state', () => {
        it('exibe estado de loading enquanto aguarda resposta IPC', () => {
            // Nunca resolve a promise para manter o loading
            mockGetMetadata.mockReturnValue(new Promise(() => { }));

            render(<GeneralTab infoHash={TEST_INFO_HASH} status="downloading" />);

            expect(screen.getByTestId('general-tab-loading')).toBeInTheDocument();
            expect(screen.getByTestId('general-tab-loading')).toHaveTextContent(
                'Carregando metadados...',
            );
        });

        it('remove o loading state após receber resposta', async () => {
            mockGetMetadata.mockResolvedValue({
                success: true,
                data: COMPLETE_METADATA,
            });

            render(<GeneralTab infoHash={TEST_INFO_HASH} status="downloading" />);

            await waitFor(() => {
                expect(
                    screen.queryByTestId('general-tab-loading'),
                ).not.toBeInTheDocument();
            });
        });
    });

    describe('erro de IPC', () => {
        it('exibe mensagem de erro quando IPC retorna success: false', async () => {
            mockGetMetadata.mockResolvedValue({
                success: false,
                error: 'Torrent não encontrado',
            });

            render(<GeneralTab infoHash={TEST_INFO_HASH} status="downloading" />);

            await waitFor(() => {
                expect(screen.getByTestId('general-tab-error')).toBeInTheDocument();
            });

            expect(screen.getByTestId('general-tab-error')).toHaveTextContent(
                'Não foi possível carregar os metadados.',
            );
        });

        it('exibe mensagem de erro quando IPC lança exceção', async () => {
            mockGetMetadata.mockRejectedValue(new Error('Network error'));

            render(<GeneralTab infoHash={TEST_INFO_HASH} status="downloading" />);

            await waitFor(() => {
                expect(screen.getByTestId('general-tab-error')).toBeInTheDocument();
            });

            expect(screen.getByTestId('general-tab-error')).toHaveTextContent(
                'Não foi possível carregar os metadados.',
            );
        });
    });

    describe('botão copiar info hash', () => {
        it('copia o infoHash para a área de transferência ao clicar', async () => {
            mockGetMetadata.mockResolvedValue({
                success: true,
                data: COMPLETE_METADATA,
            });

            render(<GeneralTab infoHash={TEST_INFO_HASH} status="downloading" />);

            await waitFor(() => {
                expect(
                    screen.getByTestId('copy-info-hash-button'),
                ).toBeInTheDocument();
            });

            await act(async () => {
                fireEvent.click(screen.getByTestId('copy-info-hash-button'));
            });

            expect(mockWriteText).toHaveBeenCalledWith(TEST_INFO_HASH);
        });

        it('exibe "Copiado!" como feedback após copiar', async () => {
            mockGetMetadata.mockResolvedValue({
                success: true,
                data: COMPLETE_METADATA,
            });

            render(<GeneralTab infoHash={TEST_INFO_HASH} status="downloading" />);

            await waitFor(() => {
                expect(
                    screen.getByTestId('copy-info-hash-button'),
                ).toBeInTheDocument();
            });

            await act(async () => {
                fireEvent.click(screen.getByTestId('copy-info-hash-button'));
            });

            expect(screen.getByTestId('copy-info-hash-button')).toHaveTextContent(
                'Copiado!',
            );
        });

        it('reverte o texto do botão para "Copiar" após 2 segundos', async () => {
            mockGetMetadata.mockResolvedValue({
                success: true,
                data: COMPLETE_METADATA,
            });

            render(<GeneralTab infoHash={TEST_INFO_HASH} status="downloading" />);

            await waitFor(() => {
                expect(
                    screen.getByTestId('copy-info-hash-button'),
                ).toBeInTheDocument();
            });

            await act(async () => {
                fireEvent.click(screen.getByTestId('copy-info-hash-button'));
            });

            expect(screen.getByTestId('copy-info-hash-button')).toHaveTextContent(
                'Copiado!',
            );

            // Avança 2 segundos
            act(() => {
                jest.advanceTimersByTime(2000);
            });

            expect(screen.getByTestId('copy-info-hash-button')).toHaveTextContent(
                'Copiar',
            );
        });

        it('exibe "Copiar" inicialmente no botão', async () => {
            mockGetMetadata.mockResolvedValue({
                success: true,
                data: COMPLETE_METADATA,
            });

            render(<GeneralTab infoHash={TEST_INFO_HASH} status="downloading" />);

            await waitFor(() => {
                expect(
                    screen.getByTestId('copy-info-hash-button'),
                ).toBeInTheDocument();
            });

            expect(screen.getByTestId('copy-info-hash-button')).toHaveTextContent(
                'Copiar',
            );
        });
    });

    describe('loading indicators em resolving-metadata', () => {
        it('exibe loading indicators para criador, comentário e data quando status é "resolving-metadata" e metadata não carregou', () => {
            // Nunca resolve para manter metadata como null
            mockGetMetadata.mockReturnValue(new Promise(() => { }));

            render(
                <GeneralTab infoHash={TEST_INFO_HASH} status="resolving-metadata" />,
            );

            // Em resolving-metadata, não mostra o loading genérico, mostra o container com indicators
            expect(screen.getByTestId('creator-loading')).toBeInTheDocument();
            expect(screen.getByTestId('comment-loading')).toBeInTheDocument();
            expect(screen.getByTestId('creation-date-loading')).toBeInTheDocument();
        });

        it('exibe info hash normalmente mesmo em resolving-metadata', () => {
            mockGetMetadata.mockReturnValue(new Promise(() => { }));

            render(
                <GeneralTab infoHash={TEST_INFO_HASH} status="resolving-metadata" />,
            );

            expect(screen.getByTestId('info-hash-value')).toHaveTextContent(
                TEST_INFO_HASH,
            );
        });

        it('substitui loading indicators por valores quando metadata é recebida em resolving-metadata', async () => {
            mockGetMetadata.mockResolvedValue({
                success: true,
                data: COMPLETE_METADATA,
            });

            render(
                <GeneralTab infoHash={TEST_INFO_HASH} status="resolving-metadata" />,
            );

            await waitFor(() => {
                expect(screen.getByTestId('creator-value')).toBeInTheDocument();
            });

            expect(screen.getByTestId('creator-value')).toHaveTextContent(
                'Autor do Torrent',
            );
            expect(
                screen.queryByTestId('creator-loading'),
            ).not.toBeInTheDocument();
        });
    });
});
