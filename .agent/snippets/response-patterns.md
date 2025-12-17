# Response Patterns

Patterns for building consistent API responses and error handling.

---

## Standard Response Envelope

**Pattern**: All MCP tools return this envelope structure.

```typescript
interface SuccessResponse<T = unknown> {
    ok: true;
    tool: string;
    bundleId?: string;
    data: T;
    meta?: Record<string, unknown>;
    diagnostics?: Diagnostic[];
}

interface ErrorResponse {
    ok: false;
    tool: string;
    error: {
        code: ErrorCode;
        message: string;
        details?: unknown;
    };
}

type ErrorCode = 
    | 'BAD_REQUEST'
    | 'NOT_FOUND'
    | 'VALIDATION_ERROR'
    | 'REFERENCE_ERROR'
    | 'DELETE_BLOCKED'
    | 'INTERNAL';
```

---

## Building Success Responses (Conditional Fields)

**Problem**: Optional fields should be omitted when undefined, not included as `undefined`.

```typescript
// ❌ Don't do this - includes undefined fields in JSON
return {
    ok: true,
    tool: 'get_bundle_snapshot',
    bundleId: options?.bundleId,      // May be undefined
    data: result,
    meta: options?.meta,               // May be undefined
    diagnostics: includeDiagnostics ? diags : undefined,  // ❌
};

// ✅ Do this - conditionally add fields
const response: Record<string, unknown> = {
    ok: true,
    tool: toolName,
    data: result,
};

if (bundleId !== undefined) {
    response.bundleId = bundleId;
}
if (meta !== undefined) {
    response.meta = meta;
}
if (diagnostics !== undefined) {
    response.diagnostics = diagnostics;
}

return response;
```

---

## Error Response Builder

```typescript
function toolError(
    tool: string,
    code: ErrorCode,
    message: string,
    details?: unknown
): { content: Array<{ type: "text"; text: string }>; isError: true } {
    return {
        content: [{
            type: "text",
            text: JSON.stringify({
                ok: false,
                tool,
                error: { code, message, details }
            }, null, 2)
        }],
        isError: true,
    };
}

// Usage
return toolError('read_entity', 'NOT_FOUND', `Entity not found: ${type}/${id}`, { entityType: type, entityId: id });
```

---

## Unwrapping Responses in Tests

**Problem**: Test helpers need to handle optional envelope fields correctly.

```typescript
// Unwrap envelope, only including fields that exist
function unwrapEnvelope(envelope: any): Record<string, unknown> {
    const result: Record<string, unknown> = {
        ...envelope.data,
        ok: envelope.ok,
        tool: envelope.tool,
        data: envelope.data,
    };
    
    // Only include optional fields when they exist
    if (envelope.bundleId !== undefined) {
        result.bundleId = envelope.bundleId;
    }
    if (envelope.meta !== undefined) {
        result.meta = envelope.meta;
    }
    if (envelope.diagnostics !== undefined) {
        result.diagnostics = envelope.diagnostics;
    }
    
    return result;
}
```
