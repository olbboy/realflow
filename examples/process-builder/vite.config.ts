import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Alias the workspace packages straight to source so the example runs against
// the local library without a build step (mirrors examples/demo).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@realflow/react/styles.css',
        replacement: resolve(__dirname, '../../packages/react/src/styles.css'),
      },
      {
        find: '@realflow/react',
        replacement: resolve(__dirname, '../../packages/react/src/index.ts'),
      },
      {
        find: '@realflow/core',
        replacement: resolve(__dirname, '../../packages/core/src/index.ts'),
      },
    ],
  },
});
