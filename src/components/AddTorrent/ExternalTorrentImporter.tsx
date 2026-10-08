import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import type { ExternalTorrentRequest } from '../../../shared/types';
import { AddTorrentModal } from './AddTorrentModal';

/** O lote mostrado permanece estável se outra entrada chegar enquanto há uma revisão aberta. */
export function ExternalTorrentImporter(): React.JSX.Element | null {
    const intl = useIntl();
    const [batch, setBatch] = useState<ExternalTorrentRequest[]>([]);
    const [error, setError] = useState(false);
    const active = useRef(false);
    useEffect(() => {
        let mounted = true;
        active.current = true;
        if (!window.meshy.onExternalTorrentRequests) return;
        const receive = (requests: ExternalTorrentRequest[]) => {
            if (mounted) setBatch((current) => (current.length ? current : requests));
        };
        const unsubscribe = window.meshy.onExternalTorrentRequests(receive);
        void window.meshy
            .getExternalTorrentRequests()
            .then((response) => {
                if (response.success) receive(response.data);
            })
            .catch(() => {});
        return () => {
            mounted = false;
            active.current = false;
            unsubscribe();
        };
    }, []);
    const close = useCallback(async () => {
        for (const request of batch) {
            const response = await window.meshy.acknowledgeExternalTorrentRequest(request.id);
            if (!response.success) throw new Error(response.error);
        }
        const response = await window.meshy.getExternalTorrentRequests();
        if (active.current) {
            setBatch(response.success ? response.data : []);
            setError(false);
        }
    }, [batch]);
    // As fontes só mudam quando o lote muda, evitando cancelar uma preparação em andamento.
    const sources = React.useMemo(() => batch.map((request) => request.source), [batch]);
    return (
        <>
            {error && <p role="alert">{intl.formatMessage({ id: 'error.operation.failed' })}</p>}
            {batch.length > 0 && (
                <AddTorrentModal
                    key={batch[0]!.id}
                    isOpen
                    initialSources={sources}
                    onClose={() =>
                        void close().catch(() => {
                            if (active.current) setError(true);
                        })
                    }
                />
            )}
        </>
    );
}
