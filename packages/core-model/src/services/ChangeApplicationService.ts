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
 * - Creates: When originalValue is null/undefined, creates a new entity
 * - Modifications: When originalValue exists, modifies the existing entity
 * 
 * Creation happens before modifications to ensure entities exist before being modified.
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

    // Separate creates from modifications
    const creates = changes.filter(c => c.originalValue === null || c.originalValue === undefined);
    const modifications = changes.filter(c => c.originalValue !== null && c.originalValue !== undefined);

    // Step 1: Handle creates first
    for (const change of creates) {
        try {
            // For creates, the newValue should be the entire entity data
            const entityData = change.newValue;
            const entity = createEntity(bundle, bundleDir, change.entityType, change.entityId, entityData);

            // Track created entity
            if (entity.filePath) {
                if (!modifiedFiles.includes(entity.filePath)) {
                    modifiedFiles.push(entity.filePath);
                }
                const entityKey = `${change.entityType}:${change.entityId}`;
                if (!modifiedEntities.includes(entityKey)) {
                    modifiedEntities.push(entityKey);
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`Failed to create ${change.entityType}:${change.entityId}: ${message}`);
        }
    }

    // Step 2: Handle modifications
    for (const change of modifications) {
        try {
            applyChange(bundle, change);

            const entityMap = bundle.entities.get(change.entityType);
            const entity = entityMap?.get(change.entityId);

            if (entity?.filePath) {
                // Track unique files and entities
                if (!modifiedFiles.includes(entity.filePath)) {
                    modifiedFiles.push(entity.filePath);
                }
                const entityKey = `${change.entityType}:${change.entityId}`;
                if (!modifiedEntities.includes(entityKey)) {
                    modifiedEntities.push(entityKey);
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`Failed to apply change to ${change.entityType}:${change.entityId}: ${message}`);
        }
    }

    return {
        success: errors.length === 0,
        modifiedFiles,
        modifiedEntities,
        errors: errors.length > 0 ? errors : undefined,
    };
}
