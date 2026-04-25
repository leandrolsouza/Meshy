/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mock child components ────────────────────────────────────────────────────
// Mock heavy child components as simple divs with data-testid to isolate
// App layout/navigation logic from child component dependencies.

jest.mock('../../src/components/DownloadList/DownloadList', () => ({
    DownloadList: () => <div data-testid="download-list">DownloadList</div>,
}));

jest.mock('../../src/components/AddTorrent/DropZone', () => ({
    DropZone: () => <div data-testid="drop-zone">DropZone</div>,
}));

jest.mock('../../src/components/AddTorrent/AddTorrentModal', () => ({
    AddTorrentModal: () => <div data-testid="add-torrent-modal">AddTorrentModal</div>,
}));

jest.mock('../../src/components/Settings/SettingsPanel', () => ({
    SettingsPanel: () => <div data-testid="settings-panel">SettingsPanel</div>,
}));

// ─── Mock window.meshy ───────────────────────────────────────────────────────

const mockMeshy = {
    getAll: jest.fn().mockResolvedValue({ success: true, data: [] }),
    addMagnetLink: jest.fn().mockResolvedValue({ success: true, data: {} }),
    addTorrentFile: jest.fn().mockResolvedValue({ success: true, data: {} }),
    pause: jest.fn().mockResolvedValue({ success: true }),
    resume: jest.fn().mockResolvedValue({ success: true }),
    remove: jest.fn().mockResolvedValue({ success: true }),
    getSettings: jest.fn().mockResolvedValue({ success: true, data: {} }),
    setSettings: jest.fn().mockResolvedValue({ success: true, data: {} }),
    selectFolder: jest.fn().mockResolvedValue({ success: true, data: '' }),
    onProgress: jest.fn().mockReturnValue(() => { }),
    onError: jest.fn().mockReturnValue(() => { }),
};

beforeAll(() => {
    Object.defineProperty(window, 'meshy', {
        value: mockMeshy,
        writable: true,
    });
});

// ─── Import App after mocks are set up ───────────────────────────────────────

import App from '../../src/App';

// ─── Tests ────────────────────────────────────────────────────────────────────
// Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5

describe('App — layout structure and Activity Bar navigation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── Structural elements ───────────────────────────────────────────────

    it('renders all structural elements: Title Bar, Activity Bar, Editor Area, Status Bar', () => {
        render(<App />);

        // Title Bar — header with "Meshy" text
        expect(screen.getByText('Meshy')).toBeInTheDocument();

        // Activity Bar — nav with aria-label
        expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();

        // Editor Area — main element
        expect(screen.getByRole('main')).toBeInTheDocument();

        // Status Bar — footer with download count
        expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    // ── Default view ──────────────────────────────────────────────────────

    it('shows downloads view by default (DropZone + DownloadList)', () => {
        render(<App />);

        expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
        expect(screen.getByTestId('download-list')).toBeInTheDocument();

        // Other views should not be rendered
        expect(screen.queryByTestId('add-torrent-modal')).not.toBeInTheDocument();
        expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument();
    });

    // ── Navigation: Adicionar torrent ─────────────────────────────────────

    it('shows AddTorrentModal when clicking "Adicionar torrent" button', () => {
        render(<App />);

        fireEvent.click(screen.getByRole('button', { name: 'Adicionar torrent' }));

        expect(screen.getByTestId('add-torrent-modal')).toBeInTheDocument();
        expect(screen.queryByTestId('drop-zone')).not.toBeInTheDocument();
        expect(screen.queryByTestId('download-list')).not.toBeInTheDocument();
    });

    // ── Navigation: Configurações ─────────────────────────────────────────

    it('shows SettingsPanel when clicking "Configurações" button', () => {
        render(<App />);

        fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));

        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
        expect(screen.queryByTestId('drop-zone')).not.toBeInTheDocument();
        expect(screen.queryByTestId('download-list')).not.toBeInTheDocument();
    });

    // ── Navigation: back to Downloads ─────────────────────────────────────

    it('returns to downloads view when clicking "Downloads" button after navigating away', () => {
        render(<App />);

        // Navigate to settings first
        fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();

        // Navigate back to downloads
        fireEvent.click(screen.getByRole('button', { name: 'Downloads' }));
        expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
        expect(screen.getByTestId('download-list')).toBeInTheDocument();
        expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument();
    });

    // ── Only one view at a time ───────────────────────────────────────────

    it('renders only one view at a time', () => {
        render(<App />);

        // Switch to settings
        fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));

        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
        expect(screen.queryByTestId('drop-zone')).not.toBeInTheDocument();
        expect(screen.queryByTestId('download-list')).not.toBeInTheDocument();
        expect(screen.queryByTestId('add-torrent-modal')).not.toBeInTheDocument();

        // Switch to add-torrent
        fireEvent.click(screen.getByRole('button', { name: 'Adicionar torrent' }));

        expect(screen.getByTestId('add-torrent-modal')).toBeInTheDocument();
        expect(screen.queryByTestId('drop-zone')).not.toBeInTheDocument();
        expect(screen.queryByTestId('download-list')).not.toBeInTheDocument();
        expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument();
    });
});

// ─── Accessibility Tests ──────────────────────────────────────────────────────
// Requisitos: 1.4, 3.2

describe('App — accessibility', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('Activity Bar nav element has aria-label "Navegação principal"', () => {
        render(<App />);

        const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
        expect(nav).toBeInTheDocument();
        expect(nav.tagName).toBe('NAV');
    });

    it('Downloads button has aria-label "Downloads"', () => {
        render(<App />);

        const btn = screen.getByRole('button', { name: 'Downloads' });
        expect(btn).toBeInTheDocument();
        expect(btn).toHaveAttribute('aria-label', 'Downloads');
    });

    it('"Adicionar torrent" button has aria-label "Adicionar torrent"', () => {
        render(<App />);

        const btn = screen.getByRole('button', { name: 'Adicionar torrent' });
        expect(btn).toBeInTheDocument();
        expect(btn).toHaveAttribute('aria-label', 'Adicionar torrent');
    });

    it('"Configurações" button has aria-label "Configurações"', () => {
        render(<App />);

        const btn = screen.getByRole('button', { name: 'Configurações' });
        expect(btn).toBeInTheDocument();
        expect(btn).toHaveAttribute('aria-label', 'Configurações');
    });

    it('all Activity Bar buttons have title attributes matching their aria-labels', () => {
        render(<App />);

        const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
        const buttons = nav.querySelectorAll('button');

        expect(buttons.length).toBeGreaterThanOrEqual(3);

        buttons.forEach((button) => {
            const ariaLabel = button.getAttribute('aria-label');
            const title = button.getAttribute('title');

            expect(ariaLabel).toBeTruthy();
            expect(title).toBeTruthy();
            expect(title).toBe(ariaLabel);
        });
    });
});
