/**
 * RjsfStyles.module.css regression tests
 * 
 * These tests verify critical CSS properties that affect layout behavior.
 * They prevent regressions where CSS changes might break the grid layout system.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Read the CSS file content directly for property assertions
const cssFilePath = path.join(__dirname, 'RjsfStyles.module.css');
const cssContent = fs.readFileSync(cssFilePath, 'utf-8');

/**
 * Helper to extract a CSS rule block by selector
 */
function getCssRuleContent(css: string, selector: string): string | null {
    // Escape special regex chars in selector
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match the selector and its block
    const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`, 'g');
    const match = regex.exec(css);
    return match ? match[1] : null;
}

describe('RjsfStyles.module.css', () => {
    describe('.object wrapper', () => {
        it('should use grid layout (not flex) to enable field size classes', () => {
            const objectRule = getCssRuleContent(cssContent, '.object');
            expect(objectRule).not.toBeNull();

            // CRITICAL: .object must use grid for rjsf-field-small/medium/large to work
            // If this is flex, fields will stack vertically instead of flowing in columns
            expect(objectRule).toMatch(/display:\s*grid/);
            expect(objectRule).not.toMatch(/display:\s*flex/);
        });

        it('should define a 4-column grid for field layout', () => {
            const objectRule = getCssRuleContent(cssContent, '.object');
            expect(objectRule).not.toBeNull();

            // The grid needs 4 columns for the field size classes:
            // - rjsf-field-small: span 1
            // - rjsf-field-medium: span 2
            // - rjsf-field-large: span 3
            // - rjsf-field-full: span 4
            expect(objectRule).toMatch(/grid-template-columns:\s*repeat\(4,\s*1fr\)/);
        });
    });

    describe('.bulletMarker', () => {
        it('should not flex to prevent text from being pushed far right', () => {
            const markerRule = getCssRuleContent(cssContent, '.bulletMarker');
            expect(markerRule).not.toBeNull();

            // CRITICAL: .bulletMarker must NOT participate in flex-grow
            // If it has flex: 1, the marker icon takes half the row width
            // pushing the text content far to the right
            expect(markerRule).toMatch(/flex:\s*none/);
        });
    });
});
