/**
 * Mutation tools - modifying bundle data.
 * 
 * Tools:
 * - apply_changes: Apply multiple changes to a bundle atomically
 */

import { z } from "zod";
import * as path from "path";
import * as fs from "fs/promises";
import { Bundle, loadBundleWithSchemaValidation, saveEntity, createEntity, applyChange, compileDocumentSchemas, validateEntityWithSchemas } from "@sdd-bundle-editor/core-model";
import { ToolContext } from "./types.js";
import { registerMutatingTool } from "./registry.js";
import { toolSuccess, toolError, type Diagnostic as ResponseDiagnostic } from "../response-helpers.js";

/**
 * Register mutation tools.
 */
export function registerMutationTools(ctx: ToolContext): void {
    const { server, bundles, getBundle, getBundleIds, isSingleBundleMode } = ctx;

    // Tool: apply_changes
    registerMutatingTool(
        server,
        "apply_changes",
        "Apply multiple changes to a bundle atomically. Supports create, update, and delete operations. All changes are validated against schemas and reference integrity before writing. dryRun defaults to true for safety - set to false to actually write changes. Returns detailed diagnostics on failure with changeIndex indicating which change caused each error.",
        {
            bundleId: z.string().optional().describe("Bundle ID (optional in single-bundle mode)"),
            changes: z.array(z.object({
                operation: z.enum(["create", "update", "delete"]).describe("Type of operation"),
                entityType: z.string().describe("Entity type (e.g., 'Requirement', 'Task', 'Feature')"),
                entityId: z.string().describe("Entity ID"),
                fieldPath: z.string().optional().describe("For updates: dot-notation path to field (e.g., 'description', 'priority'). Field MUST exist in schema."),
                value: z.any().optional().describe("For updates: new value for the field. For creates: ignored if 'data' is provided"),
                data: z.any().optional().describe("For creates: complete entity data object"),
            })).describe("Array of changes to apply atomically"),
            dryRun: z.boolean().default(true).describe("If true (default), validate and return preview without writing files. Set to false to actually write."),
            validate: z.enum(["strict", "warn", "none"]).optional().describe("Schema validation: strict (default for writes), warn (default for dryRun), none"),
            referencePolicy: z.enum(["strict", "warn", "none"]).optional().describe("Reference integrity: strict (default for writes), warn (default for dryRun), none"),
            deleteMode: z.enum(["restrict", "orphan"]).default("restrict").describe("Delete behavior: restrict (fail if referenced), orphan (allow dangling refs)"),
        },
        async ({ bundleId, changes, dryRun, validate: validateParam, referencePolicy: refPolicyParam, deleteMode }) => {
            const TOOL_NAME = "apply_changes";

            const loaded = getBundle(bundleId);
            if (!loaded) {
                if (!bundleId && !isSingleBundleMode()) {
                    return toolError(TOOL_NAME, "BAD_REQUEST", "Multiple bundles loaded. Please specify bundleId.", { availableBundles: getBundleIds() });
                }
                return toolError(TOOL_NAME, "NOT_FOUND", `Bundle not found: ${bundleId}`, { bundleId });
            }

            const bundleDir = loaded.path;
            const effectiveBundleId = loaded.id;

            // Determine effective validation modes based on dryRun
            const effectiveValidate = validateParam ?? (dryRun ? "warn" : "strict");
            const effectiveRefPolicy = refPolicyParam ?? (dryRun ? "warn" : "strict");

            // Load a fresh working bundle copy
            let workingBundle: Bundle;
            try {
                const { bundle } = await loadBundleWithSchemaValidation(bundleDir);
                workingBundle = bundle;
            } catch (err) {
                return toolError(TOOL_NAME, "INTERNAL", `Failed to load bundle for modification: ${err instanceof Error ? err.message : String(err)}`);
            }

            // Compile schemas for validation
            let compiledSchemas;
            try {
                compiledSchemas = await compileDocumentSchemas(bundleDir, workingBundle.manifest);
            } catch (err) {
                return toolError(TOOL_NAME, "INTERNAL", `Failed to compile schemas: ${err instanceof Error ? err.message : String(err)}`);
            }

            // Load raw schemas for field existence checking
            const rawSchemas = new Map<string, Record<string, unknown>>();
            for (const [entityType, relPath] of Object.entries(workingBundle.manifest.spec?.schemas?.documents ?? {})) {
                try {
                    const schemaPath = path.join(bundleDir, relPath);
                    const schemaContent = await fs.readFile(schemaPath, 'utf8');
                    rawSchemas.set(entityType, JSON.parse(schemaContent));
                } catch {
                    // Schema loading failed - skip
                }
            }

            // Track results per change
            interface ChangeResult {
                index: number;
                operation: string;
                entityType: string;
                entityId: string;
                status: "would_apply" | "applied" | "error";
                resultEntity?: unknown;
                affectedFiles?: string[];
                diagnostics: ResponseDiagnostic[];
                error?: { code: string; message: string };
            }

            const results: ChangeResult[] = [];
            const modifiedFiles: string[] = [];
            const deletedFiles: string[] = [];
            let hasBlockingErrors = false;

            // Helper to check if a field path exists in schema
            function fieldExistsInSchema(schema: Record<string, unknown>, fieldPath: string): boolean {
                const parts = fieldPath.split(".");
                let current: any = schema;

                for (const part of parts) {
                    if (!current.properties) return false;
                    if (!(part in current.properties)) return false;
                    current = current.properties[part];
                }
                return true;
            }

            // Helper to extract sdd-ref fields from entity data
            function extractRefs(data: Record<string, unknown>, schema: Record<string, unknown>): Array<{ field: string; targetId: string }> {
                const refs: Array<{ field: string; targetId: string }> = [];
                const props = (schema as any).properties || {};

                for (const [field, fieldSchema] of Object.entries(props)) {
                    const fs = fieldSchema as any;
                    const fieldValue = data[field];
                    if (!fieldValue) continue;

                    // Check for format: sdd-ref
                    if (fs.format === "sdd-ref" && typeof fieldValue === "string") {
                        refs.push({ field, targetId: fieldValue });
                    }
                    // Check for array of refs
                    if (fs.type === "array" && fs.items?.format === "sdd-ref" && Array.isArray(fieldValue)) {
                        for (const targetId of fieldValue) {
                            if (typeof targetId === "string") {
                                refs.push({ field, targetId });
                            }
                        }
                    }
                }
                return refs;
            }

            // Process each change
            for (let i = 0; i < changes.length; i++) {
                const change = changes[i];
                const result: ChangeResult = {
                    index: i,
                    operation: change.operation,
                    entityType: change.entityType,
                    entityId: change.entityId,
                    status: "would_apply",
                    diagnostics: [],
                };
                results.push(result);

                const schema = rawSchemas.get(change.entityType);

                try {
                    switch (change.operation) {
                        case "create": {
                            const entityData = change.data ?? { id: change.entityId };

                            // Validate schema if not none
                            if (effectiveValidate !== "none" && schema) {
                                // Create entity in-memory first
                                const entity = createEntity(workingBundle, bundleDir, change.entityType, change.entityId, entityData);

                                // Validate against schema
                                const schemaDiags = validateEntityWithSchemas(compiledSchemas, entity);
                                for (const d of schemaDiags) {
                                    result.diagnostics.push({
                                        severity: d.severity,
                                        code: d.code,
                                        message: d.message,
                                        entityType: change.entityType,
                                        entityId: change.entityId,
                                        field: d.path,
                                    });
                                }

                                if (schemaDiags.some(d => d.severity === "error") && effectiveValidate === "strict") {
                                    result.status = "error";
                                    result.error = { code: "VALIDATION_ERROR", message: "Schema validation failed" };
                                    hasBlockingErrors = true;
                                    continue;
                                }

                                result.resultEntity = entity.data;
                                result.affectedFiles = [entity.filePath];
                                if (!modifiedFiles.includes(entity.filePath)) {
                                    modifiedFiles.push(entity.filePath);
                                }
                            } else {
                                // No validation - just create
                                const entity = createEntity(workingBundle, bundleDir, change.entityType, change.entityId, entityData);
                                result.resultEntity = entity.data;
                                result.affectedFiles = [entity.filePath];
                                if (!modifiedFiles.includes(entity.filePath)) {
                                    modifiedFiles.push(entity.filePath);
                                }
                            }

                            // Check reference integrity for create
                            if (effectiveRefPolicy !== "none" && schema) {
                                const refs = extractRefs(entityData, schema);
                                for (const ref of refs) {
                                    if (!workingBundle.idRegistry.has(ref.targetId)) {
                                        result.diagnostics.push({
                                            severity: effectiveRefPolicy === "strict" ? "error" : "warning",
                                            code: "REFERENCE_ERROR",
                                            message: `Reference to non-existent entity: ${ref.targetId}`,
                                            entityType: change.entityType,
                                            entityId: change.entityId,
                                            field: ref.field,
                                        });
                                        if (effectiveRefPolicy === "strict") {
                                            result.status = "error";
                                            result.error = { code: "REFERENCE_ERROR", message: `Broken reference: ${ref.field} -> ${ref.targetId}` };
                                            hasBlockingErrors = true;
                                        }
                                    }
                                }
                            }
                            break;
                        }

                        case "update": {
                            if (!change.fieldPath) {
                                result.status = "error";
                                result.error = { code: "BAD_REQUEST", message: "Update operation requires fieldPath" };
                                hasBlockingErrors = true;
                                continue;
                            }

                            // Non-upserting: check if field exists in schema
                            if (effectiveValidate !== "none" && schema) {
                                if (!fieldExistsInSchema(schema, change.fieldPath)) {
                                    result.status = "error";
                                    result.error = {
                                        code: "VALIDATION_ERROR",
                                        message: `Field '${change.fieldPath}' does not exist in ${change.entityType} schema. Updates cannot create new fields.`
                                    };
                                    result.diagnostics.push({
                                        severity: "error",
                                        code: "VALIDATION_ERROR",
                                        message: `Unknown field: ${change.fieldPath}`,
                                        entityType: change.entityType,
                                        entityId: change.entityId,
                                        field: change.fieldPath,
                                    });
                                    hasBlockingErrors = true;
                                    continue;
                                }
                            }

                            // Check entity exists BEFORE calling applyChange
                            // This prevents the applyChange throw from being caught as INTERNAL
                            const entityMap = workingBundle.entities.get(change.entityType);
                            const entity = entityMap?.get(change.entityId);

                            if (!entity) {
                                result.status = "error";
                                result.error = { code: "NOT_FOUND", message: `Entity not found: ${change.entityType}/${change.entityId}` };
                                hasBlockingErrors = true;
                                continue;
                            }

                            // Apply change in-memory (entity is guaranteed to exist now)
                            applyChange(workingBundle, {
                                entityType: change.entityType,
                                entityId: change.entityId,
                                fieldPath: change.fieldPath,
                                newValue: change.value,
                                originalValue: null,
                            });

                            // Validate the updated entity against schema
                            if (effectiveValidate !== "none") {
                                const schemaDiags = validateEntityWithSchemas(compiledSchemas, entity);
                                for (const d of schemaDiags) {
                                    result.diagnostics.push({
                                        severity: d.severity,
                                        code: d.code,
                                        message: d.message,
                                        entityType: change.entityType,
                                        entityId: change.entityId,
                                        field: d.path,
                                    });
                                }

                                if (schemaDiags.some(d => d.severity === "error") && effectiveValidate === "strict") {
                                    result.status = "error";
                                    result.error = { code: "VALIDATION_ERROR", message: "Schema validation failed after update" };
                                    hasBlockingErrors = true;
                                    continue;
                                }
                            }

                            // Check reference integrity for the updated field if it's a ref
                            if (effectiveRefPolicy !== "none" && schema) {
                                const refs = extractRefs(entity.data as Record<string, unknown>, schema);
                                for (const ref of refs) {
                                    if (!workingBundle.idRegistry.has(ref.targetId)) {
                                        result.diagnostics.push({
                                            severity: effectiveRefPolicy === "strict" ? "error" : "warning",
                                            code: "REFERENCE_ERROR",
                                            message: `Reference to non-existent entity: ${ref.targetId}`,
                                            entityType: change.entityType,
                                            entityId: change.entityId,
                                            field: ref.field,
                                        });
                                        if (effectiveRefPolicy === "strict") {
                                            result.status = "error";
                                            result.error = { code: "REFERENCE_ERROR", message: `Broken reference: ${ref.field} -> ${ref.targetId}` };
                                            hasBlockingErrors = true;
                                        }
                                    }
                                }
                            }

                            result.resultEntity = entity.data;
                            result.affectedFiles = [entity.filePath];
                            if (!modifiedFiles.includes(entity.filePath)) {
                                modifiedFiles.push(entity.filePath);
                            }
                            break;
                        }

                        case "delete": {
                            const entityMap = workingBundle.entities.get(change.entityType);
                            const entity = entityMap?.get(change.entityId);

                            if (!entity) {
                                result.status = "error";
                                result.error = { code: "NOT_FOUND", message: `Entity not found: ${change.entityType}/${change.entityId}` };
                                hasBlockingErrors = true;
                                continue;
                            }

                            // Check for incoming references if deleteMode is restrict
                            if (deleteMode === "restrict") {
                                const incomingRefs: Array<{ fromType: string; fromId: string; field: string }> = [];
                                for (const edge of workingBundle.refGraph.edges) {
                                    if (edge.toId === change.entityId && edge.toEntityType === change.entityType) {
                                        incomingRefs.push({
                                            fromType: edge.fromEntityType,
                                            fromId: edge.fromId,
                                            field: edge.fromField,
                                        });
                                    }
                                }

                                if (incomingRefs.length > 0) {
                                    result.status = "error";
                                    result.error = {
                                        code: "DELETE_BLOCKED",
                                        message: `Cannot delete: ${incomingRefs.length} entity/entities reference this ${change.entityType}`
                                    };
                                    result.diagnostics.push({
                                        severity: "error",
                                        code: "DELETE_BLOCKED",
                                        message: `Referenced by: ${incomingRefs.map(r => `${r.fromType}:${r.fromId}.${r.field}`).join(", ")}`,
                                        entityType: change.entityType,
                                        entityId: change.entityId,
                                    });
                                    hasBlockingErrors = true;
                                    continue;
                                }
                            }

                            deletedFiles.push(entity.filePath);
                            result.affectedFiles = [entity.filePath];

                            // Remove from bundle in-memory
                            entityMap!.delete(change.entityId);
                            workingBundle.idRegistry.delete(change.entityId);
                            break;
                        }
                    }
                } catch (err) {
                    result.status = "error";
                    result.error = { code: "INTERNAL", message: err instanceof Error ? err.message : String(err) };
                    hasBlockingErrors = true;
                }
            }

            // If strict mode and there are errors, fail atomically
            if (hasBlockingErrors) {
                // Determine most appropriate top-level error code based on per-change errors
                const failedResults = results.filter(r => r.status === "error");
                let topLevelCode: "NOT_FOUND" | "REFERENCE_ERROR" | "DELETE_BLOCKED" | "VALIDATION_ERROR" = "VALIDATION_ERROR";

                // Priority: NOT_FOUND > DELETE_BLOCKED > REFERENCE_ERROR > VALIDATION_ERROR
                if (failedResults.some(r => r.error?.code === "NOT_FOUND")) {
                    topLevelCode = "NOT_FOUND";
                } else if (failedResults.some(r => r.error?.code === "DELETE_BLOCKED")) {
                    topLevelCode = "DELETE_BLOCKED";
                } else if (failedResults.some(r => r.error?.code === "REFERENCE_ERROR")) {
                    topLevelCode = "REFERENCE_ERROR";
                }

                return toolError(
                    TOOL_NAME,
                    topLevelCode,
                    `${failedResults.length} change(s) failed`,
                    {
                        dryRun,
                        validate: effectiveValidate,
                        referencePolicy: effectiveRefPolicy,
                        results
                    }
                );
            }

            // Dry run - return preview
            if (dryRun) {
                return toolSuccess(TOOL_NAME, {
                    dryRun: true,
                    validate: effectiveValidate,
                    referencePolicy: effectiveRefPolicy,
                    wouldApply: changes.length,
                    wouldModify: modifiedFiles,
                    wouldDelete: deletedFiles,
                    results,
                }, {
                    bundleId: effectiveBundleId,
                    meta: { changesCount: changes.length },
                    diagnostics: results.flatMap(r => r.diagnostics),
                });
            }

            // Actually write changes to disk
            for (const change of changes) {
                if (change.operation === "create" || change.operation === "update") {
                    const entityMap = workingBundle.entities.get(change.entityType);
                    const entity = entityMap?.get(change.entityId);
                    if (entity) {
                        await saveEntity(entity, bundleDir);
                    }
                }
            }

            // Delete files
            for (const relPath of deletedFiles) {
                try {
                    await fs.unlink(path.join(bundleDir, relPath));
                } catch (err) {
                    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
                        throw err;
                    }
                }
            }

            // Reload bundle into cache
            const { bundle: reloadedBundle, diagnostics: reloadedDiagnostics } = await loadBundleWithSchemaValidation(bundleDir);
            loaded.bundle = reloadedBundle;
            loaded.diagnostics = reloadedDiagnostics;

            // Update result statuses
            for (const r of results) {
                if (r.status === "would_apply") {
                    r.status = "applied";
                }
            }

            return toolSuccess(TOOL_NAME, {
                dryRun: false,
                validate: effectiveValidate,
                referencePolicy: effectiveRefPolicy,
                applied: changes.length,
                modifiedFiles: modifiedFiles,
                deletedFiles: deletedFiles,
                results,
            }, {
                bundleId: effectiveBundleId,
                meta: { changesCount: changes.length },
                diagnostics: results.flatMap(r => r.diagnostics),
            });
        }
    );
}
