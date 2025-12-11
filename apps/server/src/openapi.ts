/**
 * OpenAPI/Swagger configuration for the SDD Bundle Editor API.
 * Provides auto-generated API documentation at /docs.
 */

import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

/**
 * Register OpenAPI documentation endpoints.
 */
export async function registerOpenAPI(fastify: FastifyInstance): Promise<void> {
    await fastify.register(fastifySwagger, {
        openapi: {
            info: {
                title: 'SDD Bundle Editor API',
                description: 'API for managing SDD bundles and agent conversations',
                version: '1.0.0',
            },
            servers: [
                { url: 'http://localhost:3000', description: 'Development server' },
            ],
            tags: [
                { name: 'bundle', description: 'Bundle operations (load, validate, save)' },
                { name: 'agent', description: 'Agent conversation operations' },
                { name: 'health', description: 'Health check endpoints' },
            ],
        },
    });

    await fastify.register(fastifySwaggerUi, {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'list',
            deepLinking: true,
        },
        staticCSP: true,
    });
}
