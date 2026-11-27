// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['legacy/**', '**/dist/**', '**/node_modules/**', '**/*.cjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // The engine runs on client and server and must give identical results: no DOM, no clock,
    // no unseeded randomness, no I/O.
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'localStorage',
          'sessionStorage',
          'navigator',
          'performance',
          'Date',
          'fetch',
          'process',
        ].map((name) => ({ name, message: 'The engine must stay pure: no DOM, clock or I/O.' })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded mulberry32 RNG.' },
      ],
      'no-restricted-imports': ['error', { patterns: ['node:*', 'fs', 'path', 'three'] }],
    },
  },
  {
    files: ['**/test/**/*.ts'],
    rules: { '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_' }] },
  },
);
