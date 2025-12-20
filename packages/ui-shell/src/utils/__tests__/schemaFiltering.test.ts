import { describe, it, expect } from 'vitest';
import {
    getHeaderFieldNames,
    getFieldToGroupMap,
    filterSchemaForLayoutGroup,
    filterSchemaWithoutHeaderFields,
    filterFormDataToSchema,
    sortFieldsByOrder,
    stripConditionalKeywords,
} from '../schemaFiltering';

describe('schemaFiltering utilities', () => {
    describe('getHeaderFieldNames', () => {
        it('extracts field names with x-sdd-displayLocation: header', () => {
            const schema = {
                properties: {
                    status: { type: 'string', 'x-sdd-displayLocation': 'header' },
                    confidence: { type: 'string', 'x-sdd-displayLocation': 'header' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                },
            };

            const headerFields = getHeaderFieldNames(schema);

            expect(headerFields.size).toBe(2);
            expect(headerFields.has('status')).toBe(true);
            expect(headerFields.has('confidence')).toBe(true);
            expect(headerFields.has('title')).toBe(false);
            expect(headerFields.has('description')).toBe(false);
        });

        it('returns empty set for schema without header fields', () => {
            const schema = {
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                },
            };

            const headerFields = getHeaderFieldNames(schema);
            expect(headerFields.size).toBe(0);
        });

        it('returns empty set for null/undefined schema', () => {
            expect(getHeaderFieldNames(null).size).toBe(0);
            expect(getHeaderFieldNames(undefined).size).toBe(0);
        });
    });

    describe('getFieldToGroupMap', () => {
        it('builds map from field names to layout groups', () => {
            const schema = {
                properties: {
                    title: { type: 'string', 'x-sdd-layoutGroup': 'overview' },
                    description: { type: 'string', 'x-sdd-layoutGroup': 'overview' },
                    createdDate: { type: 'string', 'x-sdd-layoutGroup': 'meta' },
                    noGroup: { type: 'string' },
                },
            };

            const fieldToGroup = getFieldToGroupMap(schema);

            expect(fieldToGroup['title']).toBe('overview');
            expect(fieldToGroup['description']).toBe('overview');
            expect(fieldToGroup['createdDate']).toBe('meta');
            expect(fieldToGroup['noGroup']).toBeUndefined();
        });

        it('returns empty object for null/undefined schema', () => {
            expect(getFieldToGroupMap(null)).toEqual({});
            expect(getFieldToGroupMap(undefined)).toEqual({});
        });
    });

    describe('sortFieldsByOrder', () => {
        it('sorts by x-sdd-order ascending', () => {
            const entries: [string, any][] = [
                ['third', { 'x-sdd-order': 30 }],
                ['first', { 'x-sdd-order': 10 }],
                ['second', { 'x-sdd-order': 20 }],
            ];

            const sorted = sortFieldsByOrder(entries);

            expect(sorted[0][0]).toBe('first');
            expect(sorted[1][0]).toBe('second');
            expect(sorted[2][0]).toBe('third');
        });

        it('puts fields without order at the end', () => {
            const entries: [string, any][] = [
                ['noOrder', {}],
                ['first', { 'x-sdd-order': 10 }],
                ['alsoNoOrder', { type: 'string' }],
            ];

            const sorted = sortFieldsByOrder(entries);

            expect(sorted[0][0]).toBe('first');
            // Fields without order come after, but order between them is stable
            expect(sorted[1][0]).toBe('noOrder');
            expect(sorted[2][0]).toBe('alsoNoOrder');
        });
    });

    describe('stripConditionalKeywords', () => {
        it('removes if/then/else and allOf/anyOf/oneOf', () => {
            const schema = {
                type: 'object',
                properties: { title: { type: 'string' } },
                if: { properties: { status: { const: 'accepted' } } },
                then: { properties: { confidence: { type: 'string' } } },
                else: {},
                allOf: [{ required: ['title'] }],
                anyOf: [{ type: 'object' }],
                oneOf: [{ type: 'string' }],
            };

            const result = stripConditionalKeywords(schema);

            expect(result.type).toBe('object');
            expect(result.properties).toEqual({ title: { type: 'string' } });
            expect(result.if).toBeUndefined();
            expect(result.then).toBeUndefined();
            expect(result.else).toBeUndefined();
            expect(result.allOf).toBeUndefined();
            expect(result.anyOf).toBeUndefined();
            expect(result.oneOf).toBeUndefined();
        });
    });

    describe('filterSchemaForLayoutGroup', () => {
        const schema = {
            type: 'object',
            required: ['title', 'status'],
            properties: {
                status: { type: 'string', 'x-sdd-displayLocation': 'header' },
                title: { type: 'string', 'x-sdd-layoutGroup': 'overview', 'x-sdd-order': 10 },
                description: { type: 'string', 'x-sdd-layoutGroup': 'overview', 'x-sdd-order': 20 },
                createdDate: { type: 'string', 'x-sdd-layoutGroup': 'meta' },
                noGroup: { type: 'string' },
            },
        };

        const headerFieldNames = new Set(['status']);
        const fieldToGroup = {
            title: 'overview',
            description: 'overview',
            createdDate: 'meta',
        };

        it('returns only fields for the specified layout group', () => {
            const filtered = filterSchemaForLayoutGroup(schema, 'overview', fieldToGroup, headerFieldNames);

            expect(filtered).not.toBeNull();
            expect(Object.keys(filtered!.properties as any)).toEqual(['title', 'description']);
        });

        it('excludes header fields from layout groups', () => {
            const allFieldsSchema = {
                properties: {
                    status: { type: 'string', 'x-sdd-displayLocation': 'header', 'x-sdd-layoutGroup': 'overview' },
                    title: { type: 'string', 'x-sdd-layoutGroup': 'overview' },
                },
            };
            const headerNames = new Set(['status']);
            const ftg = { status: 'overview', title: 'overview' };

            const filtered = filterSchemaForLayoutGroup(allFieldsSchema, 'overview', ftg, headerNames);

            expect(Object.keys(filtered!.properties as any)).toEqual(['title']);
        });

        it('preserves x-sdd-order sorting', () => {
            const filtered = filterSchemaForLayoutGroup(schema, 'overview', fieldToGroup, headerFieldNames);

            const propKeys = Object.keys(filtered!.properties as any);
            expect(propKeys[0]).toBe('title'); // order: 10
            expect(propKeys[1]).toBe('description'); // order: 20
        });

        it('filters required array to only include group fields', () => {
            const filtered = filterSchemaForLayoutGroup(schema, 'overview', fieldToGroup, headerFieldNames);

            expect(filtered!.required).toEqual(['title']);
        });

        it('sets additionalProperties: false', () => {
            const filtered = filterSchemaForLayoutGroup(schema, 'overview', fieldToGroup, headerFieldNames);

            expect(filtered!.additionalProperties).toBe(false);
        });

        it('returns null for empty group', () => {
            const filtered = filterSchemaForLayoutGroup(schema, 'nonexistent', fieldToGroup, headerFieldNames);

            expect(filtered).toBeNull();
        });

        it('returns null for null/undefined schema', () => {
            expect(filterSchemaForLayoutGroup(null, 'overview', {}, new Set())).toBeNull();
            expect(filterSchemaForLayoutGroup(undefined, 'overview', {}, new Set())).toBeNull();
        });
    });

    describe('filterSchemaWithoutHeaderFields', () => {
        it('removes header fields from schema', () => {
            const schema = {
                type: 'object',
                required: ['title', 'status'],
                properties: {
                    status: { type: 'string', 'x-sdd-displayLocation': 'header' },
                    confidence: { type: 'string', 'x-sdd-displayLocation': 'header' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                },
            };
            const headerFieldNames = new Set(['status', 'confidence']);

            const filtered = filterSchemaWithoutHeaderFields(schema, headerFieldNames);

            expect(Object.keys(filtered!.properties as any)).toEqual(['title', 'description']);
        });

        it('filters required array to exclude header fields', () => {
            const schema = {
                type: 'object',
                required: ['title', 'status'],
                properties: {
                    status: { type: 'string', 'x-sdd-displayLocation': 'header' },
                    title: { type: 'string' },
                },
            };
            const headerFieldNames = new Set(['status']);

            const filtered = filterSchemaWithoutHeaderFields(schema, headerFieldNames);

            expect(filtered!.required).toEqual(['title']);
        });

        it('sets additionalProperties: false', () => {
            const schema = {
                properties: { title: { type: 'string' } },
            };
            const headerFieldNames = new Set(['status']);

            const filtered = filterSchemaWithoutHeaderFields(schema, headerFieldNames);

            expect(filtered!.additionalProperties).toBe(false);
        });

        it('returns original schema if no header fields', () => {
            const schema = {
                properties: { title: { type: 'string' } },
            };
            const headerFieldNames = new Set<string>();

            const filtered = filterSchemaWithoutHeaderFields(schema, headerFieldNames);

            expect(filtered).toBe(schema); // Same reference
        });

        it('returns null/undefined for null/undefined schema', () => {
            expect(filterSchemaWithoutHeaderFields(null, new Set())).toBeNull();
            expect(filterSchemaWithoutHeaderFields(undefined, new Set())).toBeUndefined();
        });
    });

    describe('filterFormDataToSchema', () => {
        it('keeps only fields that exist in schema properties', () => {
            const data = {
                title: 'Test',
                description: 'A test',
                status: 'active',
                extraField: 'should be removed',
            };
            const schema = {
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                },
            };

            const filtered = filterFormDataToSchema(data, schema);

            expect(filtered).toEqual({
                title: 'Test',
                description: 'A test',
            });
            expect(filtered.status).toBeUndefined();
            expect(filtered.extraField).toBeUndefined();
        });

        it('returns original data if schema has no properties', () => {
            const data = { title: 'Test' };
            const schema = { type: 'object' };

            const filtered = filterFormDataToSchema(data, schema);

            expect(filtered).toBe(data); // Same reference
        });

        it('returns original data for null/undefined schema', () => {
            const data = { title: 'Test' };

            expect(filterFormDataToSchema(data, null)).toBe(data);
            expect(filterFormDataToSchema(data, undefined)).toBe(data);
        });
    });
});
