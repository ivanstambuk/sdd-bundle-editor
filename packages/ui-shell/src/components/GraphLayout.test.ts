/**
 * GraphLayout CSS regression tests
 * 
 * These tests verify critical CSS properties that affect the vertical
 * expansion of the RelationshipGraph and EntityDependencyGraph to ensure
 * they span full available height instead of clustering at 400px.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function getCssRuleContent(cssFilePath: string, selector: string): string | null {
    const cssPath = path.join(__dirname, cssFilePath);
    if (!fs.existsSync(cssPath)) return null;
    const css = fs.readFileSync(cssPath, 'utf-8');
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`, 'g');
    const match = regex.exec(css);
    return match ? match[1] : null;
}

describe('Graph Layout CSS', () => {
    describe('BundleOverview.module.css', () => {
        it('should use flex layout for .body to enable vertical expansion', () => {
            const rule = getCssRuleContent('BundleOverview.module.css', '.body');
            expect(rule).not.toBeNull();
            expect(rule).toMatch(/display:\s*flex/);
            expect(rule).toMatch(/flex-direction:\s*column/);
        });

        it('should use flex layout for .tabContent with flex: 1', () => {
            const rule = getCssRuleContent('BundleOverview.module.css', '.tabContent');
            expect(rule).not.toBeNull();
            expect(rule).toMatch(/display:\s*flex/);
            expect(rule).toMatch(/flex:\s*1/);
        });
    });

    describe('EntityDetails.module.css', () => {
        it('should use flex layout for .body', () => {
            const rule = getCssRuleContent('EntityDetails.module.css', '.body');
            expect(rule).not.toBeNull();
            expect(rule).toMatch(/display:\s*flex/);
            expect(rule).toMatch(/flex-direction:\s*column/);
        });

        it('should have flex: 1 on .dependenciesContainer', () => {
            const rule = getCssRuleContent('EntityDetails.module.css', '.dependenciesContainer');
            expect(rule).not.toBeNull();
            expect(rule).toMatch(/flex:\s*1/);
        });
    });

    describe('RelationshipGraph.module.css', () => {
        it('should not have fixed height, instead uses flex: 1', () => {
            const rule = getCssRuleContent('RelationshipGraph.module.css', '.graph');
            expect(rule).not.toBeNull();
            expect(rule).toMatch(/flex:\s*1/);
            expect(rule).not.toMatch(/(?<!-)height:\s*(400|500)px/);
            expect(rule).toMatch(/min-height:\s*400px/);
        });
    });

    describe('EntityDependencyGraph.module.css', () => {
        it('should not have fixed height on .graph', () => {
            const rule = getCssRuleContent('EntityDependencyGraph.module.css', '.graph');
            expect(rule).not.toBeNull();
            expect(rule).toMatch(/flex:\s*1/);
            expect(rule).not.toMatch(/(?<!-)height:\s*(400|500)px/);
            expect(rule).toMatch(/min-height:\s*400px/);
        });
    });
});
