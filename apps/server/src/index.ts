// Load environment variables from .env file FIRST before any other imports
// This ensures agent configuration persists across server restarts
import 'dotenv/config';

import Fastify from 'fastify';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { loadBundleWithSchemaValidation } from '@sdd-bundle-editor/core-model';
import {
  buildBundleSchemaSnapshot,
  buildBundleSnapshot,
  createNoopProvider,
  generateBundle as aiGenerateBundle,
  refineBundle as aiRefineBundle,
  fixErrors as aiFixErrors,
} from '@sdd-bundle-editor/core-ai';
import { assertCleanNonMainBranch } from '@sdd-bundle-editor/git-utils';
import { agentRoutes } from './routes/agent';

import { registerOpenAPI } from './openapi';
import { registerErrorHandler } from './error-handler';

const DEFAULT_PORT = Number(process.env.PORT ?? '3000');

async function resolveBundleDir(queryDir?: string): Promise<string> {
  const baseDir = queryDir ? path.resolve(queryDir) : process.cwd();
  const manifestPath = path.join(baseDir, 'sdd-bundle.yaml');
  try {
    await fs.access(manifestPath);
    return baseDir;
  } catch {
    throw new Error(`sdd-bundle.yaml not found in ${baseDir}`);
  }
}

async function loadDocumentSchemasForBundle(
  bundleDir: string,
  manifest: Awaited<ReturnType<typeof loadBundleWithSchemaValidation>>['bundle']['manifest'],
): Promise<Record<string, unknown>> {
  const schemas: Record<string, unknown> = {};
  const documents = (manifest as any).spec?.schemas?.documents ?? {};
  for (const [entityType, relPath] of Object.entries(documents)) {
    const fullPath = path.join(bundleDir, String(relPath));
    try {
      const raw = await fs.readFile(fullPath, 'utf8');
      schemas[entityType] = JSON.parse(raw);
    } catch {
      // If a schema cannot be read or parsed, we simply omit it from the snapshot.
      // Validation is handled separately via core-schema.
    }
  }
  return schemas;
}

function serialiseBundle(
  bundle: Awaited<ReturnType<typeof loadBundleWithSchemaValidation>>['bundle'],
  schemas?: Record<string, unknown>,
) {
  const entities: Record<string, unknown[]> = {};
  for (const [entityType, byId] of bundle.entities.entries()) {
    entities[entityType] = Array.from(byId.values()).map((e) => ({
      id: e.id,
      entityType: e.entityType,
      data: e.data,
      filePath: e.filePath,
    }));
  }

  return {
    manifest: bundle.manifest,
    bundleTypeDefinition: bundle.bundleTypeDefinition,
    entities,
    refGraph: bundle.refGraph,
    schemas,
    domainMarkdown: bundle.domainMarkdown,
  };
}

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

  fastify.get('/bundle', async (request, reply) => {
    try {
      const bundleDirParam = (request.query as { bundleDir?: string }).bundleDir;
      const bundleDir = await resolveBundleDir(bundleDirParam);
      const { bundle, diagnostics } = await loadBundleWithSchemaValidation(bundleDir);
      const schemas = await loadDocumentSchemasForBundle(bundleDir, bundle.manifest);
      return reply.send({
        bundle: serialiseBundle(bundle, schemas),
        diagnostics,
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(400).send({ error: (err as Error).message });
    }
  });

  fastify.post('/bundle/validate', async (request, reply) => {
    try {
      const body = (request.body as { bundleDir?: string }) || {};
      const bundleDir = await resolveBundleDir(body.bundleDir);
      const { diagnostics } = await loadBundleWithSchemaValidation(bundleDir);
      return reply.send({ diagnostics });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(400).send({ error: (err as Error).message });
    }
  });

  fastify.post('/bundle/save', async (request, reply) => {
    try {
      const body = (request.body as { bundleDir?: string }) || {};
      const bundleDir = await resolveBundleDir(body.bundleDir);
      const { bundle, diagnostics } = await loadBundleWithSchemaValidation(bundleDir);
      const hasErrors = diagnostics.some((d) => d.severity === 'error');

      if (hasErrors) {
        return reply.status(400).send({
          saved: false,
          diagnostics,
        });
      }

      // For now, saving is a no-op: the bundle on disk is treated as source of truth.
      // Later, this endpoint will accept edited entities and write YAML files.
      return reply.send({
        saved: true,
        diagnostics,
        bundle: serialiseBundle(bundle),
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(400).send({ error: (err as Error).message });
    }
  });

  fastify.post('/ai/generate', async (request, reply) => {
    try {
      const body = (request.body as { bundleDir?: string; instructions?: string }) || {};
      const bundleDir = await resolveBundleDir(body.bundleDir);
      await assertCleanNonMainBranch(bundleDir);
      const { bundle, diagnostics } = await loadBundleWithSchemaValidation(bundleDir);
      const hasErrors = diagnostics.some((d) => d.severity === 'error');
      if (hasErrors) {
        return reply.status(400).send({
          error: 'Bundle has validation errors; cannot run AI generate.',
          diagnostics,
        });
      }

      const provider = createNoopProvider({ id: 'noop-http' });
      const response = await aiGenerateBundle(provider, {
        bundleType: bundle.manifest.metadata.bundleType,
        schema: buildBundleSchemaSnapshot(bundle),
        bundle: buildBundleSnapshot(bundle),
        domainMarkdown: bundle.domainMarkdown ?? '',
        diagnostics,
        instructions: body.instructions,
      });

      const schemas = await loadDocumentSchemasForBundle(bundleDir, bundle.manifest);

      return reply.send({
        response: {
          notes: response.notes,
          updatedBundle: response.updatedBundle
            ? serialiseBundle(response.updatedBundle.bundle, schemas)
            : undefined,
        },
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(400).send({ error: (err as Error).message });
    }
  });

  fastify.post('/ai/fix-errors', async (request, reply) => {
    try {
      const body = (request.body as { bundleDir?: string; instructions?: string }) || {};
      const bundleDir = await resolveBundleDir(body.bundleDir);
      await assertCleanNonMainBranch(bundleDir);
      const { bundle, diagnostics } = await loadBundleWithSchemaValidation(bundleDir);

      const provider = createNoopProvider({ id: 'noop-http' });
      const response = await aiFixErrors(provider, {
        bundleType: bundle.manifest.metadata.bundleType,
        schema: buildBundleSchemaSnapshot(bundle),
        bundle: buildBundleSnapshot(bundle),
        domainMarkdown: bundle.domainMarkdown ?? '',
        diagnostics,
        instructions: body.instructions,
      });

      return reply.send({
        response: {
          notes: response.notes,
          updatedBundle: response.updatedBundle
            ? serialiseBundle(response.updatedBundle.bundle, await loadDocumentSchemasForBundle(bundleDir, bundle.manifest))
            : undefined,
        },
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(400).send({ error: (err as Error).message });
    }
  });

  await fastify.register(agentRoutes);

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
