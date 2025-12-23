# External Metamodel References

This directory contains reference documentation for various enterprise architecture metamodels and frameworks that can be implemented as SDD bundles.

## Purpose

These references serve as:
1. **Documentation** - Human-readable descriptions of each framework's concepts
2. **Ingestion Source** - Structured content for generating SDD bundle schemas
3. **Bundle Templates** - Foundation for creating SDD bundle schemas for each framework

## Frameworks Covered

| Directory | Framework | Description |
|-----------|-----------|-------------|
| `togaf/` | TOGAF 9.2 Content Metamodel | The Open Group Architecture Framework - comprehensive enterprise architecture methodology |
| `apm/` | Application Portfolio Management | Framework for analyzing application portfolios |
| `archipeg-ea/` | Enterprise Architecture Framework | Comprehensive EA framework covering business, data, application, and technology domains |
| `c4/` | C4 Model | Simon Brown's hierarchical software architecture model |
| `ddd/` | Domain-Driven Design | Eric Evans' strategic and tactical design patterns |
| `knowledge-graph/` | Knowledge Graph | Generic node-edge model for knowledge representation |

## Structure

Each framework directory contains:
- `README.md` - Overview and source attribution
- `source.md` - Structured content describing the metamodel
- `metamodel.json` - Machine-readable metamodel definition (to be generated)
- `bundle/` - SDD bundle implementation (to be created)

## Canonical Sources

- **TOGAF**: [The Open Group](https://pubs.opengroup.org/architecture/togaf9-doc/arch/chap30.html)
- **C4 Model**: [c4model.com](https://c4model.com/)
- **DDD**: [Domain-Driven Design book](https://www.amazon.com/Domain-Driven-Design-Tackling-Complexity-Software/dp/0321125215) / [domainlanguage.com](https://www.domainlanguage.com/)
- **APM**: [Wikipedia - Application Portfolio Management](https://en.wikipedia.org/wiki/Application_portfolio_management)
- **Knowledge Graph**: [Wikipedia - Knowledge Graph](https://en.wikipedia.org/wiki/Knowledge_graph)

## Next Steps

For each framework:
1. ✅ Create directory structure
2. ✅ Extract source documentation (Markdown)
3. 🔲 Parse into structured JSON metamodel
4. 🔲 Create SDD bundle schema (`metaschema.json` + entity schemas)
5. 🔲 Validate bundle against SDD core model
6. 🔲 Create example entities

## Approach Options

When implementing these as SDD bundles, we have several options:

### Option A: Separate Bundles
Each framework becomes its own independent SDD bundle with its own `metaschema.json` and entity schemas.

**Pros:**
- Clean separation of concerns
- Users can choose only the frameworks they need
- Easier to maintain and version independently

**Cons:**
- No interoperability between frameworks
- Duplicate concepts (e.g., "Application" exists in multiple frameworks)

### Option B: Unified Master Bundle with Projections
Create a master bundle that encompasses all concepts, with "projections" that filter to specific frameworks.

**Pros:**
- Cross-framework analysis possible
- Shared concepts are unified
- Enables framework translation/migration

**Cons:**
- More complex schema design
- Potential concept conflicts
- Larger bundle size

### Option C: Hybrid - Core + Extensions
A core bundle with fundamental concepts (Entity, Relationship, etc.) plus extension bundles for each framework.

**Pros:**
- Best of both worlds
- Modular and composable
- Framework-specific extensions can build on common base

**Cons:**
- Requires careful design of core concepts
- Extension mechanism needs to be implemented

**Recommendation:** Start with Option A (separate bundles) for simplicity, then explore Option C for advanced use cases.
