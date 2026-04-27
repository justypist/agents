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

test('agent navigation creates a session and opens the chat page', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: /Agents/ }).click();

  await expect(page).toHaveURL(/\/default\/[A-Za-z0-9_-]+$/);
  await expect(page.getByRole('heading', { name: 'Agents' })).toBeVisible();
  await expect(page.getByText('准备就绪')).toBeVisible();
  await expect(page.getByPlaceholder('输入你的问题...')).toBeVisible();
  await expect(page.getByRole('button', { name: '发送' })).toBeDisabled();

  await page.getByPlaceholder('输入你的问题...').fill('你好');
  await expect(page.getByRole('button', { name: '发送' })).toBeEnabled();
});

test('session history shows created chat sessions', async ({ page }) => {
  await page.goto('/default');
  await expect(page).toHaveURL(/\/default\/[A-Za-z0-9_-]+$/);

  await page.goto('/');

  await expect(page.getByText('历史会话')).toBeVisible();
  await expect(page.getByText('空白会话').first()).toBeVisible();
});
