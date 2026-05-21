/**
 * Vitest config — testes unitários puros (sem DOM).
 *
 *   npm run test         # roda 1x
 *   npm run test:watch   # watch
 *   npm run test:cov     # coverage
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
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/tmp/**'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/*.test.ts', 'lib/types.ts'],
    },
  },
});
