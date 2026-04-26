// ─── Métricas de operação ─────────────────────────────────────────────────────
//
// Coleta métricas in-memory sobre a operação do Meshy: contadores de erro,
// latência de chamadas IPC, uptime, e contadores de operações.
// Não persiste em disco — resetado a cada reinício do app.
//
// Acessível via IPC `app:get-metrics` para exibição no renderer (debugging).

// ─── Types ────────────────────────────────────────────────────────────────────

/** Snapshot das métricas coletadas */
export interface MetricsSnapshot {
    /** Timestamp de quando o app foi iniciado (ms desde epoch) */
    startedAt: number;
    /** Uptime do app em milissegundos */
    uptimeMs: number;
    /** Total de chamadas IPC processadas */
    ipcCallCount: number;
    /** Total de erros IPC (chamadas que retornaram success: false) */
    ipcErrorCount: number;
    /** Contadores de erro por canal IPC */
    errorsByChannel: Record<string, number>;
    /** Latência média por canal IPC (ms) */
    avgLatencyByChannel: Record<string, number>;
    /** Contadores de chamadas por canal IPC */
    callsByChannel: Record<string, number>;
    /** Total de erros do torrent engine */
    engineErrorCount: number;
    /** Total de crashes do renderer detectados */
    rendererCrashCount: number;
    /** Total de erros reportados pelo renderer */
    rendererErrorCount: number;
    /** Uso de memória do processo principal (bytes) */
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        rss: number;
    };
}

// ─── Implementation ───────────────────────────────────────────────────────────

class MetricsCollector {
    private readonly startedAt = Date.now();
    private ipcCallCount = 0;
    private ipcErrorCount = 0;
    private engineErrorCount = 0;
    private rendererCrashCount = 0;
    private rendererErrorCount = 0;

    /** Contadores de erro por canal */
    private readonly errorsByChannel = new Map<string, number>();
    /** Soma de latências por canal (para calcular média) */
    private readonly latencySumByChannel = new Map<string, number>();
    /** Contadores de chamadas por canal */
    private readonly callsByChannel = new Map<string, number>();

    // ── IPC ───────────────────────────────────────────────────────────────────

    /** Registra uma chamada IPC com sua duração e resultado */
    recordIpcCall(channel: string, durationMs: number, success: boolean): void {
        this.ipcCallCount++;
        this.callsByChannel.set(channel, (this.callsByChannel.get(channel) ?? 0) + 1);
        this.latencySumByChannel.set(
            channel,
            (this.latencySumByChannel.get(channel) ?? 0) + durationMs,
        );

        if (!success) {
            this.ipcErrorCount++;
            this.errorsByChannel.set(channel, (this.errorsByChannel.get(channel) ?? 0) + 1);
        }
    }

    // ── Engine ────────────────────────────────────────────────────────────────

    /** Registra um erro do torrent engine */
    recordEngineError(): void {
        this.engineErrorCount++;
    }

    // ── Renderer ──────────────────────────────────────────────────────────────

    /** Registra um crash do renderer process */
    recordRendererCrash(): void {
        this.rendererCrashCount++;
    }

    /** Registra um erro reportado pelo renderer */
    recordRendererError(): void {
        this.rendererErrorCount++;
    }

    // ── Snapshot ──────────────────────────────────────────────────────────────

    /** Retorna um snapshot imutável das métricas atuais */
    getSnapshot(): MetricsSnapshot {
        const mem = process.memoryUsage();

        const avgLatencyByChannel: Record<string, number> = {};
        for (const [channel, sum] of this.latencySumByChannel.entries()) {
            const count = this.callsByChannel.get(channel) ?? 1;
            avgLatencyByChannel[channel] = Math.round(sum / count);
        }

        return {
            startedAt: this.startedAt,
            uptimeMs: Date.now() - this.startedAt,
            ipcCallCount: this.ipcCallCount,
            ipcErrorCount: this.ipcErrorCount,
            errorsByChannel: Object.fromEntries(this.errorsByChannel),
            avgLatencyByChannel,
            callsByChannel: Object.fromEntries(this.callsByChannel),
            engineErrorCount: this.engineErrorCount,
            rendererCrashCount: this.rendererCrashCount,
            rendererErrorCount: this.rendererErrorCount,
            memoryUsage: {
                heapUsed: mem.heapUsed,
                heapTotal: mem.heapTotal,
                rss: mem.rss,
            },
        };
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/** Instância global do coletor de métricas */
export const metrics = new MetricsCollector();
