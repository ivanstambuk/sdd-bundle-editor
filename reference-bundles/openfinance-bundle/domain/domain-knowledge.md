# openFinance V2 Domain Knowledge

## Positioning

This bundle models the Berlin Group `openFinance` V2 suite as a domain-led bundle rather than as a raw source-inventory bundle.

The design principle is:

- domain concepts are primary
- official OpenAPI conformance remains explicit
- provenance remains auditable

## Core Layer

The main domain-facing layer includes:

- `Participant`
- `DomainResource`
- `DomainCapability`
- `ProcessFlow`
- `BusinessRule`
- `SecurityMeasure`
- `ConceptFamily`
- `ProductSurface`

## Structural Layer

Reusable payload and lifecycle structure is modeled explicitly through:

- `ValueObject`
- `ValueObjectField`
- `StatusTransition`

This keeps the model above raw OpenAPI schemas while still exposing reusable implementation-relevant structure.

## Conformance Layer

The official technical contract remains visible through:

- `TechnicalCitation`
- `ApiContractBinding`
- `SchemaContract`

This means an agent can use the bundle for both:

- domain reasoning
- OpenAPI contract enforcement

## Source-Suite Note

This bundle represents the `openFinance` V2 suite as a whole. Individual Berlin Group services and documents have their own version numbers, so there is no single authoritative per-service patch version for the entire suite.

Accordingly:

- suite designation: `openFinance V2`
- bundle release version: `1.0.0`

## Publication Intent

This bundle is the publishable `openFinance` bundle for the workspace.

The older bootstrap/evidence bundle remains a local derivation substrate only and is not the intended user-facing publication artifact.
