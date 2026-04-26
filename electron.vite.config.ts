import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin({ exclude: ['electron-store'] })],
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'main/index.ts'),
                },
                output: {
                    format: 'es',
                    entryFileNames: '[name].mjs',
                },
            },
        },
    },
    preload: {
        plugins: [externalizeDepsPlugin({ exclude: ['electron-store'] })],
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'electron/preload.ts'),
                },
            },
        },
    },
    renderer: {
        root: resolve(__dirname, 'src'),
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/index.html'),
                },
            },
        },
        resolve: {
            alias: {
                '@renderer': resolve(__dirname, 'src'),
            },
        },
        plugins: [react()],
    },
});
