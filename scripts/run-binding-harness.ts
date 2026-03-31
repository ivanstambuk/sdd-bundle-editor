#!/usr/bin/env ts-node

import { parseArgs } from "node:util";
import { access, appendFile, chmod, cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";

type JsonRpcResponse = {
    result?: unknown;
    error?: { code: number; message: string };
    id: number | null;
};

type McpSession = {
    sessionId: string;
    port: number;
};

type PromptGetResult = {
    messages: Array<{
        role: string;
        content: { type: string; text: string };
    }>;
};

type BindingPacketType = "implementation" | "conformance";

type ResolvedBindingPacket = {
    kind: string;
    packetType: BindingPacketType;
    bundleId: string;
    promptName: string;
    promptRole: string;
    templateId: string;
    arguments: Record<string, unknown>;
    messages: PromptGetResult["messages"];
};

type ToolCallResult = {
    content?: Array<{ type: string; text: string }>;
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
};

type ReadEntitiesResult = {
    entityType: string;
    entities: Array<Record<string, unknown>>;
};

type AuditStatus = "passed" | "failed" | "skipped";

type AuditCheck = {
    name: string;
    status: AuditStatus;
    details: string;
};

type AuditReport = {
    status: Exclude<AuditStatus, "skipped">;
    checks: AuditCheck[];
};

type AuditSnapshot = AuditReport | {
    status: "skipped";
    checks: AuditCheck[];
};

type FrozenFileRecord = {
    path: string;
    sha256: string;
};

type PhaseRunResult = {
    exitCode: number | null;
    completion: "exited" | "timed-out" | "soft-completed" | "error";
    details?: string;
};

type SemanticMismatch = {
    vectorId: string;
    expected?: string;
    actual?: string;
    category: string;
};

type SemanticAuditReport = {
    status: "passed" | "failed" | "skipped";
    totalVectors: number;
    failingVectors: number;
    mismatches: SemanticMismatch[];
    mismatchByCategory: Record<string, number>;
};

type RuntimeCommandPolicy = {
    packageManager?: string;
    installCommand: string;
    testCommand: string;
    buildCommand?: string;
};

type BuilderRuntimeSummary = {
    markdown: string;
};

type FrozenPackStringifyMode = "pretty-json" | "json-string" | "pretty-js-literal";

type FrozenPackTemplateReplacement = {
    token: string;
    source: string;
    stringify?: FrozenPackStringifyMode;
};

type FrozenPackTemplateFile = {
    path: string;
    template?: string;
    inlineTemplate?: string;
    literalContent?: string;
    replacements?: FrozenPackTemplateReplacement[];
};

type FrozenPackEntityMapSpec = {
    idField?: string;
    fields?: string[];
};

type FrozenPackDerivedFieldSpec = {
    field: string;
    op: "equals";
    sourceField: string;
    value: unknown;
    whenTrue?: unknown;
    whenFalse?: unknown;
};

type FrozenPackEntityListSpec = {
    fields?: string[];
    defaults?: Record<string, unknown>;
    derived?: FrozenPackDerivedFieldSpec[];
};

type FrozenPackContextEntrySpec = {
    name: string;
    kind: "fixtureMap" | "normalizedVectors" | "suiteId";
    mapSpec?: FrozenPackEntityMapSpec;
    listSpec?: FrozenPackEntityListSpec;
};

type FrozenPackContextSpec = {
    entries?: FrozenPackContextEntrySpec[];
};

type FrozenPackMatchCriteria = {
    bindingLanguages?: string[];
    runtimeNames?: string[];
    runtimeLanguages?: string[];
    packageManagers?: string[];
    toolchains?: string[];
    moduleSystems?: string[];
    tagsAny?: string[];
};

type FrozenPackTemplatePack = {
    packId: string;
    description?: string;
    priority?: number;
    match: FrozenPackMatchCriteria;
    context?: FrozenPackContextSpec;
    directories?: string[];
    files: FrozenPackTemplateFile[];
    templateBaseDir?: string;
};

type CriticFinding = {
    severity: "critical" | "high" | "medium" | "low";
    category: string;
    path?: string;
    evidence: string;
    reason: string;
};

type CriticReport = {
    status: "passed" | "failed" | "inconclusive" | "skipped";
    summary: string;
    recommendedGate: "pass" | "fail" | "defer";
    findings: CriticFinding[];
};

type CodexCriticRunResult = {
    phase: PhaseRunResult;
    report: CriticReport;
    sessionId?: string;
    attempts: number;
};

type CriticReviewDepth = "shallow" | "deep";

type BuilderBackend = "gemini" | "opencode";
type BuilderProfile = "default" | "packet-only" | "glm-strict";
type CriticBackend = "gemini" | "codex";

type CodexReasoningEffort = "low" | "medium" | "high";

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT_ROOT = path.join(REPO_ROOT, ".scratch", "binding-runs");
const TEMPLATE_ROOT = path.join(REPO_ROOT, "scripts", "binding-harness-templates");
const DEFAULT_PORT = 3001;
const DEFAULT_MODEL = "gemini-3-flash-preview";
const DEFAULT_OPENCODE_MODEL = "litellm-local/glm-5-turbo";
const DEFAULT_BUILDER_BACKEND: BuilderBackend = "gemini";
const DEFAULT_BUILDER_PROFILE: BuilderProfile = "default";
const DEFAULT_CRITIC_MODEL = "gemini-3-pro-preview";
const DEFAULT_CRITIC_BACKEND: CriticBackend = "gemini";
const DEFAULT_CRITIC_REASONING_EFFORT: CodexReasoningEffort = "high";
const DEFAULT_OPENCODE_CRITIC_MODEL = "gpt-5.2";
const DEFAULT_OPENCODE_CRITIC_BACKEND: CriticBackend = "codex";
const DEFAULT_OPENCODE_CRITIC_REASONING_EFFORT: CodexReasoningEffort = "medium";
const DEFAULT_BUNDLE = "jwt";
const DEFAULT_BINDING = "BIND-node-jose-library";
const DEFAULT_OPERATION = "OP-validate-jwt";
const DEFAULT_PROMPT = "implement-binding";
const DEFAULT_TEST_PROMPT = "generate-binding-tests";
const DEFAULT_SUITE = "SUITE-core-validation";
const DEFAULT_ARTIFACT_MODE = "library-only";
const DEFAULT_TIMEOUT_SECONDS = 900;
const DEFAULT_MODE = "generate-only";
const BUILDER_QUIESCENCE_MIN_RUNTIME_SECONDS = 180;
const BUILDER_QUIESCENCE_QUIET_SECONDS = 60;
const BUILDER_QUIESCENCE_POLL_MS = 5000;
const OPENCODE_PACKET_ONLY_MAX_PREWRITE_FILES = 8;
const OPENCODE_GLM_STRICT_MAX_PREWRITE_TOOL_CALLS = 3;

type BuilderObservability = {
    backend: BuilderBackend;
    profile?: BuilderProfile;
    sessionId?: string;
    lastMeaningfulEvent?: string;
    toolUsage?: {
        read: number;
        write: number;
        edit: number;
        bash: number;
        glob: number;
        grep: number;
    };
    mcpConnected?: boolean;
    mcpToolInvocationCount?: number;
};

type HarnessLogPaths = {
    testStdoutPath: string;
    testStderrPath: string;
    builderStdoutPath: string;
    builderStderrPath: string;
    criticStdoutPath: string;
    criticStderrPath: string;
};

type HarnessMode = "generate-only" | "self-verify" | "critic-only";

const DEFAULT_CRITIC_STATUS: CriticReport = {
    status: "skipped",
    summary: "Critic phase not executed.",
    recommendedGate: "defer",
    findings: [],
};

function isPacketOnlyBuilderProfile(profile: BuilderProfile): boolean {
    return profile === "packet-only" || profile === "glm-strict";
}

function openCodePrewriteLimit(profile: BuilderProfile): number {
    return profile === "glm-strict"
        ? OPENCODE_GLM_STRICT_MAX_PREWRITE_TOOL_CALLS
        : OPENCODE_PACKET_ONLY_MAX_PREWRITE_FILES;
}

function buildOpenCodePermission(profile: BuilderProfile): Record<string, string> {
    const base: Record<string, string> = {
        edit: "allow",
        write: "allow",
        bash: "allow",
        read: "allow",
        task: "allow",
        webfetch: "allow",
        skill: "allow",
        question: "deny",
        plan_enter: "deny",
        plan_exit: "deny",
    };

    if (profile === "glm-strict") {
        base.glob = "deny";
        base.todowrite = "deny";
        base.todoread = "deny";
    }

    return base;
}

function buildOpenCodeBuilderAgentPrompt(profile: BuilderProfile): string {
    const lines = [
        "You are a focused code-generation worker running inside a harness workspace.",
        "Follow the loaded instruction files as the authoritative brief.",
        "Write the required artifacts directly.",
        "Avoid open-ended exploration, delegation, or long narrative summaries.",
        "If frozen tests already exist, treat them as immutable.",
    ];

    if (profile === "glm-strict") {
        lines.push(
            "Work only from local run artifacts such as packets/ and prompt/ until the implementation skeleton exists.",
            "Do not create a todo list.",
            "Do not use todowrite.",
            "Do not use glob.",
            `Your first write or edit must happen within your first ${openCodePrewriteLimit(profile)} tool calls.`,
            "If you have not started writing a required implementation artifact by then, stop exploring and write it immediately.",
            "Start with the runtime manifest if needed, then the smallest required implementation artifact under src/.",
            "Read prompt/implementation-start.md first, then prompt/runtime-summary.md, then packets/ and prompt/ as needed.",
            "Do not start by opening tests/fixtures/ unless you are debugging a concrete mismatch after implementation files already exist.",
            "Do not spend the run understanding the frozen tests line by line before you create package.json and src/*."
        );
    } else if (isPacketOnlyBuilderProfile(profile)) {
        lines.push(
            `Work only from local run artifacts such as packets/, prompt/, and tests/. Do not inspect more than ${openCodePrewriteLimit(profile)} files before you begin writing implementation artifacts.`
        );
    } else {
        lines.push("Use local run artifacts as the primary source of truth and avoid unnecessary exploration.");
    }

    lines.push("When the required artifacts are written, stop and print a short completion summary.");
    return lines.join("\n");
}

function buildOpenCodeRunPrompt(profile: BuilderProfile): string {
    if (profile === "glm-strict") {
        return [
            "Implement the binding in the current workspace using only the frozen local run artifacts.",
            "Do not rely on live MCP access.",
            "Do not create a todo list.",
            "Do not use todowrite.",
            "Do not use glob.",
            `Your first write or edit must happen within your first ${openCodePrewriteLimit(profile)} tool calls.`,
            "Read only the minimum local files needed to start implementation.",
            "Start from prompt/implementation-start.md.",
            "Then read prompt/runtime-summary.md.",
            "Then use packets/implementation-packet.json, packets/validation-packet.json, prompt/harness-instructions.txt, and prompt/resolved-prompt.txt only as needed.",
            "If the runtime manifest is missing, create it first, then create src/*.",
            "Do not read tests/, tests/test-utils.ts, or tests/fixtures/* before the runtime manifest and at least one src/* implementation file exist.",
            "Create a required implementation artifact immediately and stop when done.",
        ].join(" ");
    }

    if (isPacketOnlyBuilderProfile(profile)) {
        return `Implement the binding in the current workspace using only the frozen local run artifacts. Do not rely on live MCP access. Do not inspect more than ${openCodePrewriteLimit(profile)} files before you start writing. Create the required artifacts now and stop when done.`;
    }

    return "Implement the binding in the current workspace. Follow the loaded instructions exactly. Create the required artifacts now and stop when done.";
}

function buildHarnessLogPaths(logsDir: string, builderBackend: BuilderBackend, criticBackend: CriticBackend): HarnessLogPaths {
    return {
        testStdoutPath: path.join(logsDir, `${builderBackend}.tests.stdout.log`),
        testStderrPath: path.join(logsDir, `${builderBackend}.tests.stderr.log`),
        builderStdoutPath: path.join(logsDir, `${builderBackend}.implementation.stdout.log`),
        builderStderrPath: path.join(logsDir, `${builderBackend}.implementation.stderr.log`),
        criticStdoutPath: path.join(logsDir, `${criticBackend}.critic.stdout.log`),
        criticStderrPath: path.join(logsDir, `${criticBackend}.critic.stderr.log`),
    };
}

function parseSseJson(text: string): JsonRpcResponse | null {
    for (const line of text.split("\n")) {
        if (line.startsWith("data: ")) {
            try {
                return JSON.parse(line.slice(6));
            } catch {
                // Ignore malformed lines.
            }
        }
    }
    return null;
}

async function initSession(port: number): Promise<McpSession> {
    const response = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "binding-harness", version: "1.0.0" },
            },
        }),
    });

    const sessionId = response.headers.get("mcp-session-id");
    if (!sessionId) {
        throw new Error("Failed to initialize MCP session: no session ID");
    }

    const text = await response.text();
    const parsed = parseSseJson(text);
    if (parsed?.error) {
        throw new Error(`Failed to initialize MCP session: ${parsed.error.message}`);
    }

    return { sessionId, port };
}

async function getPrompt(
    session: McpSession,
    name: string,
    args: Record<string, unknown>
): Promise<PromptGetResult> {
    const response = await fetch(`http://localhost:${session.port}/mcp`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Mcp-Session-Id": session.sessionId,
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "prompts/get",
            params: { name, arguments: args },
        }),
    });

    const text = await response.text();
    const parsed = parseSseJson(text);
    if (!parsed) {
        throw new Error("Failed to parse MCP prompt response");
    }
    if (parsed.error) {
        throw new Error(`MCP prompt error: ${parsed.error.message}`);
    }

    return parsed.result as PromptGetResult;
}

async function resolveBindingPacket(
    session: McpSession,
    args: {
        bundleId?: string;
        packetType: BindingPacketType;
        bindingId: string;
        operationId?: string;
        suiteId?: string;
        artifactMode?: string;
        promptName?: string;
    }
): Promise<ResolvedBindingPacket> {
    const result = await callTool<ResolvedBindingPacket | { data?: ResolvedBindingPacket }>(
        session,
        "resolve_binding_packet",
        args
    );
    if ("messages" in result && Array.isArray(result.messages)) {
        return result;
    }
    if ("data" in result && result.data && Array.isArray(result.data.messages)) {
        return result.data;
    }
    throw new Error("resolve_binding_packet returned an unexpected payload shape");
}

async function callTool<T>(
    session: McpSession,
    name: string,
    args: Record<string, unknown>
): Promise<T> {
    const response = await fetch(`http://localhost:${session.port}/mcp`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Mcp-Session-Id": session.sessionId,
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name, arguments: args },
        }),
    });

    const text = await response.text();
    const parsed = parseSseJson(text);
    if (!parsed) {
        throw new Error(`Failed to parse MCP tool response for ${name}`);
    }
    if (parsed.error) {
        throw new Error(`MCP tool error for ${name}: ${parsed.error.message}`);
    }

    const result = parsed.result as ToolCallResult | undefined;
    if (result?.isError && result.structuredContent) {
        const errorMessage = (result.structuredContent.error as { message?: string } | undefined)?.message;
        throw new Error(`MCP tool error for ${name}: ${errorMessage ?? "unknown tool error"}`);
    }
    if (result?.structuredContent) {
        return result.structuredContent as T;
    }
    if (result?.content?.[0]?.type === "text") {
        const textContent = result.content[0].text.trim();
        if (textContent.startsWith("{") || textContent.startsWith("[")) {
            return JSON.parse(textContent) as T;
        }
        throw new Error(`MCP tool ${name} returned non-JSON text content`);
    }

    return parsed.result as T;
}

async function readEntities(
    session: McpSession,
    bundleId: string,
    entityType: string,
    ids: string[]
): Promise<Array<Record<string, unknown>>> {
    if (ids.length === 0) {
        return [];
    }

    const result = await callTool<ReadEntitiesResult | { data?: ReadEntitiesResult }>(session, "read_entities", {
        bundleId,
        entityType,
        ids,
    });

    if ("entities" in result && Array.isArray(result.entities)) {
        return result.entities;
    }

    if ("data" in result && result.data && Array.isArray(result.data.entities)) {
        return result.data.entities;
    }

    return [];
}

async function isServerHealthy(port: number): Promise<boolean> {
    try {
        const response = await fetch(`http://localhost:${port}/health`);
        return response.ok;
    } catch {
        return false;
    }
}

async function waitForServer(port: number, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await isServerHealthy(port)) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`MCP server did not become healthy on port ${port}`);
}

function timestampSlug(): string {
    return new Date().toISOString().replace(/[:.]/g, "-");
}

async function listFilesRecursive(root: string, prefix = ""): Promise<string[]> {
    const entries = await readdir(root, { withFileTypes: true });
    const results: string[] = [];

    for (const entry of entries) {
        const relative = path.join(prefix, entry.name);
        const fullPath = path.join(root, entry.name);
        if (entry.isDirectory()) {
            results.push(...await listFilesRecursive(fullPath, relative));
        } else {
            results.push(relative);
        }
    }

    return results.sort();
}

type WorkspaceSnapshotEntry = {
    path: string;
    size: number;
    mtimeMs: number;
};

async function appendChunk(filePath: string, chunk: Buffer | string): Promise<void> {
    await appendFile(filePath, chunk);
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function readUtf8(filePath: string): Promise<string> {
    return readFile(filePath, "utf8");
}

async function hashFileSha256(filePath: string): Promise<string> {
    const content = await readFile(filePath);
    return createHash("sha256").update(content).digest("hex");
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function mirrorDirectoryIntoWorkspace(sourceDir: string, destinationDir: string): Promise<void> {
    if (!await fileExists(sourceDir)) {
        return;
    }

    await rm(destinationDir, { recursive: true, force: true });
    await mkdir(path.dirname(destinationDir), { recursive: true });
    await cp(sourceDir, destinationDir, { recursive: true, force: true });
}

async function mirrorHarnessContextIntoWorkspace(runDir: string, generatedDir: string): Promise<void> {
    await mirrorDirectoryIntoWorkspace(path.join(runDir, "packets"), path.join(generatedDir, "packets"));
    await mirrorDirectoryIntoWorkspace(path.join(runDir, "prompt"), path.join(generatedDir, "prompt"));
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
    if (!await fileExists(filePath)) {
        return null;
    }

    return JSON.parse(await readUtf8(filePath)) as T;
}

function normalizeRelativePath(relativePath: string): string {
    return relativePath.split(path.sep).join("/");
}

function summarizePromptResponse(response: PromptGetResult | null) {
    if (!response) {
        return null;
    }

    const textMessages = response.messages.filter((message) => message.content.type === "text");
    const joined = textMessages.map((message) => message.content.text).join("\n\n");

    return {
        messageCount: response.messages.length,
        textMessageCount: textMessages.length,
        textBytes: Buffer.byteLength(joined, "utf8"),
        roles: uniqueStrings(response.messages.map((message) => message.role)),
    };
}

function isWorkspaceArtifact(relativePath: string): boolean {
    const normalized = normalizeRelativePath(relativePath);
    return !normalized.startsWith("node_modules/");
}

function isHarnessManagedWorkspaceArtifact(relativePath: string): boolean {
    const normalized = normalizeRelativePath(relativePath);
    return /^(packets|prompt|\.opencode)\//.test(normalized);
}

function isAuthoredWorkspaceArtifact(relativePath: string): boolean {
    const normalized = normalizeRelativePath(relativePath);
    return isWorkspaceArtifact(normalized)
        && !isHarnessManagedWorkspaceArtifact(normalized)
        && !isIgnoredGeneratedArtifact(normalized);
}

function isIgnoredGeneratedArtifact(relativePath: string): boolean {
    const normalized = normalizeRelativePath(relativePath);
    return /(^|\/)(node_modules|__pycache__|\.pytest_cache|\.mypy_cache|\.ruff_cache|\.venv|venv|env|\.tox|\.gradle|coverage|htmlcov|dist|build|target|out|bin|obj)(\/|$)/.test(normalized)
        || /\.(pyc|pyo|class|o|obj|so|dll|dylib|exe|a|lib|jar|war|zip|tar|gz|tgz|png|jpg|jpeg|gif|webp|ico|pdf)$/i.test(normalized);
}

function shouldIgnoreQuiescencePath(relativePath: string): boolean {
    const normalized = normalizeRelativePath(relativePath);
    return /(^|\/)(node_modules|__pycache__|\.pytest_cache|\.mypy_cache|\.ruff_cache|\.venv|venv|env|\.tox|\.gradle|\.idea|\.vscode|htmlcov|coverage)(\/|$)/.test(normalized)
        || /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|poetry\.lock)$/i.test(normalized);
}

function isTestLikePath(relativePath: string): boolean {
    const normalized = normalizeRelativePath(relativePath);
    return /^(tests?|spec|specs|conformance)\//.test(normalized)
        || /(^|\/)(tests?|spec|specs)\.[A-Za-z0-9]+$/i.test(normalized)
        || /(^|\/)test_[^/]+\.[A-Za-z0-9]+$/i.test(normalized)
        || /(^|\/)[^/]+\.(test|spec)\.[A-Za-z0-9]+$/i.test(normalized);
}

function isQualifyingImplementationArtifact(relativePath: string): boolean {
    const normalized = normalizeRelativePath(relativePath);
    if (shouldIgnoreQuiescencePath(normalized) || isTestLikePath(normalized)) {
        return false;
    }

    return /^(src|lib|app|examples|docs)\//.test(normalized)
        || /^(README\.md|CONFORMANCE\.md|binding-manifest\.json|package\.json|requirements\.txt|pyproject\.toml|setup\.py|Pipfile|go\.mod|Cargo\.toml|pom\.xml|build\.gradle|build\.gradle\.kts|[^/]+\.(csproj|fsproj|vbproj|sln))$/i.test(normalized)
        || /(^|\/)[^/]+\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|py|go|rs|java|kt|kts|cs|scala|rb)$/i.test(normalized);
}

async function collectWorkspaceSnapshot(rootDir: string): Promise<WorkspaceSnapshotEntry[]> {
    const relativePaths = await listFilesRecursive(rootDir);
    const filtered = relativePaths
        .map(normalizeRelativePath)
        .filter((relativePath) => !shouldIgnoreQuiescencePath(relativePath));

    const entries = await Promise.all(filtered.map(async (relativePath) => {
        const fileStat = await stat(path.join(rootDir, relativePath));
        return {
            path: relativePath,
            size: fileStat.size,
            mtimeMs: fileStat.mtimeMs,
        };
    }));

    return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function workspaceSnapshotKey(entries: WorkspaceSnapshotEntry[]): string {
    return entries.map((entry) => `${entry.path}:${entry.size}:${Math.trunc(entry.mtimeMs)}`).join("|");
}

function findNewImplementationArtifacts(
    entries: WorkspaceSnapshotEntry[],
    baselineFiles: Set<string>
): string[] {
    return entries
        .map((entry) => entry.path)
        .filter((relativePath) => !baselineFiles.has(relativePath))
        .filter((relativePath) => isQualifyingImplementationArtifact(relativePath))
        .sort();
}

function isRelevantCriticArtifact(relativePath: string): boolean {
    const normalized = normalizeRelativePath(relativePath);
    if (!isWorkspaceArtifact(normalized) || isHarnessManagedWorkspaceArtifact(normalized) || isIgnoredGeneratedArtifact(normalized)) {
        return false;
    }
    return /^(src|lib|app|cmd|pkg|internal|tests|test|spec|specs|conformance|examples|docs)\//.test(normalized)
        || /^(README\.md|CONFORMANCE\.md|binding-manifest\.json|package\.json|tsconfig\.json|pyproject\.toml|requirements\.txt|setup\.py|Pipfile|go\.mod|go\.sum|Cargo\.toml|Cargo\.lock|pom\.xml|build\.gradle|build\.gradle\.kts|gradle\.properties|settings\.gradle|settings\.gradle\.kts|[^/]+\.(csproj|fsproj|vbproj|sln))$/i.test(normalized)
        || /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|kts|cs|scala|rb|sh|json|md|toml|yaml|yml|xml|properties|txt)$/i.test(normalized);
}

async function createWorkspaceManifest(rootDir: string, relativePaths: string[]): Promise<FrozenFileRecord[]> {
    const records: FrozenFileRecord[] = [];

    for (const relativePath of relativePaths) {
        records.push({
            path: normalizeRelativePath(relativePath),
            sha256: await hashFileSha256(path.join(rootDir, relativePath)),
        });
    }

    return records.sort((a, b) => a.path.localeCompare(b.path));
}

async function detectWorkspaceMutations(rootDir: string, manifest: FrozenFileRecord[]): Promise<string[]> {
    const mutations: string[] = [];

    for (const record of manifest) {
        const fullPath = path.join(rootDir, record.path);
        if (!await fileExists(fullPath)) {
            mutations.push(`${record.path}: deleted`);
            continue;
        }

        const currentHash = await hashFileSha256(fullPath);
        if (currentHash !== record.sha256) {
            mutations.push(`${record.path}: modified`);
        }
    }

    return mutations;
}

function uniqueStrings(values: string[]): string[] {
    return Array.from(new Set(values));
}

function authoredWorkspaceArtifacts(generatedFiles: string[]): string[] {
    return generatedFiles
        .map(normalizeRelativePath)
        .filter((relativePath) => isAuthoredWorkspaceArtifact(relativePath));
}

function extractExpectedVectorIds(promptText: string): string[] {
    return uniqueStrings(Array.from(promptText.matchAll(/VEC-[A-Za-z0-9-]+/g), (match) => match[0]));
}

function extractImplementedVectorIds(text: string): string[] {
    return uniqueStrings(Array.from(text.matchAll(/VEC-[A-Za-z0-9-]+/g), (match) => match[0]));
}

function findPlaceholderMatches(text: string): string[] {
    const checks: Array<{ label: string; pattern: RegExp }> = [
        { label: "TODO marker", pattern: /\bTODO\b/i },
        { label: "placeholder marker", pattern: /\bplaceholder\b/i },
        { label: "stub marker", pattern: /\bstub\b/i },
        { label: "assert.ok(true) placeholder", pattern: /assert\.ok\s*\(\s*true\s*\)/ },
        { label: "plan prose", pattern: /\bI will\b/ },
        { label: "demo wording", pattern: /\bfor the sake of (?:this )?demo\b/i },
        { label: "omission wording", pattern: /\band so on\b/i },
        { label: "coverage claim shortcut", pattern: /\bto be efficient\b/i },
    ];

    return checks.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
}

function extractAssertionValue(block: string, marker: "expected" | "actual"): string | undefined {
    const lineMatch = block.match(new RegExp(`\\n\\s*${marker}: '([^']+)'`, "i"));
    if (lineMatch) {
        return lineMatch[1];
    }

    const diffMatch = block.match(/\n\s*\+\s'([^']+)'\s*\n\s*-\s'([^']+)'/);
    if (diffMatch) {
        return marker === "actual" ? diffMatch[1] : diffMatch[2];
    }

    return undefined;
}

function categorizeSemanticMismatch(expected?: string, actual?: string): string {
    const outcomeClasses = new Set(["accepted", "rejected", "malformed", "indeterminate", "diagnostic"]);

    if (expected === "accepted" && actual && actual !== expected) {
        return "acceptance-regression";
    }

    if (expected?.startsWith("ERR-") && actual === "ERR-invalid-sig" && expected !== actual) {
        return "signature-preempts-specific-error";
    }

    if (expected && actual && outcomeClasses.has(expected) && outcomeClasses.has(actual)) {
        if ((expected === "rejected" && actual === "malformed") || (expected === "malformed" && actual === "rejected")) {
            return "format-classification-drift";
        }
        return "outcome-class-mismatch";
    }

    if (expected === "ERR-missing-claim" && actual && actual !== expected) {
        return "claim-requirement-drift";
    }

    if (expected === "ERR-expired" && actual && actual !== expected) {
        return "temporal-validation-drift";
    }

    if (expected === "ERR-premature" && actual && actual !== expected) {
        return "temporal-validation-drift";
    }

    if (expected === "ERR-invalid-audience" && actual && actual !== expected) {
        return "audience-validation-drift";
    }

    if (expected === "ERR-type-mismatch" || (expected === "malformed" && actual === "rejected")) {
        return "type-or-shape-classification-drift";
    }

    if (expected?.startsWith("ERR-") && actual?.startsWith("ERR-")) {
        return "error-code-mismatch";
    }

    return "assertion-mismatch";
}

function parseSemanticAuditFromTap(testOutput: string, observedVectorIds: string[]): SemanticAuditReport {
    const mismatches: SemanticMismatch[] = [];
    const totalVectorsMatch = testOutput.match(/# tests (\d+)/) ?? testOutput.match(/Tests\s+(\d+)\s+failed \|\s+(\d+)\s+passed \((\d+)\)/);
    const totalVectors = totalVectorsMatch
        ? Number(totalVectorsMatch[totalVectorsMatch.length - 1])
        : observedVectorIds.length;
    const lines = testOutput.split(/\r?\n/);

    const tapMismatches = parseTapSemanticMismatches(lines);
    const vitestMismatches = parseVitestSemanticMismatches(lines);
    mismatches.push(...(tapMismatches.length > 0 ? tapMismatches : vitestMismatches));

    if (mismatches.length === 0) {
        const hasVectorMention = /VEC-[A-Za-z0-9-]+/.test(testOutput);
        const infraFailure = /(?:ENOENT|ERR_TEST_FAILURE|JWSInvalid|TypeError|Unknown file extension|compactSign is not a function|test failed)/.test(testOutput);
        if (!hasVectorMention && infraFailure) {
            mismatches.push({
                vectorId: "pre-vector-test-infrastructure",
                category: "pre-vector-test-infrastructure-failure",
            });
        }
    }

    const mismatchByCategory = mismatches.reduce<Record<string, number>>((acc, mismatch) => {
        acc[mismatch.category] = (acc[mismatch.category] ?? 0) + 1;
        return acc;
    }, {});

    return {
        status: mismatches.length > 0 ? "failed" : "passed",
        totalVectors,
        failingVectors: mismatches.length,
        mismatches,
        mismatchByCategory,
    };
}

function commandForPackageManager(packageManager: string | undefined, action: "install" | "test" | "build"): string {
    switch (packageManager) {
        case "pip":
            switch (action) {
                case "install":
                    return "if [ -f requirements.txt ]; then python -m pip install -r requirements.txt; elif [ -f pyproject.toml ] || [ -f setup.py ]; then python -m pip install -e .; else python -m pip install .; fi";
                case "test":
                    return "pytest";
                case "build":
                    return "python -m compileall src";
            }
        case "pnpm":
            return `pnpm ${action}`;
        case "yarn":
            return `yarn ${action}`;
        case "bun":
            return `bun ${action}`;
        case "npm":
        default:
            return `npm ${action}`;
    }
}

async function resolveRuntimeCommandPolicy(params: {
    session: McpSession;
    bundleId: string;
    bindingId: string;
}): Promise<RuntimeCommandPolicy> {
    const bindings = await readEntities(params.session, params.bundleId, "ImplementationBinding", [params.bindingId]);
    const binding = bindings[0];
    const runtimeProfileId = typeof binding?.runtimeProfileId === "string" ? binding.runtimeProfileId : undefined;
    if (!runtimeProfileId) {
        return {
            installCommand: "npm install",
            testCommand: "npm test",
        };
    }

    const runtimeProfiles = await readEntities(params.session, params.bundleId, "RuntimeProfile", [runtimeProfileId]);
    const runtimeProfile = runtimeProfiles[0];
    const packageManager = typeof runtimeProfile?.packageManager === "string" ? runtimeProfile.packageManager : undefined;
    const buildCommand = typeof runtimeProfile?.recommendedBuildCommand === "string"
        ? runtimeProfile.recommendedBuildCommand
        : undefined;
    const testCommand = typeof runtimeProfile?.recommendedTestCommand === "string"
        ? runtimeProfile.recommendedTestCommand
        : commandForPackageManager(packageManager, "test");

    return {
        packageManager,
        installCommand: commandForPackageManager(packageManager, "install"),
        testCommand,
        buildCommand,
    };
}

async function resolveBuilderRuntimeSummary(params: {
    session: McpSession;
    bundleId: string;
    bindingId: string;
    runtimeCommandPolicy: RuntimeCommandPolicy;
}): Promise<BuilderRuntimeSummary> {
    const bindings = await readEntities(params.session, params.bundleId, "ImplementationBinding", [params.bindingId]);
    const binding = bindings[0];

    const dependencyPolicyId = typeof binding?.dependencyPolicyId === "string" ? binding.dependencyPolicyId : undefined;
    const runtimeProfileId = typeof binding?.runtimeProfileId === "string" ? binding.runtimeProfileId : undefined;
    const outputContractId = typeof binding?.outputContractId === "string" ? binding.outputContractId : undefined;

    const [dependencyPolicy] = dependencyPolicyId
        ? await readEntities(params.session, params.bundleId, "DependencyPolicy", [dependencyPolicyId])
        : [];
    const [runtimeProfile] = runtimeProfileId
        ? await readEntities(params.session, params.bundleId, "RuntimeProfile", [runtimeProfileId])
        : [];
    const [outputContract] = outputContractId
        ? await readEntities(params.session, params.bundleId, "OutputContract", [outputContractId])
        : [];

    const requiredDependencies = Array.isArray(dependencyPolicy?.allowedDependencies)
        ? dependencyPolicy.allowedDependencies.filter((value): value is Record<string, unknown> => Boolean(value))
            .filter((dependency) => dependency.required === true)
            .map((dependency) => {
                const name = typeof dependency.name === "string" ? dependency.name : "unknown";
                const version = typeof dependency.version === "string" ? dependency.version : "unspecified";
                const purpose = typeof dependency.purpose === "string" ? dependency.purpose : undefined;
                return purpose ? `- ${name}@${version} — ${purpose}` : `- ${name}@${version}`;
            })
        : [];

    const requiredArtifactPaths = Array.isArray(outputContract?.requiredArtifactPaths)
        ? outputContract.requiredArtifactPaths.filter((value): value is string => typeof value === "string")
        : [];

    const readmeSections = Array.isArray(outputContract?.readmeSections)
        ? outputContract.readmeSections.filter((value): value is string => typeof value === "string")
        : [];

    const manifestFields = Array.isArray(outputContract?.manifestFields)
        ? outputContract.manifestFields.filter((value): value is string => typeof value === "string")
        : [];

    const runtimeNotes = typeof runtimeProfile?.platformNotes === "string"
        ? runtimeProfile.platformNotes.trim()
        : "";

    const summaryLines = [
        "# Runtime Summary",
        "",
        "Use this as the compact packaging/runtime checklist for the current binding.",
        "",
        "## Commands",
        "",
        `- Install: \`${params.runtimeCommandPolicy.installCommand}\``,
        `- Build: \`${params.runtimeCommandPolicy.buildCommand ?? "not declared"}\``,
        `- Test: \`${params.runtimeCommandPolicy.testCommand}\``,
        "",
        "## Required Runtime Dependencies",
        "",
        ...(requiredDependencies.length > 0 ? requiredDependencies : ["- No required dependencies were declared."]),
        "",
        "## Required Artifact Paths",
        "",
        ...(requiredArtifactPaths.length > 0
            ? requiredArtifactPaths.map((artifactPath) => `- ${artifactPath}`)
            : ["- No required artifact paths were declared."]),
        "",
        "## Required README Sections",
        "",
        ...(readmeSections.length > 0
            ? readmeSections.map((section) => `- ${section}`)
            : ["- No README sections were declared."]),
        "",
        "## Required Manifest Fields",
        "",
        ...(manifestFields.length > 0
            ? manifestFields.map((field) => `- ${field}`)
            : ["- No manifest fields were declared."]),
    ];

    if (runtimeNotes.length > 0) {
        summaryLines.push(
            "",
            "## Runtime Notes",
            "",
            runtimeNotes
        );
    }

    summaryLines.push(
        "",
        "## Packaging Reminder",
        "",
        "- If you create package.json, declare the required dependencies there.",
        "- Make build/test scripts match the runtime profile commands above.",
        "- Ensure the public entrypoint and emitted module paths are compatible with the frozen tests."
    );

    return {
        markdown: `${summaryLines.join("\n")}\n`,
    };
}

async function runAuditShellCommand(
    command: string,
    cwd: string,
    stdoutPath: string,
    stderrPath: string
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
    return runAuditCommand("bash", ["-lc", command], cwd, stdoutPath, stderrPath);
}

function parseTapSemanticMismatches(lines: string[]): SemanticMismatch[] {
    const mismatches: SemanticMismatch[] = [];

    for (let i = 0; i < lines.length; i += 1) {
        const vectorMatch = lines[i].match(/^\s*not ok \d+ - .*?(VEC-[A-Za-z0-9-]+)/);
        if (!vectorMatch) {
            continue;
        }

        const vectorId = vectorMatch[1];
        const blockLines = [lines[i]];
        let j = i + 1;
        while (
            j < lines.length &&
            !/^\s*(?:not ok \d+ - |ok \d+ - |# Subtest: |\d+\.\.)/.test(lines[j])
        ) {
            blockLines.push(lines[j]);
            j += 1;
        }
        i = j - 1;

        const block = blockLines.join("\n");
        const expected = extractAssertionValue(block, "expected");
        const actual = extractAssertionValue(block, "actual");
        mismatches.push({
            vectorId,
            expected,
            actual,
            category: categorizeSemanticMismatch(expected, actual),
        });
    }

    return mismatches;
}

function parseVitestSemanticMismatches(lines: string[]): SemanticMismatch[] {
    const mismatches: SemanticMismatch[] = [];

    for (let i = 0; i < lines.length; i += 1) {
        const vectorMatch = lines[i].match(/^\s*❯ .* > (VEC-[A-Za-z0-9-]+)(?::.*)?$/);
        if (!vectorMatch) {
            continue;
        }

        const vectorId = vectorMatch[1];
        const blockLines = [lines[i]];
        let j = i + 1;
        while (
            j < lines.length &&
            !/^\s*❯ .* > (VEC-[A-Za-z0-9-]+)(?::.*)?$/.test(lines[j]) &&
            !/^\s*Test Files\b/.test(lines[j]) &&
            !/^\s*FAIL\b/.test(lines[j])
        ) {
            blockLines.push(lines[j]);
            j += 1;
        }
        i = j - 1;

        const block = blockLines.join("\n");
        const expected = extractVitestExpected(block);
        const actual = extractVitestActual(block);
        mismatches.push({
            vectorId,
            expected,
            actual,
            category: categorizeSemanticMismatch(expected, actual),
        });
    }

    return mismatches;
}

function extractVitestExpected(block: string): string | undefined {
    const strictEquality = block.match(/expected '([^']+)' to be '([^']+)'/);
    if (strictEquality) {
        return strictEquality[2];
    }

    const boolEquality = block.match(/expected (true|false) to be (true|false)/);
    if (boolEquality) {
        return boolEquality[2];
    }

    const diffMatch = block.match(/- Expected[\s\S]*?\n- ([^\n]+)\n\+ ([^\n]+)/);
    if (diffMatch) {
        return diffMatch[1].trim().replace(/^'+|'+$/g, "");
    }

    return undefined;
}

function extractVitestActual(block: string): string | undefined {
    const strictEquality = block.match(/expected '([^']+)' to be '([^']+)'/);
    if (strictEquality) {
        return strictEquality[1];
    }

    const boolEquality = block.match(/expected (true|false) to be (true|false)/);
    if (boolEquality) {
        return boolEquality[1];
    }

    const diffMatch = block.match(/- Expected[\s\S]*?\n- ([^\n]+)\n\+ ([^\n]+)/);
    if (diffMatch) {
        return diffMatch[2].trim().replace(/^'+|'+$/g, "");
    }

    return undefined;
}

function toConstIdentifier(value: string): string {
    return value
        .replace(/[^A-Za-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .toUpperCase();
}

function stableStringify(value: unknown): string {
    return JSON.stringify(value, null, 2);
}

function escapeSingleQuotedString(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
}

function isValidIdentifier(value: string): boolean {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}

function stableJsLiteral(value: unknown, indentLevel = 0): string {
    const indent = "  ".repeat(indentLevel);
    const childIndent = "  ".repeat(indentLevel + 1);

    if (value === null) {
        return "null";
    }
    if (typeof value === "string") {
        return `'${escapeSingleQuotedString(value)}'`;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return "[]";
        }
        return [
            "[",
            ...value.map((entry) => `${childIndent}${stableJsLiteral(entry, indentLevel + 1)},`),
            `${indent}]`,
        ].join("\n");
    }
    if (typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>);
        if (entries.length === 0) {
            return "{}";
        }
        return [
            "{",
            ...entries.map(([key, entryValue]) => {
                const renderedKey = isValidIdentifier(key)
                    ? key
                    : `'${escapeSingleQuotedString(key)}'`;
                return `${childIndent}${renderedKey}: ${stableJsLiteral(entryValue, indentLevel + 1)},`;
            }),
            `${indent}}`,
        ].join("\n");
    }

    return "undefined";
}

async function renderTemplate(templatePath: string, replacements: Record<string, string> = {}): Promise<string> {
    let template = await readUtf8(templatePath);
    for (const [token, value] of Object.entries(replacements)) {
        template = template.split(token).join(value);
    }
    return template;
}

function buildProjectedRecord(
    entity: Record<string, unknown>,
    fields: string[] | undefined,
    defaults: Record<string, unknown> | undefined
): Record<string, unknown> {
    const projected: Record<string, unknown> = {};

    if (defaults) {
        Object.assign(projected, defaults);
    }

    const selectedFields = Array.isArray(fields) && fields.length > 0
        ? fields
        : Object.keys(entity);
    for (const field of selectedFields) {
        const value = entity[field];
        if (value !== undefined) {
            projected[field] = value;
        }
    }

    return projected;
}

function applyDerivedFields(
    record: Record<string, unknown>,
    sourceEntity: Record<string, unknown>,
    derivedFields: FrozenPackDerivedFieldSpec[] | undefined
): void {
    for (const derivedField of derivedFields ?? []) {
        if (derivedField.op === "equals") {
            const actual = sourceEntity[derivedField.sourceField];
            const matches = actual === derivedField.value;
            record[derivedField.field] = matches
                ? (derivedField.whenTrue ?? true)
                : (derivedField.whenFalse ?? false);
        }
    }
}

function buildFixtureMap(
    fixtures: Array<Record<string, unknown>>,
    spec: FrozenPackEntityMapSpec | undefined
): Record<string, unknown> {
    const fixtureMap: Record<string, unknown> = {};
    const idField = typeof spec?.idField === "string" ? spec.idField : "id";
    const fields = Array.isArray(spec?.fields) ? spec?.fields : ["id", "jwks"];

    for (const fixture of fixtures) {
        const fixtureId = typeof fixture[idField] === "string" ? fixture[idField] as string : undefined;
        if (!fixtureId) {
            continue;
        }

        fixtureMap[fixtureId] = buildProjectedRecord(
            {
                ...fixture,
                [idField]: fixtureId,
            },
            fields,
            undefined
        );
    }

    return fixtureMap;
}

function normalizeVectorForFrozenPack(
    vector: Record<string, unknown>,
    spec: FrozenPackEntityListSpec | undefined
): Record<string, unknown> {
    const defaults = spec?.defaults ?? {
        runtimePolicy: {},
        validationContext: {},
        expectsErrorCodeIds: [],
    };
    const fields = Array.isArray(spec?.fields) && spec.fields.length > 0
        ? spec.fields
        : [
            "id",
            "title",
            "description",
            "invocationProfileId",
            "expectedEvaluatedProfileId",
            "rawJwtInput",
            "payloadJson",
            "headerJson",
            "runtimePolicy",
            "validationContext",
            "expectedOutcomeClass",
            "expectedKeySelectionStatus",
            "expectedTrustDecision",
            "expectedPrimaryErrorCodeId",
            "expectedFailedRuleId",
            "expectedTerminalStepId",
            "expectsErrorCodeIds",
            "usesMockKeyId",
        ];
    const normalized = buildProjectedRecord(vector, fields, defaults);
    applyDerivedFields(normalized, vector, spec?.derived);
    return normalized;
}

function buildNormalizedFrozenVectors(
    vectors: Array<Record<string, unknown>>,
    spec: FrozenPackEntityListSpec | undefined
): Array<Record<string, unknown>> {
    return vectors.map((vector) => normalizeVectorForFrozenPack(vector, spec));
}

function buildFrozenPackContext(params: {
    pack: FrozenPackTemplatePack;
    orderedFixtures: Array<Record<string, unknown>>;
    orderedVectors: Array<Record<string, unknown>>;
    suiteId: string;
}): Record<string, unknown> {
    const declaredEntries = Array.isArray(params.pack.context?.entries)
        ? params.pack.context.entries
        : [];
    const entries = declaredEntries.length > 0
        ? declaredEntries
        : [
            { name: "fixtureMap", kind: "fixtureMap" as const },
            { name: "normalizedVectors", kind: "normalizedVectors" as const },
            { name: "suiteId", kind: "suiteId" as const },
        ];

    const context: Record<string, unknown> = {};

    for (const entry of entries) {
        if (!entry?.name || typeof entry.name !== "string") {
            continue;
        }

        switch (entry.kind) {
            case "fixtureMap":
                context[entry.name] = buildFixtureMap(params.orderedFixtures, entry.mapSpec);
                break;
            case "normalizedVectors":
                context[entry.name] = buildNormalizedFrozenVectors(params.orderedVectors, entry.listSpec);
                break;
            case "suiteId":
                context[entry.name] = params.suiteId;
                break;
        }
    }

    return context;
}

function stringifyReplacementValue(value: unknown, mode: FrozenPackStringifyMode | undefined): string {
    switch (mode) {
        case "json-string":
            return JSON.stringify(value);
        case "pretty-js-literal":
            return stableJsLiteral(value);
        case "pretty-json":
        default:
            return stableStringify(value);
    }
}

async function loadFrozenTemplatePacks(): Promise<FrozenPackTemplatePack[]> {
    const runtimeDirs = await readdir(TEMPLATE_ROOT, { withFileTypes: true });
    const packs: FrozenPackTemplatePack[] = [];

    for (const entry of runtimeDirs) {
        if (!entry.isDirectory()) {
            continue;
        }
        const manifestPath = path.join(TEMPLATE_ROOT, entry.name, "pack.json");
        const pack = await readJsonFile<FrozenPackTemplatePack>(manifestPath);
        if (pack) {
            packs.push({
                ...pack,
                templateBaseDir: path.dirname(manifestPath),
            });
        }
    }

    return packs.sort((a, b) => a.packId.localeCompare(b.packId));
}

function normalizeSelectorValue(value: string | undefined): string | undefined {
    return typeof value === "string" && value.trim().length > 0
        ? value.trim().toLowerCase()
        : undefined;
}

function normalizeSelectorValues(values: string[] | undefined): string[] {
    return Array.isArray(values)
        ? values
            .map((value) => normalizeSelectorValue(value))
            .filter((value): value is string => Boolean(value))
        : [];
}

function selectorFieldMatches(expectedValues: string[] | undefined, actualValue: string | undefined): boolean {
    const normalizedExpected = normalizeSelectorValues(expectedValues);
    if (normalizedExpected.length === 0) {
        return true;
    }

    const normalizedActual = normalizeSelectorValue(actualValue);
    if (!normalizedActual) {
        return false;
    }

    return normalizedExpected.includes(normalizedActual);
}

function selectorTagsMatch(expectedValues: string[] | undefined, actualTags: string[]): boolean {
    const normalizedExpected = normalizeSelectorValues(expectedValues);
    if (normalizedExpected.length === 0) {
        return true;
    }

    const normalizedActual = new Set(normalizeSelectorValues(actualTags));
    return normalizedExpected.some((value) => normalizedActual.has(value));
}

function selectorSpecificity(match: FrozenPackMatchCriteria): number {
    const fields = [
        match.bindingLanguages,
        match.runtimeNames,
        match.runtimeLanguages,
        match.packageManagers,
        match.toolchains,
        match.moduleSystems,
        match.tagsAny,
    ];

    return fields.reduce((count, values) => count + (normalizeSelectorValues(values).length > 0 ? 1 : 0), 0);
}

type FrozenPackSelectionContext = {
    bindingLanguage?: string;
    runtimeName?: string;
    runtimeLanguage?: string;
    packageManager?: string;
    toolchain?: string;
    moduleSystem?: string;
    tags: string[];
};

function packMatchesContext(pack: FrozenPackTemplatePack, context: FrozenPackSelectionContext): boolean {
    return selectorFieldMatches(pack.match.bindingLanguages, context.bindingLanguage)
        && selectorFieldMatches(pack.match.runtimeNames, context.runtimeName)
        && selectorFieldMatches(pack.match.runtimeLanguages, context.runtimeLanguage)
        && selectorFieldMatches(pack.match.packageManagers, context.packageManager)
        && selectorFieldMatches(pack.match.toolchains, context.toolchain)
        && selectorFieldMatches(pack.match.moduleSystems, context.moduleSystem)
        && selectorTagsMatch(pack.match.tagsAny, context.tags);
}

function selectFrozenTemplatePack(
    packs: FrozenPackTemplatePack[],
    context: FrozenPackSelectionContext
): FrozenPackTemplatePack | null {
    const matches = packs.filter((pack) => packMatchesContext(pack, context));
    if (matches.length === 0) {
        return null;
    }

    return matches.sort((a, b) =>
        (b.priority ?? 0) - (a.priority ?? 0)
        || selectorSpecificity(b.match) - selectorSpecificity(a.match)
        || a.packId.localeCompare(b.packId)
    )[0] ?? null;
}

async function materializeFrozenTemplatePack(params: {
    pack: FrozenPackTemplatePack;
    generatedDir: string;
    suiteId: string;
    orderedFixtures: Array<Record<string, unknown>>;
    orderedVectors: Array<Record<string, unknown>>;
}): Promise<Array<{ path: string; content: string }>> {
    const replacementContext = buildFrozenPackContext({
        pack: params.pack,
        orderedFixtures: params.orderedFixtures,
        orderedVectors: params.orderedVectors,
        suiteId: params.suiteId,
    });

    const files: Array<{ path: string; content: string }> = [];

    for (const file of params.pack.files) {
        const outputPath = path.join(params.generatedDir, file.path);
        let content = file.literalContent ?? "";

        if (file.template || file.inlineTemplate) {
            const replacements = Object.fromEntries((file.replacements ?? []).map((replacement) => [
                replacement.token,
                (() => {
                    if (!(replacement.source in replacementContext)) {
                        throw new Error(`Frozen pack ${params.pack.packId} requested unknown replacement source '${replacement.source}'`);
                    }
                    return stringifyReplacementValue(
                        replacementContext[replacement.source],
                        replacement.stringify
                    );
                })(),
            ]));

            if (typeof file.inlineTemplate === "string") {
                content = file.inlineTemplate;
                for (const [token, value] of Object.entries(replacements)) {
                    content = content.split(token).join(value);
                }
            } else {
                if (!params.pack.templateBaseDir) {
                    throw new Error(`Frozen pack ${params.pack.packId} is missing templateBaseDir`);
                }
                content = await renderTemplate(path.join(params.pack.templateBaseDir, file.template!), replacements);
            }
        }

        files.push({ path: outputPath, content });
    }

    return files;
}

async function ensureFrozenTemplatePackDirectories(params: {
    pack: FrozenPackTemplatePack;
    generatedDir: string;
}): Promise<void> {
    const declaredDirs = Array.isArray(params.pack.directories)
        ? params.pack.directories
            .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            .map((value) => normalizeRelativePath(value))
        : [];
    const fileDirs = params.pack.files
        .map((file) => normalizeRelativePath(path.dirname(file.path)))
        .filter((dir) => dir !== "." && dir.length > 0);
    const directories = uniqueStrings([...declaredDirs, ...fileDirs]);

    for (const relativeDir of directories) {
        await mkdir(path.join(params.generatedDir, relativeDir), { recursive: true });
    }
}

async function tryMaterializeDeterministicFrozenTests(params: {
    session: McpSession;
    bundleId: string;
    bindingId: string;
    suiteId: string;
    generatedDir: string;
}): Promise<{ files: string[]; packId: string } | null> {
    const bindings = await readEntities(params.session, params.bundleId, "ImplementationBinding", [params.bindingId]);
    const binding = bindings[0];
    if (!binding) {
        return null;
    }

    const runtimeProfileId = typeof binding.runtimeProfileId === "string" ? binding.runtimeProfileId : undefined;
    if (!runtimeProfileId) {
        return null;
    }

    const runtimeProfiles = await readEntities(params.session, params.bundleId, "RuntimeProfile", [runtimeProfileId]);
    const runtimeProfile = runtimeProfiles[0];
    if (!runtimeProfile) {
        return null;
    }

    const language = typeof binding.language === "string" ? binding.language : undefined;
    const runtimeName = typeof runtimeProfile.runtimeName === "string" ? runtimeProfile.runtimeName : undefined;
    const runtimeLanguage = typeof runtimeProfile.language === "string" ? runtimeProfile.language : undefined;
    const packageManager = typeof runtimeProfile.packageManager === "string" ? runtimeProfile.packageManager : undefined;
    const toolchain = typeof runtimeProfile.toolchain === "string" ? runtimeProfile.toolchain : undefined;
    const moduleSystem = typeof runtimeProfile.moduleSystem === "string" ? runtimeProfile.moduleSystem : undefined;
    const bindingTags = Array.isArray(binding.tags)
        ? binding.tags.filter((value): value is string => typeof value === "string")
        : [];
    const runtimeTags = Array.isArray(runtimeProfile.tags)
        ? runtimeProfile.tags.filter((value): value is string => typeof value === "string")
        : [];
    const templatePacks = await loadFrozenTemplatePacks();
    const templatePack = selectFrozenTemplatePack(templatePacks, {
        bindingLanguage: language,
        runtimeName,
        runtimeLanguage,
        packageManager,
        toolchain,
        moduleSystem,
        tags: [...bindingTags, ...runtimeTags],
    });
    const suites = await readEntities(params.session, params.bundleId, "ConformanceSuite", [params.suiteId]);
    const suite = suites[0];
    if (!suite) {
        return null;
    }

    const vectorIds = Array.isArray(suite.containsVectorIds)
        ? suite.containsVectorIds.filter((value): value is string => typeof value === "string")
        : [];
    if (vectorIds.length === 0) {
        return null;
    }

    const vectorsRaw = await readEntities(params.session, params.bundleId, "TestVector", vectorIds);
    const vectorMap = new Map(vectorsRaw.map((vector) => [String(vector.id), vector]));
    const orderedVectors = vectorIds
        .map((id) => vectorMap.get(id))
        .filter((value): value is Record<string, unknown> => Boolean(value));

    const suiteFixtureIds = Array.isArray(suite.requiresFixtureIds)
        ? suite.requiresFixtureIds.filter((value): value is string => typeof value === "string")
        : [];
    const vectorFixtureIds = orderedVectors
        .map((vector) => (typeof vector.usesMockKeyId === "string" ? vector.usesMockKeyId : undefined))
        .filter((value): value is string => Boolean(value));
    const fixtureIds = uniqueStrings([...suiteFixtureIds, ...vectorFixtureIds]);
    const fixturesRaw = await readEntities(params.session, params.bundleId, "MockKeySet", fixtureIds);
    const fixtureMap = new Map(fixturesRaw.map((fixture) => [String(fixture.id), fixture]));
    const orderedFixtures = fixtureIds
        .map((id) => fixtureMap.get(id))
        .filter((value): value is Record<string, unknown> => Boolean(value));

    if (!templatePack) {
        return null;
    }

    await ensureFrozenTemplatePackDirectories({
        pack: templatePack,
        generatedDir: params.generatedDir,
    });

    const files = await materializeFrozenTemplatePack({
        pack: templatePack,
        generatedDir: params.generatedDir,
        suiteId: params.suiteId,
        orderedFixtures,
        orderedVectors,
    });

    for (const file of files) {
        await writeFile(file.path, file.content);
    }

    return {
        files: files.map((file) => path.relative(params.generatedDir, file.path)).sort(),
        packId: templatePack.packId,
    };
}

function hasRuntimeInstallManifest(generatedFiles: string[]): boolean {
    const normalized = generatedFiles.map(normalizeRelativePath);
    return normalized.some((relativePath) =>
        /(^|\/)(package\.json|pyproject\.toml|requirements\.txt|setup\.py|Pipfile|go\.mod|Cargo\.toml|pom\.xml|build\.gradle|build\.gradle\.kts|[^/]+\.(csproj|fsproj|vbproj|sln))$/i.test(relativePath)
    );
}

async function runAuditCommand(
    cmd: string,
    args: string[],
    cwd: string,
    stdoutPath: string,
    stderrPath: string
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
    const child = spawn(cmd, args, {
        cwd,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", async (chunk: Buffer) => {
        stdoutChunks.push(chunk);
        await appendChunk(stdoutPath, chunk);
    });
    child.stderr.on("data", async (chunk: Buffer) => {
        stderrChunks.push(chunk);
        await appendChunk(stderrPath, chunk);
    });

    const exitCode = await new Promise<number | null>((resolve, reject) => {
        child.on("error", reject);
        child.on("exit", (code) => resolve(code));
    });

    return {
        exitCode,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
    };
}

async function runLoggedCommand(params: {
    cmd: string;
    args: string[];
    cwd: string;
    stdoutPath: string;
    stderrPath: string;
    timeoutSeconds: number;
    errorLogPath: string;
    stdinText?: string;
    completionProbe?: {
        pollIntervalMs: number;
        logPath: string;
        ready: () => Promise<{ done: boolean; details?: string }>;
    };
    quiescence?: {
        mode: "builder-soft-complete";
        rootDir: string;
        baselineFiles: string[];
        logPath: string;
        minRuntimeSeconds: number;
        quietSeconds: number;
        pollIntervalMs: number;
    };
}): Promise<PhaseRunResult> {
    const child = spawn(params.cmd, params.args, {
        cwd: params.cwd,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
    });

    if (params.stdinText !== undefined) {
        child.stdin.write(params.stdinText);
    }
    child.stdin.end();

    const startedAt = Date.now();
    let lastSignalAt = startedAt;
    let settled = false;
    let monitorTimer: NodeJS.Timeout | undefined;
    let killTimer: NodeJS.Timeout | undefined;
    let timeoutTimer: NodeJS.Timeout | undefined;
    let pollInFlight = false;
    const baselineFiles = new Set((params.quiescence?.baselineFiles ?? []).map(normalizeRelativePath));
    let snapshotKey = "";

    child.stdout.on("data", async (chunk: Buffer) => {
        lastSignalAt = Date.now();
        await appendChunk(params.stdoutPath, chunk);
    });
    child.stderr.on("data", async (chunk: Buffer) => {
        lastSignalAt = Date.now();
        await appendChunk(params.stderrPath, chunk);
    });

    const result = await new Promise<PhaseRunResult>((resolve) => {
        const finalize = async (phase: PhaseRunResult) => {
            if (settled) {
                return;
            }
            settled = true;
            if (timeoutTimer) {
                clearTimeout(timeoutTimer);
            }
            if (monitorTimer) {
                clearInterval(monitorTimer);
            }
            resolve(phase);
        };

        const maybeEarlyComplete = async () => {
            if (!params.completionProbe || settled || pollInFlight) {
                return false;
            }

            pollInFlight = true;
            try {
                const probeResult = await params.completionProbe.ready();
                if (!probeResult.done) {
                    return false;
                }

                const details = probeResult.details ?? `${params.cmd} completed early after producing a parseable structured result.`;
                await appendFile(params.completionProbe.logPath, `${details}\n`);
                child.kill("SIGTERM");
                killTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
                await finalize({
                    exitCode: 0,
                    completion: "soft-completed",
                    details,
                });
                return true;
            } finally {
                pollInFlight = false;
            }
        };

        const maybeSoftComplete = async () => {
            if (!params.quiescence || settled || pollInFlight) {
                return;
            }

            pollInFlight = true;
            try {
                const elapsedSeconds = (Date.now() - startedAt) / 1000;
                if (elapsedSeconds < params.quiescence.minRuntimeSeconds) {
                    return;
                }

                const snapshot = await collectWorkspaceSnapshot(params.quiescence.rootDir);
                const currentSnapshotKey = workspaceSnapshotKey(snapshot);
                if (currentSnapshotKey !== snapshotKey) {
                    snapshotKey = currentSnapshotKey;
                    lastSignalAt = Date.now();
                }

                const quietSeconds = (Date.now() - lastSignalAt) / 1000;
                if (quietSeconds < params.quiescence.quietSeconds) {
                    return;
                }

                const newArtifacts = findNewImplementationArtifacts(snapshot, baselineFiles);
                if (newArtifacts.length === 0) {
                    return;
                }

                const details = [
                    `Soft-completed after ${Math.round(elapsedSeconds)}s due to builder quiescence.`,
                    `Quiet window: ${Math.round(quietSeconds)}s.`,
                    `Observed new implementation artifacts:`,
                    ...newArtifacts.slice(0, 20).map((artifact) => `- ${artifact}`),
                ].join("\n");
                await appendFile(params.quiescence.logPath, `${details}\n`);
                child.kill("SIGTERM");
                killTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
                await finalize({
                    exitCode: 0,
                    completion: "soft-completed",
                    details,
                });
            } finally {
                pollInFlight = false;
            }
        };

        const maybeMonitor = async () => {
            if (settled) {
                return;
            }
            if (await maybeEarlyComplete()) {
                return;
            }
            await maybeSoftComplete();
        };

        timeoutTimer = setTimeout(async () => {
            const details = `${params.cmd} run timed out after ${params.timeoutSeconds} seconds`;
            await writeFile(params.errorLogPath, `Error: ${details}\n`, { flag: "a" });
            child.kill("SIGTERM");
            killTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
            await finalize({
                exitCode: null,
                completion: "timed-out",
                details,
            });
        }, params.timeoutSeconds * 1000);

        if (params.quiescence || params.completionProbe) {
            const pollIntervalMs = Math.min(
                params.quiescence?.pollIntervalMs ?? Number.MAX_SAFE_INTEGER,
                params.completionProbe?.pollIntervalMs ?? Number.MAX_SAFE_INTEGER
            );
            monitorTimer = setInterval(() => {
                void maybeMonitor();
            }, pollIntervalMs);
        }

        child.on("error", async (error) => {
            await writeFile(params.errorLogPath, `${error.name}: ${error.message}\n`, { flag: "a" });
            await finalize({
                exitCode: null,
                completion: "error",
                details: `${error.name}: ${error.message}`,
            });
        });

        child.on("exit", async (code) => {
            if (killTimer) {
                clearTimeout(killTimer);
                killTimer = undefined;
            }
            await finalize({
                exitCode: code,
                completion: "exited",
                details: code === 0 ? "Process exited normally." : `Process exited with code ${code ?? "null"}.`,
            });
        });
    });

    return result;
}

async function runGeminiPhase(params: {
    model: string;
    cwd: string;
    promptText: string;
    instructions: string;
    stdoutPath: string;
    stderrPath: string;
    timeoutSeconds: number;
    errorLogPath: string;
    quiescence?: {
        rootDir: string;
        baselineFiles: string[];
        logPath: string;
    };
}): Promise<PhaseRunResult> {
    return runLoggedCommand({
        cmd: "gemini",
        args: [
            "-m", params.model,
            "--yolo",
            "-p", params.instructions,
        ],
        cwd: params.cwd,
        stdoutPath: params.stdoutPath,
        stderrPath: params.stderrPath,
        timeoutSeconds: params.timeoutSeconds,
        errorLogPath: params.errorLogPath,
        stdinText: params.promptText,
        quiescence: params.quiescence
            ? {
                mode: "builder-soft-complete",
                rootDir: params.quiescence.rootDir,
                baselineFiles: params.quiescence.baselineFiles,
                logPath: params.quiescence.logPath,
                minRuntimeSeconds: BUILDER_QUIESCENCE_MIN_RUNTIME_SECONDS,
                quietSeconds: BUILDER_QUIESCENCE_QUIET_SECONDS,
                pollIntervalMs: BUILDER_QUIESCENCE_POLL_MS,
            }
            : undefined,
    });
}

async function writeOpenCodeRuntimeConfig(params: {
    cwd: string;
    mcpUrl?: string;
    model: string;
    instructionFiles: Array<{ name: string; content: string }>;
    profile: BuilderProfile;
}): Promise<{ configPath: string; cleanup: () => Promise<void> }> {
    const configDir = path.join(params.cwd, ".opencode");
    const configPath = path.join(configDir, "opencode.jsonc");
    await mkdir(configDir, { recursive: true });
    const instructionPaths: string[] = [];

    for (const file of params.instructionFiles) {
        const targetPath = path.join(configDir, file.name);
        await writeFile(targetPath, file.content);
        instructionPaths.push(`.opencode/${file.name}`);
    }

    const config: Record<string, unknown> = {
        $schema: "https://opencode.ai/config.json",
        model: params.model,
        small_model: params.model,
        instructions: instructionPaths,
        permission: buildOpenCodePermission(params.profile),
        snapshot: false,
        agent: {
            "harness-builder": {
                mode: "primary",
                description: "Focused harness builder that writes required artifacts directly and avoids open-ended delegation.",
                permission: {
                    ...buildOpenCodePermission(params.profile),
                    task: "deny",
                    webfetch: "deny",
                    skill: "deny",
                },
                prompt: buildOpenCodeBuilderAgentPrompt(params.profile),
            },
        },
    };

    if (params.mcpUrl && !isPacketOnlyBuilderProfile(params.profile)) {
        config.mcp = {
            specstudio: {
                type: "remote",
                url: params.mcpUrl,
            },
        };
    }

    await writeJsonFile(configPath, config);

    return {
        configPath,
        cleanup: async () => {
            await rm(configDir, { recursive: true, force: true });
        },
    };
}

async function runOpenCodePhase(params: {
    model: string;
    cwd: string;
    promptText: string;
    instructions: string;
    stdoutPath: string;
    stderrPath: string;
    timeoutSeconds: number;
    errorLogPath: string;
    quiescence?: {
        rootDir: string;
        baselineFiles: string[];
        logPath: string;
    };
    mcpUrl?: string;
    profile: BuilderProfile;
}): Promise<PhaseRunResult> {
    const runtimeConfig = await writeOpenCodeRuntimeConfig({
        cwd: params.cwd,
        mcpUrl: params.mcpUrl,
        model: params.model,
        profile: params.profile,
        instructionFiles: [
            { name: "harness-instructions.md", content: params.instructions },
            { name: "binding-brief.md", content: params.promptText },
        ],
    });

    try {
        return await runLoggedCommand({
            cmd: "opencode",
            args: [
                "run",
                "-m", params.model,
                "--agent", "harness-builder",
                "--print-logs",
                buildOpenCodeRunPrompt(params.profile),
            ],
            cwd: params.cwd,
            stdoutPath: params.stdoutPath,
            stderrPath: params.stderrPath,
            timeoutSeconds: params.timeoutSeconds,
            errorLogPath: params.errorLogPath,
            quiescence: params.quiescence
                ? {
                    mode: "builder-soft-complete",
                    rootDir: params.quiescence.rootDir,
                    baselineFiles: params.quiescence.baselineFiles,
                    logPath: params.quiescence.logPath,
                    minRuntimeSeconds: BUILDER_QUIESCENCE_MIN_RUNTIME_SECONDS,
                    quietSeconds: BUILDER_QUIESCENCE_QUIET_SECONDS,
                    pollIntervalMs: BUILDER_QUIESCENCE_POLL_MS,
                }
                : undefined,
        });
    } finally {
        await runtimeConfig.cleanup();
    }
}

async function runBuilderPhase(params: {
    backend: BuilderBackend;
    profile: BuilderProfile;
    model: string;
    cwd: string;
    promptText: string;
    instructions: string;
    stdoutPath: string;
    stderrPath: string;
    timeoutSeconds: number;
    errorLogPath: string;
    quiescence?: {
        rootDir: string;
        baselineFiles: string[];
        logPath: string;
    };
    mcpUrl?: string;
}): Promise<PhaseRunResult> {
    if (params.backend === "gemini") {
        return runGeminiPhase({
            model: params.model,
            cwd: params.cwd,
            promptText: params.promptText,
            instructions: params.instructions,
            stdoutPath: params.stdoutPath,
            stderrPath: params.stderrPath,
            timeoutSeconds: params.timeoutSeconds,
            errorLogPath: params.errorLogPath,
            quiescence: params.quiescence,
        });
    }

    return runOpenCodePhase({
        model: params.model,
        cwd: params.cwd,
        promptText: params.promptText,
        instructions: params.instructions,
        stdoutPath: params.stdoutPath,
        stderrPath: params.stderrPath,
        timeoutSeconds: params.timeoutSeconds,
        errorLogPath: params.errorLogPath,
        quiescence: params.quiescence,
        mcpUrl: params.mcpUrl,
        profile: params.profile,
    });
}

async function createFrozenTestManifest(generatedDir: string, generatedFiles: string[]): Promise<FrozenFileRecord[]> {
    const testFiles = generatedFiles.filter((file) => /^tests\/.+/.test(file));
    const records: FrozenFileRecord[] = [];

    for (const relativePath of testFiles) {
        records.push({
            path: relativePath,
            sha256: await hashFileSha256(path.join(generatedDir, relativePath)),
        });
    }

    return records;
}

async function lockFrozenFiles(generatedDir: string, manifest: FrozenFileRecord[]): Promise<() => Promise<void>> {
    const originals: Array<{ fullPath: string; mode: number }> = [];

    for (const record of manifest) {
        const fullPath = path.join(generatedDir, record.path);
        const fileStat = await stat(fullPath);
        originals.push({ fullPath, mode: fileStat.mode });
        await chmod(fullPath, fileStat.mode & ~0o222);
    }

    return async () => {
        for (const entry of originals) {
            await chmod(entry.fullPath, entry.mode);
        }
    };
}

async function readLinesIfExists(filePath: string): Promise<string[]> {
    try {
        const text = await readUtf8(filePath);
        return text.split(/\r?\n/).filter(Boolean);
    } catch {
        return [];
    }
}

async function collectBuilderObservability(params: {
    backend: BuilderBackend;
    profile: BuilderProfile;
    stderrPath: string;
}): Promise<BuilderObservability> {
    const lines = await readLinesIfExists(params.stderrPath);
    if (params.backend !== "opencode") {
        return {
            backend: params.backend,
            profile: params.profile,
        };
    }

    const sessionId = lines
        .map((line) => line.match(/service=session id=(\S+)/)?.[1])
        .find(Boolean);

    const countPermission = (name: string) =>
        lines.filter((line) => line.includes(`service=permission permission=${name} pattern=`) && line.includes(" evaluated")).length;

    const meaningfulLine = [...lines]
        .reverse()
        .find((line) =>
            !line.includes("service=bus type=message.part.delta") &&
            !line.includes("service=bus type=message.part.updated") &&
            !line.includes("service=bus type=session.updated") &&
            !line.includes("publishing")
        );

    const mcpLines = lines.filter((line) => line.includes("service=mcp key=specstudio"));
    const mcpToolInvocationCount = mcpLines.filter(
        (line) =>
            !line.includes(" type=remote found") &&
            !line.includes(" transport=StreamableHTTP connected") &&
            !line.includes(" create() successfully created client") &&
            !line.includes(" toolCount=")
    ).length;

    return {
        backend: params.backend,
        profile: params.profile,
        sessionId,
        lastMeaningfulEvent: meaningfulLine,
        toolUsage: {
            read: countPermission("read"),
            write: countPermission("write"),
            edit: countPermission("edit"),
            bash: countPermission("bash"),
            glob: countPermission("glob"),
            grep: countPermission("grep"),
        },
        mcpConnected: mcpLines.some((line) => line.includes("transport=StreamableHTTP connected")),
        mcpToolInvocationCount,
    };
}

async function detectFrozenFileMutations(
    generatedDir: string,
    manifest: FrozenFileRecord[]
): Promise<string[]> {
    const mutations: string[] = [];

    for (const record of manifest) {
        const fullPath = path.join(generatedDir, record.path);
        if (!await fileExists(fullPath)) {
            mutations.push(`${record.path}: deleted`);
            continue;
        }

        const currentHash = await hashFileSha256(fullPath);
        if (currentHash !== record.sha256) {
            mutations.push(`${record.path}: modified`);
        }
    }

    return mutations;
}

async function runPostGenerationAudit(
    runDir: string,
    generatedDir: string,
    generatedFiles: string[],
    promptText: string,
    frozenTestsManifest: FrozenFileRecord[] | null,
    commandPolicy: RuntimeCommandPolicy
): Promise<{ audit: AuditReport; semanticAudit: SemanticAuditReport }> {
    const auditDir = path.join(runDir, "audit");
    await mkdir(auditDir, { recursive: true });

    const checks: AuditCheck[] = [];
    let semanticAudit: SemanticAuditReport = {
        status: "skipped",
        totalVectors: 0,
        failingVectors: 0,
        mismatches: [],
        mismatchByCategory: {},
    };
    const expectedVectorIds = extractExpectedVectorIds(promptText);
    const authoredFiles = authoredWorkspaceArtifacts(generatedFiles);
    const testLikePathPattern = /^(tests|test|spec|specs|conformance)\/.+\.(ts|tsx|js|jsx|mjs|cjs|json|py|java|kt|kts|cs|go|rs|md|txt)$/i;
    const sourceLikePathPattern = /^(src|tests|test|spec|specs|conformance|examples|lib|app)\/.+\.(ts|tsx|js|jsx|mjs|cjs|json|py|java|kt|kts|cs|go|rs|md|txt|sh|toml|yaml|yml|xml|properties)$/i;
    const candidateTestFiles = authoredFiles.filter((file) => testLikePathPattern.test(file));
    const candidateSourceFiles = authoredFiles.filter((file) => sourceLikePathPattern.test(file));

    checks.push({
        name: "generated-files-present",
        status: authoredFiles.length > 0 ? "passed" : "failed",
        details: authoredFiles.length > 0
            ? `Generated ${authoredFiles.length} authored workspace files (${generatedFiles.length - authoredFiles.length} installed/runtime artifacts ignored in this summary).`
            : "No authored workspace files were created.",
    });

    if (frozenTestsManifest && frozenTestsManifest.length > 0) {
        const mutations = await detectFrozenFileMutations(generatedDir, frozenTestsManifest);
        checks.push({
            name: "frozen-test-integrity",
            status: mutations.length === 0 ? "passed" : "failed",
            details: mutations.length === 0
                ? `Frozen test pack remained unchanged across ${frozenTestsManifest.length} files.`
                : mutations.join("\n"),
        });
    } else {
        checks.push({
            name: "frozen-test-integrity",
            status: "skipped",
            details: "No frozen test manifest was available for integrity audit.",
        });
    }

    const implementedVectorIds = expectedVectorIds.length > 0 && candidateTestFiles.length > 0
        ? uniqueStrings(
            (await Promise.all(
                candidateTestFiles.map(async (relativePath) =>
                    extractImplementedVectorIds(await readUtf8(path.join(generatedDir, relativePath)))
                )
            )).flat()
        )
        : [];

    if (expectedVectorIds.length > 0 && candidateTestFiles.length > 0) {
        const missingVectorIds = expectedVectorIds.filter((id) => !implementedVectorIds.includes(id));
        checks.push({
            name: "vector-coverage",
            status: missingVectorIds.length === 0 ? "passed" : "failed",
            details: missingVectorIds.length === 0
                ? `Implemented all ${expectedVectorIds.length} expected vector IDs.`
                : `Missing vector IDs: ${missingVectorIds.join(", ")}`,
        });
    } else {
        checks.push({
            name: "vector-coverage",
            status: "skipped",
            details: "No expected vector IDs or candidate test files were available for coverage audit.",
        });
    }

    const placeholderFindings: string[] = [];
    for (const relativePath of candidateSourceFiles) {
        const content = await readUtf8(path.join(generatedDir, relativePath));
        const matches = findPlaceholderMatches(content);
        if (matches.length > 0) {
            placeholderFindings.push(`${relativePath}: ${matches.join(", ")}`);
        }
    }
    checks.push({
        name: "placeholder-scan",
        status: placeholderFindings.length === 0 ? "passed" : "failed",
        details: placeholderFindings.length === 0
            ? "No placeholder or prose-plan markers detected in source/test files."
            : placeholderFindings.join("\n"),
    });

    const packageJsonPath = path.join(generatedDir, "package.json");
    const tsconfigPath = path.join(generatedDir, "tsconfig.json");

    if (await fileExists(packageJsonPath) || hasRuntimeInstallManifest(generatedFiles)) {
        const installResult = await runAuditShellCommand(
            commandPolicy.installCommand,
            generatedDir,
            path.join(auditDir, "npm-install.stdout.log"),
            path.join(auditDir, "npm-install.stderr.log")
        );
        checks.push({
            name: "dependency-install",
            status: installResult.exitCode === 0 ? "passed" : "failed",
            details: installResult.exitCode === 0
                ? `${commandPolicy.installCommand} succeeded.`
                : `${commandPolicy.installCommand} failed with exit code ${installResult.exitCode ?? "null"}.`,
        });

        if (typeof commandPolicy.buildCommand === "string" && commandPolicy.buildCommand.trim().length > 0) {
            const buildResult = await runAuditShellCommand(
                commandPolicy.buildCommand,
                generatedDir,
                path.join(auditDir, "workspace-build.stdout.log"),
                path.join(auditDir, "workspace-build.stderr.log")
            );
            const buildDetails = [buildResult.stdout, buildResult.stderr].filter(Boolean).join("\n").trim();
            checks.push({
                name: "workspace-build-command",
                status: buildResult.exitCode === 0 ? "passed" : "failed",
                details: buildResult.exitCode === 0
                    ? `${commandPolicy.buildCommand} succeeded.`
                    : buildDetails || `${commandPolicy.buildCommand} failed with exit code ${buildResult.exitCode ?? "null"}.`,
            });
        } else if (await fileExists(tsconfigPath)) {
            const tscResult = await runAuditCommand(
                "npx",
                ["tsc", "-p", "tsconfig.json", "--noEmit", "--pretty", "false"],
                generatedDir,
                path.join(auditDir, "workspace-static-check.stdout.log"),
                path.join(auditDir, "workspace-static-check.stderr.log")
            );
            const tscDetails = [tscResult.stdout, tscResult.stderr].filter(Boolean).join("\n").trim();
            checks.push({
                name: "workspace-static-check",
                status: tscResult.exitCode === 0 ? "passed" : "failed",
                details: tscResult.exitCode === 0
                    ? "Static validation passed via TypeScript compiler fallback."
                    : tscDetails || `Static validation failed via TypeScript compiler fallback with exit code ${tscResult.exitCode ?? "null"}.`,
            });
        }

        const npmTestResult = await runAuditShellCommand(
            commandPolicy.testCommand,
            generatedDir,
            path.join(auditDir, "npm-test.stdout.log"),
            path.join(auditDir, "npm-test.stderr.log")
        );
        const npmTestDetails = [npmTestResult.stdout, npmTestResult.stderr].filter(Boolean).join("\n").trim();
        checks.push({
            name: "workspace-test-command",
            status: npmTestResult.exitCode === 0 ? "passed" : "failed",
            details: npmTestResult.exitCode === 0
                ? `${commandPolicy.testCommand} succeeded.`
                : npmTestDetails || `${commandPolicy.testCommand} failed with exit code ${npmTestResult.exitCode ?? "null"}.`,
        });

        semanticAudit = parseSemanticAuditFromTap(npmTestDetails, implementedVectorIds.length > 0 ? implementedVectorIds : expectedVectorIds);
        await writeFile(path.join(auditDir, "semantic-report.json"), JSON.stringify(semanticAudit, null, 2));
        await writeFile(
            path.join(auditDir, "semantic-summary.md"),
            [
                "# Semantic Audit",
                "",
                `- Status: \`${semanticAudit.status}\``,
                `- Total vectors observed: ${semanticAudit.totalVectors}`,
                `- Failing vectors: ${semanticAudit.failingVectors}`,
                ...Object.entries(semanticAudit.mismatchByCategory).map(
                    ([category, count]) => `- ${category}: ${count}`
                ),
                ...semanticAudit.mismatches.map(
                    (mismatch) =>
                        `- ${mismatch.vectorId}: expected=\`${mismatch.expected ?? "unknown"}\`, actual=\`${mismatch.actual ?? "unknown"}\`, category=\`${mismatch.category}\``
                ),
            ].join("\n") + "\n"
        );
    } else {
        checks.push({
            name: "runtime-command-audit",
            status: "skipped",
            details: "No package manifest was found for the current audit path; skipped install/build/test command execution.",
        });
    }

    const status = checks.some((check) => check.status === "failed") ? "failed" : "passed";

    await writeFile(path.join(auditDir, "report.json"), JSON.stringify({ status, checks }, null, 2));
    await writeFile(
        path.join(auditDir, "summary.md"),
        [
            "# Post-Generation Audit",
            "",
            `- Status: \`${status}\``,
            ...checks.map((check) => `- ${check.name}: \`${check.status}\` - ${check.details.replace(/\n/g, " ")}`),
            "",
            `- Semantic audit status: \`${semanticAudit.status}\``,
        ].join("\n") + "\n"
    );

    return { audit: { status, checks }, semanticAudit };
}

async function writeRunPackets(params: {
    runDir: string;
    bundleId: string;
    bindingId: string;
    operationId: string;
    suiteId: string;
    promptName: string;
    testPromptName: string;
    implementationResolutionMode: "packet-tool" | "legacy-prompt";
    conformanceResolutionMode: "packet-tool" | "legacy-prompt";
    artifactMode: string;
    mode: HarnessMode;
    model: string;
    builderBackend?: BuilderBackend;
    builderProfile?: BuilderProfile;
    criticModel?: string;
    criticBackend?: CriticBackend;
    criticReasoningEffort?: CodexReasoningEffort;
    runtimeCommandPolicy?: RuntimeCommandPolicy;
    freezeTests: boolean;
    skipAudit: boolean;
    implementationPromptResponse: PromptGetResult;
    testPromptResponse: PromptGetResult | null;
    frozenTestsManifest: FrozenFileRecord[] | null;
    executionPolicy: string;
}): Promise<void> {
    const packetsDir = path.join(params.runDir, "packets");
    await mkdir(packetsDir, { recursive: true });
    const promptArtifacts = {
        implementation: {
            resolvedTextPath: "prompt/resolved-prompt.txt",
            resolvedResponsePath: "prompt/resolved-prompt-response.json",
            instructionsPath: "prompt/harness-instructions.txt",
        },
        conformance: {
            resolvedTextPath: "prompt/resolved-test-prompt.txt",
            resolvedResponsePath: "prompt/resolved-test-prompt-response.json",
            instructionsPath: "prompt/frozen-test-instructions.txt",
        },
    };

    await writeJsonFile(path.join(packetsDir, "run-settings.json"), {
        bundleId: params.bundleId,
        bindingId: params.bindingId,
        operationId: params.operationId,
        suiteId: params.suiteId,
        promptName: params.promptName,
        testPromptName: params.testPromptName,
        implementationResolutionMode: params.implementationResolutionMode,
        conformanceResolutionMode: params.conformanceResolutionMode,
        artifactMode: params.artifactMode,
        mode: params.mode,
        model: params.model,
        builderBackend: params.builderBackend ?? DEFAULT_BUILDER_BACKEND,
        builderProfile: params.builderProfile ?? DEFAULT_BUILDER_PROFILE,
        criticModel: params.criticModel ?? null,
        criticBackend: params.criticBackend ?? null,
        criticReasoningEffort: params.criticReasoningEffort ?? null,
        runtimeCommandPolicy: params.runtimeCommandPolicy ?? null,
        freezeTests: params.freezeTests,
        skipAudit: params.skipAudit,
        promptArtifacts,
    });

    await writeJsonFile(path.join(packetsDir, "implementation-packet.json"), {
        kind: "implementation-packet",
        bundleId: params.bundleId,
        bindingId: params.bindingId,
        operationId: params.operationId,
        artifactMode: params.artifactMode,
        promptName: params.promptName,
        resolutionMode: params.implementationResolutionMode,
        promptSummary: summarizePromptResponse(params.implementationPromptResponse),
        promptArtifacts: promptArtifacts.implementation,
    });

    await writeJsonFile(path.join(packetsDir, "conformance-packet.json"), {
        kind: "conformance-packet",
        bundleId: params.bundleId,
        bindingId: params.bindingId,
        suiteId: params.suiteId,
        testPromptName: params.testPromptName,
        resolutionMode: params.conformanceResolutionMode,
        freezeTests: params.freezeTests,
        promptSummary: summarizePromptResponse(params.testPromptResponse),
        promptArtifacts: promptArtifacts.conformance,
        frozenTestsManifest: params.frozenTestsManifest,
    });

    await writeJsonFile(path.join(packetsDir, "validation-packet.json"), {
        kind: "validation-packet",
        mode: params.mode,
        executionPolicy: params.executionPolicy,
        genericMechanicalChecks: [
            "generated-files-present",
            "frozen-test-integrity",
            "vector-coverage",
            "placeholder-scan",
            "dependency-install",
            "workspace-build-command",
            "workspace-test-command",
        ],
        runtimeCommandPolicy: params.runtimeCommandPolicy ?? null,
    });
}

async function createCriticWorkspaceSnapshot(
    generatedDir: string,
    generatedFiles: string[],
    runtimeCommandPolicy?: RuntimeCommandPolicy
): Promise<Array<{ path: string; content: string }>> {
    const textLikePattern = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|yaml|yml|toml|txt|py|java|kt|kts|cs|go|rs|sh|xml|properties)$/i;
    const candidates = generatedFiles
        .map(normalizeRelativePath)
        .filter((relativePath) => isRelevantCriticArtifact(relativePath))
        .filter((relativePath) => textLikePattern.test(relativePath));

    const prioritized = candidates.sort((a, b) => criticArtifactPriority(a, runtimeCommandPolicy) - criticArtifactPriority(b, runtimeCommandPolicy) || a.localeCompare(b));
    const snapshot: Array<{ path: string; content: string }> = [];
    let totalChars = 0;

    for (const relativePath of prioritized) {
        if (snapshot.length >= 20 || totalChars >= 120000) {
            break;
        }
        const content = await readUtf8(path.join(generatedDir, relativePath));
        const trimmed = content.length > 12000 ? `${content.slice(0, 12000)}\n/* truncated */\n` : content;
        snapshot.push({ path: relativePath, content: trimmed });
        totalChars += trimmed.length;
    }

    return snapshot;
}

function criticArtifactPriority(relativePath: string, runtimeCommandPolicy?: RuntimeCommandPolicy): number {
    const normalized = normalizeRelativePath(relativePath);
    const packageManager = runtimeCommandPolicy?.packageManager;

    if (relativePath === "binding-manifest.json") return 0;
    if (relativePath === "README.md") return 1;
    if (relativePath === "CONFORMANCE.md") return 2;

    if (packageManager === "pip" && /^(pyproject\.toml|requirements\.txt|setup\.py|Pipfile)$/i.test(normalized)) return 3;
    if ((packageManager === "pnpm" || packageManager === "npm" || packageManager === "yarn" || packageManager === "bun")
        && /^(package\.json|tsconfig\.json)$/i.test(normalized)) return 3;
    if (/^(Cargo\.toml|go\.mod|pom\.xml|build\.gradle|build\.gradle\.kts|settings\.gradle|settings\.gradle\.kts|[^/]+\.(csproj|fsproj|vbproj|sln))$/i.test(normalized)) return 3;
    if (/^(src|lib|app|cmd|pkg|internal)\//.test(normalized)) return 4;
    if (/^(tests|test|spec|specs|conformance)\//.test(normalized)) return 5;
    if (/^examples\//.test(normalized)) return 6;
    if (/^docs\//.test(normalized)) return 7;
    if (/\.(json|toml|yaml|yml|xml|properties|txt|md)$/i.test(normalized)) return 8;
    return 10;
}

function collectCriticAnomalies(audit: AuditSnapshot, semanticAudit: SemanticAuditReport): string[] {
    const anomalies: string[] = [];

    if (audit.status !== "passed") {
        for (const check of audit.checks.filter((candidate) => candidate.status === "failed")) {
            anomalies.push(`machine-audit:${check.name}`);
        }
    }

    if (semanticAudit.status !== "passed") {
        anomalies.push(`semantic-audit:${semanticAudit.status}`);
    }

    if (semanticAudit.failingVectors > 0) {
        anomalies.push(`semantic-failures:${semanticAudit.failingVectors}`);
    }

    return anomalies;
}

function shouldEscalateCriticDepth(
    audit: AuditSnapshot,
    semanticAudit: SemanticAuditReport,
    shallowReport: CriticReport
): boolean {
    if (collectCriticAnomalies(audit, semanticAudit).length > 0) {
        return true;
    }

    if (shallowReport.status === "inconclusive") {
        return true;
    }

    return shallowReport.status === "failed" || shallowReport.findings.length > 0;
}

function buildCriticInstructions(): string {
    return `You are the critic model for a spec-driven code generation harness.

Review the provided packets, machine-audit evidence, and generated workspace snapshot.
- Do not modify any files.
- Do not weaken tests or redefine the contract.
- Detect semantic drift, cheating, frozen-asset mutation, weak assertions, or suspicious shortcuts.
- Prefer concrete evidence over speculation.
- Return only the requested delimited JSON payload.

Output format:
BEGIN_CRITIC_JSON
{
  "status": "passed" | "failed" | "inconclusive",
  "summary": "short summary",
  "recommendedGate": "pass" | "fail" | "defer",
  "findings": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "category": "short-category",
      "path": "optional/path",
      "evidence": "specific evidence",
      "reason": "why this matters"
    }
  ]
}
END_CRITIC_JSON`;
}

function buildCodexCriticPrompt(params: {
    depth: CriticReviewDepth;
    anomalies: string[];
}): string {
    const anomalyBlock = params.anomalies.length > 0
        ? `Concrete anomalies already present in machine evidence:
${params.anomalies.map((anomaly) => `- ${anomaly}`).join("\n")}`
        : "Machine evidence is currently green. Assume pass-by-default unless the required files show a concrete issue.";

    if (params.depth === "shallow") {
        return `You are the critic model for a spec-driven code generation harness.

Review the existing run artifacts in the current directory.

You must read only these files first:
- packets/run-settings.json
- packets/validation-packet.json
- packets/implementation-packet.json
- packets/conformance-packet.json
- audit/report.json
- audit/semantic-report.json

${anomalyBlock}

Rules:
- Do not modify any files.
- Do not narrate your plan or reasoning in the final answer.
- Do not weaken tests or redefine the contract.
- Prefer concrete evidence over speculation.
- This is a shallow review. Do not inspect generated workspace files unless the required files above reveal a concrete anomaly that cannot be evaluated from those files alone.
- If audit/report.json and audit/semantic-report.json are both passed and you do not see a concrete anomaly in the required files, return a verdict immediately.
- If you believe deeper inspection is required, say so via findings and recommendedGate rather than continuing broad exploration.
- Return only valid JSON with the exact shape requested below.

Output JSON shape:
{
  "status": "passed" | "failed" | "inconclusive",
  "summary": "short summary",
  "recommendedGate": "pass" | "fail" | "defer",
  "findings": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "category": "short-category",
      "path": "optional/path",
      "evidence": "specific evidence",
      "reason": "why this matters"
    }
  ]
}`;
    }

    return `You are the critic model for a spec-driven code generation harness.

Review the existing run artifacts in the current directory.

You must read at least these files:
- packets/run-settings.json
- packets/validation-packet.json
- packets/implementation-packet.json
- packets/conformance-packet.json
- audit/report.json
- audit/semantic-report.json
- packets/critic-workspace-snapshot.json

${anomalyBlock}

You may inspect the generated workspace as needed.

Rules:
- Do not modify any files.
- Do not narrate your plan or reasoning in the final answer.
- Do not weaken tests or redefine the contract.
- Detect semantic drift, cheating, frozen-asset mutation, weak assertions, or suspicious shortcuts.
- Prefer concrete evidence over speculation.
- Start with the required files listed above.
- This is a deep review. Inspect at most 8 additional generated workspace files beyond the required packet and audit files.
- Use packets/critic-workspace-snapshot.json to choose the smallest set of files you need.
- If audit/report.json and audit/semantic-report.json are both passed, treat that as the default baseline and only inspect extra generated files when you need evidence for a concrete concern.
- Do not inspect package-lock.json, node_modules, or unrelated generated artifacts unless a concrete anomaly requires it.
- Prefer a short evidence review over broad exploratory spelunking. Stop once you have enough evidence to return the verdict.
- Return only valid JSON with the exact shape requested below.

Output JSON shape:
{
  "status": "passed" | "failed" | "inconclusive",
  "summary": "short summary",
  "recommendedGate": "pass" | "fail" | "defer",
  "findings": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "category": "short-category",
      "path": "optional/path",
      "evidence": "specific evidence",
      "reason": "why this matters"
    }
  ]
}`;
}

function buildCodexCriticFinishPrompt(): string {
    return `Stop exploring and do not inspect additional files unless absolutely necessary.

Based on the evidence you have already gathered in this session, return the final critic verdict now.

Return only valid JSON with this exact shape:
{
  "status": "passed" | "failed" | "inconclusive",
  "summary": "short summary",
  "recommendedGate": "pass" | "fail" | "defer",
  "findings": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "category": "short-category",
      "path": "optional/path",
      "evidence": "specific evidence",
      "reason": "why this matters"
    }
  ]
}`;
}

function buildCriticOutputSchema(): Record<string, unknown> {
    return {
        type: "object",
        additionalProperties: false,
        required: ["status", "summary", "recommendedGate", "findings"],
        properties: {
            status: {
                type: "string",
                enum: ["passed", "failed", "inconclusive"],
            },
            summary: {
                type: "string",
                minLength: 1,
            },
            recommendedGate: {
                type: "string",
                enum: ["pass", "fail", "defer"],
            },
            findings: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["severity", "category", "path", "evidence", "reason"],
                    properties: {
                        severity: {
                            type: "string",
                            enum: ["critical", "high", "medium", "low"],
                        },
                        category: {
                            type: "string",
                            minLength: 1,
                        },
                        path: {
                            type: "string",
                        },
                        evidence: {
                            type: "string",
                        },
                        reason: {
                            type: "string",
                        },
                    },
                },
            },
        },
    };
}

function extractCodexSessionId(text: string): string | undefined {
    const match = text.match(/session id:\s*([0-9a-f-]{36})/i);
    return match?.[1];
}

function parseCriticReportFromText(text: string): CriticReport {
    try {
        const trimmed = text.trim();
        const jsonSource = trimmed.startsWith("{")
            ? trimmed
            : (text.match(/BEGIN_CRITIC_JSON\s*([\s\S]*?)\s*END_CRITIC_JSON/)?.[1] ?? null);

        if (!jsonSource) {
            return {
                status: "inconclusive",
                summary: "Critic output did not contain a parseable JSON payload.",
                recommendedGate: "defer",
                findings: [],
            };
        }

        const parsed = JSON.parse(jsonSource) as Partial<CriticReport>;
        const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
        const status = parsed.status === "passed" || parsed.status === "failed" || parsed.status === "inconclusive"
            ? parsed.status
            : "inconclusive";
        const recommendedGate = parsed.recommendedGate === "pass" || parsed.recommendedGate === "fail" || parsed.recommendedGate === "defer"
            ? parsed.recommendedGate
            : "defer";

        return {
            status,
            summary: typeof parsed.summary === "string" ? parsed.summary : "Critic completed without a summary.",
            recommendedGate,
            findings: findings
                .filter((finding) => Boolean(finding && typeof finding === "object"))
                .map((finding) => {
                    const record = finding as Record<string, unknown>;
                    return {
                    severity: record.severity === "critical" || record.severity === "high" || record.severity === "medium" || record.severity === "low"
                        ? record.severity
                        : "medium",
                    category: typeof record.category === "string" ? record.category : "unspecified",
                    path: typeof record.path === "string" ? record.path : undefined,
                    evidence: typeof record.evidence === "string" ? record.evidence : "",
                    reason: typeof record.reason === "string" ? record.reason : "",
                };
                }),
        };
    } catch (error) {
        return {
            status: "inconclusive",
            summary: `Critic JSON could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
            recommendedGate: "defer",
            findings: [],
        };
    }
}

async function runCodexCriticPhase(params: {
    model: string;
    reasoningEffort: CodexReasoningEffort;
    cwd: string;
    promptText: string;
    stdoutPath: string;
    stderrPath: string;
    lastMessagePath: string;
    timeoutSeconds: number;
    errorLogPath: string;
}): Promise<CodexCriticRunResult> {
    const outputSchemaPath = path.join(path.dirname(params.lastMessagePath), "codex.critic.output-schema.json");
    const completionProbe = {
        pollIntervalMs: 5000,
        logPath: path.join(path.dirname(params.lastMessagePath), "codex.critic-completion.log"),
        ready: async () => {
            const messageText = await readUtf8(params.lastMessagePath).catch(() => "");
            const report = parseCriticReportFromText(messageText);
            return {
                done: report.status !== "inconclusive",
                details: report.status !== "inconclusive"
                    ? `Critic completed early after writing a parseable ${report.status} verdict.`
                    : undefined,
            };
        },
    };
    await writeJsonFile(outputSchemaPath, buildCriticOutputSchema());

    const phase = await runLoggedCommand({
        cmd: "codex",
        args: [
            "exec",
            "-m", params.model,
            "-c", `model_reasoning_effort="${params.reasoningEffort}"`,
            "--dangerously-bypass-approvals-and-sandbox",
            "--skip-git-repo-check",
            "--output-schema", outputSchemaPath,
            "-C", params.cwd,
            "-o", params.lastMessagePath,
            params.promptText,
        ],
        cwd: params.cwd,
        stdoutPath: params.stdoutPath,
        stderrPath: params.stderrPath,
        timeoutSeconds: params.timeoutSeconds,
        errorLogPath: params.errorLogPath,
        completionProbe,
    });

    const stderrText = await readUtf8(params.stderrPath).catch(() => "");
    const sessionId = extractCodexSessionId(stderrText);

    let messageText = await readUtf8(params.lastMessagePath).catch(() => "");
    let report = parseCriticReportFromText(messageText);
    let attempts = 1;

    if (report.status === "inconclusive" && sessionId) {
        for (let attempt = 1; attempt <= 2; attempt += 1) {
            const resumePhase = await runLoggedCommand({
                cmd: "codex",
                args: [
                    "exec",
                    "resume",
                    sessionId,
                    "-m", params.model,
                    "--dangerously-bypass-approvals-and-sandbox",
                    "--skip-git-repo-check",
                    "-o", params.lastMessagePath,
                    buildCodexCriticFinishPrompt(),
                ],
                cwd: params.cwd,
                stdoutPath: params.stdoutPath,
                stderrPath: params.stderrPath,
                timeoutSeconds: Math.min(params.timeoutSeconds, 300),
                errorLogPath: params.errorLogPath,
                completionProbe,
            });

            attempts += 1;
            if (resumePhase.exitCode !== null) {
                phase.exitCode = resumePhase.exitCode;
            }

            messageText = await readUtf8(params.lastMessagePath).catch(() => "");
            report = parseCriticReportFromText(messageText);
            if (report.status !== "inconclusive") {
                break;
            }
        }
    }

    return { phase, report, sessionId, attempts };
}

function criticTimeoutSeconds(totalTimeoutSeconds: number, depth: CriticReviewDepth): number {
    if (depth === "shallow") {
        return Math.min(totalTimeoutSeconds, 180);
    }
    return Math.min(totalTimeoutSeconds, 300);
}

async function runCriticPhase(params: {
    backend: CriticBackend;
    model: string;
    reasoningEffort: CodexReasoningEffort;
    runDir: string;
    logsDir: string;
    timeoutSeconds: number;
    audit: AuditSnapshot;
    semanticAudit: SemanticAuditReport;
    criticWorkspaceSnapshot: Array<{ path: string; content: string }>;
}): Promise<{ phase: PhaseRunResult; report: CriticReport }> {
    const anomalies = collectCriticAnomalies(params.audit, params.semanticAudit);

    if (params.backend === "codex") {
        const shallowResult = await runCodexCriticPhase({
            model: params.model,
            reasoningEffort: params.reasoningEffort,
            cwd: params.runDir,
            promptText: buildCodexCriticPrompt({ depth: "shallow", anomalies }),
            stdoutPath: path.join(params.logsDir, "codex.critic.stdout.log"),
            stderrPath: path.join(params.logsDir, "codex.critic.stderr.log"),
            lastMessagePath: path.join(params.logsDir, "codex.critic.last-message.json"),
            timeoutSeconds: criticTimeoutSeconds(params.timeoutSeconds, "shallow"),
            errorLogPath: path.join(params.logsDir, "critic-error.txt"),
        });

        if (!shouldEscalateCriticDepth(params.audit, params.semanticAudit, shallowResult.report)) {
            return { phase: shallowResult.phase, report: shallowResult.report };
        }

        return runCodexCriticPhase({
            model: params.model,
            reasoningEffort: params.reasoningEffort,
            cwd: params.runDir,
            promptText: buildCodexCriticPrompt({ depth: "deep", anomalies }),
            stdoutPath: path.join(params.logsDir, "codex.critic.stdout.log"),
            stderrPath: path.join(params.logsDir, "codex.critic.stderr.log"),
            lastMessagePath: path.join(params.logsDir, "codex.critic.last-message.json"),
            timeoutSeconds: criticTimeoutSeconds(params.timeoutSeconds, "deep"),
            errorLogPath: path.join(params.logsDir, "critic-error.txt"),
        });
    }

    const shallowCriticPrompt = [
        "# Critic Input",
        "",
        "## Run Settings",
        await readUtf8(path.join(params.runDir, "packets", "run-settings.json")),
        "",
        "## Validation Packet",
        await readUtf8(path.join(params.runDir, "packets", "validation-packet.json")),
        "",
        "## Machine Audit Report",
        JSON.stringify(params.audit, null, 2),
        "",
        "## Semantic Audit Report",
        JSON.stringify(params.semanticAudit, null, 2),
        "",
        "## Review Mode",
        "shallow",
        "",
        "## Machine-Evidence Anomalies",
        JSON.stringify(anomalies, null, 2),
        "",
        "## Instructions",
        "Stay shallow. Do not inspect generated workspace details unless the evidence above requires deeper review.",
    ].join("\n");

    const shallowPhase = await runGeminiPhase({
        model: params.model,
        cwd: params.runDir,
        promptText: shallowCriticPrompt,
        instructions: buildCriticInstructions(),
        stdoutPath: path.join(params.logsDir, "gemini.critic.stdout.log"),
        stderrPath: path.join(params.logsDir, "gemini.critic.stderr.log"),
        timeoutSeconds: criticTimeoutSeconds(params.timeoutSeconds, "shallow"),
        errorLogPath: path.join(params.logsDir, "critic-error.txt"),
    });
    const shallowStdout = await readUtf8(path.join(params.logsDir, "gemini.critic.stdout.log")).catch(() => "");
    const shallowReport = parseCriticReportFromText(shallowStdout);

    if (!shouldEscalateCriticDepth(params.audit, params.semanticAudit, shallowReport)) {
        return { phase: shallowPhase, report: shallowReport };
    }

    const criticPrompt = [
        "# Critic Input",
        "",
        "## Run Settings",
        await readUtf8(path.join(params.runDir, "packets", "run-settings.json")),
        "",
        "## Validation Packet",
        await readUtf8(path.join(params.runDir, "packets", "validation-packet.json")),
        "",
        "## Machine Audit Report",
        JSON.stringify(params.audit, null, 2),
        "",
        "## Semantic Audit Report",
        JSON.stringify(params.semanticAudit, null, 2),
        "",
        "## Review Mode",
        "deep",
        "",
        "## Machine-Evidence Anomalies",
        JSON.stringify(anomalies, null, 2),
        "",
        "## Workspace Snapshot",
        JSON.stringify(params.criticWorkspaceSnapshot, null, 2),
        "",
        "## Instructions",
        "Deep review allowed. Inspect the smallest set of generated files needed to evaluate the anomalies above.",
    ].join("\n");

    const phase = await runGeminiPhase({
        model: params.model,
        cwd: params.runDir,
        promptText: criticPrompt,
        instructions: buildCriticInstructions(),
        stdoutPath: path.join(params.logsDir, "gemini.critic.stdout.log"),
        stderrPath: path.join(params.logsDir, "gemini.critic.stderr.log"),
        timeoutSeconds: criticTimeoutSeconds(params.timeoutSeconds, "deep"),
        errorLogPath: path.join(params.logsDir, "critic-error.txt"),
    });
    const criticStdout = await readUtf8(path.join(params.logsDir, "gemini.critic.stdout.log")).catch(() => "");
    return { phase, report: parseCriticReportFromText(criticStdout) };
}

async function runCriticOnlyMode(params: {
    criticRunDir: string;
    criticBackend: CriticBackend;
    criticModel: string;
    criticReasoningEffort: CodexReasoningEffort;
    timeoutSeconds: number;
}): Promise<number> {
    const runDir = path.resolve(params.criticRunDir);
    const generatedDir = path.join(runDir, "generated");
    const logsDir = path.join(runDir, "logs");
    const packetsDir = path.join(runDir, "packets");

    await mkdir(logsDir, { recursive: true });
    await mkdir(packetsDir, { recursive: true });

    if (!await fileExists(generatedDir)) {
        throw new Error(`critic-only mode requires an existing generated workspace at ${generatedDir}`);
    }

    const generatedFiles = await listFilesRecursive(generatedDir);
    const audit = await readJsonFile<AuditSnapshot>(path.join(runDir, "audit", "report.json")) ?? {
        status: "skipped",
        checks: [],
    };
    const semanticAudit = await readJsonFile<SemanticAuditReport>(path.join(runDir, "audit", "semantic-report.json")) ?? {
        status: "skipped",
        totalVectors: 0,
        failingVectors: 0,
        mismatches: [],
        mismatchByCategory: {},
    };
    const runSettings = await readJsonFile<{ runtimeCommandPolicy?: RuntimeCommandPolicy }>(path.join(packetsDir, "run-settings.json"));
    const runtimeCommandPolicy = runSettings?.runtimeCommandPolicy;

    const criticWorkspaceSnapshot = await createCriticWorkspaceSnapshot(generatedDir, generatedFiles, runtimeCommandPolicy);
    await writeJsonFile(path.join(packetsDir, "critic-workspace-snapshot.json"), criticWorkspaceSnapshot);

    const preCriticManifest = await createWorkspaceManifest(
        generatedDir,
        generatedFiles.filter((relativePath) => isWorkspaceArtifact(relativePath))
    );

    const criticPhaseResult = await runCriticPhase({
        backend: params.criticBackend,
        model: params.criticModel,
        reasoningEffort: params.criticReasoningEffort,
        runDir,
        logsDir,
        timeoutSeconds: params.timeoutSeconds,
        audit,
        semanticAudit,
        criticWorkspaceSnapshot,
    });

    let criticReport = criticPhaseResult.report;
    const criticMutations = await detectWorkspaceMutations(generatedDir, preCriticManifest);
    const criticIntegrityCheck: AuditCheck = {
        name: "critic-workspace-integrity",
        status: criticMutations.length === 0 ? "passed" : "failed",
        details: criticMutations.length === 0
            ? "Critic phase did not mutate generated workspace artifacts."
            : criticMutations.join("\n"),
    };

    if (criticPhaseResult.phase.exitCode !== 0 && criticReport.status === "skipped") {
        criticReport = {
            status: "inconclusive",
            summary: `Critic phase exited with ${criticPhaseResult.phase.exitCode ?? "null"} and did not produce a parseable report.`,
            recommendedGate: "defer",
            findings: [],
        };
    }

    if (criticMutations.length > 0) {
        criticReport = {
            status: "failed",
            summary: "Critic mutated generated workspace artifacts, which is not allowed.",
            recommendedGate: "fail",
            findings: [
                {
                    severity: "high",
                    category: "critic-workspace-mutation",
                    evidence: criticMutations.join("; "),
                    reason: "Critic phase must be read-only with respect to generated artifacts.",
                },
            ],
        };
    }

    await writeJsonFile(path.join(runDir, "critic-report.json"), criticReport);

    const criticOnlyReport = {
        runId: path.basename(runDir),
        mode: "critic-only",
        criticBackend: params.criticBackend,
        criticModel: params.criticModel,
        criticReasoningEffort: params.criticReasoningEffort,
        critic: criticReport,
        criticWorkspaceIntegrity: criticIntegrityCheck,
        auditStatus: audit.status,
        semanticAuditStatus: semanticAudit.status,
    };
    await writeJsonFile(path.join(runDir, "critic-only-report.json"), criticOnlyReport);
    await writeFile(
        path.join(runDir, "critic-only-summary.md"),
        [
            "# Critic-Only Run",
            "",
            `- Run ID: \`${path.basename(runDir)}\``,
            `- Critic backend: \`${params.criticBackend}\``,
            `- Critic model: \`${params.criticModel}\``,
            `- Critic reasoning effort: \`${params.criticReasoningEffort}\``,
            `- Critic status: \`${criticReport.status}\``,
            `- Recommended gate: \`${criticReport.recommendedGate}\``,
            `- Summary: ${criticReport.summary}`,
            `- Workspace integrity: \`${criticIntegrityCheck.status}\``,
            ...criticReport.findings.map((finding) => `- [${finding.severity}] ${finding.category}${finding.path ? ` (${finding.path})` : ""}: ${finding.reason} Evidence: ${finding.evidence}`),
        ].join("\n") + "\n"
    );

    console.log(JSON.stringify(criticOnlyReport, null, 2));
    return criticReport.status === "failed" || criticReport.recommendedGate === "fail" || criticIntegrityCheck.status === "failed" ? 2 : 0;
}

async function main() {
    const { values } = parseArgs({
        options: {
            bundle: { type: "string", default: DEFAULT_BUNDLE },
            binding: { type: "string", default: DEFAULT_BINDING },
            operation: { type: "string", default: DEFAULT_OPERATION },
            prompt: { type: "string", default: DEFAULT_PROMPT },
            suite: { type: "string", default: DEFAULT_SUITE },
            testPrompt: { type: "string", default: DEFAULT_TEST_PROMPT },
            artifactMode: { type: "string", default: DEFAULT_ARTIFACT_MODE },
            builderBackend: { type: "string", default: DEFAULT_BUILDER_BACKEND },
            builderProfile: { type: "string", default: DEFAULT_BUILDER_PROFILE },
            model: { type: "string" },
            criticModel: { type: "string" },
            criticBackend: { type: "string" },
            criticReasoningEffort: { type: "string" },
            criticRunDir: { type: "string" },
            port: { type: "string", default: String(DEFAULT_PORT) },
            outputRoot: { type: "string", default: DEFAULT_OUTPUT_ROOT },
            timeoutSeconds: { type: "string", default: String(DEFAULT_TIMEOUT_SECONDS) },
            mode: { type: "string", default: DEFAULT_MODE },
            executeCommands: { type: "boolean", default: false },
            freezeTests: { type: "boolean", default: true },
            skipAudit: { type: "boolean", default: false },
            skipCritic: { type: "boolean", default: false },
            keepServer: { type: "boolean", default: false },
            clean: { type: "boolean", default: false },
            help: { type: "boolean", short: "h", default: false },
        },
        allowPositionals: false,
    });

    if (values.help) {
        console.log(`Usage: pnpm binding:harness [options]

Options:
  --bundle <id>          Bundle ID (default: ${DEFAULT_BUNDLE})
  --binding <id>         ImplementationBinding ID (default: ${DEFAULT_BINDING})
  --operation <id>       Operation ID (default: ${DEFAULT_OPERATION})
  --prompt <name>        Legacy prompt override for implementation packet resolution (default: ${DEFAULT_PROMPT})
  --suite <id>           ConformanceSuite ID for frozen test generation (default: ${DEFAULT_SUITE})
  --testPrompt <name>    Legacy prompt override for conformance packet resolution (default: ${DEFAULT_TEST_PROMPT})
  --artifactMode <mode>  Artifact mode (default: ${DEFAULT_ARTIFACT_MODE})
  --builderBackend <name> Builder backend: gemini | opencode (default: ${DEFAULT_BUILDER_BACKEND})
  --builderProfile <name> Builder profile: default | packet-only | glm-strict (default: ${DEFAULT_BUILDER_PROFILE})
  --model <name>         Builder model (default: ${DEFAULT_MODEL}; OpenCode default: ${DEFAULT_OPENCODE_MODEL})
  --criticModel <name>   Critic model (default: ${DEFAULT_CRITIC_MODEL}; OpenCode default: ${DEFAULT_OPENCODE_CRITIC_MODEL})
  --criticBackend <name> Critic backend: gemini | codex (default: ${DEFAULT_CRITIC_BACKEND}; OpenCode default: ${DEFAULT_OPENCODE_CRITIC_BACKEND})
  --criticReasoningEffort <level>  Codex critic reasoning effort: low | medium | high (default: ${DEFAULT_CRITIC_REASONING_EFFORT}; OpenCode default: ${DEFAULT_OPENCODE_CRITIC_REASONING_EFFORT})
  --criticRunDir <dir>   Existing run directory for --mode critic-only
  --port <n>             MCP HTTP port (default: ${DEFAULT_PORT})
  --outputRoot <dir>     Run output root (default: ${DEFAULT_OUTPUT_ROOT})
  --timeoutSeconds <n>   Phase timeout in seconds (default: ${DEFAULT_TIMEOUT_SECONDS})
  --mode <name>          Harness mode: generate-only | self-verify | critic-only (default: ${DEFAULT_MODE})
  --executeCommands      Legacy alias for --mode self-verify
  --freezeTests          Generate and freeze a normative test pack before implementation (default: true)
  --skipAudit            Skip post-generation audit checks
  --skipCritic           Skip AI critic phase after machine audit
  --keepServer           Do not stop MCP server if harness started it
  --clean                Remove generated workspace before running
`);
        return;
    }

    const bundleId = values.bundle!;
    const bindingId = values.binding!;
    const operationId = values.operation!;
    const requestedPromptName = values.prompt!;
    const suiteId = values.suite!;
    const requestedTestPromptName = values.testPrompt!;
    const artifactMode = values.artifactMode!;
    const builderBackend = resolveBuilderBackend(values.builderBackend ?? DEFAULT_BUILDER_BACKEND);
    const builderProfile = resolveBuilderProfile(values.builderProfile ?? DEFAULT_BUILDER_PROFILE);
    const model = values.model
        ?? (builderBackend === "opencode" ? DEFAULT_OPENCODE_MODEL : DEFAULT_MODEL);
    const criticModel = values.criticModel
        ?? (builderBackend === "opencode" ? DEFAULT_OPENCODE_CRITIC_MODEL : DEFAULT_CRITIC_MODEL);
    const criticBackend = resolveCriticBackend(
        values.criticBackend
        ?? (builderBackend === "opencode" ? DEFAULT_OPENCODE_CRITIC_BACKEND : DEFAULT_CRITIC_BACKEND)
    );
    const criticReasoningEffort = resolveCriticReasoningEffort(
        values.criticReasoningEffort
        ?? (builderBackend === "opencode" ? DEFAULT_OPENCODE_CRITIC_REASONING_EFFORT : DEFAULT_CRITIC_REASONING_EFFORT)
    );
    const criticRunDir = values.criticRunDir;
    const port = Number(values.port);
    const outputRoot = path.resolve(values.outputRoot!);
    const timeoutSeconds = Number(values.timeoutSeconds);
    const requestedMode = values.mode!;
    const mode = resolveHarnessMode(requestedMode, values.executeCommands ?? false);
    const freezeTests = values.freezeTests ?? true;
    const skipAudit = values.skipAudit ?? false;
    const skipCritic = values.skipCritic ?? false;
    const useLegacyImplementationPrompt = requestedPromptName !== DEFAULT_PROMPT;
    const useLegacyTestPrompt = requestedTestPromptName !== DEFAULT_TEST_PROMPT;

    if (mode === "critic-only") {
        if (!criticRunDir) {
            throw new Error("--criticRunDir is required when --mode critic-only");
        }
        process.exitCode = await runCriticOnlyMode({
            criticRunDir,
            criticBackend,
            criticModel,
            criticReasoningEffort,
            timeoutSeconds,
        });
        return;
    }

    const runId = `${timestampSlug()}-${bindingId}`;
    const runDir = path.join(outputRoot, runId);
    const generatedDir = path.join(runDir, "generated");
    const logsDir = path.join(runDir, "logs");
    const promptDir = path.join(runDir, "prompt");
    const serverLogPath = path.join(logsDir, "mcp-server.log");
    const logPaths = buildHarnessLogPaths(logsDir, builderBackend, criticBackend);

    if (values.clean) {
        await rm(runDir, { recursive: true, force: true });
    }

    await mkdir(generatedDir, { recursive: true });
    await mkdir(logsDir, { recursive: true });
    await mkdir(promptDir, { recursive: true });

    let startedServer = false;
    let serverProcess: ChildProcess | undefined;

    if (!await isServerHealthy(port)) {
        startedServer = true;
        serverProcess = spawn(
            "node",
            [
                path.join(REPO_ROOT, "packages", "mcp-server", "dist", "index.js"),
                "--http",
                "--port", String(port),
                "--config", path.join(REPO_ROOT, "bundles.dev.yaml"),
            ],
            {
                cwd: REPO_ROOT,
                env: process.env,
                stdio: ["ignore", "pipe", "pipe"],
            }
        );

        serverProcess.stdout?.on("data", (chunk: Buffer) => {
            void appendChunk(serverLogPath, chunk);
        });
        serverProcess.stderr?.on("data", (chunk: Buffer) => {
            void appendChunk(serverLogPath, chunk);
        });

        await waitForServer(port, 30000);
    }

    const session = await initSession(port);
    let frozenTestsManifest: FrozenFileRecord[] | null = null;
    let testPromptResponse: PromptGetResult | null = null;
    let promptName = requestedPromptName;
    let testPromptName = requestedTestPromptName;
    const runtimeCommandPolicy = await resolveRuntimeCommandPolicy({
        session,
        bundleId,
        bindingId,
    });

    if (freezeTests) {
        if (useLegacyTestPrompt) {
            testPromptResponse = await getPrompt(session, requestedTestPromptName, {
                bundleId,
                bindingId,
                suiteId,
            });
            testPromptName = requestedTestPromptName;
        } else {
            const conformancePacket = await resolveBindingPacket(session, {
                bundleId,
                packetType: "conformance",
                bindingId,
                suiteId,
                artifactMode,
            });
            testPromptResponse = { messages: conformancePacket.messages };
            testPromptName = conformancePacket.promptName;
        }
        const testPromptText = testPromptResponse.messages
            .filter((message) => message.content.type === "text")
            .map((message) => message.content.text)
            .join("\n\n");
        const frozenTestInstructions = `Use the runtime-native test brief from stdin as the authoritative source.

You are generating the frozen normative test pack for a spec-driven code-generation harness.
- Work only in the current directory.
- Create conformance tests and supporting test fixtures only.
- Write files under tests/ and optional test-support paths only.
- Do not create implementation source files under src/.
- Do not create placeholders, stubs, or prose-only plans.
- Preserve modeled vector IDs exactly.
- Preserve modeled expected outcomes and error assertions exactly.
- These tests are immutable contract inputs for a later implementation stage.
- At the end, print a short summary of the test files you created.`;

        await writeFile(path.join(promptDir, "resolved-test-prompt.txt"), testPromptText);
        await writeFile(path.join(promptDir, "frozen-test-instructions.txt"), frozenTestInstructions);
        await writeFile(
            path.join(promptDir, "resolved-test-prompt-response.json"),
            JSON.stringify(testPromptResponse, null, 2)
        );
        const deterministicFiles = await tryMaterializeDeterministicFrozenTests({
            session,
            bundleId,
            bindingId,
            suiteId,
            generatedDir,
        });
        let testPhase: PhaseRunResult;

        if (deterministicFiles) {
            await writeFile(
                path.join(logsDir, "frozen-test-generator.log"),
                [
                    "Deterministic frozen test generator used.",
                    `Template pack: ${deterministicFiles.packId}`,
                    `Binding: ${bindingId}`,
                    `Suite: ${suiteId}`,
                    "Files:",
                    ...deterministicFiles.files.map((file) => `- ${file}`),
                ].join("\n") + "\n"
            );
            testPhase = {
                exitCode: 0,
                completion: "exited",
                details: "Deterministic frozen test generator completed.",
            };
        } else {
            testPhase = await runBuilderPhase({
                backend: builderBackend,
                profile: DEFAULT_BUILDER_PROFILE,
                model,
                cwd: generatedDir,
                promptText: testPromptText,
                instructions: frozenTestInstructions,
                stdoutPath: logPaths.testStdoutPath,
                stderrPath: logPaths.testStderrPath,
                timeoutSeconds,
                errorLogPath: path.join(logsDir, "frozen-test-error.txt"),
                mcpUrl: `http://127.0.0.1:${port}/mcp`,
            });
        }

        const filesAfterTests = await listFilesRecursive(generatedDir);
        frozenTestsManifest = await createFrozenTestManifest(generatedDir, filesAfterTests);
        await writeFile(
            path.join(runDir, "frozen-test-manifest.json"),
            JSON.stringify(frozenTestsManifest, null, 2)
        );

        if (testPhase.exitCode !== 0) {
            const failedReport = {
                runId,
                bundleId,
                bindingId,
                operationId,
                suiteId,
                promptName,
                testPromptName,
                artifactMode,
                mode,
                model,
                builderBackend,
                builderProfile,
                startedAt: new Date().toISOString(),
                endedAt: new Date().toISOString(),
                exitCode: testPhase.exitCode,
                finalExitCode: testPhase.exitCode,
                startedServer,
                serverLogPath,
                builderStdoutPath: logPaths.builderStdoutPath,
                builderStderrPath: logPaths.builderStderrPath,
                generatedDir,
                generatedFiles: filesAfterTests,
                audit: {
                    status: "failed" as const,
                    checks: [{
                        name: "frozen-test-generation",
                        status: "failed" as const,
                        details: `Frozen test generation failed with exit code ${testPhase.exitCode ?? "null"}.`,
                    }],
                },
            };
            await writeFile(path.join(runDir, "report.json"), JSON.stringify(failedReport, null, 2));
            console.log(JSON.stringify(failedReport, null, 2));
            process.exitCode = failedReport.finalExitCode ?? 1;
            return;
        }
    }

    const promptResponse = useLegacyImplementationPrompt
        ? await getPrompt(session, requestedPromptName, {
            bundleId,
            bindingId,
            operationId,
            artifactMode,
        })
        : await (async () => {
            const implementationPacket = await resolveBindingPacket(session, {
                bundleId,
                packetType: "implementation",
                bindingId,
                operationId,
                artifactMode,
            });
            promptName = implementationPacket.promptName;
            return { messages: implementationPacket.messages };
        })();

    if (useLegacyImplementationPrompt) {
        promptName = requestedPromptName;
    }

    const promptText = promptResponse.messages
        .filter((message) => message.content.type === "text")
        .map((message) => message.content.text)
        .join("\n\n");

    const executionPolicy = buildExecutionPolicy(mode);
    const builderRuntimeSummary = await resolveBuilderRuntimeSummary({
        session,
        bundleId,
        bindingId,
        runtimeCommandPolicy,
    });

    const harnessInstructions = `Use the implementation brief from stdin as the authoritative source.

You are running in a dedicated output workspace.
- Work only in the current directory.
- Create the implementation artifacts directly in the current directory.
- Do not modify files outside this workspace.
- Start writing files immediately. Do not spend the run on a prose-only plan.
- If you need a package manifest, test files, source files, or README, create them here.
- Produce valid JSON and source files. Do not leave placeholders that make manifests unparsable.
- Prefer complete, minimal implementations over partial scaffolding.
- If requirements are ambiguous, document the assumption in README or CONFORMANCE.md.
- For TypeScript, keep the project self-contained and export the primary validator entry point.
- This run is incomplete unless the required artifact files exist in the workspace.
- A narrative explanation without created files is a failed attempt.
- If a frozen normative test pack already exists under tests/, treat it as immutable and do not modify it.
- Implement source/config/docs around the frozen tests instead of rewriting them.
${executionPolicy}
- At the end, print a short summary of what you created and any blockers.`;

    const effectiveHarnessInstructions = builderBackend === "opencode" && builderProfile === "glm-strict"
        ? `${harnessInstructions}
- Read prompt/implementation-start.md first.
- Then read prompt/runtime-summary.md.
- Do not create a todo list.
- Do not use glob.
- Your first write or edit must happen within your first ${openCodePrewriteLimit(builderProfile)} tool calls.
- If you have not written a required implementation artifact by then, stop reading and write it immediately.
- Use packets/implementation-packet.json, packets/validation-packet.json, prompt/harness-instructions.txt, and prompt/resolved-prompt.txt only after you have read prompt/implementation-start.md.
- If package.json or another runtime manifest is missing, create it first.
- Then create the smallest required implementation artifact under src/.
- Do not read tests/, tests/conformance.test.ts, tests/test-utils.ts, or tests/fixtures/* before package.json and at least one src/* file exist.
- Only open tests/fixtures/* if you are resolving a concrete mismatch after the implementation skeleton exists.`
        : harnessInstructions;

    await writeFile(path.join(promptDir, "resolved-prompt.txt"), promptText);
    await writeFile(path.join(promptDir, "harness-instructions.txt"), effectiveHarnessInstructions);
    await writeFile(path.join(promptDir, "runtime-summary.md"), builderRuntimeSummary.markdown);
    await writeFile(
        path.join(promptDir, "implementation-start.md"),
        [
            "# Implementation Start",
            "",
            "Use this file as the first implementation guide inside the workspace.",
            "",
            "Order of work:",
            "1. Read this file first.",
            "2. Read prompt/runtime-summary.md.",
            "3. Read packets/implementation-packet.json and packets/validation-packet.json.",
            "4. Read prompt/harness-instructions.txt and prompt/resolved-prompt.txt only as needed.",
            "5. If the runtime manifest is missing, create it now and include the required dependencies and scripts from the runtime summary.",
            "6. Create the first required implementation file under src/ now.",
            "7. Only after package.json or another runtime manifest exists and at least one src/* file exists may you read tests/conformance.test.ts or tests/test-utils.ts.",
            "8. Only read tests/fixtures/* when debugging a concrete mismatch after the implementation skeleton exists.",
            "",
            "A run that only reads tests without creating package.json and src/* is a failed attempt.",
        ].join("\n") + "\n"
    );
    await writeFile(
        path.join(promptDir, "resolved-prompt-response.json"),
        JSON.stringify(promptResponse, null, 2)
    );

    await writeRunPackets({
        runDir,
        bundleId,
        bindingId,
        operationId,
        suiteId,
        promptName,
        testPromptName,
        implementationResolutionMode: useLegacyImplementationPrompt ? "legacy-prompt" : "packet-tool",
        conformanceResolutionMode: useLegacyTestPrompt ? "legacy-prompt" : "packet-tool",
        artifactMode,
        mode,
        model,
        builderBackend,
        builderProfile,
        criticModel,
        criticBackend,
        criticReasoningEffort,
        runtimeCommandPolicy,
        freezeTests,
        skipAudit,
        implementationPromptResponse: promptResponse,
        testPromptResponse,
        frozenTestsManifest,
        executionPolicy,
    });

    await mirrorHarnessContextIntoWorkspace(runDir, generatedDir);

    const startedAt = new Date().toISOString();
    const preImplementationFiles = await listFilesRecursive(generatedDir);
    const unlockFrozenFiles = frozenTestsManifest && frozenTestsManifest.length > 0
        ? await lockFrozenFiles(generatedDir, frozenTestsManifest)
        : null;
    const implementationPhase = await (async () => {
        try {
            return await runBuilderPhase({
                backend: builderBackend,
                profile: builderProfile,
                model,
                cwd: generatedDir,
                promptText,
                instructions: `${effectiveHarnessInstructions}
- Frozen normative test files have been marked read-only at the filesystem level for this run. Do not attempt to edit or replace them.`,
                stdoutPath: logPaths.builderStdoutPath,
                stderrPath: logPaths.builderStderrPath,
                timeoutSeconds,
                errorLogPath: path.join(logsDir, "harness-error.txt"),
                quiescence: {
                    rootDir: generatedDir,
                    baselineFiles: preImplementationFiles,
                    logPath: path.join(logsDir, "builder-quiescence.log"),
                },
                mcpUrl: `http://127.0.0.1:${port}/mcp`,
            });
        } finally {
            await unlockFrozenFiles?.();
        }
    })();
    const exitCode = implementationPhase.exitCode;
    const builderObservability = await collectBuilderObservability({
        backend: builderBackend,
        profile: builderProfile,
        stderrPath: logPaths.builderStderrPath,
    });
    await writeJsonFile(path.join(runDir, "builder-observability.json"), builderObservability);

    const generatedFiles = await listFilesRecursive(generatedDir);
    const authoredFiles = authoredWorkspaceArtifacts(generatedFiles);
    const installedArtifactCount = generatedFiles.length - authoredFiles.length;
    const endedAt = new Date().toISOString();
    const auditResults = skipAudit
        ? {
            audit: { status: "skipped" as const, checks: [] as AuditCheck[] },
            semanticAudit: {
                status: "skipped" as const,
                totalVectors: 0,
                failingVectors: 0,
                mismatches: [] as SemanticMismatch[],
                mismatchByCategory: {},
            },
        }
        : await runPostGenerationAudit(
            runDir,
            generatedDir,
            generatedFiles,
            promptText,
            frozenTestsManifest,
            runtimeCommandPolicy
        );
    const audit = auditResults.audit;
    const semanticAudit = auditResults.semanticAudit;
    let criticReport: CriticReport = DEFAULT_CRITIC_STATUS;

    if (!skipCritic && !skipAudit) {
        const packetsDir = path.join(runDir, "packets");
        const criticWorkspaceSnapshot = await createCriticWorkspaceSnapshot(generatedDir, generatedFiles, runtimeCommandPolicy);
        await writeJsonFile(path.join(packetsDir, "critic-workspace-snapshot.json"), criticWorkspaceSnapshot);

        const preCriticManifest = await createWorkspaceManifest(
            generatedDir,
            generatedFiles.filter((relativePath) => isWorkspaceArtifact(relativePath))
        );

        const criticPhaseResult = await runCriticPhase({
            backend: criticBackend,
            model: criticModel,
            reasoningEffort: criticReasoningEffort,
            runDir,
            logsDir,
            timeoutSeconds,
            audit,
            semanticAudit,
            criticWorkspaceSnapshot,
        });
        criticReport = criticPhaseResult.report;

        const criticMutations = await detectWorkspaceMutations(generatedDir, preCriticManifest);
        audit.checks.push({
            name: "critic-workspace-integrity",
            status: criticMutations.length === 0 ? "passed" : "failed",
            details: criticMutations.length === 0
                ? "Critic phase did not mutate generated workspace artifacts."
                : criticMutations.join("\n"),
        });

        if (criticPhaseResult.phase.exitCode !== 0 && criticReport.status === "skipped") {
            criticReport = {
                status: "inconclusive",
                summary: `Critic phase exited with ${criticPhaseResult.phase.exitCode ?? "null"} and did not produce a parseable report.`,
                recommendedGate: "defer",
                findings: [],
            };
        }

        if (criticMutations.length > 0) {
            criticReport = {
                status: "failed",
                summary: "Critic mutated generated workspace artifacts, which is not allowed.",
                recommendedGate: "fail",
                findings: [
                    {
                        severity: "high",
                        category: "critic-workspace-mutation",
                        evidence: criticMutations.join("; "),
                        reason: "Critic phase must be read-only with respect to generated artifacts.",
                    },
                ],
            };
        }

        await writeJsonFile(path.join(runDir, "critic-report.json"), criticReport);
    }

    if (audit.status !== "skipped") {
        audit.status = audit.checks.some((check) => check.status === "failed") ? "failed" : "passed";
    }

    const finalExitCode = exitCode === null
        ? null
        : ((audit.checks.some((check) => check.status === "failed")
            || semanticAudit.status === "failed"
            || criticReport.status === "failed"
            || criticReport.recommendedGate === "fail") ? 2 : exitCode);

    const report = {
        runId,
        bundleId,
        bindingId,
        operationId,
        promptName,
        testPromptName,
        artifactMode,
        mode,
        model,
        builderBackend,
        builderProfile,
        builderObservability,
        criticBackend,
        criticReasoningEffort,
        startedAt,
        endedAt,
        exitCode,
        phaseCompletion: implementationPhase.completion,
        phaseDetails: implementationPhase.details,
        finalExitCode,
        startedServer,
        serverLogPath,
        builderStdoutPath: logPaths.builderStdoutPath,
        builderStderrPath: logPaths.builderStderrPath,
        generatedDir,
        generatedFiles,
        authoredFiles,
        installedArtifactCount,
        audit,
        semanticAudit,
        critic: criticReport,
    };

    await writeFile(path.join(runDir, "report.json"), JSON.stringify(report, null, 2));

    const summaryLines = [
        `# Binding Harness Run`,
        ``,
        `- Run ID: \`${runId}\``,
        `- Bundle: \`${bundleId}\``,
        `- Binding: \`${bindingId}\``,
        `- Operation: \`${operationId}\``,
        `- Suite: \`${suiteId}\``,
        `- Prompt: \`${promptName}\``,
        `- Test Prompt: \`${testPromptName}\``,
        `- Mode: \`${mode}\``,
        `- Model: \`${model}\``,
        `- Builder backend: \`${builderBackend}\``,
        `- Builder profile: \`${builderProfile}\``,
        `- Builder session: \`${builderObservability.sessionId ?? "n/a"}\``,
        `- Phase completion: \`${implementationPhase.completion}\``,
        `- Exit code: \`${exitCode === null ? "timeout-or-error" : exitCode}\``,
        `- Final exit code: \`${finalExitCode === null ? "timeout-or-error" : finalExitCode}\``,
        `- Audit status: \`${audit.status}\``,
        `- Semantic audit status: \`${semanticAudit.status}\``,
        `- Critic status: \`${criticReport.status}\``,
        `- Frozen tests: \`${freezeTests ? "enabled" : "disabled"}\``,
        `- Authored files: ${authoredFiles.length}`,
        `- Installed/runtime artifacts: ${installedArtifactCount}`,
        ``,
        `## Files`,
        ...authoredFiles.map((file) => `- \`${file}\``),
        ``,
        `## Audit`,
        ...audit.checks.map((check) => `- \`${check.name}\`: \`${check.status}\` - ${check.details.replace(/\n/g, " ")}`),
        ``,
        `## Builder Observability`,
        `- Session ID: \`${builderObservability.sessionId ?? "n/a"}\``,
        `- MCP connected: \`${builderObservability.mcpConnected ?? false}\``,
        `- MCP tool invocations observed: ${builderObservability.mcpToolInvocationCount ?? 0}`,
        `- Tool usage: read=${builderObservability.toolUsage?.read ?? 0}, write=${builderObservability.toolUsage?.write ?? 0}, edit=${builderObservability.toolUsage?.edit ?? 0}, bash=${builderObservability.toolUsage?.bash ?? 0}, glob=${builderObservability.toolUsage?.glob ?? 0}, grep=${builderObservability.toolUsage?.grep ?? 0}`,
        `- Last meaningful event: ${builderObservability.lastMeaningfulEvent ?? "n/a"}`,
        ``,
        `## Semantic Audit`,
        `- Status: \`${semanticAudit.status}\``,
        `- Failing vectors: ${semanticAudit.failingVectors}`,
        ...Object.entries(semanticAudit.mismatchByCategory).map(([category, count]) => `- ${category}: ${count}`),
        ``,
        `## Critic`,
        `- Status: \`${criticReport.status}\``,
        `- Recommended gate: \`${criticReport.recommendedGate}\``,
        `- Summary: ${criticReport.summary}`,
        ...criticReport.findings.map((finding) => `- [${finding.severity}] ${finding.category}${finding.path ? ` (${finding.path})` : ""}: ${finding.reason} Evidence: ${finding.evidence}`),
    ];
    await writeFile(path.join(runDir, "summary.md"), `${summaryLines.join("\n")}\n`);

    if (startedServer && serverProcess && !values.keepServer) {
        serverProcess.kill("SIGINT");
    }

    console.log(JSON.stringify(report, null, 2));

    if (finalExitCode && finalExitCode !== 0) {
        process.exitCode = finalExitCode;
    }
}

function resolveHarnessMode(requestedMode: string, executeCommands: boolean): HarnessMode {
    if (executeCommands && requestedMode === DEFAULT_MODE) {
        return "self-verify";
    }

    if (requestedMode === "generate-only" || requestedMode === "self-verify" || requestedMode === "critic-only") {
        return requestedMode;
    }

    throw new Error(`Unsupported harness mode: ${requestedMode}`);
}

function resolveCriticBackend(value: string): CriticBackend {
    if (value === "gemini" || value === "codex") {
        return value;
    }

    throw new Error(`Unsupported critic backend: ${value}`);
}

function resolveBuilderProfile(value: string): BuilderProfile {
    if (value === "default" || value === "packet-only" || value === "glm-strict") {
        return value;
    }

    throw new Error(`Unsupported builder profile: ${value}`);
}

function resolveBuilderBackend(value: string): BuilderBackend {
    if (value === "gemini" || value === "opencode") {
        return value;
    }

    throw new Error(`Unsupported builder backend: ${value}`);
}

function resolveCriticReasoningEffort(value: string): CodexReasoningEffort {
    if (value === "low" || value === "medium" || value === "high") {
        return value;
    }

    throw new Error(`Unsupported critic reasoning effort: ${value}`);
}

function buildExecutionPolicy(mode: HarnessMode): string {
    if (mode === "self-verify") {
        return `Harness mode: self-verify
- Follow a small spec-driven development loop inside the workspace.
- Write or refine conformance tests first from the modeled vectors.
- Then implement or adjust source code against those tests.
- Install dependencies inside the workspace when needed.
- Run build and test commands inside the workspace, inspect failures, and iterate.
- Prefer short iterative loops over one large speculative implementation.
- Avoid long-lived processes.`;
    }

    return `Harness mode: generate-only
- Do not run package-manager install commands, builds, tests, or long-lived processes.
- Generate manifests, source files, test files, and documentation only.
- Use the modeled DTO contracts, vector inputs, and fixture payloads directly when generating files.
- Do not stop at a plan or outline; create the actual files during the run.
- Optimize for observability of semantic correctness, not autonomous verification.`;
}

main().catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
});
