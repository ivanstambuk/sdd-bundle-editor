import { test, expect } from '@playwright/test';
import { getSampleBundlePath } from './bundle-test-fixture';

test.describe('Basic bundle UI flow', () => {
  const bundleDir = getSampleBundlePath();

  test('loads basic bundle and lists entities', async ({ page }) => {
    await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}`);

    await expect(page.getByText('Entities')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Feature' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Requirement' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Task' })).toBeVisible();

    await expect(page.getByRole('button', { name: 'FEAT-001' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'REQ-001' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'TASK-001' })).toBeVisible();
  });

  test('selects an entity and shows schema-driven details with references', async ({ page }) => {
    await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}`);

    await page.getByRole('button', { name: 'FEAT-001' }).click();

    // New design has separate type badge and ID
    await expect(page.locator('.entity-type-badge').filter({ hasText: 'Feature' })).toBeVisible();
    await expect(page.locator('.entity-id').filter({ hasText: 'FEAT-001' })).toBeVisible();
    await expect(page.locator('.references-title').filter({ hasText: 'Outgoing references' })).toBeVisible();
    await expect(page.locator('.references-title').filter({ hasText: 'Incoming references' })).toBeVisible();
  });

  test('Compile Spec keeps basic bundle free of diagnostics', async ({ page }) => {
    await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}`);

    await page.getByRole('button', { name: 'Compile Spec' }).click();

    await expect(page.getByText('No diagnostics.')).toBeVisible();
  });
});
