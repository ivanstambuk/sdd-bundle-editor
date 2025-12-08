import { test, expect } from '@playwright/test';

test.describe('Bullet List CSS Spacing', () => {
    test('verify list item spacing is under 15px', async ({ page }) => {
        // Navigate to app
        await page.goto('/?bundleDir=examples/basic-bundle');
        await page.waitForSelector('.entity-group', { timeout: 10000 });

        // Inject a test message with a bullet list directly into the DOM
        await page.evaluate(() => {
            // Find the messages container
            const container = document.querySelector('.messages-container') || document.querySelector('.agent-panel');

            if (container) {
                // Create a test message element
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message role-agent';
                messageDiv.setAttribute('data-testid', 'test-bullet-list-message');

                const contentDiv = document.createElement('div');
                contentDiv.className = 'message-content';

                // Add test content with bullet list
                contentDiv.innerHTML = `
                    <p>Here is a test paragraph before the list:</p>
                    <ul>
                        <li><p>First item with paragraph wrapper</p></li>
                        <li><p>Second item with paragraph wrapper</p></li>
                        <li><p>Third item with paragraph wrapper</p></li>
                        <li><p>Fourth item with paragraph wrapper</p></li>
                    </ul>
                    <p>Paragraph after the list.</p>
                `;

                messageDiv.appendChild(contentDiv);
                container.appendChild(messageDiv);
            }
        });

        // Wait for element to be in DOM
        await page.waitForSelector('[data-testid="test-bullet-list-message"]');

        // Capture screenshot
        const testMessage = page.locator('[data-testid="test-bullet-list-message"]');
        await testMessage.screenshot({ path: 'artifacts/test_bullet_spacing.png' });

        // Get list items
        const items = page.locator('[data-testid="test-bullet-list-message"] ul li');
        const count = await items.count();

        console.log(`Found ${count} list items`);
        expect(count).toBe(4);

        // Measure spacing between each pair of items
        const spacings: number[] = [];

        for (let i = 0; i < count - 1; i++) {
            const item = items.nth(i);
            const nextItem = items.nth(i + 1);

            const box1 = await item.boundingBox();
            const box2 = await nextItem.boundingBox();

            if (box1 && box2) {
                const gap = box2.y - (box1.y + box1.height);
                spacings.push(gap);
                console.log(`Gap between item ${i} and ${i + 1}: ${gap.toFixed(2)}px`);
                console.log(`  Item ${i}: y=${box1.y.toFixed(2)}, height=${box1.height.toFixed(2)}, bottom=${(box1.y + box1.height).toFixed(2)}`);
                console.log(`  Item ${i + 1}: y=${box2.y.toFixed(2)}`);
            }
        }

        // Log the HTML structure of first list item
        const firstItemHTML = await items.first().evaluate(el => {
            return {
                outerHTML: el.outerHTML,
                children: Array.from(el.children).map(child => child.tagName),
            };
        });
        console.log('First item HTML:', firstItemHTML);

        // Check computed styles
        const firstItem = items.first();
        const liStyles = await firstItem.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
                marginBottom: computed.marginBottom,
                marginTop: computed.marginTop,
                lineHeight: computed.lineHeight,
                height: el.offsetHeight + 'px',
            };
        });
        console.log('Li computed styles:', liStyles);

        const firstP = page.locator('[data-testid="test-bullet-list-message"] ul li p').first();
        const pStyles = await firstP.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
                marginBottom: computed.marginBottom,
                marginTop: computed.marginTop,
                paddingBottom: computed.paddingBottom,
                paddingTop: computed.paddingTop,
                display: computed.display,
                lineHeight: computed.lineHeight,
                height: el.offsetHeight + 'px',
            };
        });
        console.log('P in li computed styles:', pStyles);

        const firstLi = items.first();
        const liStylesFull = await firstLi.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
                marginBottom: computed.marginBottom,
                marginTop: computed.marginTop,
                paddingBottom: computed.paddingBottom,
                paddingTop: computed.paddingTop,
                height: el.offsetHeight + 'px',
            };
        });
        console.log('Li computed styles (full):', liStylesFull);

        const ul = page.locator('[data-testid="test-bullet-list-message"] ul');
        const ulStyles = await ul.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
                display: computed.display,
                gap: computed.gap,
                rowGap: computed.rowGap,
                flexDirection: computed.flexDirection,
                marginBottom: computed.marginBottom,
            };
        });
        console.log('UL computed styles:', ulStyles);

        // The issue: 50px gap but li margin-bottom is only 5.6px
        // Expected gap = li.marginBottom + (any other spacing)
        // 50.38px - 5.6px = 44.78px unaccounted for!
        console.log(`\n⚠️  MYSTERY: Gap is 50.38px but li margin is only 5.6px`);
        console.log(`   Missing: ~45px coming from somewhere!`);

        // Assert spacing is reasonable (less than 15px)
        for (let i = 0; i < spacings.length; i++) {
            console.log(`Asserting gap ${i}: ${spacings[i].toFixed(2)}px < 15px`);
            expect(spacings[i]).toBeLessThan(15);
        }

        // Also check that spacing is not negative
        for (let i = 0; i < spacings.length; i++) {
            expect(spacings[i]).toBeGreaterThanOrEqual(0);
        }

        console.log('✅ All spacing tests passed!');
    });
});
