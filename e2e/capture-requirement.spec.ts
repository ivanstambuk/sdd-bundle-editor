import { test, expect } from '@playwright/test';

/**
 * Capture screenshots of Requirement entity to verify form improvements
 */
test('capture requirement entity screenshots', async ({ page }) => {
    await page.goto('/');

    // Wait for bundle to load
    await page.waitForSelector('.entity-group', { timeout: 10000 });

    // Expand Requirements group
    await page.click('[data-testid="entity-group-Requirement"]');
    await page.waitForTimeout(500);

    // Click on a Requirement entity
    const reqItems = page.locator('.entity-item').filter({ hasText: /REQ-/ });
    await reqItems.first().click();

    // Wait for entity details to load
    await page.waitForSelector('.entity-details', { timeout: 5000 });

    // Scroll down to see quality attributes and acceptance criteria
    await page.evaluate(() => {
        const content = document.querySelector('.entity-details-body');
        if (content) content.scrollTop = content.scrollHeight;
    });
    await page.waitForTimeout(300);

    // Capture full page screenshot
    await page.screenshot({
        path: 'test-results/requirement-form.png',
        fullPage: true
    });

    console.log('Screenshot saved to test-results/requirement-form.png');
});
