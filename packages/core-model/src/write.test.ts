
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs/promises';
import { applyChange, saveEntity } from './write';
import { Bundle, Entity, ProposedChange } from './types';

vi.mock('node:fs/promises');

describe('write module', () => {
    describe('applyChange', () => {
        it('should update a nested field in an entity', () => {
            const entity: Entity = {
                id: 'user',
                entityType: 'Profile',
                data: {
                    metadata: {
                        title: 'User Profile',
                        version: 1
                    },
                    spec: {
                        fields: []
                    }
                },
                filePath: '/tmp/user.yaml'
            };

            const bundle: Bundle = {
                manifest: {} as any,
                entities: new Map([
                    ['Profile', new Map([['user', entity]])]
                ]),
                idRegistry: new Map(),
                refGraph: { edges: [] }
            };

            const change: ProposedChange = {
                entityType: 'Profile',
                entityId: 'user',
                fieldPath: 'metadata.title',
                newValue: 'Updated Profile',
                originalValue: 'User Profile'
            };

            applyChange(bundle, change);

            expect((entity.data.metadata as any).title).toBe('Updated Profile');
        });

        it('should create nested structure if missing', () => {
            const entity: Entity = {
                id: 'user',
                entityType: 'Profile',
                data: {
                    metadata: {}
                },
                filePath: '/tmp/user.yaml'
            };

            const bundle: Bundle = {
                manifest: {} as any,
                entities: new Map([
                    ['Profile', new Map([['user', entity]])]
                ]),
                idRegistry: new Map(),
                refGraph: { edges: [] }
            };

            const change: ProposedChange = {
                entityType: 'Profile',
                entityId: 'user',
                fieldPath: 'metadata.extra.info',
                newValue: 'test',
                originalValue: undefined
            };

            applyChange(bundle, change);

            expect((entity.data.metadata as any).extra.info).toBe('test');
        });
    });

    describe('saveEntity', () => {
        it('should write entity data as YAML to filePath', async () => {
            const entity: Entity = {
                id: 'user',
                entityType: 'Profile',
                data: { foo: 'bar' },
                filePath: '/test/path.yaml'
            };

            await saveEntity(entity);

            expect(fs.writeFile).toHaveBeenCalledWith(
                '/test/path.yaml',
                expect.stringContaining('foo: bar'),
                'utf8'
            );
        });
    });
});
