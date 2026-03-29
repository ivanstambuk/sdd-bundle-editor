# openFinance V2 Bundle

This is the publishable Berlin Group `openFinance` bundle for Spec Studio.

## What It Is

This bundle is the domain-led, user-facing `openFinance` bundle derived from the official Berlin Group `openFinance` document set and official `openfinance` GitLab OpenAPI surface.

It is intended to be:

- explorable in Spec Studio
- mappable to the official OpenAPI contract
- useful to AI agents as both a domain model and an interface-conformance reference

## Scope

Included:

- Berlin Group `openFinance` V2 suite materials
- domain entities such as participants, resources, capabilities, flows, business rules, concept families, value objects, and status transitions
- explicit OpenAPI-conformance entities such as:
  - `TechnicalCitation`
  - `ApiContractBinding`
  - `SchemaContract`

Excluded:

- legacy `NextGenPSD2`
- raw bootstrap/evidence extraction entities
- scratch-only collection and transformation artifacts

## Versioning Note

This bundle is published as:

- bundle release: `1.0.0`
- source suite: `openFinance V2`

The Berlin Group `openFinance` suite does **not** expose one single uniform service version across all included documents and services. The bundle therefore uses:

- `V2` as the suite-level source designation
- `1.0.0` as the bundle release version

## Source Provenance

The published bundle was derived from the official Berlin Group `openFinance` downloads and the official `openfinance` GitLab repository. The working extraction/evidence pipeline remains under `.scratch/openFinance/` for local provenance and iteration, but only this finalized bundle is intended for publication.
