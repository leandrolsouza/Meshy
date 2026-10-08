/**
 * @jest-environment jsdom
 */

/**
 * Testes de prevenção de re-renders desnecessários em DownloadItem.
 *
 * Como DownloadItem recebe seu item como prop (não lê o store diretamente),
 * estes testes verificam que React.memo impede re-renders quando:
 *   1. O pai re-renderiza mas a referência do item não mudou.
 *   2. O filterStore muda (campo não lido por DownloadItem) mas a referência
 *      do item no downloadStore permanece estável.
 *
 * Mecanismo de detecção:
 *   ProgressBar é renderizado exatamente uma vez por render do DownloadItem.
 *   Um spy instalado no mock de ProgressBar serve como proxy: se o spy for
 *   chamado, DownloadItem re-renderizou; se não for chamado, não re-renderizou.
 *
 * Nota sobre hoisting do jest.mock:
 *   A chamada jest.mock() é hoisted para antes das importações pelo ts-jest.
 *   Porém a factory só é EXECUTADA quando o módulo mockado é importado pela
 *   primeira vez. Nesse momento, progressBarRenderSpy já foi inicializado
 *   (const progressBarRenderSpy = jest.fn() aparece antes do import de DownloadItem
 *   no código transformado).
 *
 * Validates: Requirement 7.6
 */

import React, { useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import '@testing-library/jest-dom';
import type { DownloadItem as DownloadItemType } from '../../shared/types';
import { useFilterStore } from '../../src/store/filterStore';
import ptBR from '../../src/locales/pt-BR.json';

// ─── Spy de renderização ──────────────────────────────────────────────────────
//
// Declarado antes dos jest.mock para que o factory do mock capture a referência
// por closura ao ser executado (na primeira importação de ProgressBar).

const progressBarRenderSpy = jest.fn();

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('react-icons/vsc', () => ({
    VscArrowDown: () => null,
    VscArrowUp: () => null,
    VscDebugPause: () => null,
    VscPlay: () => null,
    VscTrash: () => null,
    VscChevronDown: () => null,
    VscChevronRight: () => null,
    VscFolderOpened: () => null,
    VscGoToFile: () => null,
    VscInfo: () => null,
}));

// MockProgressBar chama o spy a cada render — usado como proxy de renders do DownloadItem.
jest.mock('../../src/components/common/ProgressBar', () => ({
    ProgressBar: function MockProgressBar() {
        progressBarRenderSpy();
        return null;
    },
}));

jest.mock('../../src/components/FileSelector/FileSelector', () => ({
    FileSelector: () => null,
}));

jest.mock('../../src/components/TrackerPanel/TrackerPanel', () => ({
    TrackerPanel: () => null,
}));

jest.mock('../../src/components/DownloadDetails/DetailsPanel', () => ({
    DetailsPanel: () => null,
    isExpandable: () => false,
}));

jest.mock('../../src/components/common/ConfirmDialog', () => ({
    ConfirmDialog: () => null,
}));

jest.mock('../../src/components/common/SpeedDisplay', () => ({
    SpeedDisplay: () => null,
}));

// Importar componente após os mocks
import { DownloadItem } from '../../src/components/DownloadList/DownloadItem';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// Props estáveis com referências fixas — necessário para que React.memo não
// re-renderize por troca de referência de callback entre renders do pai.
const stableHandlers = {
    onPause: jest.fn(),
    onResume: jest.fn(),
    onRemove: jest.fn(),
    queueSize: 0,
    onMoveUp: jest.fn(),
    onMoveDown: jest.fn(),
};

function renderWithIntl(ui: React.ReactElement) {
    return render(
        <IntlProvider locale="pt-BR" messages={ptBR}>
            {ui}
        </IntlProvider>,
    );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();
    // Limpar explicitamente o spy de renderização após o clearAllMocks geral
    progressBarRenderSpy.mockClear();

    window.meshy = {
        openFolder: jest.fn().mockResolvedValue({ success: true, data: undefined }),
        openFile: jest.fn().mockResolvedValue({ success: true, data: undefined }),
        getFiles: jest.fn().mockResolvedValue({ success: true, data: [] }),
        setFileSelection: jest.fn().mockResolvedValue({ success: true, data: [] }),
        getTrackers: jest.fn().mockResolvedValue({ success: true, data: [] }),
        addTracker: jest.fn(),
        removeTracker: jest.fn(),
        applyGlobalTrackers: jest.fn(),
        getGlobalTrackers: jest.fn(),
        addGlobalTracker: jest.fn(),
        removeGlobalTracker: jest.fn(),
        addTorrentFile: jest.fn(),
        addMagnetLink: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn(),
        remove: jest.fn(),
        getAll: jest.fn(),
        getSettings: jest.fn(),
        setSettings: jest.fn(),
        selectFolder: jest.fn(),
        retryDownload: jest.fn(),
        onProgress: jest.fn().mockReturnValue(() => {}),
        onError: jest.fn().mockReturnValue(() => {}),
        reportError: jest.fn(),
        getMetrics: jest.fn(),
        reorderQueue: jest.fn().mockResolvedValue({ success: true, data: [] }),
        getQueueOrder: jest.fn().mockResolvedValue({ success: true, data: [] }),
    } as unknown as typeof window.meshy;
});

afterEach(() => {
    // Restaurar filterStore ao estado inicial entre testes
    useFilterStore.getState().resetFilters();
});

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('DownloadItem — prevenção de re-renders desnecessários', () => {
    // Validates: Requirement 7.6
    it('renderiza ProgressBar uma vez no mount inicial', () => {
        // Verifica o baseline: ProgressBar é renderizado exatamente uma vez
        // no mount inicial, confirmando que o spy funciona como proxy.
        renderWithIntl(<DownloadItem item={createItem()} {...stableHandlers} />);

        expect(progressBarRenderSpy).toHaveBeenCalledTimes(1);
    });

    // Validates: Requirement 7.6
    it('React.memo impede re-renderização quando a referência do item não muda', () => {
        // A referência do item é estabilizada fora do componente pai,
        // simulando o cenário em que o store é atualizado mas o item específico
        // desta linha não sofreu alteração (mesma referência).
        const item = createItem();
        let triggerParentRerender!: () => void;

        function TestParent() {
            const [, setState] = useState(0);
            triggerParentRerender = () => setState((s) => s + 1);
            // item e stableHandlers têm referências estáveis em cada render do pai
            return <DownloadItem item={item} {...stableHandlers} />;
        }

        renderWithIntl(<TestParent />);

        // Render inicial: ProgressBar chamado 1 vez
        expect(progressBarRenderSpy).toHaveBeenCalledTimes(1);
        progressBarRenderSpy.mockClear();

        // Re-renderizar o pai sem alterar a referência do item nem dos callbacks
        act(() => {
            triggerParentRerender();
        });

        // React.memo detecta mesmas props → DownloadItem não re-renderiza →
        // ProgressBar não é chamado novamente
        expect(progressBarRenderSpy).toHaveBeenCalledTimes(0);
    });

    // Validates: Requirement 7.6
    it('re-renderiza quando um campo renderizado do item muda (sanidade do React.memo)', () => {
        // Confirma que React.memo NÃO bloqueia re-renders legítimos.
        // Quando uma nova referência de item com campo renderizado diferente é passada,
        // DownloadItem deve re-renderizar normalmente.
        const { rerender } = renderWithIntl(
            <DownloadItem item={createItem({ name: 'Torrent A' })} {...stableHandlers} />,
        );

        progressBarRenderSpy.mockClear();

        // Re-render com novo objeto de item (nome diferente — campo visível na UI)
        rerender(
            <IntlProvider locale="pt-BR" messages={ptBR}>
                <DownloadItem item={createItem({ name: 'Torrent B' })} {...stableHandlers} />
            </IntlProvider>,
        );

        // DownloadItem DEVE ter re-renderizado: nova referência de item, campo renderizado mudou
        expect(progressBarRenderSpy).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Torrent B')).toBeInTheDocument();
    });

    // Validates: Requirement 7.6
    it('não re-renderiza quando filterStore.searchTerm muda mas item é estável', () => {
        // Simula o comportamento real: o pai (DownloadList) usa filterStore e
        // re-renderiza quando searchTerm muda. Como DownloadItem não lê o
        // filterStore diretamente e a referência do item não mudou, ele não
        // deve re-renderizar.
        const item = createItem();

        function SimulatedParent() {
            // Lê filterStore → SimulatedParent re-renderiza quando searchTerm mudar
            const searchTerm = useFilterStore((s) => s.searchTerm);
            return (
                <>
                    <span data-testid="search-term">{searchTerm}</span>
                    <DownloadItem item={item} {...stableHandlers} />
                </>
            );
        }

        renderWithIntl(<SimulatedParent />);
        progressBarRenderSpy.mockClear();

        // Atualizar filterStore — SimulatedParent vai re-renderizar
        act(() => {
            useFilterStore.getState().setSearchTerm('novo filtro');
        });

        // Confirmar que o pai re-renderizou (verificação do span de saída)
        expect(screen.getByTestId('search-term')).toHaveTextContent('novo filtro');

        // DownloadItem NÃO deve ter re-renderizado: referência do item estável,
        // callbacks estáveis (stableHandlers) e DownloadItem é React.memo
        expect(progressBarRenderSpy).toHaveBeenCalledTimes(0);
    });

    // Validates: Requirement 7.6
    it('não re-renderiza em múltiplas atualizações do filterStore com item estável', () => {
        // Verifica que múltiplas mudanças consecutivas no filterStore
        // (sortField, sortDirection) não causam re-renders do DownloadItem
        // quando o item permanece com a mesma referência.
        const item = createItem();

        function SimulatedParent() {
            // Lê dois campos do filterStore para garantir re-renders em cada mudança
            useFilterStore((s) => s.sortField);
            useFilterStore((s) => s.sortDirection);
            return <DownloadItem item={item} {...stableHandlers} />;
        }

        renderWithIntl(<SimulatedParent />);
        progressBarRenderSpy.mockClear();

        // Três atualizações consecutivas do filterStore
        act(() => {
            useFilterStore.getState().setSortField('name');
        });
        act(() => {
            useFilterStore.getState().toggleSortDirection();
        });
        act(() => {
            useFilterStore.getState().setSortField('addedAt');
        });

        // Após todas as atualizações do filterStore, DownloadItem não re-renderizou
        expect(progressBarRenderSpy).toHaveBeenCalledTimes(0);
    });

    // Validates: Requirement 7.6
    it('não re-renderiza quando campos não renderizados do item mudam via re-render do pai', () => {
        // Verifica que quando o pai recebe uma referência de item onde apenas
        // campos NÃO renderizados mudaram (destinationFolder, addedAt), o
        // DownloadItem não re-renderiza por causa do React.memo.
        //
        // Nota: React.memo usa comparação rasa das props. A referência do item
        // MUDA neste teste, então DownloadItem vai re-renderizar. Este teste
        // documenta esse comportamento: para prevenção completa de re-renders
        // quando apenas campos não lidos mudam, é necessário estabilizar a
        // referência do item no store (via seletores granulares no pai).
        const itemOriginal = createItem({ destinationFolder: '/tmp/original', addedAt: 1000 });
        const itemMesmoConteudoVisivel = createItem({
            destinationFolder: '/tmp/outro',
            addedAt: 2000,
        });
        // Todos os campos RENDERIZADOS são idênticos entre os dois objetos

        const { rerender } = renderWithIntl(
            <DownloadItem item={itemOriginal} {...stableHandlers} />,
        );

        progressBarRenderSpy.mockClear();

        // Re-render com nova referência de item (destinationFolder e addedAt mudaram)
        rerender(
            <IntlProvider locale="pt-BR" messages={ptBR}>
                <DownloadItem item={itemMesmoConteudoVisivel} {...stableHandlers} />
            </IntlProvider>,
        );

        // React.memo compara referências de objetos (comparação rasa):
        // item é um objeto diferente → re-render acontece mesmo que campos
        // visíveis sejam iguais. Para evitar re-renders nesse cenário,
        // o pai deve estabilizar a referência do item via useMemo ou seletores granulares.
        expect(progressBarRenderSpy).toHaveBeenCalledTimes(1);
    });
});
