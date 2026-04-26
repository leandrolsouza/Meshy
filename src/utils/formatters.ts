// Re-exporta formatadores do shared para manter compatibilidade com imports existentes no renderer.
// A implementação canônica está em shared/formatters.ts.
export { formatBytes, formatDuration } from '../../shared/formatters';
