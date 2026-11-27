import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // the physics checks run the full best-shot search on dozens of holes
    testTimeout: 300_000,
    pool: 'forks',
  },
});
