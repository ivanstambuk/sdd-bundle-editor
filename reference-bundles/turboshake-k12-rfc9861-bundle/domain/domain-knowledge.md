# TurboSHAKE / KangarooTwelve / HopMAC Bundle Domain Knowledge

This bundle models a cryptographic profile rather than an application architecture.

The core distinction is:
- `CryptoProfile`: overall profiled contract and scope
- `Primitive`: named primitive or helper with a stable semantic identity
- `Operation`: callable contract or stateful method surface
- `Constraint`: normative bounds and policy restrictions
- `ConformanceClass` and `ConformanceSuite`: capability claims and executable coverage
- `TestVector`: either a concrete vector or a family definition derived from a normative standard

This bundle is intended to be:
- spec-oriented
- read-mostly
- traceable to normative references
- suitable for AI-assisted reasoning and bundle validation

Test-vector helper semantics:
- `ptn(n)` means the first `n` bytes of the infinite byte pattern `00 01 02 ... F9 FA 00 01 ...`
- Algorithmically, `ptn(n)[i] = i mod 0xFB` for `i = 0..n-1`
- Symbolic lengths such as `17**6` and `41**3` are exact byte counts from RFC 9861 vector tables, not prose placeholders

When there is tension between readability and normative fidelity, prefer preserving structured
normative meaning over flattening content into prose.
