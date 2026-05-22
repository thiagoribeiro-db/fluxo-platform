/**
 * Smoke tests E2E — fluxos críticos que NÃO podem quebrar.
 *
 * Testes não-autenticados (não dependem de Supabase user). Focam em:
 *  - App carrega e renderiza
 *  - Página de login responde
 *  - /editor/demo (modo demo, sem auth) abre o editor
 *  - Atalhos globais respondem
 *
 * Pra testes que exigem login (criar projeto, exportar Blip), adicione
 * um helper de auth e use storage state.
 */
import { expect, test } from '@playwright/test';

test.describe('Smoke', () => {
  test('home page carrega', async ({ page }) => {
    await page.goto('/');
    // Espera algo da página inicial renderizar — não vai dar 500
    await expect(page).toHaveTitle(/Fluxo Platform/i);
  });

  test('página de login renderiza', async ({ page }) => {
    await page.goto('/login');
    // Deve ter algum input pra email/magic link
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });

  test('editor demo abre sem auth', async ({ page }) => {
    // /editor/demo é a rota pública sem auth
    await page.goto('/editor/demo');
    // React Flow root aparece
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10_000 });
  });

  test('atalho Cmd+K abre command palette no editor demo', async ({ page }) => {
    await page.goto('/editor/demo');
    await page.locator('.react-flow').waitFor({ state: 'visible' });
    // Cmd+K (Mac) / Ctrl+K (Win/Linux)
    await page.keyboard.press('Control+K');
    // O input do palette tem placeholder específico
    await expect(
      page.locator('input[placeholder*="O que você quer fazer"]')
    ).toBeVisible({ timeout: 2_000 });
  });

  test('atalho ? abre cheatsheet no editor demo', async ({ page }) => {
    await page.goto('/editor/demo');
    await page.locator('.react-flow').waitFor({ state: 'visible' });
    await page.keyboard.press('?');
    await expect(page.getByText('Atalhos do teclado')).toBeVisible({
      timeout: 2_000,
    });
  });
});
