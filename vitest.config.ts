import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@realflow/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@realflow/react': resolve(__dirname, 'packages/react/src/index.ts'),
      '@realflow/compat': resolve(__dirname, 'packages/compat/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.{ts,tsx}', 'examples/ai-agent/test/**/*.test.{ts,mts}'],
    environment: 'node',
  },
});
