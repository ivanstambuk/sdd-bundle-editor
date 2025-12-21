import { describe, it, expect } from 'vitest';
import {
    getEntityDisplayName,
    getEntityDisplayNamePlural,
    getEntityIcon,
    getSchemaUiMetadata,
} from '../schemaMetadata';

describe('schemaMetadata', () => {
    describe('getEntityDisplayName', () => {
        it('returns x-sdd-ui.displayName when defined', () => {
            const schema = {
                title: 'OpenQuestion',
                'x-sdd-ui': {
                    displayName: 'Open Question',
                    icon: '❓',
                },
            };
            expect(getEntityDisplayName(schema)).toBe('Open Question');
        });

        it('splits camelCase title when no x-sdd-ui defined', () => {
            const schema = { title: 'OpenQuestion' };
            expect(getEntityDisplayName(schema)).toBe('Open Question');
        });

        it('splits PascalCase with multiple words', () => {
            const schema = { title: 'TelemetrySchema' };
            expect(getEntityDisplayName(schema)).toBe('Telemetry Schema');
        });

        it('handles multi-word camelCase', () => {
            const schema = { title: 'HealthCheckSpec' };
            expect(getEntityDisplayName(schema)).toBe('Health Check Spec');
        });

        it('handles single word titles', () => {
            const schema = { title: 'View' };
            expect(getEntityDisplayName(schema)).toBe('View');
        });

        it('handles acronyms in title (HTTPServer -> HTTP Server)', () => {
            const schema = { title: 'HTTPServer' };
            expect(getEntityDisplayName(schema)).toBe('HTTP Server');
        });

        it('preserves title with spaces (already human-readable)', () => {
            const schema = { title: 'Open Question' };
            expect(getEntityDisplayName(schema)).toBe('Open Question');
        });

        it('returns undefined for empty schema', () => {
            expect(getEntityDisplayName(null)).toBeUndefined();
            expect(getEntityDisplayName(undefined)).toBeUndefined();
            expect(getEntityDisplayName({})).toBeUndefined();
        });

        it('prioritizes x-sdd-ui.displayName over schema title', () => {
            const schema = {
                title: 'ADR', // Raw title
                'x-sdd-ui': {
                    displayName: 'Architecture Decision Record',
                    icon: '📐',
                },
            };
            expect(getEntityDisplayName(schema)).toBe('Architecture Decision Record');
        });
    });

    describe('getEntityDisplayNamePlural', () => {
        it('returns x-sdd-ui.displayNamePlural when defined', () => {
            const schema = {
                title: 'OpenQuestion',
                'x-sdd-ui': {
                    displayName: 'Open Question',
                    displayNamePlural: 'Open Questions',
                    icon: '❓',
                },
            };
            expect(getEntityDisplayNamePlural(schema)).toBe('Open Questions');
        });

        it('falls back to singular displayName when plural not defined', () => {
            const schema = {
                title: 'OpenQuestion',
                'x-sdd-ui': {
                    displayName: 'Open Question',
                    icon: '❓',
                },
            };
            expect(getEntityDisplayNamePlural(schema)).toBe('Open Question');
        });

        it('falls back to split title when no x-sdd-ui', () => {
            const schema = { title: 'DataSchema' };
            expect(getEntityDisplayNamePlural(schema)).toBe('Data Schema');
        });
    });

    describe('getEntityIcon', () => {
        it('returns icon from x-sdd-ui when defined', () => {
            const schema = {
                'x-sdd-ui': {
                    displayName: 'Risk',
                    icon: '⚠️',
                },
            };
            expect(getEntityIcon(schema)).toBe('⚠️');
        });

        it('returns undefined when no x-sdd-ui', () => {
            const schema = { title: 'Risk' };
            expect(getEntityIcon(schema)).toBeUndefined();
        });
    });

    describe('getSchemaUiMetadata', () => {
        it('returns x-sdd-ui object when present', () => {
            const schema = {
                'x-sdd-ui': {
                    displayName: 'Test',
                    icon: '🧪',
                },
            };
            const metadata = getSchemaUiMetadata(schema);
            expect(metadata).toEqual({
                displayName: 'Test',
                icon: '🧪',
            });
        });

        it('returns undefined for non-object schema', () => {
            expect(getSchemaUiMetadata(null)).toBeUndefined();
            expect(getSchemaUiMetadata('string')).toBeUndefined();
            expect(getSchemaUiMetadata(123)).toBeUndefined();
        });
    });
});

describe('display name consistency', () => {
    // These tests ensure that ALL entity types that could appear in the UI
    // get human-readable display names via the camelCase splitting fallback
    const camelCaseEntityTypes = [
        { title: 'OpenQuestion', expected: 'Open Question' },
        { title: 'TelemetrySchema', expected: 'Telemetry Schema' },
        { title: 'TelemetryContract', expected: 'Telemetry Contract' },
        { title: 'HealthCheckSpec', expected: 'Health Check Spec' },
        { title: 'ErrorCode', expected: 'Error Code' },
        { title: 'DataSchema', expected: 'Data Schema' },
    ];

    it.each(camelCaseEntityTypes)(
        'converts $title to "$expected"',
        ({ title, expected }) => {
            const schema = { title };
            expect(getEntityDisplayName(schema)).toBe(expected);
        }
    );
});
