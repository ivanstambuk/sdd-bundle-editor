# JWT Validator Bundle – Domain Knowledge

This bundle models a JWT validation ontology for three purposes:

1. code generation contracts for validator implementations
2. executable conformance expectations for existing implementations
3. human-readable documentation of the validator domain

## Active Contract

The active baseline profile is `PROF-JWT-CORE`.

It represents local, stateless validation of compact signed JWTs using caller-supplied trusted key material.

Two extension profiles expand that baseline:

- `PROF-JWT-REMOTE-JWKS` adds direct HTTPS JWKS retrieval
- `PROF-JWT-OIDC-DISCOVERY` adds OIDC metadata discovery before JWKS resolution

Current scope is explicit:

- active profile families: `JWT-CORE`, `JWT-REMOTE`, `OIDC`
- referenced but not yet first-class families: OAuth2 JWT profiles and FAPI

## Contract Layers

The ontology separates three different concerns:

- `TokenProfile`: normative validation contract
- `RuntimePolicy`: caller-supplied policy overrides such as issuer, audience, and clock skew
- `ValidationContext`: execution-time context such as current time and selected key strategy

These concerns are intentionally separate so validators can generate stable APIs and conformance tools can reason about behavior without hidden assumptions.

Replay protection is modeled as posture, not assumed behavior:

- `out-of-scope`: the profile does not make replay prevention claims
- `stateless-only`: the profile is explicit that no replay cache is consulted
- `jti-tracking`: the profile expects stateful replay tracking semantics

## Operations

Operations have explicit roles:

- `authoritative`: real validation decision path
- `diagnostic`: debug-oriented extraction path
- `parser`: structural decode path without full trust semantics
- `harness`: conformance/test execution path

Only the authoritative validation operation defines the primary acceptance/rejection contract.

## Validation Outcomes

The bundle distinguishes these outcome classes:

- `accepted`
- `rejected`
- `malformed`
- `indeterminate`
- `diagnostic`

This prevents cryptographic failures, syntax failures, and ambiguous trust outcomes from collapsing into a single boolean.

## Conformance Posture

Conformance artifacts in this bundle are intended to cover:

- positive-path acceptance
- negative-path rejection
- malformed input handling
- indeterminate key-resolution cases

Lint and gate checks enforce graph completeness such as:

- rules belonging to steps
- steps belonging to profiles
- vectors belonging to suites

## Inheritance And Supersession

Profile inheritance is additive unless a profile explicitly declares otherwise.

That means:

- child profiles inherit the baseline validation pipeline and contract structures
- child profiles narrow algorithms, key strategies, and required claims as needed
- supersession is reserved for future revisions and is not implied by inheritance alone

## Implementation Hints

`systemComponent` is treated as a support-operation implementation hint only.

It is not part of the authoritative validation contract and must not appear on contract-grade operations.

## Self-Documentation Goal

This bundle should remain understandable to non-technical readers, but documentation convenience must not weaken executable precision.

When there is tension between readability and contract precision, the ontology favors explicit modeled semantics first and narrative explanation second.
