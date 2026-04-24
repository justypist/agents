import { expect, test } from '@playwright/test';

test('home page exposes agent navigation and session history', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '选择一个 Agent' })).toBeVisible();
  await expect(page.getByText('Agent Navigation')).toBeVisible();
  await expect(page.getByText('Session History')).toBeVisible();
  await expect(page.getByRole('link', { name: /Agents/ })).toHaveAttribute(
    'href',
    '/default',
  );
});

test('manifest is available for PWA installs', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({
    name: 'Agents',
    display: 'standalone',
  });
});
