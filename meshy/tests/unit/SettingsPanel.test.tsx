/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mock dependências pesadas ────────────────────────────────────────────────

jest.mock('react-icons/vsc', () => ({
    VscTrash: () => <span data-testid="vsc-trash">trash</span>,
}));

jest.mock('../../src/themes/themeApplier', () => ({
    applyTheme: jest.fn(),
}));

jest.mock('../../src/themes/themeRegistry', () => ({
    DEFAULT_THEME_ID: 'vs-code-dark',
    isValidThemeId: jest.fn().mockReturnValue(true),
    getAllThemes: jest.fn().mockReturnValue([]),
    getTheme: jest.fn().mockReturnValue({ id: 'vs-code-dark', displayName: 'VS Code Dark' }),
}));

jest.mock('../../src/components/Settings/ThemeSwitcher', () => ({
    ThemeSwitcher: () => <div data-testid="theme-switcher">ThemeSwitcher</div>,
}));

// ─── Configurações padrão para mock ──────────────────────────────────────────

const defaultSettings = {
    destinationFolder: '/downloads',
    downloadSpeedLimit: 0,
    uploadSpeedLimit: 0,
    maxConcurrentDownloads: 3,
    notificationsEnabled: true,
    theme: 'vs-code-dark',
    globalTrackers: [],
    autoApplyGlobalTrackers: false,
    dhtEnabled: true,
    pexEnabled: true,
    utpEnabled: true,
};

// ─── Mock window.meshy ───────────────────────────────────────────────────────

const mockGetSettings = jest.fn();
const mockSetSettings = jest.fn();
const mockSelectFolder = jest.fn();
const mockGetGlobalTrackers = jest.fn();
const mockAddGlobalTracker = jest.fn();
const mockRemoveGlobalTracker = jest.fn();

const mockMeshy = {
    getSettings: mockGetSettings,
    setSettings: mockSetSettings,
    selectFolder: mockSelectFolder,
    getGlobalTrackers: mockGetGlobalTrackers,
    addGlobalTracker: mockAddGlobalTracker,
    removeGlobalTracker: mockRemoveGlobalTracker,
    getAll: jest.fn().mockResolvedValue({ success: true, data: [] }),
    addMagnetLink: jest.fn(),
    addTorrentFile: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    remove: jest.fn(),
    getFiles: jest.fn(),
    setFileSelection: jest.fn(),
    getTrackers: jest.fn(),
    addTracker: jest.fn(),
    removeTracker: jest.fn(),
    applyGlobalTrackers: jest.fn(),
    setTorrentSpeedLimits: jest.fn(),
    getTorrentSpeedLimits: jest.fn(),
    onProgress: jest.fn().mockReturnValue(() => { }),
    onError: jest.fn().mockReturnValue(() => { }),
};

beforeAll(() => {
    Object.defineProperty(window, 'meshy', {
        value: mockMeshy,
        writable: true,
    });
});

// ─── Import após mocks ──────────────────────────────────────────────────────

import { SettingsPanel } from '../../src/components/Settings/SettingsPanel';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupMocks(settingsOverrides: Partial<typeof defaultSettings> = {}) {
    const settings = { ...defaultSettings, ...settingsOverrides };
    mockGetSettings.mockResolvedValue({ success: true, data: settings });
    mockSetSettings.mockResolvedValue({ success: true, data: settings });
    mockSelectFolder.mockResolvedValue({ success: true, data: '/downloads' });
    mockGetGlobalTrackers.mockResolvedValue({ success: true, data: [] });
    mockAddGlobalTracker.mockResolvedValue({ success: true, data: [] });
    mockRemoveGlobalTracker.mockResolvedValue({ success: true, data: [] });
    return settings;
}

/**
 * Aguarda o carregamento das configurações e navega para a aba "Rede".
 */
async function navigateToNetworkTab() {
    // Aguarda o painel carregar (aba "Geral" é a padrão)
    await screen.findByText('Configurações');
    // Clica na aba "Rede"
    const networkTab = await screen.findByRole('tab', { name: 'Rede' });
    fireEvent.click(networkTab);
}

// ─── Testes da navegação por abas ────────────────────────────────────────────

describe('SettingsPanel — navegação por abas', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renderiza as quatro abas: Geral, Transferências, Rede, Trackers', async () => {
        setupMocks();
        render(<SettingsPanel isOpen={true} onClose={jest.fn()} />);

        await screen.findByText('Configurações');

        expect(screen.getByRole('tab', { name: 'Geral' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Transferências' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Rede' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Trackers' })).toBeInTheDocument();
    });

    it('aba "Geral" é a aba ativa por padrão', async () => {
        setupMocks();
        render(<SettingsPanel isOpen={true} onClose={jest.fn()} />);

        await screen.findByText('Configurações');

        const generalTab = screen.getByRole('tab', { name: 'Geral' });
        expect(generalTab).toHaveAttribute('aria-selected', 'true');
    });

    it('clicar em uma aba muda o conteúdo exibido', async () => {
        setupMocks();
        render(<SettingsPanel isOpen={true} onClose={jest.fn()} />);

        await screen.findByText('Configurações');

        // Aba Geral mostra pasta de destino
        expect(screen.getByLabelText('Pasta de destino')).toBeInTheDocument();

        // Navega para Transferências
        fireEvent.click(screen.getByRole('tab', { name: 'Transferências' }));
        expect(
            screen.getByLabelText('Limite de download (KB/s, 0 = sem limite)'),
        ).toBeInTheDocument();

        // Navega para Rede
        fireEvent.click(screen.getByRole('tab', { name: 'Rede' }));
        expect(screen.getByLabelText('DHT (Distributed Hash Table)')).toBeInTheDocument();

        // Navega para Trackers
        fireEvent.click(screen.getByRole('tab', { name: 'Trackers' }));
        expect(screen.getByText('Trackers Globais (Favoritos)')).toBeInTheDocument();
    });
});

// ─── Testes da seção "Rede avançada" (agora na aba "Rede") ──────────────────
// Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7

describe('SettingsPanel — seção Rede avançada', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── Renderização dos três checkboxes (Req 5.1) ───────────────────────

    it('renderiza os três checkboxes DHT, PEX e uTP na aba Rede', async () => {
        setupMocks();
        render(<SettingsPanel isOpen={true} onClose={jest.fn()} />);

        await navigateToNetworkTab();

        expect(screen.getByLabelText('DHT (Distributed Hash Table)')).toBeInTheDocument();
        expect(screen.getByLabelText('PEX (Peer Exchange)')).toBeInTheDocument();
        expect(screen.getByLabelText('uTP (Micro Transport Protocol)')).toBeInTheDocument();
    });

    // ── Checkboxes são do tipo checkbox ──────────────────────────────────

    it('os três controles de rede são checkboxes', async () => {
        setupMocks();
        render(<SettingsPanel isOpen={true} onClose={jest.fn()} />);

        await navigateToNetworkTab();

        const dht = screen.getByLabelText('DHT (Distributed Hash Table)');
        const pex = screen.getByLabelText('PEX (Peer Exchange)');
        const utp = screen.getByLabelText('uTP (Micro Transport Protocol)');

        expect(dht).toHaveAttribute('type', 'checkbox');
        expect(pex).toHaveAttribute('type', 'checkbox');
        expect(utp).toHaveAttribute('type', 'checkbox');
    });

    // ── Texto informativo sobre reinício (Req 5.3) ──────────────────────

    it('exibe texto informativo sobre reinício do motor abaixo dos toggles', async () => {
        setupMocks();
        render(<SettingsPanel isOpen={true} onClose={jest.fn()} />);

        await navigateToNetworkTab();

        expect(
            screen.getByText(/Alterar essas opções reinicia o motor de torrents/),
        ).toBeInTheDocument();
    });

    // ── Sincronização com settings carregados (Req 5.2) ─────────────────

    it('checkboxes refletem os valores carregados — todos habilitados', async () => {
        setupMocks({ dhtEnabled: true, pexEnabled: true, utpEnabled: true });
        render(<SettingsPanel isOpen={true} onClose={jest.fn()} />);

        await navigateToNetworkTab();

        expect(screen.getByLabelText('DHT (Distributed Hash Table)')).toBeChecked();
        expect(screen.getByLabelText('PEX (Peer Exchange)')).toBeChecked();
        expect(screen.getByLabelText('uTP (Micro Transport Protocol)')).toBeChecked();
    });

    it('checkboxes refletem os valores carregados — todos desabilitados', async () => {
        setupMocks({ dhtEnabled: false, pexEnabled: false, utpEnabled: false });
        render(<SettingsPanel isOpen={true} onClose={jest.fn()} />);

        await navigateToNetworkTab();

        expect(screen.getByLabelText('DHT (Distributed Hash Table)')).not.toBeChecked();
        expect(screen.getByLabelText('PEX (Peer Exchange)')).not.toBeChecked();
        expect(screen.getByLabelText('uTP (Micro Transport Protocol)')).not.toBeChecked();
    });

    it('checkboxes refletem combinação mista de valores carregados', async () => {
        setupMocks({ dhtEnabled: true, pexEnabled: false, utpEnabled: true });
        render(<SettingsPanel isOpen={true} onClose={jest.fn()} />);

        await navigateToNetworkTab();

        expect(screen.getByLabelText('DHT (Distributed Hash Table)')).toBeChecked();
        expect(screen.getByLabelText('PEX (Peer Exchange)')).not.toBeChecked();
        expect(screen.getByLabelText('uTP (Micro Transport Protocol)')).toBeChecked();
    });

    // ── Toggle altera estado local ──────────────────────────────────────

    it('clicar em um checkbox altera seu estado', async () => {
        setupMocks({ dhtEnabled: true });
        render(<SettingsPanel isOpen={true} onClose={jest.fn()} />);

        await navigateToNetworkTab();

        const dhtCheckbox = screen.getByLabelText('DHT (Distributed Hash Table)');
        expect(dhtCheckbox).toBeChecked();

        fireEvent.click(dhtCheckbox);
        expect(dhtCheckbox).not.toBeChecked();

        fireEvent.click(dhtCheckbox);
        expect(dhtCheckbox).toBeChecked();
    });

    // ── handleSave inclui configurações de rede (Req 5.4) ───────────────

    it('salvar envia dhtEnabled, pexEnabled e utpEnabled ao processo principal', async () => {
        const settings = setupMocks();
        mockSetSettings.mockResolvedValue({ success: true, data: settings });

        render(<SettingsPanel isOpen={true} onClose={jest.fn()} />);

        await navigateToNetworkTab();

        // Submeter o formulário
        const saveButton = screen.getByRole('button', { name: 'Salvar' });
        await act(async () => {
            fireEvent.click(saveButton);
        });

        expect(mockSetSettings).toHaveBeenCalledWith(
            expect.objectContaining({
                dhtEnabled: true,
                pexEnabled: true,
                utpEnabled: true,
            }),
        );
    });

    // ── Estado de reinício no botão (Req 5.5) ───────────────────────────

    it('botão exibe "Reiniciando motor..." quando configurações de rede mudam', async () => {
        setupMocks({ dhtEnabled: true, pexEnabled: true, utpEnabled: true });

        // Simular setSettings que demora para resolver
        let resolveSetSettings: (value: unknown) => void;
        const setSettingsPromise = new Promise((resolve) => {
            resolveSetSettings = resolve;
        });
        mockSetSettings.mockReturnValue(setSettingsPromise);

        render(<SettingsPanel isOpen={true} onClose={jest.fn()} />);

        await navigateToNetworkTab();

        // Desabilitar DHT para causar mudança de rede
        const dhtCheckbox = screen.getByLabelText('DHT (Distributed Hash Table)');
        fireEvent.click(dhtCheckbox);

        // Submeter o formulário
        const saveButton = screen.getByRole('button', { name: 'Salvar' });
        await act(async () => {
            fireEvent.click(saveButton);
        });

        // Botão deve exibir "Reiniciando motor..."
        expect(screen.getByRole('button', { name: 'Reiniciando motor...' })).toBeInTheDocument();

        // Resolver a promise para limpar o estado
        await act(async () => {
            resolveSetSettings!({ success: true, data: defaultSettings });
        });

        // Botão deve voltar ao estado normal
        expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    });

    // ── Botão exibe "Salvando..." quando não há mudança de rede ─────────

    it('botão exibe "Salvando..." quando não há mudança de rede', async () => {
        setupMocks();

        let resolveSetSettings: (value: unknown) => void;
        const setSettingsPromise = new Promise((resolve) => {
            resolveSetSettings = resolve;
        });
        mockSetSettings.mockReturnValue(setSettingsPromise);

        render(<SettingsPanel isOpen={true} onClose={jest.fn()} />);

        await navigateToNetworkTab();

        // Submeter sem alterar configurações de rede
        const saveButton = screen.getByRole('button', { name: 'Salvar' });
        await act(async () => {
            fireEvent.click(saveButton);
        });

        // Botão deve exibir "Salvando..." (não "Reiniciando motor...")
        expect(screen.getByRole('button', { name: 'Salvando...' })).toBeInTheDocument();

        await act(async () => {
            resolveSetSettings!({ success: true, data: defaultSettings });
        });
    });

    // ── Mensagem de erro quando reinício falha (Req 5.7) ────────────────

    it('exibe mensagem de erro quando o reinício do motor falha', async () => {
        setupMocks({ dhtEnabled: true, pexEnabled: true, utpEnabled: true });
        mockSetSettings.mockResolvedValue({
            success: false,
            error: 'Falha ao reiniciar motor',
        });

        render(<SettingsPanel isOpen={true} onClose={jest.fn()} />);

        await navigateToNetworkTab();

        // Desabilitar DHT para causar mudança de rede
        const dhtCheckbox = screen.getByLabelText('DHT (Distributed Hash Table)');
        fireEvent.click(dhtCheckbox);

        // Submeter o formulário
        const saveButton = screen.getByRole('button', { name: 'Salvar' });
        await act(async () => {
            fireEvent.click(saveButton);
        });

        // Mensagem de erro de reinício deve ser exibida com role="alert"
        await waitFor(() => {
            const errorElements = screen.getAllByRole('alert');
            const restartErrorEl = errorElements.find(
                (el) =>
                    el.classList.contains('errorMessage') ||
                    el.textContent?.includes('reiniciar motor'),
            );
            expect(restartErrorEl).toBeTruthy();
        });
    });

    // ── Erro genérico quando mensagem de erro não está disponível ────────

    it('exibe mensagem genérica quando erro de reinício não tem mensagem específica', async () => {
        setupMocks({ dhtEnabled: true, pexEnabled: true, utpEnabled: true });
        mockSetSettings.mockResolvedValue({
            success: false,
            error: undefined,
        });

        render(<SettingsPanel isOpen={true} onClose={jest.fn()} />);

        await navigateToNetworkTab();

        // Desabilitar PEX para causar mudança de rede
        const pexCheckbox = screen.getByLabelText('PEX (Peer Exchange)');
        fireEvent.click(pexCheckbox);

        const saveButton = screen.getByRole('button', { name: 'Salvar' });
        await act(async () => {
            fireEvent.click(saveButton);
        });

        await waitFor(() => {
            expect(screen.getByText('Erro ao reiniciar motor de torrents')).toBeInTheDocument();
        });
    });

    // ── Não renderiza quando isOpen é false ──────────────────────────────

    it('não renderiza nada quando isOpen é false', () => {
        setupMocks();
        const { container } = render(<SettingsPanel isOpen={false} onClose={jest.fn()} />);

        expect(container.innerHTML).toBe('');
    });
});
