#!/usr/bin/env ts-node

import { parseArgs } from "node:util";
import { access, appendFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
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

type ToolCallResult = {
    content?: Array<{ type: string; text: string }>;
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

type FrozenFileRecord = {
    path: string;
    sha256: string;
};

type PhaseRunResult = {
    exitCode: number | null;
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

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT_ROOT = path.join(REPO_ROOT, ".scratch", "binding-runs");
const DEFAULT_PORT = 3001;
const DEFAULT_MODEL = "gemini-3-flash-preview";
const DEFAULT_BUNDLE = "jwt";
const DEFAULT_BINDING = "BIND-node-jose-library";
const DEFAULT_OPERATION = "OP-validate-jwt";
const DEFAULT_PROMPT = "implement-binding";
const DEFAULT_TEST_PROMPT = "generate-binding-tests";
const DEFAULT_SUITE = "SUITE-core-validation";
const DEFAULT_ARTIFACT_MODE = "library-only";
const DEFAULT_TIMEOUT_SECONDS = 900;
const DEFAULT_MODE = "generate-only";

type HarnessMode = "generate-only" | "self-verify";

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
    if (result?.content?.[0]?.type === "text") {
        return JSON.parse(result.content[0].text) as T;
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

function uniqueStrings(values: string[]): string[] {
    return Array.from(new Set(values));
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

function parseSemanticAuditFromTap(testOutput: string): SemanticAuditReport {
    const mismatches: SemanticMismatch[] = [];
    const totalVectorsMatch = testOutput.match(/# tests (\d+)/) ?? testOutput.match(/Tests\s+(\d+)\s+failed \|\s+(\d+)\s+passed \((\d+)\)/);
    const totalVectors = totalVectorsMatch
        ? Number(totalVectorsMatch[totalVectorsMatch.length - 1])
        : 0;
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

function renderNodeFixtureModule(fixtures: Array<Record<string, unknown>>): string {
    const fixtureMap: Record<string, unknown> = {};

    for (const fixture of fixtures) {
        const fixtureId = typeof fixture.id === "string" ? fixture.id : undefined;
        if (!fixtureId) {
            continue;
        }

        fixtureMap[fixtureId] = {
            id: fixtureId,
            jwks: fixture.jwks,
        };
    }

    return `/**
 * Frozen normative key fixtures derived directly from bundle MockKeySet entities.
 * Do not edit by hand; regenerate from the harness.
 */

export type FrozenKeyFixture = {
  id: string;
  jwks?: {
    keys: Array<Record<string, unknown>>;
  };
};

export const FIXTURES: Record<string, FrozenKeyFixture> = ${stableStringify(fixtureMap)};
`;
}

function normalizeVectorForFrozenPack(vector: Record<string, unknown>): Record<string, unknown> {
    const expectedOutcomeClass = typeof vector.expectedOutcomeClass === "string"
        ? vector.expectedOutcomeClass
        : undefined;

    return {
        id: vector.id,
        title: vector.title,
        description: vector.description,
        invocationProfileId: vector.invocationProfileId,
        expectedEvaluatedProfileId: vector.expectedEvaluatedProfileId,
        rawJwtInput: vector.rawJwtInput,
        payloadJson: vector.payloadJson,
        headerJson: vector.headerJson,
        runtimePolicy: vector.runtimePolicy ?? {},
        validationContext: vector.validationContext ?? {},
        expectedOutcomeClass,
        expectedIsValid: expectedOutcomeClass === "accepted",
        expectedKeySelectionStatus: vector.expectedKeySelectionStatus,
        expectedTrustDecision: vector.expectedTrustDecision,
        expectedPrimaryErrorCodeId: vector.expectedPrimaryErrorCodeId,
        expectedFailedRuleId: vector.expectedFailedRuleId,
        expectedTerminalStepId: vector.expectedTerminalStepId,
        expectsErrorCodeIds: vector.expectsErrorCodeIds ?? [],
        usesMockKeyId: vector.usesMockKeyId,
    };
}

function renderNodeVectorsModule(vectors: Array<Record<string, unknown>>): string {
    const normalizedVectors = vectors.map(normalizeVectorForFrozenPack);

    return `/**
 * Frozen normative conformance vectors derived directly from bundle TestVector entities.
 * Do not edit by hand; regenerate from the harness.
 */

export type FrozenRuntimePolicy = Record<string, unknown>;
export type FrozenValidationContext = Record<string, unknown>;

export interface FrozenTestVector {
  id: string;
  title?: string;
  description?: string;
  invocationProfileId: string;
  expectedEvaluatedProfileId?: string;
  rawJwtInput?: string;
  payloadJson?: string;
  headerJson?: string;
  runtimePolicy: FrozenRuntimePolicy;
  validationContext: FrozenValidationContext;
  expectedOutcomeClass: string;
  expectedIsValid: boolean;
  expectedKeySelectionStatus?: string;
  expectedTrustDecision?: string;
  expectedPrimaryErrorCodeId?: string;
  expectedFailedRuleId?: string;
  expectedTerminalStepId?: string;
  expectsErrorCodeIds: string[];
  usesMockKeyId?: string;
}

export const CONFORMANCE_VECTORS: FrozenTestVector[] = ${stableStringify(normalizedVectors)};
`;
}

function renderNodeTestUtilsModule(): string {
    return `import { createHmac, createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import { importJWK, SignJWT, base64url, type JWK, type JWTHeaderParameters } from "jose";

import { FIXTURES } from "./fixtures/keysets.js";
import type { FrozenTestVector } from "./fixtures/vectors.js";

type JwksKey = JWK & Record<string, unknown>;
type ProtectedHeader = JWTHeaderParameters & Record<string, unknown>;
type DerivedWeakRsaFixture = {
  publicJwk: JwksKey;
  privateKey: KeyObject;
};

let derivedWeakRsaFixturePromise: Promise<DerivedWeakRsaFixture> | undefined;

function cloneObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function defaultFixtureIdForVector(vector: FrozenTestVector): string {
  return vector.usesMockKeyId ?? "MOCK-hs256-static-1";
}

function resolveFixtureKey(vector: FrozenTestVector): JwksKey {
  const fixture = FIXTURES[defaultFixtureIdForVector(vector)];
  if (!fixture?.jwks?.keys?.length) {
    throw new Error(\`No JWKS fixture available for \${vector.id}\`);
  }

  const requestedHeader = vector.headerJson ? JSON.parse(vector.headerJson) as Record<string, unknown> : {};
  const requestedAlg = typeof requestedHeader.alg === "string" ? requestedHeader.alg : undefined;
  const requestedKid = typeof requestedHeader.kid === "string" ? requestedHeader.kid : undefined;

  const exactKid = requestedKid
    ? fixture.jwks.keys.find((candidate: Record<string, unknown>) => candidate && typeof candidate === "object" && candidate.kid === requestedKid)
    : undefined;
  if (exactKid && typeof exactKid === "object") {
    return cloneObject(exactKid as JwksKey);
  }

  const exactAlg = requestedAlg
    ? fixture.jwks.keys.find((candidate: Record<string, unknown>) => candidate && typeof candidate === "object" && candidate.alg === requestedAlg)
    : undefined;
  if (exactAlg && typeof exactAlg === "object") {
    return cloneObject(exactAlg as JwksKey);
  }

  return cloneObject(fixture.jwks.keys[0] as JwksKey);
}

async function getDerivedWeakRsaFixture(): Promise<DerivedWeakRsaFixture> {
  if (!derivedWeakRsaFixturePromise) {
    derivedWeakRsaFixturePromise = (async () => {
      const { publicKey, privateKey } = generateKeyPairSync("rsa", {
        modulusLength: 1024,
        publicExponent: 0x10001,
      });
      const publicJwk = publicKey.export({ format: "jwk" }) as JwksKey;

      return {
        publicJwk: {
          ...publicJwk,
          alg: "RS256",
          use: "sig",
          kid: "rsa-weak-1",
        },
        privateKey,
      };
    })();
  }

  return derivedWeakRsaFixturePromise;
}

function inferBasePayload(vector: FrozenTestVector): Record<string, unknown> {
  const runtimePolicy = vector.runtimePolicy ?? {};
  const overlay = vector.payloadJson ? JSON.parse(vector.payloadJson) as Record<string, unknown> : undefined;
  const omitsRequiredClaim = (claimName: string, policyValue: unknown): boolean =>
    vector.expectedFailedRuleId === "RULE-REQUIRED-CLAIMS"
    && policyValue !== undefined
    && (!overlay || !Object.prototype.hasOwnProperty.call(overlay, claimName));
  const payload: Record<string, unknown> = {
    iat: 1516239022,
    exp: 2500000000,
  };

  if (!omitsRequiredClaim("sub", runtimePolicy.expectedSubject)) {
    payload.sub = "1234567890";
  }

  if (typeof runtimePolicy.expectedIssuer === "string" && !omitsRequiredClaim("iss", runtimePolicy.expectedIssuer)) {
    payload.iss = runtimePolicy.expectedIssuer;
  }

  if (typeof runtimePolicy.expectedSubject === "string" && !omitsRequiredClaim("sub", runtimePolicy.expectedSubject)) {
    payload.sub = runtimePolicy.expectedSubject;
  }

  if (typeof runtimePolicy.expectedAudience === "string" && !omitsRequiredClaim("aud", runtimePolicy.expectedAudience)) {
    payload.aud = runtimePolicy.expectedAudience;
  }

  if (Array.isArray(runtimePolicy.expectedAudience) && !omitsRequiredClaim("aud", runtimePolicy.expectedAudience)) {
    payload.aud = runtimePolicy.expectedAudience;
  }

  return payload;
}

function inferBaseHeader(vector: FrozenTestVector, key: JwksKey): Record<string, unknown> {
  const alg = typeof key.alg === "string"
    ? key.alg
    : (typeof key.kty === "string" && key.kty === "RSA" ? "RS256" : "HS256");

  const header: ProtectedHeader = {
    alg,
    typ: "JWT",
  };

  if (typeof key.kid === "string") {
    header.kid = key.kid;
  }

  return header;
}

function mergePayload(vector: FrozenTestVector): Record<string, unknown> {
  const basePayload = inferBasePayload(vector);
  if (!vector.payloadJson) {
    return basePayload;
  }

  const overlay = JSON.parse(vector.payloadJson) as Record<string, unknown>;
  return {
    ...basePayload,
    ...overlay,
  };
}

function mergeHeader(vector: FrozenTestVector, key: JwksKey): ProtectedHeader {
  const baseHeader = inferBaseHeader(vector, key);
  if (!vector.headerJson) {
    return baseHeader;
  }

  const overlay = JSON.parse(vector.headerJson) as Record<string, unknown>;
  return {
    ...baseHeader,
    ...overlay,
  } as ProtectedHeader;
}

function encodeJsonSegment(jsonText: string): string {
  return Buffer.from(jsonText, "utf8").toString("base64url");
}

function signHs256RawCompact(header: Record<string, unknown>, payloadJsonText: string, secretBase64Url: string): string {
  const encodedHeader = encodeJsonSegment(JSON.stringify(header));
  const encodedPayload = encodeJsonSegment(payloadJsonText);
  const signingInput = \`\${encodedHeader}.\${encodedPayload}\`;
  const secret = Buffer.from(secretBase64Url, "base64url");
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
  return \`\${signingInput}.\${signature}\`;
}

function signRs256RawCompact(header: Record<string, unknown>, payloadJsonText: string, privateKey: KeyObject): string {
  const encodedHeader = encodeJsonSegment(JSON.stringify(header));
  const encodedPayload = encodeJsonSegment(payloadJsonText);
  const signingInput = \`\${encodedHeader}.\${encodedPayload}\`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey).toString("base64url");
  return \`\${signingInput}.\${signature}\`;
}

async function signStructuredToken(payload: Record<string, unknown>, header: ProtectedHeader, key: JwksKey): Promise<string> {
  if (typeof key.kty !== "string") {
    throw new Error("Fixture key is missing kty");
  }

  if (key.kty === "oct") {
    const secret = base64url.decode(String(key.k));
    return new SignJWT(payload)
      .setProtectedHeader(header)
      .sign(secret);
  }

  if (key.kty === "RSA" && typeof key.d === "string") {
    const privateKey = await importJWK(key as unknown as JWK, String(key.alg ?? header.alg ?? "RS256"));
    return new SignJWT(payload)
      .setProtectedHeader(header)
      .sign(privateKey);
  }

  throw new Error(\`Fixture key for \${String(header.kid ?? "unknown-kid")} is not signable in the frozen test pack\`);
}

export function resolveTrustedJwks(vector: FrozenTestVector): { keys: Array<Record<string, unknown>> } {
  if (vector.id === "VEC-jwt-weak-key") {
    throw new Error("Use resolveTrustedJwksAsync for VEC-jwt-weak-key.");
  }

  const fixture = FIXTURES[defaultFixtureIdForVector(vector)];
  if (!fixture?.jwks?.keys?.length) {
    return { keys: [] };
  }

  return cloneObject(fixture.jwks);
}

export async function resolveTrustedJwksAsync(vector: FrozenTestVector): Promise<{ keys: Array<Record<string, unknown>> }> {
  if (vector.id === "VEC-jwt-weak-key") {
    const weakFixture = await getDerivedWeakRsaFixture();
    return {
      keys: [cloneObject(weakFixture.publicJwk)],
    };
  }

  return resolveTrustedJwks(vector);
}

export async function prepareToken(vector: FrozenTestVector): Promise<string> {
  if (typeof vector.rawJwtInput === "string" && vector.rawJwtInput.length > 0) {
    return vector.rawJwtInput;
  }

  if (vector.id === "VEC-jwt-malformed") {
    return "not.a.jwt";
  }

  const key = resolveFixtureKey(vector);
  const header = mergeHeader(vector, key);
  const payload = mergePayload(vector);

  if ((vector.id === "VEC-jwt-duplicate-keys" || vector.id === "VEC-jwt-unsupported-header-crit") && typeof key.k === "string") {
    const payloadJsonText = vector.id === "VEC-jwt-duplicate-keys" && typeof vector.payloadJson === "string"
      ? vector.payloadJson
      : JSON.stringify(payload);
    return signHs256RawCompact(header, payloadJsonText, key.k);
  }

  if (vector.id === "VEC-jwt-weak-key") {
    const weakFixture = await getDerivedWeakRsaFixture();
    return signRs256RawCompact({
      ...header,
      alg: "RS256",
      kid: "rsa-weak-1",
    }, JSON.stringify(payload), weakFixture.privateKey);
  }

  return signStructuredToken(payload, header, key);
}
`;
}

function renderNodeConformanceTestModule(suiteId: string): string {
    return `import { describe, expect, test } from "vitest";

import { validateJwt } from "../src/index.js";
import { CONFORMANCE_VECTORS } from "./fixtures/vectors.js";
import { prepareToken, resolveTrustedJwksAsync } from "./test-utils.js";

describe("JWT Conformance Suite: ${suiteId}", () => {
  for (const vector of CONFORMANCE_VECTORS) {
    test(\`\${vector.id}: \${vector.title ?? "Untitled Vector"}\`, async () => {
      const token = await prepareToken(vector);
      const trustedJwks = await resolveTrustedJwksAsync(vector);

      const result = await validateJwt({
        token,
        invocationProfileId: vector.invocationProfileId,
        runtimePolicy: vector.runtimePolicy,
        validationContext: {
          ...vector.validationContext,
          trustedJwks,
        },
      });

      expect(result.isValid, \`Vector \${vector.id} isValid mismatch\`).toBe(vector.expectedIsValid);
      expect(result.outcomeClass, \`Vector \${vector.id} outcomeClass mismatch\`).toBe(vector.expectedOutcomeClass);

      if (vector.expectedEvaluatedProfileId) {
        expect(result.evaluatedProfileId, \`Vector \${vector.id} evaluatedProfileId mismatch\`).toBe(vector.expectedEvaluatedProfileId);
      }

      if (vector.expectedKeySelectionStatus) {
        expect(result.keySelectionStatus, \`Vector \${vector.id} keySelectionStatus mismatch\`).toBe(vector.expectedKeySelectionStatus);
      }

      if (vector.expectedTrustDecision) {
        expect(result.trustDecision, \`Vector \${vector.id} trustDecision mismatch\`).toBe(vector.expectedTrustDecision);
      }

      if (vector.expectedPrimaryErrorCodeId) {
        expect(result.primaryErrorCode, \`Vector \${vector.id} primaryErrorCode mismatch\`).toBe(vector.expectedPrimaryErrorCodeId);
      }

      if (vector.expectedFailedRuleId) {
        expect(result.failedRuleId, \`Vector \${vector.id} failedRuleId mismatch\`).toBe(vector.expectedFailedRuleId);
      }

      if (vector.expectedTerminalStepId) {
        expect(result.terminalStepId, \`Vector \${vector.id} terminalStepId mismatch\`).toBe(vector.expectedTerminalStepId);
      }

      for (const expectedErrorCode of vector.expectsErrorCodeIds) {
        expect(result.errorCodes, \`Vector \${vector.id} missing errorCode \${expectedErrorCode}\`).toContain(expectedErrorCode);
      }
    });
  }
});
`;
}

async function tryMaterializeDeterministicFrozenTests(params: {
    session: McpSession;
    bundleId: string;
    bindingId: string;
    suiteId: string;
    generatedDir: string;
}): Promise<string[] | null> {
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
    if (language !== "typescript" || runtimeName !== "node" || runtimeLanguage !== "typescript") {
        return null;
    }

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

    await mkdir(path.join(params.generatedDir, "tests", "fixtures"), { recursive: true });

    const files = [
        {
            path: path.join(params.generatedDir, "tests", "fixtures", "keysets.ts"),
            content: renderNodeFixtureModule(orderedFixtures),
        },
        {
            path: path.join(params.generatedDir, "tests", "fixtures", "vectors.ts"),
            content: renderNodeVectorsModule(orderedVectors),
        },
        {
            path: path.join(params.generatedDir, "tests", "test-utils.ts"),
            content: renderNodeTestUtilsModule(),
        },
        {
            path: path.join(params.generatedDir, "tests", "conformance.test.ts"),
            content: renderNodeConformanceTestModule(params.suiteId),
        },
    ];

    for (const file of files) {
        await writeFile(file.path, file.content);
    }

    return files.map((file) => path.relative(params.generatedDir, file.path)).sort();
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

async function runGeminiPhase(params: {
    model: string;
    cwd: string;
    promptText: string;
    instructions: string;
    stdoutPath: string;
    stderrPath: string;
    timeoutSeconds: number;
    errorLogPath: string;
}): Promise<PhaseRunResult> {
    const geminiArgs = [
        "-m", params.model,
        "--yolo",
        "-p", params.instructions,
    ];

    const geminiProcess = spawn("gemini", geminiArgs, {
        cwd: params.cwd,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
    });

    geminiProcess.stdin.write(params.promptText);
    geminiProcess.stdin.end();

    geminiProcess.stdout.on("data", async (chunk: Buffer) => {
        await appendChunk(params.stdoutPath, chunk);
    });
    geminiProcess.stderr.on("data", async (chunk: Buffer) => {
        await appendChunk(params.stderrPath, chunk);
    });

    const exitCode = await new Promise<number | null>((resolve, reject) => {
        const timeout = setTimeout(() => {
            geminiProcess.kill("SIGTERM");
            setTimeout(() => geminiProcess.kill("SIGKILL"), 5000);
            reject(new Error(`Gemini run timed out after ${params.timeoutSeconds} seconds`));
        }, params.timeoutSeconds * 1000);

        geminiProcess.on("error", (error) => {
            clearTimeout(timeout);
            reject(error);
        });
        geminiProcess.on("exit", (code) => {
            clearTimeout(timeout);
            resolve(code);
        });
    }).catch(async (error: Error) => {
        await writeFile(params.errorLogPath, `${error.name}: ${error.message}\n`, { flag: "a" });
        return null;
    });

    return { exitCode };
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
    frozenTestsManifest: FrozenFileRecord[] | null
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
    const candidateTestFiles = generatedFiles.filter((file) => /^tests\/.+\.(ts|js|tsx|jsx|mjs|cjs|json)$/.test(file));
    const candidateSourceFiles = generatedFiles.filter((file) => /^(src|tests)\/.+\.(ts|js|tsx|jsx|mjs|cjs|md)$/.test(file));

    checks.push({
        name: "generated-files-present",
        status: generatedFiles.length > 0 ? "passed" : "failed",
        details: generatedFiles.length > 0 ? `Generated ${generatedFiles.length} files.` : "No generated files were created.",
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

    if (expectedVectorIds.length > 0 && candidateTestFiles.length > 0) {
        const implementedVectorIds = uniqueStrings(
            (await Promise.all(
                candidateTestFiles.map(async (relativePath) =>
                    extractImplementedVectorIds(await readUtf8(path.join(generatedDir, relativePath)))
                )
            )).flat()
        );
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

    if (await fileExists(packageJsonPath)) {
        const installResult = await runAuditCommand(
            "npm",
            ["install"],
            generatedDir,
            path.join(auditDir, "npm-install.stdout.log"),
            path.join(auditDir, "npm-install.stderr.log")
        );
        checks.push({
            name: "npm-install",
            status: installResult.exitCode === 0 ? "passed" : "failed",
            details: installResult.exitCode === 0
                ? "npm install succeeded."
                : `npm install failed with exit code ${installResult.exitCode ?? "null"}.`,
        });

        if (await fileExists(tsconfigPath)) {
            const tscResult = await runAuditCommand(
                "npx",
                ["tsc", "-p", "tsconfig.json", "--noEmit", "--pretty", "false"],
                generatedDir,
                path.join(auditDir, "tsc.stdout.log"),
                path.join(auditDir, "tsc.stderr.log")
            );
            const tscDetails = [tscResult.stdout, tscResult.stderr].filter(Boolean).join("\n").trim();
            checks.push({
                name: "typescript-typecheck",
                status: tscResult.exitCode === 0 ? "passed" : "failed",
                details: tscResult.exitCode === 0
                    ? "TypeScript typecheck passed."
                    : tscDetails || `TypeScript typecheck failed with exit code ${tscResult.exitCode ?? "null"}.`,
            });
        }

        const npmTestResult = await runAuditCommand(
            "npm",
            ["test"],
            generatedDir,
            path.join(auditDir, "npm-test.stdout.log"),
            path.join(auditDir, "npm-test.stderr.log")
        );
        const npmTestDetails = [npmTestResult.stdout, npmTestResult.stderr].filter(Boolean).join("\n").trim();
        checks.push({
            name: "npm-test",
            status: npmTestResult.exitCode === 0 ? "passed" : "failed",
            details: npmTestResult.exitCode === 0
                ? "npm test succeeded."
                : npmTestDetails || `npm test failed with exit code ${npmTestResult.exitCode ?? "null"}.`,
        });

        semanticAudit = parseSemanticAuditFromTap(npmTestDetails);
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
            name: "runtime-install-and-test",
            status: "skipped",
            details: "No package.json found; skipped Node.js install/typecheck/test audit.",
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
            model: { type: "string", default: DEFAULT_MODEL },
            port: { type: "string", default: String(DEFAULT_PORT) },
            outputRoot: { type: "string", default: DEFAULT_OUTPUT_ROOT },
            timeoutSeconds: { type: "string", default: String(DEFAULT_TIMEOUT_SECONDS) },
            mode: { type: "string", default: DEFAULT_MODE },
            executeCommands: { type: "boolean", default: false },
            freezeTests: { type: "boolean", default: true },
            skipAudit: { type: "boolean", default: false },
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
  --prompt <name>        MCP prompt name (default: ${DEFAULT_PROMPT})
  --suite <id>           ConformanceSuite ID for frozen test generation (default: ${DEFAULT_SUITE})
  --testPrompt <name>    MCP prompt name for frozen test generation (default: ${DEFAULT_TEST_PROMPT})
  --artifactMode <mode>  Artifact mode (default: ${DEFAULT_ARTIFACT_MODE})
  --model <name>         Gemini model (default: ${DEFAULT_MODEL})
  --port <n>             MCP HTTP port (default: ${DEFAULT_PORT})
  --outputRoot <dir>     Run output root (default: ${DEFAULT_OUTPUT_ROOT})
  --timeoutSeconds <n>   Gemini timeout in seconds (default: ${DEFAULT_TIMEOUT_SECONDS})
  --mode <name>          Harness mode: generate-only | self-verify (default: ${DEFAULT_MODE})
  --executeCommands      Legacy alias for --mode self-verify
  --freezeTests          Generate and freeze a normative test pack before implementation (default: true)
  --skipAudit            Skip post-generation audit checks
  --keepServer           Do not stop MCP server if harness started it
  --clean                Remove generated workspace before running
`);
        return;
    }

    const bundleId = values.bundle!;
    const bindingId = values.binding!;
    const operationId = values.operation!;
    const promptName = values.prompt!;
    const suiteId = values.suite!;
    const testPromptName = values.testPrompt!;
    const artifactMode = values.artifactMode!;
    const model = values.model!;
    const port = Number(values.port);
    const outputRoot = path.resolve(values.outputRoot!);
    const timeoutSeconds = Number(values.timeoutSeconds);
    const requestedMode = values.mode!;
    const mode = resolveHarnessMode(requestedMode, values.executeCommands ?? false);
    const freezeTests = values.freezeTests ?? true;
    const skipAudit = values.skipAudit ?? false;

    const runId = `${timestampSlug()}-${bindingId}`;
    const runDir = path.join(outputRoot, runId);
    const generatedDir = path.join(runDir, "generated");
    const logsDir = path.join(runDir, "logs");
    const promptDir = path.join(runDir, "prompt");
    const serverLogPath = path.join(logsDir, "mcp-server.log");
    const testGeminiStdoutPath = path.join(logsDir, "gemini.tests.stdout.log");
    const testGeminiStderrPath = path.join(logsDir, "gemini.tests.stderr.log");
    const implementationGeminiStdoutPath = path.join(logsDir, "gemini.implementation.stdout.log");
    const implementationGeminiStderrPath = path.join(logsDir, "gemini.implementation.stderr.log");

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
            "pnpm",
            ["--filter", "@sdd-bundle-editor/mcp-server", "start:http"],
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

    if (freezeTests) {
        const testPromptResponse = await getPrompt(session, testPromptName, {
            bundleId,
            bindingId,
            suiteId,
        });
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
                    `Binding: ${bindingId}`,
                    `Suite: ${suiteId}`,
                    "Files:",
                    ...deterministicFiles.map((file) => `- ${file}`),
                ].join("\n") + "\n"
            );
            testPhase = { exitCode: 0 };
        } else {
            testPhase = await runGeminiPhase({
                model,
                cwd: generatedDir,
                promptText: testPromptText,
                instructions: frozenTestInstructions,
                stdoutPath: testGeminiStdoutPath,
                stderrPath: testGeminiStderrPath,
                timeoutSeconds,
                errorLogPath: path.join(logsDir, "frozen-test-error.txt"),
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
                startedAt: new Date().toISOString(),
                endedAt: new Date().toISOString(),
                exitCode: testPhase.exitCode,
                finalExitCode: testPhase.exitCode,
                startedServer,
                serverLogPath,
                geminiStdoutPath: implementationGeminiStdoutPath,
                geminiStderrPath: implementationGeminiStderrPath,
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

    const promptResponse = await getPrompt(session, promptName, {
        bundleId,
        bindingId,
        operationId,
        artifactMode,
    });

    const promptText = promptResponse.messages
        .filter((message) => message.content.type === "text")
        .map((message) => message.content.text)
        .join("\n\n");

    const executionPolicy = buildExecutionPolicy(mode);

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

    await writeFile(path.join(promptDir, "resolved-prompt.txt"), promptText);
    await writeFile(path.join(promptDir, "harness-instructions.txt"), harnessInstructions);
    await writeFile(
        path.join(promptDir, "resolved-prompt-response.json"),
        JSON.stringify(promptResponse, null, 2)
    );

    const startedAt = new Date().toISOString();
    const implementationPhase = await runGeminiPhase({
        model,
        cwd: generatedDir,
        promptText,
        instructions: harnessInstructions,
        stdoutPath: implementationGeminiStdoutPath,
        stderrPath: implementationGeminiStderrPath,
        timeoutSeconds,
        errorLogPath: path.join(logsDir, "harness-error.txt"),
    });
    const exitCode = implementationPhase.exitCode;

    const generatedFiles = await listFilesRecursive(generatedDir);
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
        : await runPostGenerationAudit(runDir, generatedDir, generatedFiles, promptText, frozenTestsManifest);
    const audit = auditResults.audit;
    const semanticAudit = auditResults.semanticAudit;
    const finalExitCode = exitCode === null
        ? null
        : ((audit.status === "failed" || semanticAudit.status === "failed") ? 2 : exitCode);

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
        startedAt,
        endedAt,
        exitCode,
        finalExitCode,
        startedServer,
        serverLogPath,
        geminiStdoutPath: implementationGeminiStdoutPath,
        geminiStderrPath: implementationGeminiStderrPath,
        generatedDir,
        generatedFiles,
        audit,
        semanticAudit,
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
        `- Exit code: \`${exitCode === null ? "timeout-or-error" : exitCode}\``,
        `- Final exit code: \`${finalExitCode === null ? "timeout-or-error" : finalExitCode}\``,
        `- Audit status: \`${audit.status}\``,
        `- Semantic audit status: \`${semanticAudit.status}\``,
        `- Frozen tests: \`${freezeTests ? "enabled" : "disabled"}\``,
        `- Generated files: ${generatedFiles.length}`,
        ``,
        `## Files`,
        ...generatedFiles.map((file) => `- \`${file}\``),
        ``,
        `## Audit`,
        ...audit.checks.map((check) => `- \`${check.name}\`: \`${check.status}\` - ${check.details.replace(/\n/g, " ")}`),
        ``,
        `## Semantic Audit`,
        `- Status: \`${semanticAudit.status}\``,
        `- Failing vectors: ${semanticAudit.failingVectors}`,
        ...Object.entries(semanticAudit.mismatchByCategory).map(([category, count]) => `- ${category}: ${count}`),
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

    if (requestedMode === "generate-only" || requestedMode === "self-verify") {
        return requestedMode;
    }

    throw new Error(`Unsupported harness mode: ${requestedMode}`);
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
