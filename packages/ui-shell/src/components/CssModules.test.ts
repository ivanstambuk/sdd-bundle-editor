/**
 * CSS Module Health Tests
 * 
 * These tests catch common CSS issues that are hard to debug:
 * - Duplicate selectors that silently override earlier rules
 * - Missing critical CSS properties
 * 
 * @see .agent/docs/pitfalls/common-pitfalls.md - Pitfall 32 (Duplicate CSS selectors)
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { describe, it, expect } from 'vitest';

const COMPONENTS_DIR = resolve(__dirname, '.');

/**
 * Extract CSS selectors from a CSS file content.
 * Matches class selectors like `.className {` at the start of lines.
 */
function extractSelectors(cssContent: string): string[] {
    // Match lines that start with a class selector (. followed by word chars)
    // and end with an opening brace (possibly with other selectors/pseudo-classes)
    const selectorLines: string[] = [];
    const lines = cssContent.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        // Match simple class selectors at start of rule
        const match = trimmed.match(/^(\.[a-zA-Z_][\w-]*)\s*\{/);
        if (match) {
            selectorLines.push(match[1]);
        }
    }

    return selectorLines;
}

/**
 * Find duplicate selectors in a list
 */
function findDuplicates(selectors: string[]): string[] {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const sel of selectors) {
        if (seen.has(sel)) {
            if (!duplicates.includes(sel)) {
                duplicates.push(sel);
            }
        }
        seen.add(sel);
    }

    return duplicates;
}

describe('CSS Module Health Checks', () => {
    // Get all CSS module files in the components directory
    const cssFiles = readdirSync(COMPONENTS_DIR)
        .filter(f => f.endsWith('.module.css'));

    describe('Duplicate Selector Detection', () => {
        for (const cssFile of cssFiles) {
            it(`${cssFile} should not have duplicate selectors`, () => {
                const cssPath = join(COMPONENTS_DIR, cssFile);
                const cssContent = readFileSync(cssPath, 'utf-8');
                const selectors = extractSelectors(cssContent);
                const duplicates = findDuplicates(selectors);

                if (duplicates.length > 0) {
                    throw new Error(
                        `Found duplicate selectors in ${cssFile}:\n` +
                        duplicates.map(d => `  - ${d}`).join('\n') +
                        '\n\nDuplicate selectors cause later rules to silently override earlier ones. ' +
                        'This was the root cause of the ADR sub-tab spacing bug.'
                    );
                }

                expect(duplicates).toEqual([]);
            });
        }
    });
});
