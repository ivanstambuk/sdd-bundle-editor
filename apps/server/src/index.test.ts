import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from './index';

let server: FastifyInstance;

beforeAll(async () => {
  server = await createServer();
});

afterAll(async () => {
  await server.close();
});

describe('server health endpoint', () => {
  it('GET /health returns ok status', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { status: string };
    expect(body.status).toBe('ok');
  });

  // Note: Bundle routes have been removed.
  // All bundle operations now go through MCP server (port 3001).
  // See e2e/mcp-server.spec.ts for bundle operation tests.
});
