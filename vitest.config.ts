import { defineConfig } from 'vitest/config';

const full = { statements: 100, branches: 100, functions: 100, lines: 100 };

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts', 'src/application/**/*.ts', 'src/infrastructure/**/*.ts'],
      // ports.ts holds only types and compiles to nothing.
      exclude: ['**/*.test.ts', 'src/application/ports.ts'],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        'src/domain/**/*.ts': full,
        'src/application/**/*.ts': full,
      },
    },
  },
});
