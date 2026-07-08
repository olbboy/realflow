import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@realflow/react/styles.css', replacement: resolve(__dirname, '../packages/react/src/styles.css') },
      { find: '@realflow/react', replacement: resolve(__dirname, '../packages/react/src/index.ts') },
      { find: '@realflow/core', replacement: resolve(__dirname, '../packages/core/src/index.ts') },
    ],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        realflow: resolve(__dirname, 'realflow.html'),
        xyflow: resolve(__dirname, 'xyflow.html'),
      },
    },
  },
});
