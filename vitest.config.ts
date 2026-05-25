/**
 * Vitest config — testes unitários.
 *
 *   npm run test         # roda 1x
 *   npm run test:watch   # watch
 *   npm run test:cov     # coverage
 *
 * Convenção de env:
 *  - `*.test.ts`  → node env (lógica pura em lib/)
 *  - `*.test.tsx` → jsdom env (hooks React via @testing-library/react)
 *
 * Override por arquivo: `// @vitest-environment jsdom` no topo.
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/tmp/**', '**/e2e/**'],
    // tsx → jsdom; .ts mantém node (default)
    // Override por arquivo via `// @vitest-environment jsdom` no topo.
    coverage: {
      reporter: ['text', 'html'],
      include: ['lib/**/*.ts', 'components/editor/hooks/**/*.ts'],
      exclude: ['lib/**/*.test.ts', 'lib/types.ts'],
    },
  },
});
