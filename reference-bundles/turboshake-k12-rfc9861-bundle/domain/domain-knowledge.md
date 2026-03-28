# TurboSHAKE / KangarooTwelve / HopMAC Bundle Domain Knowledge

This bundle models a cryptographic profile rather than an application architecture.

The core distinction is:
- `CryptoProfile`: overall profiled contract and scope
- `Primitive`: named primitive or helper with a stable semantic identity
- `Operation`: callable contract or stateful method surface
- `Constraint`: normative bounds and policy restrictions
- `ConformanceClass` and `ConformanceSuite`: capability claims and executable coverage
- `TestVector`: either a concrete vector or a family definition imported from an upstream standard

This bundle is intended to be:
- spec-oriented
- read-mostly
- traceable back to upstream normative sources
- suitable for AI-assisted reasoning and bundle validation

When there is tension between readability and source fidelity, prefer preserving structured
normative meaning over flattening content into prose.
