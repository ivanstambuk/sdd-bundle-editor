/**
 * Dynamic binding prompts backed by bundle entities.
 *
 * These prompts are registered from BindingPromptTemplate entities after bundles
 * are loaded. The adapter is generic at the registration layer while prompt-role
 * specific context assembly remains explicit and auditable.
 */

import { completable } from "@modelcontextprotocol/sdk/server/completable.js";
import type { ZodRawShapeCompat, AnySchema } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { z } from "zod";
import { formatEntitiesForPrompt } from "../entity-utils.js";
import { LoadedBundle } from "../types.js";
import { completableRequiredBundleId } from "./completion-helpers.js";
import { PromptContext } from "./types.js";

type EntityData = Record<string, unknown>;
type BindingPacketType = "implementation" | "conformance";

type BindingPacketResolverContext = Pick<PromptContext, "bundles" | "getBundle" | "getBundleIds">;

interface PromptArgumentData {
    name: string;
    type: "string" | "integer" | "boolean" | "enum";
    required: boolean;
    description: string;
    allowedValues?: string[];
}

interface BindingPromptTemplateData extends EntityData {
    id: string;
    title: string;
    description?: string;
    mcpPromptName: string;
    promptRole: string;
    templateVersion: string;
    arguments?: PromptArgumentData[];
    includesEntityTypes?: string[];
    followsReferenceFields?: string[];
    outputExpectations?: string[];
    defaultModelClass?: string;
    maxContextBudget?: number;
    templateBody: string;
}

interface DiscoveredPromptTemplate {
    bundleId: string;
    template: BindingPromptTemplateData;
}

interface ResolvedEntity {
    entityType: string;
    id: string;
    data: EntityData;
}

interface ResolvedBindingPacket {
    kind: "implementation-packet" | "conformance-packet";
    packetType: BindingPacketType;
    bundleId: string;
    promptName: string;
    promptRole: string;
    templateId: string;
    arguments: Record<string, unknown>;
    messages: Array<{
        role: string;
        content: { type: "text"; text: string };
    }>;
}

/**
 * Register bundle-defined binding prompts with the MCP server.
 *
 * Duplicate MCP prompt names are ignored after the first registration.
 */
export function registerBindingPrompts(ctx: PromptContext): void {
    const templates = discoverBindingPromptTemplates(ctx);

    for (const [promptName, discovered] of templates) {
        ctx.server.registerPrompt(
            promptName,
            {
                description: discovered.template.description ?? discovered.template.title,
                argsSchema: buildArgsSchema(ctx, discovered),
            },
            async (args: Record<string, unknown>) => {
                const bundleId = typeof args.bundleId === "string" ? args.bundleId : undefined;
                const loaded = ctx.getBundle(bundleId);
                if (!loaded) {
                    return promptError(`Bundle not found. Available bundles: ${ctx.getBundleIds().join(", ")}`);
                }

                const selectedTemplate = resolveTemplateForInvocation(templates, promptName, loaded.id);
                if (!selectedTemplate) {
                    return promptError(`No prompt template found for ${promptName} in bundle ${loaded.id}`);
                }

                try {
                    const promptText = buildPromptContent(
                        loaded,
                        selectedTemplate.template,
                        args
                    );
                    return {
                        messages: [{
                            role: "user",
                            content: { type: "text", text: promptText },
                        }],
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return promptError(message);
                }
            }
        );
    }
}

export function resolveBindingPacket(
    ctx: BindingPacketResolverContext,
    args: {
        bundleId?: string;
        packetType: BindingPacketType;
        bindingId: string;
        operationId?: string;
        suiteId?: string;
        artifactMode?: string;
        promptName?: string;
    }
): ResolvedBindingPacket {
    const loaded = ctx.getBundle(args.bundleId);
    if (!loaded) {
        const bundleSuffix = args.bundleId
            ? `: ${args.bundleId}`
            : `. Available bundles: ${ctx.getBundleIds().join(", ")}`;
        throw new Error(`Bundle not found${bundleSuffix}`);
    }

    const template = selectTemplateForPacket(loaded, args.packetType, args.promptName);
    if (!template) {
        const selector = args.promptName ? `prompt ${args.promptName}` : `${args.packetType} packet`;
        throw new Error(`No binding prompt template found for ${selector} in bundle ${loaded.id}`);
    }

    const invocationArgs: Record<string, unknown> = {
        bundleId: loaded.id,
        bindingId: args.bindingId,
    };
    if (typeof args.operationId === "string") {
        invocationArgs.operationId = args.operationId;
    }
    if (typeof args.suiteId === "string") {
        invocationArgs.suiteId = args.suiteId;
    }
    if (typeof args.artifactMode === "string") {
        invocationArgs.artifactMode = args.artifactMode;
    }

    const text = buildPromptContent(loaded, template, invocationArgs);
    return {
        kind: args.packetType === "implementation" ? "implementation-packet" : "conformance-packet",
        packetType: args.packetType,
        bundleId: loaded.id,
        promptName: template.mcpPromptName,
        promptRole: template.promptRole,
        templateId: template.id,
        arguments: invocationArgs,
        messages: [{
            role: "user",
            content: { type: "text", text },
        }],
    };
}

function discoverBindingPromptTemplates(ctx: PromptContext): Map<string, DiscoveredPromptTemplate> {
    const prompts = new Map<string, DiscoveredPromptTemplate>();

    for (const [bundleId, loaded] of ctx.bundles) {
        const templates = loaded.bundle.entities.get("BindingPromptTemplate");
        if (!templates) {
            continue;
        }

        for (const entity of templates.values()) {
            const data = entity.data as BindingPromptTemplateData;
            const promptName = data.mcpPromptName;
            if (!promptName) {
                continue;
            }
            if (prompts.has(promptName)) {
                console.error(
                    `[Prompts] Skipping duplicate dynamic prompt "${promptName}" from bundle ${bundleId}; first registration wins.`
                );
                continue;
            }
            prompts.set(promptName, { bundleId, template: data });
        }
    }

    return prompts;
}

function resolveTemplateForInvocation(
    templates: Map<string, DiscoveredPromptTemplate>,
    promptName: string,
    bundleId: string
): DiscoveredPromptTemplate | undefined {
    const discovered = templates.get(promptName);
    if (!discovered) {
        return undefined;
    }
    if (discovered.bundleId === bundleId) {
        return discovered;
    }
    return discovered;
}

function selectTemplateForPacket(
    loaded: LoadedBundle,
    packetType: BindingPacketType,
    promptName?: string
): BindingPromptTemplateData | undefined {
    const templates = Array.from(loaded.bundle.entities.get("BindingPromptTemplate")?.values() ?? [])
        .map((entity) => entity.data as BindingPromptTemplateData)
        .sort((a, b) => a.id.localeCompare(b.id));

    if (promptName) {
        return templates.find((template) => template.mcpPromptName === promptName);
    }

    const expectedRole = packetType === "implementation" ? "implement-binding" : "generate-binding-tests";
    return templates.find((template) => template.promptRole === expectedRole);
}

function buildArgsSchema(ctx: PromptContext, discovered: DiscoveredPromptTemplate): ZodRawShapeCompat {
    const argsSchema: Record<string, AnySchema> = {
        bundleId: completableRequiredBundleId(ctx, "Bundle ID containing the binding template"),
    };

    for (const arg of discovered.template.arguments ?? []) {
        argsSchema[arg.name] = buildArgumentSchema(ctx, arg);
    }

    return argsSchema;
}

function buildArgumentSchema(ctx: PromptContext, arg: PromptArgumentData): AnySchema {
    if (arg.name === "bindingId") {
        return completable(
            baseStringSchema(arg),
            (_value: string | undefined, context?: { arguments?: Record<string, string> }) => {
                const loaded = ctx.getBundle(context?.arguments?.bundleId);
                const entityMap = loaded?.bundle.entities.get("ImplementationBinding");
                return entityMap ? Array.from(entityMap.keys()) : [];
            }
        );
    }

    if (arg.name === "operationId") {
        return completable(
            baseStringSchema(arg),
            (_value: string | undefined, context?: { arguments?: Record<string, string> }) => {
                const loaded = ctx.getBundle(context?.arguments?.bundleId);
                const entityMap = loaded?.bundle.entities.get("Operation");
                return entityMap ? Array.from(entityMap.keys()) : [];
            }
        );
    }

    if (arg.name === "suiteId") {
        return completable(
            baseStringSchema(arg),
            (_value: string | undefined, context?: { arguments?: Record<string, string> }) => {
                const loaded = ctx.getBundle(context?.arguments?.bundleId);
                const entityMap = loaded?.bundle.entities.get("ConformanceSuite");
                return entityMap ? Array.from(entityMap.keys()) : [];
            }
        );
    }

    switch (arg.type) {
        case "integer": {
            const schema = z.number().int().describe(arg.description);
            return arg.required ? schema : schema.optional();
        }
        case "boolean": {
            const schema = z.boolean().describe(arg.description);
            return arg.required ? schema : schema.optional();
        }
        case "enum": {
            const values = arg.allowedValues ?? [];
            if (values.length === 0) {
                return baseStringSchema(arg);
            }
            const enumSchema = z.enum(values as [string, ...string[]]).describe(arg.description);
            return arg.required ? enumSchema : enumSchema.optional();
        }
        case "string":
        default:
            return baseStringSchema(arg);
    }
}

function baseStringSchema(arg: PromptArgumentData) {
    const schema = z.string().describe(arg.description);
    return arg.required ? schema : schema.optional();
}

function buildPromptContent(
    loaded: LoadedBundle,
    template: BindingPromptTemplateData,
    args: Record<string, unknown>
): string {
    switch (template.promptRole) {
        case "implement-binding":
            return buildImplementBindingPrompt(loaded, template, args);
        case "generate-binding-tests":
            return buildGenerateBindingTestsPrompt(loaded, template, args);
        default:
            return buildGenericBindingPrompt(loaded, template, args);
    }
}

function buildImplementBindingPrompt(
    loaded: LoadedBundle,
    template: BindingPromptTemplateData,
    args: Record<string, unknown>
): string {
    const bindingId = requireStringArg(args, "bindingId");
    const operationId = requireStringArg(args, "operationId");

    const binding = requireEntity(loaded, "ImplementationBinding", bindingId);
    const operation = requireEntity(loaded, "Operation", operationId);
    const runtimeProfile = requireSingleReference(loaded, binding, "runtimeProfileId", "RuntimeProfile");
    const dependencyPolicy = requireSingleReference(loaded, binding, "dependencyPolicyId", "DependencyPolicy");
    const outputContract = requireSingleReference(loaded, binding, "outputContractId", "OutputContract");
    const bindingConstraints = resolveManyReferences(loaded, binding, "constraintIds", "BindingConstraint");
    const targetProfiles = resolveManyReferences(loaded, binding, "targetProfileIds", "TokenProfile");
    const keyStrategies = uniqueResolvedEntities(
        targetProfiles.flatMap((profile) => resolveManyReferences(loaded, profile, "usesKeyStrategyIds", "KeyStrategy"))
    );
    const requestStructures = resolveManyReferences(loaded, operation, "acceptsStructureIds", "DataStructure");
    const resultStructures = resolveManyReferences(loaded, operation, "producesDataStructureIds", "DataStructure");
    const profileStructures = uniqueResolvedEntities([
        ...targetProfiles.flatMap((profile) => resolveOptionalSingleReference(loaded, profile, "acceptsPolicyId", "DataStructure")),
        ...targetProfiles.flatMap((profile) => resolveOptionalSingleReference(loaded, profile, "acceptsContextId", "DataStructure")),
        ...targetProfiles.flatMap((profile) => resolveOptionalSingleReference(loaded, profile, "returnsModelId", "DataStructure")),
    ]);
    const relatedStructures = uniqueResolvedEntities([
        ...requestStructures,
        ...resultStructures,
        ...profileStructures,
        ...requestStructures.flatMap((structure) => resolveManyReferences(loaded, structure, "composesStructureIds", "DataStructure")),
    ]);
    const suites = resolveManyReferences(loaded, binding, "conformanceSuiteIds", "ConformanceSuite");
    const vectors = uniqueResolvedEntities(
        suites.flatMap((suite) => resolveManyReferences(loaded, suite, "containsVectorIds", "TestVector"))
    );
    const fixtures = uniqueResolvedEntities([
        ...suites.flatMap((suite) => resolveManyReferences(loaded, suite, "requiresFixtureIds", "MockKeySet")),
        ...vectors.flatMap((vector) => resolveManyReferences(loaded, vector, "requiresFixtureIds", "MockKeySet")),
        ...vectors.flatMap((vector) => resolveOptionalSingleReference(loaded, vector, "usesMockKeyId", "MockKeySet")),
    ]);
    const validationRules = uniqueResolvedEntities([
        ...vectors.flatMap((vector) => resolveManyReferences(loaded, vector, "validatesRuleIds", "ValidationRule")),
        ...vectors.flatMap((vector) => resolveOptionalSingleReference(loaded, vector, "expectedFailedRuleId", "ValidationRule")),
    ]);
    const errorCodes = uniqueResolvedEntities([
        ...vectors.flatMap((vector) => resolveManyReferences(loaded, vector, "expectsErrorCodeIds", "ErrorCode")),
        ...vectors.flatMap((vector) => resolveOptionalSingleReference(loaded, vector, "expectedPrimaryErrorCodeId", "ErrorCode")),
    ]);
    const validationSteps = resolveRelevantValidationSteps(loaded, validationRules, vectors);
    const securityConstraints = uniqueResolvedEntities(
        validationRules.flatMap((rule) => resolveManyReferences(loaded, rule, "implementsConstraintIds", "SecurityConstraint"))
    );

    const domainKnowledge = truncateText(loaded.bundle.domainMarkdown || "", 1200);
    const normativeVectorMatrix = formatNormativeVectorMatrix(vectors);
    const errorContractMatrix = formatErrorContractMatrix(errorCodes);
    const structureContractMatrix = formatStructureContractMatrix(relatedStructures);
    const fixtureAdaptationMatrix = formatFixtureAdaptationMatrix(fixtures, keyStrategies);
    const exactDtoSchemas = formatExactStructureSchemas(relatedStructures);
    const exactDtoChecklist = formatExactDtoChecklist(relatedStructures);
    const exactVectorDetails = formatExactVectorDetails(vectors);
    const exactFixturePayloads = formatExactFixturePayloads(fixtures);
    const constraintMatrix = formatConstraintMatrix(bindingConstraints);
    const suiteSummary = formatSuiteSummary(suites);
    const profileSummary = formatProfileSummary(targetProfiles);
    const suiteCoverageChecklist = formatSuiteCoverageChecklist(suites);
    const workspaceAcceptanceGates = formatWorkspaceAcceptanceGates(runtimeProfile, suites);
    const entityDerivedGuidance = formatEntityDerivedGuidance([
        { title: "Implementation Binding", entities: [binding] },
        { title: "Runtime Profile", entities: [runtimeProfile] },
        { title: "Dependency Policy", entities: [dependencyPolicy] },
        { title: "Validation Steps", entities: validationSteps },
        { title: "Validation Rules", entities: validationRules },
        { title: "Conformance Vectors", entities: vectors },
    ]);
    const implementationSpine = formatImplementationSpine(validationSteps);
    const ruleProjectionMatrix = formatRuleProjectionMatrix(validationSteps, validationRules);

    return `You are implementing a platform-specific JWT validation binding from Spec Studio bundle data.

## Binding Template
**Prompt Template**: ${template.id}
**Prompt Role**: ${template.promptRole}
**Template Version**: ${template.templateVersion}
**Default Model Class**: ${template.defaultModelClass ?? "unspecified"}
**Max Context Budget**: ${template.maxContextBudget ?? "unspecified"}

## Bundle
**Bundle ID**: ${loaded.id}

## Implementation Binding
\`\`\`json
${JSON.stringify(binding.data, null, 2)}
\`\`\`

## Operation
\`\`\`json
${JSON.stringify(operation.data, null, 2)}
\`\`\`

## Runtime Profile
\`\`\`json
${JSON.stringify(runtimeProfile.data, null, 2)}
\`\`\`

## Dependency Policy
\`\`\`json
${JSON.stringify(dependencyPolicy.data, null, 2)}
\`\`\`

## Output Contract
\`\`\`json
${JSON.stringify(outputContract.data, null, 2)}
\`\`\`

## Target Profile Summary
${profileSummary}

## Exact DTO Schemas
${exactDtoSchemas}

## Exact DTO Checklist
${exactDtoChecklist}

## Key Strategies (${keyStrategies.length})
${formatResolvedEntities(keyStrategies, "summary", 10)}

## Binding Constraint Matrix
${constraintMatrix}

## Conformance Suite Summary
${suiteSummary}

## Suite Coverage Checklist
${suiteCoverageChecklist}

## Implementation Spine
${implementationSpine}

## Rule Precedence And Failure Projection Matrix
${ruleProjectionMatrix}

## Exact Conformance Vector Inputs And Expected Outputs (${vectors.length})
${exactVectorDetails}

## Normative Vector Matrix
${normativeVectorMatrix}

## Error Contract Matrix
${errorContractMatrix}

## Exact Fixture Payloads (${fixtures.length})
${exactFixturePayloads}

## Fixture Adaptation Matrix
${fixtureAdaptationMatrix}

## Workspace Acceptance Gates
${workspaceAcceptanceGates}

## Entity-Derived Guidance
${entityDerivedGuidance}

## Additional Rule And Security References
- Validation rules referenced by vectors: ${validationRules.map((rule) => rule.id).join(", ") || "none"}
- Security constraints referenced by those rules: ${securityConstraints.map((constraint) => constraint.id).join(", ") || "none"}

## Structure Contract Matrix
${structureContractMatrix}

${domainKnowledge ? `## Domain Knowledge\n${domainKnowledge}\n` : ""}
## Template Guidance
${template.templateBody}

## Output Expectations
${(template.outputExpectations ?? []).map(item => `- ${item}`).join("\n") || "- No explicit output expectations configured."}

## Non-Negotiable Semantics
- Treat the modeled expected outcomes and primary errors as normative.
- Preserve the distinction between accepted, rejected, malformed, and indeterminate outcomes.
- Do not collapse multiple modeled failures into a generic runtime-library error such as signature failure.
- If the third-party runtime library is too coarse, add explicit pre-checks or post-checks so the public API still matches the bundle contract.
- Use the implementation spine and rule precedence matrix to decide what must be implemented first and which failures must win within a step.
- When a step establishes public-result state and marks it for preservation on later failure, do not overwrite that state unless a later rule explicitly projects a replacement value.
- When a rule defines a failureProjection, apply that projection exactly for the public result rather than inferring a broader fallback from the overall failure.
- Do not let mismatch rules consume cases that the precedence matrix assigns to missing-claim or malformed-type rules first.
- When vectors use partial payload/header overlays or intentionally omit fields, preserve those omissions in generated helper logic. Do not backfill defaults that erase the modeled scenario.
- Once raw input has already been classified as unsupported container or malformed syntax, do not let later parse or duplicate-key checks replace that earlier classification.
- Follow the exact request and result contracts shown above. Do not invent aliases, omit required fields, or change enum values.
- Use the authoritative vector inputs, policies, contexts, and fixture payloads directly in tests rather than synthesizing replacement scenarios for convenience.
- Generate conformance tests from the modeled vector IDs and authoritative vector inputs. Do not invent substitute or approximate scenarios.
- For non-obvious implementation paths, add concise traceability comments that explain which modeled steps, rules, vectors, or public-result semantics the code is satisfying.
- Emit one generated test for every TestVector ID in the bound ConformanceSuite. Do not claim full coverage if the file contains fewer tests than suite vectors.
- Do not exit before every required artifact path from the output contract exists.
- Write files directly in the workspace. A prose-only plan or design summary is not a valid completion.
- Ensure the declared build and test commands are runnable with the generated files and declared dependencies only.
- A build that compiles but fails these modeled vector semantics is incorrect.

## Your Task
Implement the selected binding as a ${stringValue(args.artifactMode) ?? "library-only"} output.

Requirements:
1. Treat the binding entity as the composition root.
2. Follow the target profile and conformance suite instead of broad JWT generalization.
3. Use only the approved dependency policy.
4. Produce only the artifacts required by the output contract.
5. Keep the public API aligned with the operation and error model.`;
}

function buildGenerateBindingTestsPrompt(
    loaded: LoadedBundle,
    template: BindingPromptTemplateData,
    args: Record<string, unknown>
): string {
    const bindingId = requireStringArg(args, "bindingId");
    const suiteId = requireStringArg(args, "suiteId");

    const binding = requireEntity(loaded, "ImplementationBinding", bindingId);
    const runtimeProfile = requireSingleReference(loaded, binding, "runtimeProfileId", "RuntimeProfile");
    const dependencyPolicy = requireSingleReference(loaded, binding, "dependencyPolicyId", "DependencyPolicy");
    const suite = requireEntity(loaded, "ConformanceSuite", suiteId);
    const operations = resolveManyReferences(loaded, binding, "implementsOperationIds", "Operation");
    const targetProfiles = resolveManyReferences(loaded, binding, "targetProfileIds", "TokenProfile");
    const keyStrategies = uniqueResolvedEntities(
        targetProfiles.flatMap((profile) => resolveManyReferences(loaded, profile, "usesKeyStrategyIds", "KeyStrategy"))
    );
    const requestStructures = uniqueResolvedEntities(
        operations.flatMap((operation) => resolveManyReferences(loaded, operation, "acceptsStructureIds", "DataStructure"))
    );
    const resultStructures = uniqueResolvedEntities(
        operations.flatMap((operation) => resolveManyReferences(loaded, operation, "producesDataStructureIds", "DataStructure"))
    );
    const relatedStructures = uniqueResolvedEntities([
        ...requestStructures,
        ...resultStructures,
        ...requestStructures.flatMap((structure) => resolveManyReferences(loaded, structure, "composesStructureIds", "DataStructure")),
    ]);
    const vectors = resolveManyReferences(loaded, suite, "containsVectorIds", "TestVector");
    const fixtures = uniqueResolvedEntities([
        ...resolveManyReferences(loaded, suite, "requiresFixtureIds", "MockKeySet"),
        ...vectors.flatMap((vector) => resolveManyReferences(loaded, vector, "requiresFixtureIds", "MockKeySet")),
        ...vectors.flatMap((vector) => resolveOptionalSingleReference(loaded, vector, "usesMockKeyId", "MockKeySet")),
    ]);
    const errorCodes = uniqueResolvedEntities([
        ...vectors.flatMap((vector) => resolveManyReferences(loaded, vector, "expectsErrorCodeIds", "ErrorCode")),
        ...vectors.flatMap((vector) => resolveOptionalSingleReference(loaded, vector, "expectedPrimaryErrorCodeId", "ErrorCode")),
    ]);
    const normativeVectorMatrix = formatNormativeVectorMatrix(vectors);
    const errorContractMatrix = formatErrorContractMatrix(errorCodes);
    const structureContractMatrix = formatStructureContractMatrix(relatedStructures);
    const fixtureAdaptationMatrix = formatFixtureAdaptationMatrix(fixtures, keyStrategies);
    const entityDerivedGuidance = formatEntityDerivedGuidance([
        { title: "Implementation Binding", entities: [binding] },
        { title: "Runtime Profile", entities: [runtimeProfile] },
        { title: "Dependency Policy", entities: [dependencyPolicy] },
        { title: "Conformance Vectors", entities: vectors },
    ]);

    return `You are generating runtime-native conformance tests for a JWT implementation binding.

## Binding
\`\`\`json
${JSON.stringify(binding.data, null, 2)}
\`\`\`

## Runtime Profile
\`\`\`json
${JSON.stringify(runtimeProfile.data, null, 2)}
\`\`\`

## Dependency Policy
\`\`\`json
${JSON.stringify(dependencyPolicy.data, null, 2)}
\`\`\`

## Conformance Suite
\`\`\`json
${JSON.stringify(suite.data, null, 2)}
\`\`\`

## Request And Result Structure Contracts (${relatedStructures.length})
${formatResolvedEntities(relatedStructures, "full", 20)}

## Structure Contract Matrix
${structureContractMatrix}

## Key Strategies (${keyStrategies.length})
${formatResolvedEntities(keyStrategies, "full", 10)}

## Test Vectors (${vectors.length})
${formatResolvedEntities(vectors, "full", 50)}

## Normative Vector Matrix
${normativeVectorMatrix}

## Fixtures (${fixtures.length})
${formatResolvedEntities(fixtures, "full", 30)}

## Fixture Adaptation Matrix
${fixtureAdaptationMatrix}

## Error Codes (${errorCodes.length})
${formatResolvedEntities(errorCodes, "summary", 30)}

## Error Contract Matrix
${errorContractMatrix}

## Entity-Derived Guidance
${entityDerivedGuidance}

## Template Guidance
${template.templateBody}

## Output Expectations
${(template.outputExpectations ?? []).map(item => `- ${item}`).join("\n") || "- No explicit output expectations configured."}

## Your Task
Generate the conformance tests for suite ${suiteId}.

Requirements:
1. Preserve vector IDs in test names or fixture names.
2. Assert expected success or failure behavior exactly as modeled.
3. Keep tests aligned with the selected runtime profile and dependency policy.
4. Do not invent extra behavior outside the bundle.
5. Do not replace modeled vectors with approximate handwritten scenarios.
6. Assert modeled expected outcomes and primary errors exactly when present.`;
}

function buildGenericBindingPrompt(
    loaded: LoadedBundle,
    template: BindingPromptTemplateData,
    args: Record<string, unknown>
): string {
    return `You are executing a bundle-defined binding workflow prompt.

## Bundle
**Bundle ID**: ${loaded.id}

## Template
\`\`\`json
${JSON.stringify(template, null, 2)}
\`\`\`

## Invocation Arguments
\`\`\`json
${JSON.stringify(args, null, 2)}
\`\`\`

## Instructions
${template.templateBody}

## Output Expectations
${(template.outputExpectations ?? []).map(item => `- ${item}`).join("\n") || "- No explicit output expectations configured."}`;
}

function requireStringArg(args: Record<string, unknown>, name: string): string {
    const value = args[name];
    if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`Missing required argument: ${name}`);
    }
    return value;
}

function requireEntity(loaded: LoadedBundle, entityType: string, id: string): ResolvedEntity {
    const entity = loaded.bundle.entities.get(entityType)?.get(id);
    if (!entity) {
        throw new Error(`${entityType} ${id} not found in bundle ${loaded.id}`);
    }
    return {
        entityType,
        id,
        data: entity.data as EntityData,
    };
}

function requireSingleReference(
    loaded: LoadedBundle,
    source: ResolvedEntity,
    fieldName: string,
    targetType: string
): ResolvedEntity {
    const resolved = resolveOptionalSingleReference(loaded, source, fieldName, targetType);
    if (resolved.length === 0) {
        throw new Error(`Expected ${source.entityType}:${source.id} to reference ${targetType} via ${fieldName}`);
    }
    return resolved[0];
}

function resolveOptionalSingleReference(
    loaded: LoadedBundle,
    source: ResolvedEntity,
    fieldName: string,
    targetType: string
): ResolvedEntity[] {
    const value = source.data[fieldName];
    if (typeof value !== "string" || value.length === 0) {
        return [];
    }
    return [requireEntity(loaded, targetType, value)];
}

function resolveManyReferences(
    loaded: LoadedBundle,
    source: ResolvedEntity,
    fieldName: string,
    targetType: string
): ResolvedEntity[] {
    const value = source.data[fieldName];
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((item): item is string => typeof item === "string" && item.length > 0)
        .map((id) => requireEntity(loaded, targetType, id));
}

function resolveRelevantValidationSteps(
    loaded: LoadedBundle,
    validationRules: ResolvedEntity[],
    vectors: ResolvedEntity[]
): ResolvedEntity[] {
    const allSteps = Array.from(loaded.bundle.entities.get("ValidationStep")?.values() ?? []).map((entity) => ({
        entityType: "ValidationStep",
        id: String(entity.data.id),
        data: entity.data as EntityData,
    }));
    const relevantRuleIds = new Set(validationRules.map((rule) => rule.id));
    const relevantStepIds = new Set(
        vectors
            .map((vector) => stringValue(vector.data.expectedTerminalStepId))
            .filter((stepId): stepId is string => Boolean(stepId))
    );

    return allSteps
        .filter((step) =>
            relevantStepIds.has(step.id) ||
            arrayOfStrings(step.data.executesRuleIds).some((ruleId) => relevantRuleIds.has(ruleId))
        )
        .sort((left, right) => {
            const leftOrder = numberValue(left.data.executionOrder) ?? Number.MAX_SAFE_INTEGER;
            const rightOrder = numberValue(right.data.executionOrder) ?? Number.MAX_SAFE_INTEGER;
            if (leftOrder !== rightOrder) {
                return leftOrder - rightOrder;
            }
            return left.id.localeCompare(right.id);
        });
}

function uniqueResolvedEntities(entities: ResolvedEntity[]): ResolvedEntity[] {
    const seen = new Set<string>();
    const unique: ResolvedEntity[] = [];

    for (const entity of entities) {
        const key = `${entity.entityType}:${entity.id}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        unique.push(entity);
    }

    return unique;
}

function formatResolvedEntities(
    entities: ResolvedEntity[],
    mode: "full" | "summary",
    maxEntities: number
): string {
    if (entities.length === 0) {
        return "None";
    }

    return formatEntitiesForPrompt(
        entities.map((entity) => ({ data: entity.data })),
        { mode, maxEntities }
    );
}

function formatNormativeVectorMatrix(vectors: ResolvedEntity[]): string {
    if (vectors.length === 0) {
        return "None";
    }

    return vectors.map((vector) => {
        const title = stringValue(vector.data.title) ?? vector.id;
        const outcome = stringValue(vector.data.expectedOutcomeClass) ?? "unspecified";
        const primaryError = stringValue(vector.data.expectedPrimaryErrorCodeId) ?? "none";
        const failedRule = stringValue(vector.data.expectedFailedRuleId) ?? "none";
        const trustDecision = stringValue(vector.data.expectedTrustDecision) ?? "unspecified";
        const keySelection = stringValue(vector.data.expectedKeySelectionStatus) ?? "unspecified";
        return `- ${vector.id} (${title}): outcome=${outcome}; primaryError=${primaryError}; failedRule=${failedRule}; trust=${trustDecision}; keySelection=${keySelection}`;
    }).join("\n");
}

function formatErrorContractMatrix(errorCodes: ResolvedEntity[]): string {
    if (errorCodes.length === 0) {
        return "None";
    }

    return errorCodes.map((errorCode) => {
        const outcome = stringValue(errorCode.data.outcomeClass) ?? "unspecified";
        const messageTemplate = stringValue(errorCode.data.messageTemplate) ?? "unspecified";
        const description = stringValue(errorCode.data.description) ?? "unspecified";
        return `- ${errorCode.id}: outcomeClass=${outcome}; messageTemplate="${messageTemplate}"; description=${description}`;
    }).join("\n");
}

function formatStructureContractMatrix(structures: ResolvedEntity[]): string {
    if (structures.length === 0) {
        return "None";
    }

    return structures.map((structure) => {
        const schema = objectValue(structure.data.schemaDefinition);
        const required = arrayOfStrings(schema?.required).join(", ") || "none";
        const properties = objectValue(schema?.properties);
        const propertyNames = properties ? Object.keys(properties).join(", ") : "none";
        return `- ${structure.id}: required=[${required}]; properties=[${propertyNames}]`;
    }).join("\n");
}

function formatFixtureAdaptationMatrix(fixtures: ResolvedEntity[], keyStrategies: ResolvedEntity[]): string {
    if (fixtures.length === 0) {
        return "None";
    }

    const usesStaticJwks = keyStrategies.some((strategy) => strategy.id === "KEY-static-jwks");
    const notes = fixtures.map((fixture) => {
        const fixtureMode = stringValue(fixture.data.fixtureMode) ?? "unspecified";
        if (usesStaticJwks && fixtureMode === "static-keyset") {
            return `- ${fixture.id}: fixtureMode=${fixtureMode}; map fixture.jwks -> validationContext.trustedJwks`;
        }
        return `- ${fixture.id}: fixtureMode=${fixtureMode}; use fixture data exactly as modeled`;
    });

    return notes.join("\n");
}

function formatImplementationSpine(steps: ResolvedEntity[]): string {
    if (steps.length === 0) {
        return "None";
    }

    return steps.map((step) => {
        const title = stringValue(step.data.title) ?? step.id;
        const order = numberValue(step.data.executionOrder) ?? "?";
        const abortOnFailure = typeof step.data.abortOnFailure === "boolean"
            ? String(step.data.abortOnFailure)
            : "unspecified";
        const rules = arrayOfStrings(step.data.executesRuleIds);
        const successProjection = formatProjectionObject(objectValue(step.data.successfulCompletionProjection));
        const preservedFields = arrayOfStrings(step.data.preserveProjectedFieldsOnLaterFailure);

        return [
            `- ${step.id} (${title})`,
            `  - executionOrder=${order}; abortOnFailure=${abortOnFailure}`,
            `  - executesRules=[${rules.join(", ") || "none"}]`,
            `  - successfulCompletionProjection=${successProjection}`,
            `  - preserveOnLaterFailure=[${preservedFields.join(", ") || "none"}]`,
        ].join("\n");
    }).join("\n");
}

function formatRuleProjectionMatrix(steps: ResolvedEntity[], validationRules: ResolvedEntity[]): string {
    if (validationRules.length === 0) {
        return "None";
    }

    const stepByRuleId = new Map<string, ResolvedEntity>();
    for (const step of steps) {
        for (const ruleId of arrayOfStrings(step.data.executesRuleIds)) {
            if (!stepByRuleId.has(ruleId)) {
                stepByRuleId.set(ruleId, step);
            }
        }
    }

    const orderedRules = [...validationRules].sort((left, right) => {
        const leftStep = stepByRuleId.get(left.id);
        const rightStep = stepByRuleId.get(right.id);
        const leftOrder = numberValue(leftStep?.data.executionOrder) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = numberValue(rightStep?.data.executionOrder) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
        }

        const leftPrecedence = numberValue(left.data.precedenceWithinStep) ?? Number.MAX_SAFE_INTEGER;
        const rightPrecedence = numberValue(right.data.precedenceWithinStep) ?? Number.MAX_SAFE_INTEGER;
        if (leftPrecedence !== rightPrecedence) {
            return leftPrecedence - rightPrecedence;
        }

        return left.id.localeCompare(right.id);
    });

    return orderedRules.map((rule) => {
        const step = stepByRuleId.get(rule.id);
        const stepLabel = step ? `${step.id}#${numberValue(step.data.executionOrder) ?? "?"}` : "unassigned";
        const precedence = numberValue(rule.data.precedenceWithinStep) ?? "unspecified";
        const errorCode = stringValue(rule.data.throwsErrorCodeId) ?? "unspecified";
        const projection = formatProjectionObject(objectValue(rule.data.failureProjection));
        return `- ${rule.id}: step=${stepLabel}; precedenceWithinStep=${precedence}; throws=${errorCode}; failureProjection=${projection}`;
    }).join("\n");
}

function formatExactStructureSchemas(structures: ResolvedEntity[]): string {
    if (structures.length === 0) {
        return "None";
    }

    return structures.map((structure) => {
        const schema = objectValue(structure.data.schemaDefinition) ?? {};
        return `### ${structure.id}\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\``;
    }).join("\n\n");
}

function formatExactDtoChecklist(structures: ResolvedEntity[]): string {
    if (structures.length === 0) {
        return "None";
    }

    return structures.map((structure) => {
        const schema = objectValue(structure.data.schemaDefinition);
        const required = new Set(arrayOfStrings(schema?.required));
        const properties = objectValue(schema?.properties) ?? {};
        const propertyLines = Object.entries(properties).map(([name, rawProperty]) => {
            const property = objectValue(rawProperty) ?? {};
            const enums = arrayOfStrings(property.enum);
            const oneOf = Array.isArray(property.oneOf)
                ? property.oneOf
                    .map((entry) => {
                        const item = objectValue(entry) ?? {};
                        const itemType = stringValue(item.type);
                        const itemEnums = arrayOfStrings(item.enum);
                        if (itemEnums.length > 0) {
                            return `enum(${itemEnums.join("|")})`;
                        }
                        return itemType ?? "$ref";
                    })
                    .join(" | ")
                : undefined;
            const type = stringValue(property.type) ?? oneOf ?? (property.$ref ? "$ref" : "object");
            const enumSuffix = enums.length > 0 ? ` enum=[${enums.join(", ")}]` : "";
            const requiredPrefix = required.has(name) ? "required" : "optional";
            return `  - ${name}: ${requiredPrefix}; type=${type}${enumSuffix}`;
        });
        return `- ${structure.id}\n${propertyLines.join("\n") || "  - no properties"}`;
    }).join("\n");
}

function formatExactVectorDetails(vectors: ResolvedEntity[]): string {
    if (vectors.length === 0) {
        return "None";
    }

    return vectors.map((vector) => {
        const exactVector = {
            id: vector.id,
            title: stringValue(vector.data.title) ?? vector.id,
            rawJwtInput: vector.data.rawJwtInput,
            runtimePolicy: vector.data.runtimePolicy,
            validationContext: vector.data.validationContext,
            expectedEvaluatedProfileId: vector.data.expectedEvaluatedProfileId,
            expectedOutcomeClass: vector.data.expectedOutcomeClass,
            expectedPrimaryErrorCodeId: vector.data.expectedPrimaryErrorCodeId,
            expectedKeySelectionStatus: vector.data.expectedKeySelectionStatus,
            expectedTrustDecision: vector.data.expectedTrustDecision,
            expectedTerminalStepId: vector.data.expectedTerminalStepId,
            expectedFailedRuleId: vector.data.expectedFailedRuleId,
            expectsErrorCodeIds: vector.data.expectsErrorCodeIds,
            validatesRuleIds: vector.data.validatesRuleIds,
            usesMockKeyId: vector.data.usesMockKeyId,
            requiresFixtureIds: vector.data.requiresFixtureIds,
        };
        return `### ${vector.id}\n\`\`\`json\n${JSON.stringify(exactVector, null, 2)}\n\`\`\``;
    }).join("\n\n");
}

function formatExactFixturePayloads(fixtures: ResolvedEntity[]): string {
    if (fixtures.length === 0) {
        return "None";
    }

    return fixtures.map((fixture) => {
        const exactFixture = {
            id: fixture.id,
            title: stringValue(fixture.data.title) ?? fixture.id,
            fixtureMode: fixture.data.fixtureMode,
            jwks: fixture.data.jwks,
        };
        return `### ${fixture.id}\n\`\`\`json\n${JSON.stringify(exactFixture, null, 2)}\n\`\`\``;
    }).join("\n\n");
}

function formatConstraintMatrix(constraints: ResolvedEntity[]): string {
    if (constraints.length === 0) {
        return "None";
    }

    return constraints.map((constraint) => {
        const level = stringValue(constraint.data.enforcementLevel) ?? "unspecified";
        const type = stringValue(constraint.data.constraintType) ?? "unspecified";
        const statement = stringValue(constraint.data.constraintStatement) ?? "unspecified";
        return `- ${constraint.id}: enforcement=${level}; type=${type}; statement=${statement}`;
    }).join("\n");
}

function formatSuiteSummary(suites: ResolvedEntity[]): string {
    if (suites.length === 0) {
        return "None";
    }

    return suites.map((suite) => {
        const vectorIds = Array.isArray(suite.data.containsVectorIds)
            ? suite.data.containsVectorIds.filter((item): item is string => typeof item === "string")
            : [];
        return `- ${suite.id}: vectors=${vectorIds.length}; ids=[${vectorIds.join(", ")}]`;
    }).join("\n");
}

function formatProfileSummary(profiles: ResolvedEntity[]): string {
    if (profiles.length === 0) {
        return "None";
    }

    return profiles.map((profile) => {
        const allowsAlgorithmIds = Array.isArray(profile.data.allowsAlgorithmIds)
            ? profile.data.allowsAlgorithmIds.filter((item): item is string => typeof item === "string")
            : [];
        const requiresClaimIds = Array.isArray(profile.data.requiresClaimIds)
            ? profile.data.requiresClaimIds.filter((item): item is string => typeof item === "string")
            : [];
        const usesKeyStrategyIds = Array.isArray(profile.data.usesKeyStrategyIds)
            ? profile.data.usesKeyStrategyIds.filter((item): item is string => typeof item === "string")
            : [];
        return `- ${profile.id}: allowsAlgorithms=[${allowsAlgorithmIds.join(", ")}]; requiresClaims=[${requiresClaimIds.join(", ")}]; keyStrategies=[${usesKeyStrategyIds.join(", ")}]`;
    }).join("\n");
}

function formatSuiteCoverageChecklist(suites: ResolvedEntity[]): string {
    if (suites.length === 0) {
        return "None";
    }

    return suites.map((suite) => {
        const vectorIds = Array.isArray(suite.data.containsVectorIds)
            ? suite.data.containsVectorIds.filter((item): item is string => typeof item === "string")
            : [];
        return `- ${suite.id}: expectedTestCount=${vectorIds.length}; vectorIds=[${vectorIds.join(", ")}]`;
    }).join("\n");
}

function formatWorkspaceAcceptanceGates(runtimeProfile: ResolvedEntity, suites: ResolvedEntity[]): string {
    const suiteVectorCount = suites.reduce((count, suite) => {
        const vectorIds = Array.isArray(suite.data.containsVectorIds)
            ? suite.data.containsVectorIds.filter((item): item is string => typeof item === "string")
            : [];
        return count + vectorIds.length;
    }, 0);
    const recommendedBuildCommand = stringValue(runtimeProfile.data.recommendedBuildCommand) ?? "build command not specified";
    const recommendedTestCommand = stringValue(runtimeProfile.data.recommendedTestCommand) ?? "test command not specified";
    const toolchain = stringValue(runtimeProfile.data.toolchain);
    const typecheckGate = toolchain === "tsc"
        ? "- For TypeScript bindings, `npx tsc -p tsconfig.json --noEmit` must succeed."
        : undefined;

    return [
        `- Declared package build command must be runnable in the generated workspace.`,
        `- Declared package test command must be runnable in the generated workspace.`,
        `- Runtime profile recommends build command: ${recommendedBuildCommand}`,
        `- Runtime profile recommends test command: ${recommendedTestCommand}`,
        `- Generated conformance tests must cover all suite vectors: expected minimum vector tests=${suiteVectorCount}`,
        `- Do not emit a TypeScript test command that depends on an undeclared loader or missing transpilation step.`,
        ...(typecheckGate ? [typecheckGate] : []),
    ].join("\n");
}

function formatEntityDerivedGuidance(sections: Array<{ title: string; entities: ResolvedEntity[] }>): string {
    const renderedSections = sections
        .map(({ title, entities }) => {
            const entries = entities
                .map((entity) => formatEntityGuidanceEntry(entity))
                .filter((entry): entry is string => Boolean(entry));

            if (entries.length === 0) {
                return undefined;
            }

            return `### ${title}\n${entries.join("\n")}`;
        })
        .filter((entry): entry is string => Boolean(entry));

    return renderedSections.length > 0 ? renderedSections.join("\n\n") : "None";
}

function formatEntityGuidanceEntry(entity: ResolvedEntity): string | undefined {
    const notes = collectEntityGuidanceNotes(entity);
    if (notes.length === 0) {
        return undefined;
    }

    const title = stringValue(entity.data.title) ?? entity.id;
    return [`- ${entity.id} (${title})`, ...notes.map((note) => `  - ${note}`)].join("\n");
}

function collectEntityGuidanceNotes(entity: ResolvedEntity): string[] {
    const notes: string[] = [];
    const implementationHints = arrayOfStrings(entity.data.implementationHints);
    notes.push(...implementationHints);

    const noteFields = [
        "platformNotes",
        "securityNotes",
        "installationNotes",
    ] as const;

    for (const field of noteFields) {
        const value = stringValue(entity.data[field]);
        if (!value) {
            continue;
        }

        notes.push(...value
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean));
    }

    return uniqueStrings(notes);
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined;
}

function numberValue(value: unknown): number | undefined {
    return typeof value === "number" ? value : undefined;
}

function arrayOfStrings(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is string => typeof item === "string");
}

function uniqueStrings(values: string[]): string[] {
    return Array.from(new Set(values));
}

function formatProjectionObject(value: Record<string, unknown> | undefined): string {
    if (!value) {
        return "none";
    }

    const entries = Object.entries(value)
        .map(([key, raw]) => {
            const stringified = stringValue(raw) ?? JSON.stringify(raw);
            return `${key}=${stringified}`;
        });

    return entries.length > 0 ? entries.join(", ") : "none";
}

function truncateText(text: string, maxChars: number): string {
    if (text.length <= maxChars) {
        return text;
    }
    return `${text.slice(0, maxChars)}\n\n... (truncated)`;
}

function stringValue(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function promptError(message: string) {
    return {
        messages: [{
            role: "user" as const,
            content: { type: "text" as const, text: `Error: ${message}` },
        }],
    };
}
