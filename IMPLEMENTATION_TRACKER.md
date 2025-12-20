# SDD Bundle Editor – Implementation Tracker

This file tracks **active and planned** implementation work only.

For completed work and architecture, see:
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** – Core concepts, package structure, design decisions
- **[AGENTS.md](./AGENTS.md)** – Developer/agent operational guide
- **[packages/mcp-server/README.md](./packages/mcp-server/README.md)** – MCP server documentation

---

## Completed Work Summary

The following major milestones have been completed:

| Phase | Description |
|-------|-------------|
| 0-7 | Monorepo, core packages, CLI, backend, UI, testing |
| 8.1 | Conversational agent interface with speech-to-text |
| 8.3 | Change proposal/application workflow |
| 8.4 | Read-only UI mode |
| 8.6 | Testing and documentation |
| 8.8 | MCP server with tools and resources |
| 8.9 | Conformance testing (Profile rules, audit templates) |
| Infra | External bundle repository migration |

**Current state**: Full read-only UI with MCP-based AI integration. All modifications via `apply_changes` MCP tool.

---

## In Progress

### Agent Backend Implementations

- [x] `CliAgentBackend` – Spawns CLI agent process (stdin/stdout)
- [x] `HttpAgentBackend` – Calls external HTTP API (DeepSeek, OpenAI, etc.)
- [ ] `VsCodeAgentBackend` – Communicates with VS Code's integrated agent
- [ ] `McpAgentBackend` – Uses MCP for agent communication

---

## Future Work

### Richer Example Bundles
- [ ] Protocol spec bundle (e.g., EC-OPRF/FHE-style)
- [ ] Feature-based project bundle (e.g., EUDIW simulator)

### VS Code Integration
- [ ] VS Code extension for tighter agent integration than web UI

### MCP Enhancements
- [ ] Additional prompts for specialized workflows
- [ ] Cross-bundle relationship analysis
- [ ] Resource template completions (autocomplete for bundleId, entityType, id)
- [ ] Prompt argument completions using `completable()` wrapper

### Entity Relationship Graph Visualization
- [x] Interactive graph view for entity types and relationships ✅
  - **Tab**: New "🗺️ Relationship Map" tab in BundleOverview
  - **Library**: React Flow + dagre layout
  - **Nodes**: Entity types with colors from bundle-type config
  - **Edges**: Relationships with human-readable labels (from schema titles) + cardinality
  - **Clustering**: Group nodes by category (already implemented in bundle-type.json)
  - **Interactions**:
    - Click node → navigate to entity type in sidebar
    - Pan/zoom with minimap
    - Drag nodes to customize layout
  - **Completed**: 2025-12-20

<details>
<summary>Reference PlantUML Diagram (click to expand)</summary>

```plantuml
@startuml
' SDD Core (v1.0.0) — relationship graph layout reference

skinparam backgroundColor #FFFFFF
skinparam dpi 100
skinparam shadowing false
skinparam linetype ortho
skinparam ranksep 50
skinparam nodesep 20

hide members
hide methods
hide attributes
hide circle

package "Delivery & Scope" as P_Delivery {
  class Feature   #bb9af7
  class Requirement #7dcfff
  class Task      #ff9e64
  class Scenario  #7aa2f7
  class Fixture   #e0af68
  class Profile   #f7768e
  class Actor     #ff7c6a
}

package "System & Interfaces" as P_System {
  class Component #73daca
  class Protocol
  class DataSchema
  class Viewpoint
  class View
}

package "Governance & Guidance" as P_Govern {
  class ADR #9ece6a
  class Decision
  class Principle
  class Policy
  class Constraint
}

package "Risk, Threats, Questions" as P_Risk {
  class Risk
  class Threat
  class OpenQuestion
}

package "Observability & Ops" as P_Obs {
  class TelemetrySchema
  class TelemetryContract
  class ErrorCode
  class HealthCheckSpec
}

' Layout hints
P_Delivery -[hidden]-> P_System
P_System   -[hidden]-> P_Govern
P_Govern   -[hidden]-> P_Risk
P_Risk     -[hidden]-> P_Obs

' Key relationships (subset for visual clarity)
Requirement --> Feature : realizesFeatureIds [*]
Task --> Requirement : fulfillsRequirementIds [*]
Task --> Feature : belongsToFeatureIds [*]
Feature --> ADR : governedByAdrIds [*]
Component --> Feature : implementsFeatureIds [*]
Component --> Protocol : providesProtocolIds [*]
Scenario --> Feature : coversFeatures [*]
Actor --> Scenario : participatesInScenarioIds [*]

legend right
[1] = single reference (string)
[*] = list of references (array)
endlegend

@enduml
```

</details>

