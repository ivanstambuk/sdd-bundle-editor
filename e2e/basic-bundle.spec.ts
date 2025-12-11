import { test, expect } from '@playwright/test';
import { getSampleBundlePath } from './bundle-test-fixture';

test.describe('Basic bundle UI flow', () => {
  const bundleDir = getSampleBundlePath();

  test('loads basic bundle and lists entities', async ({ page }) => {
    await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}`);

    await expect(page.getByText('Entities')).toBeVisible();

    // Entity groups are collapsed by default, look for group headers (buttons)
    await expect(page.getByTestId('entity-group-Feature')).toBeVisible();
    await expect(page.getByTestId('entity-group-Requirement')).toBeVisible();
    await expect(page.getByTestId('entity-group-Task')).toBeVisible();

    // Expand Feature group and check entity button
    await page.getByTestId('entity-group-Feature').click();
    await expect(page.getByTestId('entity-FEAT-001')).toBeVisible();

    // Expand Requirement group 
    await page.getByTestId('entity-group-Requirement').click();
    await expect(page.getByTestId('entity-REQ-001')).toBeVisible();

    // Expand Task group
    await page.getByTestId('entity-group-Task').click();
    await expect(page.getByTestId('entity-TASK-001')).toBeVisible();
  });

  test('selects an entity and shows schema-driven details with references', async ({ page }) => {
    await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}`);

    // Expand Feature group first (groups are collapsed by default)
    await page.getByTestId('entity-group-Feature').click();
    await page.getByTestId('entity-FEAT-001').click();

    // New design has separate type badge and ID
    await expect(page.locator('.entity-type-badge').filter({ hasText: 'Feature' })).toBeVisible();
    await expect(page.locator('.entity-id').filter({ hasText: 'FEAT-001' })).toBeVisible();
    await expect(page.locator('.references-title').filter({ hasText: 'Outgoing references' })).toBeVisible();
    await expect(page.locator('.references-title').filter({ hasText: 'Incoming references' })).toBeVisible();
  });

  test('Compile Spec keeps basic bundle free of diagnostics', async ({ page }) => {
    await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}`);

    // Wait for bundle to load before clicking compile
    await page.waitForSelector('.entity-group', { timeout: 10000 });
    await page.getByTestId('compile-btn').click();

    await expect(page.getByText('No diagnostics.')).toBeVisible();
  });
});
