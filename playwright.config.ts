/**
 * Playwright config — E2E pra cobertura de fluxos críticos.
 *
 * Pra rodar:
 *   npm run e2e          → headless contra http://localhost:3000
 *   npm run e2e:ui       → UI mode (debugar visualmente)
 *   npm run e2e:headed   → headed mode (vê o browser)
 *
 * Os testes assumem que o dev server JÁ ESTÁ RODANDO em :3000.
 * Pra rodar automaticamente, descomente o `webServer` abaixo.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // testes podem compartilhar state (login, etc.)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Pra Playwright iniciar o dev server sozinho, descomente:
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
});
