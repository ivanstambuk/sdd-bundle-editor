/**
 * Shared Bundle Test Fixture
 * 
 * This module provides utilities for E2E tests to set up temporary bundle directories.
 * The source bundle is read from an external repository (sdd-sample-bundle) which is
 * separate from the editor codebase.
 * 
 * Environment Variables:
 * - SDD_SAMPLE_BUNDLE_PATH: Path to the sample bundle directory (default: /home/ivan/dev/sdd-sample-bundle)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

/**
 * Get the path to the sample bundle.
 * Uses SDD_SAMPLE_BUNDLE_PATH environment variable if set, otherwise defaults to the standard location.
 */
export function getSampleBundlePath(): string {
    return process.env.SDD_SAMPLE_BUNDLE_PATH || '/home/ivan/dev/sdd-sample-bundle';
}

/**
 * Recursively copy a directory, skipping .git
 */
export async function copyDir(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.name === '.git') continue; // Skip .git

        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

/**
 * Create a temporary bundle directory by copying from the sample bundle.
 * Also initializes a git repository in the temp directory for agent tests.
 * 
 * @param prefix - Prefix for the temp directory name
 * @returns Path to the temporary bundle directory
 */
export async function createTempBundle(prefix: string = 'sdd-test-'): Promise<string> {
    const sourceDir = getSampleBundlePath();

    // Verify source exists
    try {
        await fs.access(sourceDir);
    } catch {
        throw new Error(`Sample bundle not found at: ${sourceDir}. Set SDD_SAMPLE_BUNDLE_PATH environment variable or ensure the bundle exists.`);
    }

    // Create temp directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));

    // Copy bundle contents
    await copyDir(sourceDir, tempDir);

    // Initialize git repo (required for agent tests)
    try {
        execSync('git init', { cwd: tempDir, stdio: 'pipe' });
        execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'pipe' });
        execSync('git config user.name "Test User"', { cwd: tempDir, stdio: 'pipe' });
        execSync('git add .', { cwd: tempDir, stdio: 'pipe' });
        execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: 'pipe' });
        // Create a feature branch for tests (since main is protected)
        execSync('git checkout -b test-branch', { cwd: tempDir, stdio: 'pipe' });
    } catch (e) {
        console.error('Failed to init git in temp dir:', e);
    }

    console.log(`Created temp bundle at: ${tempDir}`);
    return tempDir;
}

/**
 * Clean up a temporary bundle directory.
 */
export async function cleanupTempBundle(tempDir: string): Promise<void> {
    if (!tempDir) return;

    try {
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`Cleaned up temp bundle at: ${tempDir}`);
    } catch (err) {
        console.error('Failed to cleanup temp dir:', err);
    }
}
