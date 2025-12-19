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

    // Expand Feature group and check entity button (uses entity-item-{type}-{id} format)
    await page.getByTestId('entity-group-Feature').click();
    await expect(page.getByTestId('entity-item-Feature-FEAT-demo-basic')).toBeVisible();

    // Expand Requirement group 
    await page.getByTestId('entity-group-Requirement').click();
    await expect(page.getByTestId('entity-item-Requirement-REQ-audit-logging')).toBeVisible();

    // Expand Task group
    await page.getByTestId('entity-group-Task').click();
    await expect(page.getByTestId('entity-item-Task-TASK-impl-auth')).toBeVisible();
  });

  test('auto-selects bundle on initial load with tabbed overview', async ({ page }) => {
    await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}`);

    // Bundle should be auto-selected - check for bundle tabs instead of "No entity selected"
    await expect(page.getByTestId('bundle-tabs')).toBeVisible();

    // Verify all 4 tabs are present
    await expect(page.getByTestId('bundle-tab-details')).toBeVisible();
    await expect(page.getByTestId('bundle-tab-entity-types')).toBeVisible();
    await expect(page.getByTestId('bundle-tab-relationships')).toBeVisible();
    await expect(page.getByTestId('bundle-tab-raw-schema')).toBeVisible();

    // Details tab should be active by default
    await expect(page.getByTestId('bundle-tab-details')).toHaveClass(/active/);

    // Should NOT show "No entity selected" placeholder
    await expect(page.getByText('No entity selected.')).not.toBeVisible();

    // Check bundle info is displayed
    await expect(page.locator('.bundle-info')).toBeVisible();
  });

  test('selects an entity and shows schema-driven details with references', async ({ page }) => {
    await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}`);

    // Expand Feature group first (groups are collapsed by default)
    await page.getByTestId('entity-group-Feature').click();
    await page.getByTestId('entity-item-Feature-FEAT-demo-basic').click();

    // New design has separate type badge and ID
    await expect(page.locator('.entity-type-badge').filter({ hasText: 'Feature' })).toBeVisible();
    await expect(page.locator('.entity-id').filter({ hasText: 'FEAT-demo-basic' })).toBeVisible();
    // Check for Dependency Graph tab (reference sections moved there)
    await expect(page.getByTestId('tab-graph')).toBeVisible();
  });

  test('Compile Spec shows diagnostics panel', async ({ page }) => {
    await page.goto(`/?bundleDir=${encodeURIComponent(bundleDir)}`);

    // Wait for bundle to load before clicking compile
    await page.waitForSelector('.entity-group', { timeout: 10000 });
    await page.getByTestId('compile-btn').click();

    // Diagnostics panel should be visible (may have diagnostics or "No diagnostics")
    await expect(page.locator('.diagnostics-panel')).toBeVisible();
  });
});
