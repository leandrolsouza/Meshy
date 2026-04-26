import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    main: {
        build: {
            externalizeDeps: {
                exclude: ['electron-store'],
            },
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
        build: {
            externalizeDeps: {
                exclude: ['electron-store'],
            },
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'electron/preload.ts'),
                },
            },
        },
    },
    renderer: {
        root: resolve(__dirname, 'src'),
        publicDir: resolve(__dirname, 'src/public'),
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
