import * as fs from 'node:fs/promises';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { Bundle, Entity, ProposedChange } from './types';

/**
 * deep set helper to update a value at a given dotted path.
 * e.g. set(obj, 'a.b', 1) -> obj.a.b = 1
 */
function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: any = obj;

    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        // Handle array indices if part looks like a number? 
        // For now assuming standard property access. 
        // Ideally we should handle `items[0].name` style if needed, 
        // but the agent usually proposes dotted notation for consistency.
        // If array access is needed, we might need a more robust parser or regex.
        // Let's assume standard JS property access for now or simple dotted.

        if (!(part in current)) {
            // If we are creating new structure, default to object
            // But if the *next* part is a number, maybe array?
            // Let's keep it simple: objects only for auto-creation.
            current[part] = {};
        }
        current = current[part];
    }

    const last = parts[parts.length - 1];
    current[last] = value;
}

/**
 * Writes an entity back to its file path in YAML format.
 * Preserves the file path from the entity record.
 */
export async function saveEntity(entity: Entity): Promise<void> {
    if (!entity.filePath) {
        throw new Error(`Entity ${entity.id} (${entity.entityType}) has no filePath, cannot save.`);
    }

    // We use the 'yaml' package which is already a dependency.
    // We rely on standard stringify. 
    // In a real IDE we might want to preserve comments, but for now strict serialization is fine.
    const content = stringifyYaml(entity.data);
    await fs.writeFile(entity.filePath, content, 'utf8');
}

/**
 * Applies a proposed change to the bundle in-memory.
 * Returns the modified bundle (mutates in place for simplicity in this context, 
 * or we could clone if immutability is required - but bundle is large).
 */
export function applyChange(bundle: Bundle, change: ProposedChange): void {
    const entityTypeMap = bundle.entities.get(change.entityType);
    if (!entityTypeMap) {
        throw new Error(`Entity type ${change.entityType} not found in bundle.`);
    }

    const entity = entityTypeMap.get(change.entityId);
    if (!entity) {
        throw new Error(`Entity ${change.entityId} not found in bundle.`);
    }

    // Apply the change to the entity data
    setPath(entity.data, change.fieldPath, change.newValue);
}
