import React, { useEffect, useRef } from 'react';
import { useDownloadStore } from '../../store/downloadStore';
import { useSpeedHistory } from '../../hooks/useSpeedHistory';
import { SpeedChart } from './SpeedChart';
import styles from './SpeedTab.module.css';

export interface SpeedTabProps {
    infoHash: string;
    isCollecting: boolean;
}

/**
 * Aba de Velocidade — coleta amostras de velocidade a cada 1s e exibe gráfico.
 *
 * - Usa `useSpeedHistory` para gerenciar buffer circular de 60 amostras.
 * - Lê `downloadSpeed`/`uploadSpeed` do item no downloadStore a cada 1s.
 * - Pausa coleta quando `isCollecting` é false (painel colapsado ou aba inativa).
 * - Ao retomar, `useSpeedHistory.addSample` preenche gaps com zeros automaticamente.
 * - Passa amostras para `SpeedChart` para renderização via Canvas 2D.
 */
export function SpeedTab({ infoHash, isCollecting }: SpeedTabProps): React.JSX.Element {
    const { addSample, getSamples } = useSpeedHistory();
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [, forceUpdate] = React.useState(0);

    useEffect(() => {
        if (!isCollecting) {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        const collect = () => {
            const items = useDownloadStore.getState().items;
            const item = items.find((i) => i.infoHash === infoHash);
            const downloadSpeed = item?.downloadSpeed ?? 0;
            const uploadSpeed = item?.uploadSpeed ?? 0;
            addSample(downloadSpeed, uploadSpeed);
            forceUpdate((n) => n + 1);
        };

        // Coleta inicial imediata
        collect();

        intervalRef.current = setInterval(collect, 1000);

        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isCollecting, infoHash, addSample]);

    return (
        <div className={styles.container} data-testid="speed-tab">
            <div className={styles.chartWrapper}>
                <SpeedChart samples={getSamples()} />
            </div>
        </div>
    );
}
