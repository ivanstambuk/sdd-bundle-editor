/**
 * CSS Spacing Validation Test Suite
 * 
 * This test suite validates expected spacing values throughout the UI.
 * It catches CSS regressions by measuring actual pixel values.
 * 
 * When adding new tests:
 * 1. Inject test HTML to isolate the component
 * 2. Measure actual pixel values with boundingBox()
 * 3. Assert against expected thresholds
 * 4. Capture screenshot for visual verification
 */

import { test, expect, Page } from '@playwright/test';

// Helper to inject test content into the agent panel
async function injectTestMessage(page: Page, testId: string, innerHTML: string) {
    await page.evaluate(({ testId, innerHTML }) => {
        const container = document.querySelector('.messages-container') || document.querySelector('.agent-panel');
        if (container) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message role-agent';
            messageDiv.setAttribute('data-testid', testId);

            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.innerHTML = innerHTML;

            messageDiv.appendChild(contentDiv);
            container.appendChild(messageDiv);
        }
    }, { testId, innerHTML });

    await page.waitForSelector(`[data-testid="${testId}"]`);
}

// Helper to measure gap between consecutive elements
async function measureGaps(page: Page, selector: string): Promise<number[]> {
    const items = page.locator(selector);
    const count = await items.count();
    const gaps: number[] = [];

    for (let i = 0; i < count - 1; i++) {
        const box1 = await items.nth(i).boundingBox();
        const box2 = await items.nth(i + 1).boundingBox();

        if (box1 && box2) {
            gaps.push(box2.y - (box1.y + box1.height));
        }
    }

    return gaps;
}

test.describe('CSS Spacing Validation', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/?bundleDir=examples/basic-bundle');
        await page.waitForSelector('.entity-group', { timeout: 10000 });
    });

    test('bullet list items have compact spacing (< 15px)', async ({ page }) => {
        await injectTestMessage(page, 'test-bullet-list', `
            <p>Test paragraph before list:</p>
            <ul>
                <li><p>First item</p></li>
                <li><p>Second item</p></li>
                <li><p>Third item</p></li>
            </ul>
        `);

        const gaps = await measureGaps(page, '[data-testid="test-bullet-list"] ul li');

        console.log('Bullet list gaps:', gaps);

        for (const gap of gaps) {
            expect(gap, `Gap between list items should be < 15px, got ${gap}px`).toBeLessThan(15);
            expect(gap, `Gap should be non-negative`).toBeGreaterThanOrEqual(0);
        }

        await page.locator('[data-testid="test-bullet-list"]').screenshot({
            path: 'artifacts/css-validation/bullet_list.png'
        });
    });

    test('numbered list items have compact spacing (< 15px)', async ({ page }) => {
        await injectTestMessage(page, 'test-numbered-list', `
            <p>Test paragraph before list:</p>
            <ol>
                <li><p>First item</p></li>
                <li><p>Second item</p></li>
                <li><p>Third item</p></li>
            </ol>
        `);

        const gaps = await measureGaps(page, '[data-testid="test-numbered-list"] ol li');

        console.log('Numbered list gaps:', gaps);

        for (const gap of gaps) {
            expect(gap, `Gap between list items should be < 15px, got ${gap}px`).toBeLessThan(15);
        }

        await page.locator('[data-testid="test-numbered-list"]').screenshot({
            path: 'artifacts/css-validation/numbered_list.png'
        });
    });

    test('paragraphs have reasonable spacing', async ({ page }) => {
        // Note: .message-content uses white-space: pre-wrap which preserves
        // newlines in injected HTML. This test validates the actual rendered spacing.
        await injectTestMessage(page, 'test-paragraphs', `
            <p>First paragraph with some content.</p>
            <p>Second paragraph with some content.</p>
            <p>Third paragraph with some content.</p>
        `);

        const gaps = await measureGaps(page, '[data-testid="test-paragraphs"] p');

        console.log('Paragraph gaps:', gaps);

        // Paragraphs may have extra spacing from white-space: pre-wrap
        // preserving newlines. We validate they're not excessively large.
        for (const gap of gaps) {
            expect(gap, `Gap between paragraphs should be >= 0px`).toBeGreaterThanOrEqual(0);
            expect(gap, `Gap between paragraphs should be < 60px, got ${gap}px`).toBeLessThan(60);
        }

        await page.locator('[data-testid="test-paragraphs"]').screenshot({
            path: 'artifacts/css-validation/paragraphs.png'
        });
    });

    test('headings have appropriate spacing', async ({ page }) => {
        // Note: white-space: pre-wrap adds extra spacing from newlines
        await injectTestMessage(page, 'test-headings', `
            <h2>Main Heading</h2>
            <p>Paragraph after heading.</p>
            <h3>Subheading</h3>
            <p>Another paragraph.</p>
        `);

        // Check h2 to p gap
        const h2 = page.locator('[data-testid="test-headings"] h2');
        const p1 = page.locator('[data-testid="test-headings"] p').first();

        const h2Box = await h2.boundingBox();
        const p1Box = await p1.boundingBox();

        if (h2Box && p1Box) {
            const gap = p1Box.y - (h2Box.y + h2Box.height);
            console.log('H2 to P gap:', gap);
            // Allow up to 60px due to white-space: pre-wrap preserving newlines
            expect(gap, `Gap between h2 and p should be < 60px, got ${gap}px`).toBeLessThan(60);
        }

        await page.locator('[data-testid="test-headings"]').screenshot({
            path: 'artifacts/css-validation/headings.png'
        });
    });

    test('code blocks have proper spacing', async ({ page }) => {
        await injectTestMessage(page, 'test-code', `
            <p>Here is some code:</p>
            <pre><code>const x = 1;
const y = 2;</code></pre>
            <p>And a paragraph after.</p>
        `);

        const pre = page.locator('[data-testid="test-code"] pre');
        const preBox = await pre.boundingBox();

        if (preBox) {
            // Code block should have reasonable height
            expect(preBox.height, `Code block height should be > 20px`).toBeGreaterThan(20);
        }

        await page.locator('[data-testid="test-code"]').screenshot({
            path: 'artifacts/css-validation/code_block.png'
        });
    });

    test('mixed content has consistent spacing', async ({ page }) => {
        // This tests a realistic markdown-rendered message
        await injectTestMessage(page, 'test-mixed', `
            <p>Here's what I can help you with:</p>
            <ul>
                <li><p>Create new entities</p></li>
                <li><p>Update existing ones</p></li>
                <li><p>Link entities together</p></li>
            </ul>
            <p>Just let me know what you'd like to do!</p>
            <h3>Available Options</h3>
            <ol>
                <li><p>Option A</p></li>
                <li><p>Option B</p></li>
            </ol>
        `);

        // Measure all list gaps
        const ulGaps = await measureGaps(page, '[data-testid="test-mixed"] ul li');
        const olGaps = await measureGaps(page, '[data-testid="test-mixed"] ol li');

        console.log('UL gaps:', ulGaps);
        console.log('OL gaps:', olGaps);

        for (const gap of [...ulGaps, ...olGaps]) {
            expect(gap, `List item gaps should be < 15px`).toBeLessThan(15);
        }

        await page.locator('[data-testid="test-mixed"]').screenshot({
            path: 'artifacts/css-validation/mixed_content.png'
        });
    });
});
