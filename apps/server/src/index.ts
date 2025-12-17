// Load environment variables from .env file FIRST before any other imports
import 'dotenv/config';

import Fastify from 'fastify';

import { registerOpenAPI } from './openapi';
import { registerErrorHandler } from './error-handler';

const DEFAULT_PORT = Number(process.env.PORT ?? '3000');

/**
 * Create a minimal legacy server.
 * 
 * NOTE: Bundle operations have moved to the MCP Server (port 3001).
 * This server is kept for backward compatibility and health checks.
 * It will be removed in a future version.
 */
export async function createServer() {
  const fastify = Fastify({
    logger: true,
  });

  // Register centralized error handler
  registerErrorHandler(fastify);

  // Register OpenAPI documentation
  await registerOpenAPI(fastify);

  // Health check endpoint for Playwright and monitoring
  fastify.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok' });
  });

  // Legacy bundle routes have been removed.
  // All bundle operations now go through MCP server (port 3001).
  // Use:
  //   - get_bundle_snapshot  (replaces GET /bundle)
  //   - validate_bundle      (replaces POST /bundle/validate)
  //   - apply_changes        (replaces POST /bundle/save)

  return fastify;
}

export async function startServer(port: number = DEFAULT_PORT) {
  const server = await createServer();
  try {
    await server.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  startServer();
}

