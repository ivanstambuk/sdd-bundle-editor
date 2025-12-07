import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import * as path from 'node:path';
import { createServer } from './index';

let server: FastifyInstance;

beforeAll(async () => {
  server = await createServer();
});

afterAll(async () => {
  await server.close();
});

function sampleBundleDir(): string {
  // Resolve the example bundle directory from the server package.
  return path.resolve(__dirname, '../../../examples/basic-bundle');
}

describe('server bundle endpoints', () => {
  it('GET /bundle returns bundle snapshot and diagnostics', async () => {
    const bundleDir = sampleBundleDir();
    const response = await server.inject({
      method: 'GET',
      url: `/bundle?bundleDir=${encodeURIComponent(bundleDir)}`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      bundle: { entities: Record<string, unknown[]> };
      diagnostics: unknown[];
    };

    expect(body.bundle).toBeTruthy();
    expect(Object.keys(body.bundle.entities)).toContain('Feature');
    expect(Array.isArray(body.diagnostics)).toBe(true);
  });

  it('POST /bundle/validate returns diagnostics for the sample bundle', async () => {
    const bundleDir = sampleBundleDir();
    const response = await server.inject({
      method: 'POST',
      url: '/bundle/validate',
      payload: { bundleDir },
      headers: { 'content-type': 'application/json' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { diagnostics: { severity: string }[] };

    expect(Array.isArray(body.diagnostics)).toBe(true);
    const errors = body.diagnostics.filter((d) => d.severity === 'error');
    expect(errors.length).toBe(0);
  });

  it('POST /bundle/save succeeds for the sample bundle', async () => {
    const bundleDir = sampleBundleDir();
    const response = await server.inject({
      method: 'POST',
      url: '/bundle/save',
      payload: { bundleDir },
      headers: { 'content-type': 'application/json' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { saved: boolean; diagnostics: { severity: string }[] };

    expect(body.saved).toBe(true);
    const errors = body.diagnostics.filter((d) => d.severity === 'error');
    expect(errors.length).toBe(0);
  });
});
