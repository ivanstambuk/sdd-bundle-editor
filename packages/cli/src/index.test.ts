import { describe, it, expect, vi } from 'vitest';
import { main } from './index';

describe('CLI entrypoint', () => {
  it('runs without crashing for --help', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await main(['node', 'sdd-bundle', '--help']);

    logSpy.mockRestore();
    errorSpy.mockRestore();
    expect(true).toBe(true);
  });
});

