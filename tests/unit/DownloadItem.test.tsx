/**
 * @jest-environment jsdom
 */

/**
 * Testes de componente para o DownloadItem.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import '@testing-library/jest-dom';
import { DownloadItem } from '../../src/components/DownloadList/DownloadItem';
import type { DownloadItem as DownloadItemType } from '../../shared/types';
import ptBR from '../../src/locales/pt-BR.json';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderWithIntl(ui: React.ReactElement) {
    return render(
        <IntlProvider locale="pt-BR" messages={ptBR}>
            {ui}
        </IntlProvider>,
    );
}

function createItem(overrides: Partial<DownloadItemType> = {}): DownloadItemType {
    return {
        infoHash: 'abc123def456abc123def456abc123def456abc1',
        name: 'Test Torrent',
        totalSize: 1_000_000,
        downloadedSize: 500_000,
        progress: 0.5,
        downloadSpeed: 100_000,
        uploadSpeed: 50_000,
        numPeers: 5,
        numSeeders: 3,
        timeRemaining: 60_000,
        status: 'downloading',
        destinationFolder: '/tmp/downloads',
        addedAt: Date.now(),
        ...overrides,
    };
}

const defaultProps = {
    onPause: jest.fn(),
    onResume: jest.fn(),
    onRemove: jest.fn(),
    queueSize: 0,
    onMoveUp: jest.fn(),
    onMoveDown: jest.fn(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DownloadItem — renderização básica', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renderiza o nome do torrent', () => {
        renderWithIntl(<DownloadItem item={createItem()} {...defaultProps} />);
        expect(screen.getByText('Test Torrent')).toBeInTheDocument();
    });

    it('renderiza o status do torrent', () => {
        renderWithIntl(<DownloadItem item={createItem()} {...defaultProps} />);
        expect(screen.getByText('Baixando')).toBeInTheDocument();
    });
});
