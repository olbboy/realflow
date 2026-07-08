import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// Flat config for the whole monorepo: TypeScript sources, tests, examples and
// the plain-JS build/bench scripts. Kept intentionally lean — it catches real
// problems (unused symbols, unreachable/duplicate code, unsafe comparisons)
// without imposing stylistic churn; formatting is out of scope.
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.d.ts',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      '**/*-snapshots/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      // Mixed browser (react, demos) + node (scripts, core, tests) monorepo.
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // The engine deliberately uses `any` at a few validated trust boundaries.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // React code: rules-of-hooks is a correctness rule (error); exhaustive-deps
    // is advisory (warn) because a few effects intentionally opt out inline.
    files: ['packages/react/**/*.{ts,tsx}', 'packages/compat/**/*.{ts,tsx}', 'examples/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Plain-JS scripts: no TS project, just Node globals + JS recommended.
    files: ['**/*.mjs', '**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  }
);
