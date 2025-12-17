import { describe, it, expect, vi, afterEach } from 'vitest';
import { main } from './index';

describe('CLI entrypoint', () => {
  // Commander calls process.exit(0) on --help, need to mock it
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { }) as never);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs without crashing for --help', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    await main(['node', 'sdd-bundle', '--help']);

    // Commander should have called process.exit(0)
    expect(exitSpy).toHaveBeenCalledWith(0);
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

