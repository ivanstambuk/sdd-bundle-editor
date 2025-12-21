import * as fs from 'node:fs/promises';
import * as path from 'node:path';
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
 * Creates a new entity and adds it to the bundle.
 * Generates a file path (relative to bundleDir) based on the bundle's manifest layout configuration.
 * 
 * @param bundle - The bundle to add the entity to
 * @param bundleDir - Root directory of the bundle
 * @param entityType - Type of entity (e.g., 'Feature', 'Requirement')
 * @param entityId - Unique ID for the entity
 * @param data - Entity data object
 * @returns The created entity
 */
export function createEntity(
    bundle: Bundle,
    bundleDir: string,
    entityType: string,
    entityId: string,
    data: any
): Entity {
    // Get or create the entity type map
    let entityMap = bundle.entities.get(entityType);
    if (!entityMap) {
        entityMap = new Map();
        bundle.entities.set(entityType, entityMap);
    }

    // Check if entity already exists
    if (entityMap.has(entityId)) {
        throw new Error(`Entity ${entityType}:${entityId} already exists in bundle.`);
    }

    // Determine file path from bundle's layout configuration
    // Layout is defined in manifest.spec.layout.documents[entityType]
    const layout = bundle.manifest.spec.layout.documents[entityType];
    let relativeFilePath: string;

    if (layout) {
        // Use layout from manifest (e.g., { dir: "bundle/features", filePattern: "{id}.yaml" })
        const fileName = layout.filePattern.replace('{id}', entityId);
        relativeFilePath = path.join(layout.dir, fileName);
    } else {
        // Fallback to default pattern if no layout is defined for this entity type
        relativeFilePath = path.join(entityType.toLowerCase(), `${entityId}.yaml`);
    }

    // Create the entity with relative path (consistent with discoverEntities)
    const entity: Entity = {
        id: entityId,
        entityType,
        filePath: relativeFilePath,
        data,
    };

    // Add to bundle
    entityMap.set(entityId, entity);

    return entity;
}

/**
 * Writes an entity back to its file path in YAML format.
 * The entity's filePath is relative to bundleDir.
 * 
 * @param entity - The entity to save
 * @param bundleDir - Root directory of the bundle (to resolve relative paths)
 */
export async function saveEntity(entity: Entity, bundleDir: string): Promise<void> {
    if (!entity.filePath) {
        throw new Error(`Entity ${entity.id} (${entity.entityType}) has no filePath, cannot save.`);
    }

    // Resolve the full path from bundleDir + relative filePath
    const fullPath = path.join(bundleDir, entity.filePath);

    // Ensure directory exists
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // We use the 'yaml' package which is already a dependency.
    const content = stringifyYaml(entity.data);
    await fs.writeFile(fullPath, content, 'utf8');
}

/**
 * Deletes an entity from the bundle (in-memory) and optionally from disk.
 * 
 * @param bundle - The bundle to remove the entity from
 * @param entityType - Type of entity to delete
 * @param entityId - ID of the entity to delete
 * @param bundleDir - Root directory of the bundle (to resolve relative paths)
 * @param deleteFile - If true, also delete the file from disk (default: false for in-memory only)
 * @returns The deleted entity, or undefined if not found
 */
export async function deleteEntity(
    bundle: Bundle,
    entityType: string,
    entityId: string,
    bundleDir: string,
    deleteFile: boolean = false
): Promise<Entity | undefined> {
    const entityMap = bundle.entities.get(entityType);
    if (!entityMap) {
        return undefined;
    }

    const entity = entityMap.get(entityId);
    if (!entity) {
        return undefined;
    }

    // Remove from bundle's entity map
    entityMap.delete(entityId);

    // Remove from id registry if present
    bundle.idRegistry.delete(entityId);

    // Optionally delete the file from disk
    if (deleteFile && entity.filePath) {
        try {
            const fullPath = path.join(bundleDir, entity.filePath);
            await fs.unlink(fullPath);
        } catch (err) {
            // File might not exist on disk yet (newly created but not saved)
            // Ignore ENOENT errors
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw err;
            }
        }
    }

    return entity;
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
