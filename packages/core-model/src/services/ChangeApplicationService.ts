/**
 * ChangeApplicationService
 * 
 * Pure service for applying proposed changes to a bundle in-memory.
 * Extracted from the /agent/accept route handler for testability.
 */

import { Bundle, ProposedChange } from '../types';
import { applyChange } from '../write';

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
 * This is a pure function that mutates the bundle's entity data.
 * It does NOT persist changes to disk - that responsibility remains
 * with the caller (typically the route handler).
 * 
 * @param bundle - The bundle to modify (mutated in-place)
 * @param changes - Array of proposed changes to apply
 * @returns Result with success status, modified files/entities, and any errors
 */
export function applyChangesToBundle(
    bundle: Bundle,
    changes: ProposedChange[]
): ApplyChangesResult {
    const modifiedFiles: string[] = [];
    const modifiedEntities: string[] = [];
    const errors: string[] = [];

    for (const change of changes) {
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
