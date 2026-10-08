/** @jest-environment jsdom */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import '@testing-library/jest-dom';
import { AddTorrentModal } from '../../src/components/AddTorrent/AddTorrentModal';
import { DropZone } from '../../src/components/AddTorrent/DropZone';
import { useDownloadStore } from '../../src/store/downloadStore';
import type { DiskSpaceInfo, IPCResponse, TorrentSource } from '../../shared/types';
import ptBR from '../../src/locales/pt-BR.json';
import enUS from '../../src/locales/en-US.json';

const files = [
    { index: 0, name: 'keep.bin', path: 'keep.bin', length: 100, downloaded: 0, selected: true },
    { index: 1, name: 'skip.bin', path: 'skip.bin', length: 900, downloaded: 0, selected: true },
];
const space = (sufficient = true): DiskSpaceInfo => ({
    freeBytes: 2000,
    selectedBytes: 1000,
    reservedBytes: 200,
    safetyMarginBytes: 64,
    sufficient,
});
const magnet = `magnet:?xt=urn:btih:${'a'.repeat(40)}`;
const api = {
    getSettings: jest.fn(),
    prepareTorrent: jest.fn(),
    getDiskSpace: jest.fn(),
    cancelTorrentPreparation: jest.fn(),
    confirmTorrent: jest.fn(),
    selectFolder: jest.fn(),
    selectTorrentFile: jest.fn(),
    addMagnetLink: jest.fn(),
    addTorrentFileBuffer: jest.fn(),
};
beforeEach(() => {
    jest.resetAllMocks();
    useDownloadStore.getState().setItems([]);
    Object.defineProperty(window, 'meshy', { value: api, configurable: true, writable: true });
    api.getSettings.mockResolvedValue({ success: true, data: { destinationFolder: '/downloads' } });
    api.prepareTorrent.mockImplementation((requestId: string) =>
        Promise.resolve({
            success: true,
            data: { requestId, name: 'Archive', infoHash: 'a'.repeat(40), files },
        }),
    );
    api.getDiskSpace.mockResolvedValue({ success: true, data: space() });
    api.cancelTorrentPreparation.mockResolvedValue({ success: true });
    api.confirmTorrent.mockResolvedValue({
        success: true,
        data: { infoHash: 'a'.repeat(40), name: 'Archive', status: 'downloading' },
    });
    api.selectFolder.mockResolvedValue({ success: true, data: '/other' });
    api.selectTorrentFile.mockResolvedValue({ success: true, data: '/archive.torrent' });
});
function view(
    props: { initialSources?: TorrentSource[]; isOpen?: boolean; onClose?: () => void } = {},
    english = false,
) {
    return (
        <IntlProvider locale={english ? 'en-US' : 'pt-BR'} messages={english ? enUS : ptBR}>
            <AddTorrentModal
                isOpen={props.isOpen ?? true}
                onClose={props.onClose ?? jest.fn()}
                {...(props.initialSources ? { initialSources: props.initialSources } : {})}
            />
        </IntlProvider>
    );
}
async function reviewMagnet() {
    fireEvent.change(screen.getByRole('textbox'), { target: { value: magnet } });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar arquivos' }));
    await screen.findByRole('heading', { name: 'Archive' });
    await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Iniciar download' })).toBeEnabled(),
    );
}
test('magnet não inicia transferência antes de revisar seleção, destino e espaço', async () => {
    const close = jest.fn();
    render(view({ onClose: close }));
    await reviewMagnet();
    expect(api.confirmTorrent).not.toHaveBeenCalled();
    expect(api.addMagnetLink).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: /skip.bin/ }));
    await waitFor(() =>
        expect(api.getDiskSpace).toHaveBeenLastCalledWith(expect.any(String), '/downloads', [0]),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar pasta' }));
    await waitFor(() =>
        expect(api.getDiskSpace).toHaveBeenLastCalledWith(expect.any(String), '/other', [0]),
    );
    await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Iniciar download' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar download' }));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(api.confirmTorrent).toHaveBeenCalledWith(expect.any(String), '/other', [0]);
    expect(useDownloadStore.getState().items).toHaveLength(1);
});
test('seleção vazia e espaço insuficiente desabilitam início; reduzir seleção permite confirmar', async () => {
    api.getDiskSpace.mockImplementation((_id: string, _folder: string, indices: number[]) =>
        Promise.resolve({ success: true, data: space(indices.length === 1) }),
    );
    render(view({ initialSources: [{ kind: 'magnet', magnetUri: magnet }] }));
    await screen.findByRole('heading', { name: 'Archive' });
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Iniciar download' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /skip.bin/ }));
    await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Iniciar download' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /keep.bin/ }));
    expect(screen.getByRole('button', { name: 'Iniciar download' })).toBeDisabled();
    expect(api.confirmTorrent).not.toHaveBeenCalled();
});
test('cancelamento durante metadados ignora resultado tardio e não adiciona torrent', async () => {
    let finish!: (value: unknown) => void;
    api.prepareTorrent.mockImplementation(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            }),
    );
    const close = jest.fn();
    const rendered = render(view({ onClose: close }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: magnet } });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar arquivos' }));
    await screen.findByRole('status');
    const requestId = api.prepareTorrent.mock.calls[0]![0] as string;
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    rendered.rerender(view({ isOpen: false, onClose: close }));
    await act(async () =>
        finish({
            success: true,
            data: { requestId, name: 'Archive', infoHash: 'a'.repeat(40), files },
        }),
    );
    expect(api.cancelTorrentPreparation).toHaveBeenCalledWith(requestId);
    expect(api.confirmTorrent).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Archive' })).not.toBeInTheDocument();
});
test('cada magnet de um lote aguarda a própria confirmação', async () => {
    const close = jest.fn();
    render(view({ onClose: close }));
    fireEvent.change(screen.getByRole('textbox'), {
        target: { value: `${magnet}\nmagnet:?xt=urn:btih:${'b'.repeat(40)}` },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar arquivos' }));
    await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Iniciar download' })).toBeEnabled(),
    );
    expect(api.prepareTorrent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar download' }));
    await waitFor(() => expect(api.prepareTorrent).toHaveBeenCalledTimes(2));
    expect(api.confirmTorrent).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
});
test('resultado antigo de espaço não sobrescreve a consulta da pasta atual', async () => {
    let oldResult!: (value: IPCResponse<DiskSpaceInfo>) => void;
    api.getDiskSpace.mockImplementation((_id: string, folder: string) =>
        folder === '/downloads'
            ? new Promise((resolve) => {
                  oldResult = resolve;
              })
            : Promise.resolve({ success: true, data: space(false) }),
    );
    render(view({ initialSources: [{ kind: 'file', filePath: '/archive.torrent' }] }));
    await screen.findByRole('heading', { name: 'Archive' });
    await waitFor(() => expect(api.getDiskSpace).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar pasta' }));
    await screen.findByRole('alert');
    await act(async () => oldResult({ success: true, data: space(true) }));
    expect(screen.getByRole('button', { name: 'Iniciar download' })).toBeDisabled();
});
test('arrastar múltiplos arquivos abre revisão sem chamar a adição direta', async () => {
    render(
        <IntlProvider locale="pt-BR" messages={ptBR}>
            <DropZone />
        </IntlProvider>,
    );
    const file = new File(['de'], 'archive.torrent');
    Object.defineProperty(file, 'arrayBuffer', {
        value: async () => new Uint8Array([100, 101]).buffer,
    });
    fireEvent.drop(screen.getByRole('region'), {
        dataTransfer: { files: [file, file], getData: () => '' },
    });
    await screen.findByRole('dialog');
    await waitFor(() => expect(api.prepareTorrent).toHaveBeenCalledTimes(1));
    expect(api.prepareTorrent.mock.calls[0]![1]).toMatchObject({ kind: 'buffer' });
    expect(api.addTorrentFileBuffer).not.toHaveBeenCalled();
    expect(api.confirmTorrent).not.toHaveBeenCalled();
});
test('apresenta revisão e erros em inglês', async () => {
    api.getDiskSpace.mockResolvedValue({
        success: false,
        error: 'error.destination.diskSpaceUnavailable',
    });
    render(view({ initialSources: [{ kind: 'magnet', magnetUri: magnet }] }, true));
    await screen.findByText(/Could not check disk space/);
    expect(screen.getByRole('button', { name: 'Start download' })).toBeDisabled();
});
