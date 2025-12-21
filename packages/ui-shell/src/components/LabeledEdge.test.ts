import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for LabeledEdge CSS to prevent interaction-blocking regressions.
 * 
 * Root cause of the tooltip bug: pointer-events: none prevented hover events
 * from reaching the label element, so the native browser tooltip never appeared.
 */
describe('LabeledEdge.module.css', () => {
    const cssPath = resolve(__dirname, './LabeledEdge.module.css');
    const cssContent = readFileSync(cssPath, 'utf-8');

    it('should have pointer-events: auto to allow hover tooltips', () => {
        // This test catches the exact bug from 2024-12-21:
        // pointer-events: none was blocking hover events on edge labels
        expect(cssContent).toMatch(/pointer-events\s*:\s*auto/);
    });

    it('should NOT have pointer-events: none on label (blocks interactions)', () => {
        // Ensure we don't regress to the broken state
        // Note: This is a simple check - a more sophisticated check would parse CSS properly
        const labelSection = cssContent.match(/\.label\s*\{[^}]+\}/);
        if (labelSection) {
            expect(labelSection[0]).not.toMatch(/pointer-events\s*:\s*none/);
        }
    });

    it('should have cursor style for better UX', () => {
        // A cursor style indicates the element is interactive
        expect(cssContent).toMatch(/cursor\s*:/);
    });
});
