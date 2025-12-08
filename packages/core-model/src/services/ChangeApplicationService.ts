/**
 * ChangeApplicationService
 * 
 * Pure service for applying proposed changes to a bundle in-memory.
 * Extracted from the /agent/accept route handler for testability.
 */

import { Bundle, ProposedChange } from '../types';
import { applyChange, createEntity } from '../write';

/**
 * Result of applying changes to a bundle.
 */
export interface ApplyChangesResult {
    success: boolean;
    /** Absolute file paths of modified entities */
    modifiedFiles: string[];
    /** Entity keys in "entityType:entityId" format */
    modifiedEntities: string[];
    /** Error messages if any changes failed to apply */
    errors?: string[];
}

/**
 * Applies an array of proposed changes to a bundle in-memory.
 * 
 * This function handles both entity creation and modification:
 * - Creates: When originalValue is null/undefined AND entity doesn't exist, creates a new entity
 * - Modifications: When entity exists, modifies it (even if originalValue is null for new fields)
 * 
 * When the LLM proposes creating a new entity, it often sends multiple field changes
 * (title, description, etc.) all with originalValue: null. This function groups them
 * and creates the entity once, then applies remaining fields as modifications.
 * 
 * @param bundle - The bundle to modify (mutated in-place)
 * @param bundleDir - Root directory of the bundle (needed for file path generation)
 * @param changes - Array of proposed changes to apply
 * @returns Result with success status, modified files/entities, and any errors
 */
export function applyChangesToBundle(
    bundle: Bundle,
    bundleDir: string,
    changes: ProposedChange[]
): ApplyChangesResult {
    const modifiedFiles: string[] = [];
    const modifiedEntities: string[] = [];
    const errors: string[] = [];

    // Track which entities we've already created in this batch
    const createdInThisBatch = new Set<string>();

    // Group changes by entityKey for smarter processing
    const changesByEntity = new Map<string, ProposedChange[]>();
    for (const change of changes) {
        const key = `${change.entityType}:${change.entityId}`;
        if (!changesByEntity.has(key)) {
            changesByEntity.set(key, []);
        }
        changesByEntity.get(key)!.push(change);
    }

    // Process each entity's changes
    for (const [entityKey, entityChanges] of changesByEntity) {
        const [entityType, entityId] = entityKey.split(':');

        // Check if entity already exists in the bundle
        const existingEntityMap = bundle.entities.get(entityType);
        const entityExists = existingEntityMap?.has(entityId) ?? false;

        if (!entityExists) {
            // Entity doesn't exist - we need to create it first
            // Collect all field values from "create" changes (originalValue null/undefined)
            const createChanges = entityChanges.filter(c => c.originalValue === null || c.originalValue === undefined);

            if (createChanges.length > 0) {
                try {
                    // Build initial entity data from all create changes
                    let initialData: Record<string, unknown> = {};
                    for (const change of createChanges) {
                        // Handle special case: when fieldPath is "data" or empty,
                        // the newValue IS the entire entity data object
                        if (change.fieldPath === 'data' || change.fieldPath === '' || !change.fieldPath) {
                            // Merge the entire object as entity data
                            if (typeof change.newValue === 'object' && change.newValue !== null) {
                                initialData = { ...initialData, ...change.newValue };
                            }
                        } else {
                            // Handle nested field paths (e.g., "metadata.title")
                            setNestedValue(initialData, change.fieldPath, change.newValue);
                        }
                    }

                    // Create the entity once with all initial data
                    const entity = createEntity(bundle, bundleDir, entityType, entityId, initialData);
                    createdInThisBatch.add(entityKey);

                    // Track created entity
                    if (entity.filePath) {
                        if (!modifiedFiles.includes(entity.filePath)) {
                            modifiedFiles.push(entity.filePath);
                        }
                        if (!modifiedEntities.includes(entityKey)) {
                            modifiedEntities.push(entityKey);
                        }
                    }
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    errors.push(`Failed to create ${entityKey}: ${message}`);
                    continue; // Skip remaining changes for this entity
                }
            }
        }

        // Now apply any modifications (entity should exist now)
        // For existing entities, we apply all changes
        // For newly created entities, we apply any changes that weren't part of the create batch
        const modificationChanges = entityExists
            ? entityChanges  // All changes are modifications for existing entities
            : entityChanges.filter(c => c.originalValue !== null && c.originalValue !== undefined);

        for (const change of modificationChanges) {
            try {
                applyChange(bundle, change);

                const entityMap = bundle.entities.get(change.entityType);
                const entity = entityMap?.get(change.entityId);

                if (entity?.filePath) {
                    if (!modifiedFiles.includes(entity.filePath)) {
                        modifiedFiles.push(entity.filePath);
                    }
                    if (!modifiedEntities.includes(entityKey)) {
                        modifiedEntities.push(entityKey);
                    }
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                errors.push(`Failed to apply change to ${entityKey}: ${message}`);
            }
        }
    }

    return {
        success: errors.length === 0,
        modifiedFiles,
        modifiedEntities,
        errors: errors.length > 0 ? errors : undefined,
    };
}

/**
 * Helper to set a nested value in an object using dot notation.
 * e.g., setNestedValue(obj, 'a.b.c', 'value') sets obj.a.b.c = 'value'
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!(part in current) || typeof current[part] !== 'object') {
            current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
    }

    const last = parts[parts.length - 1];
    current[last] = value;
}
