import React, { useRef, useEffect } from 'react';
import { SpeedSample } from '../../hooks/useSpeedHistory';
import { computeYAxisScale } from '../../utils/detailsFormatters';

export interface SpeedChartProps {
    samples: SpeedSample[];
}

/** Número máximo de pontos no eixo X (últimos 60 segundos) */
const MAX_POINTS = 60;

/** Padding interno do gráfico em pixels */
const PADDING = { top: 20, right: 20, bottom: 30, left: 60 };

/** Altura fixa do canvas em pixels */
const CANVAS_HEIGHT = 200;

/** Cores das séries */
const DOWNLOAD_COLOR = '#4fc3f7';
const UPLOAD_COLOR = '#81c784';

/**
 * Formata o valor do eixo Y para exibição nos rótulos.
 * Usa limiares de 1024 para determinar unidade (B/s, KB/s, MB/s).
 */
function formatYLabel(value: number): string {
    if (value < 1024) return `${Math.round(value)} B/s`;
    if (value < 1_048_576) return `${(value / 1024).toFixed(0)} KB/s`;
    return `${(value / 1_048_576).toFixed(1)} MB/s`;
}

/**
 * Desenha os eixos e linhas de grade no canvas.
 */
function drawAxes(
    ctx: CanvasRenderingContext2D,
    chartW: number,
    chartH: number,
    maxY: number,
): void {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Linhas de grade horizontais (4 divisões)
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
        const y = PADDING.top + (chartH / gridLines) * i;
        const value = maxY - (maxY / gridLines) * i;

        // Linha de grade
        ctx.beginPath();
        ctx.moveTo(PADDING.left, y);
        ctx.lineTo(PADDING.left + chartW, y);
        ctx.stroke();

        // Rótulo do eixo Y
        ctx.fillText(formatYLabel(value), PADDING.left - 8, y);
    }

    // Eixo X (linha inferior)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(PADDING.left, PADDING.top + chartH);
    ctx.lineTo(PADDING.left + chartW, PADDING.top + chartH);
    ctx.stroke();

    // Eixo Y (linha esquerda)
    ctx.beginPath();
    ctx.moveTo(PADDING.left, PADDING.top);
    ctx.lineTo(PADDING.left, PADDING.top + chartH);
    ctx.stroke();

    // Rótulos do eixo X (segundos)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    const xLabels = [0, 15, 30, 45, 60];
    for (const sec of xLabels) {
        const x = PADDING.left + (sec / MAX_POINTS) * chartW;
        ctx.fillText(`-${MAX_POINTS - sec}s`, x, PADDING.top + chartH + 8);
    }
}

/**
 * Desenha uma série de dados como linha no gráfico.
 */
function drawLine(
    ctx: CanvasRenderingContext2D,
    samples: SpeedSample[],
    key: 'downloadSpeed' | 'uploadSpeed',
    chartW: number,
    chartH: number,
    maxY: number,
    color: string,
): void {
    if (samples.length === 0) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    // Posicionar amostras alinhadas à direita (últimas amostras no final do gráfico)
    const startOffset = MAX_POINTS - samples.length;

    for (let i = 0; i < samples.length; i++) {
        const x = PADDING.left + ((startOffset + i) / (MAX_POINTS - 1)) * chartW;
        const value = samples[i][key];
        const y = PADDING.top + chartH - (value / maxY) * chartH;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }

    ctx.stroke();
}

/**
 * Desenha a legenda do gráfico (download e upload).
 */
function drawLegend(ctx: CanvasRenderingContext2D, width: number): void {
    const legendY = PADDING.top - 12;
    const legendX = width - PADDING.right;

    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Upload (verde)
    ctx.fillStyle = UPLOAD_COLOR;
    ctx.fillRect(legendX - 70, legendY - 4, 8, 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('Upload', legendX - 74, legendY);

    // Download (azul)
    ctx.fillStyle = DOWNLOAD_COLOR;
    ctx.fillRect(legendX - 140, legendY - 4, 8, 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('Download', legendX - 144, legendY);
}

/**
 * Função principal de renderização do gráfico de velocidade.
 */
function drawSpeedChart(
    ctx: CanvasRenderingContext2D,
    samples: SpeedSample[],
    width: number,
    height: number,
): void {
    // Limpar canvas
    ctx.clearRect(0, 0, width, height);

    // Calcular dimensões da área do gráfico
    const chartW = width - PADDING.left - PADDING.right;
    const chartH = height - PADDING.top - PADDING.bottom;

    if (chartW <= 0 || chartH <= 0) return;

    // Calcular escala Y automática (mínimo 1 KB/s)
    const maxY = computeYAxisScale(samples);

    // Desenhar eixos e grade
    drawAxes(ctx, chartW, chartH, maxY);

    // Desenhar legenda
    drawLegend(ctx, width);

    // Desenhar linhas de dados (apenas se houver amostras)
    if (samples.length > 0) {
        drawLine(ctx, samples, 'downloadSpeed', chartW, chartH, maxY, DOWNLOAD_COLOR);
        drawLine(ctx, samples, 'uploadSpeed', chartW, chartH, maxY, UPLOAD_COLOR);
    }
}

/**
 * Componente de gráfico de velocidade usando Canvas 2D.
 *
 * Renderiza um gráfico de linhas com duas séries (download e upload)
 * representando os últimos 60 segundos de atividade.
 * Redesenha automaticamente quando as amostras mudam.
 */
export function SpeedChart({ samples }: SpeedChartProps): React.JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Ajustar tamanho do canvas ao container (preencher largura disponível)
        const parent = canvas.parentElement;
        const width = parent ? parent.clientWidth : canvas.clientWidth;
        const height = CANVAS_HEIGHT;

        // Ajustar para device pixel ratio para renderização nítida
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(dpr, dpr);

        drawSpeedChart(ctx, samples, width, height);
    }, [samples]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: '100%', height: `${CANVAS_HEIGHT}px`, display: 'block' }}
            aria-label="Gráfico de velocidade de download e upload"
            role="img"
        />
    );
}
