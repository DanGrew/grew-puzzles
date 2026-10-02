import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['core/**/*-core.js'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        lines: 80,
        functions: 78,
        branches: 70,
        statements: 80,
      },
    },
  },
});
