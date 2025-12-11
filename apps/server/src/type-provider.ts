/**
 * Fastify type provider configuration for TypeBox.
 * Provides compile-time type safety for request/response schemas.
 */

import Fastify, { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

/**
 * Create a Fastify server instance with TypeBox type provider.
 */
export function createTypedServer(): FastifyInstance {
    return Fastify({
        logger: true,
    }).withTypeProvider<TypeBoxTypeProvider>();
}

export type TypedFastify = ReturnType<typeof createTypedServer>;
