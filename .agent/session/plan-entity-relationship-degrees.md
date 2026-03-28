# Entity Relationship Degrees

This plan outlines the implementation of a 1st/2nd/3rd degree relationship selector for the individual Entity Details view, allowing users to deeply explore dependency chains.

## User Review Required
Please review the graph traversal behavior. The depth selector will be restricted to a maximum of 3 degrees. This prevents severe performance degradation with `dagre` layout on highly interconnected bundles, while still giving the user the capability to explore the "blast radius" of a requirement. 

> [!WARNING]  
> The **List** view will remain restricted strictly to 1-level deep (outgoing/incoming) references. Recursive hierarchical tracking inside the list view would create a confusing UX. The Map view will exclusively power the multi-degree exploration.

## Proposed Changes

### 1. Update Map Graph Component
#### [MODIFY] [EntityDependencyGraph.tsx](file:///home/ivan/dev/sdd-bundle-editor/packages/ui-shell/src/components/EntityDependencyGraph.tsx)
- Modify props: Remove `incoming` and `outgoing`. Replace with `allEdges: EntityEdge[]` and `depth: number`.
- Implement a Breadth-First Search (BFS) algorithm to traverse the graph starting from `entityId` up to `depth`.
- The traversal will check both source and target directions (incoming and outgoing) to capture all adjacent relations at each depth level.
- Ensure the layout calculations correctly position larger graphs by rendering all discovered nodes and edges.

### 2. Rename Tab & Add Controls
#### [MODIFY] [EntityDetails.tsx](file:///home/ivan/dev/sdd-bundle-editor/packages/ui-shell/src/components/EntityDetails.tsx)
- Rename the specific tab internally and in the UI from "Dependencies" to "Relationships" (aligning with the Bundle view terminology).
- Add `graphDepth` state, defaulting to 1.
- In the relationships header, when `depViewMode === 'map'`, render a segmented depth control (1st Degree, 2nd Degree, 3rd Degree).
- Pass `bundle.refGraph.edges` and `depth={graphDepth}` parameters to the updated `EntityDependencyGraph`.

### 3. Progress Tracking
#### [MODIFY] [task.md](file:///home/ivan/.gemini/antigravity/brain/15076e5f-cb1f-42cd-a7f5-48d0cfab616e/task.md)
#### [MODIFY] [IMPLEMENTATION_TRACKER.md](file:///home/ivan/dev/sdd-bundle-editor/IMPLEMENTATION_TRACKER.md)
- Set up a tracker artifact.
- Synchronize with the project's internal `IMPLEMENTATION_TRACKER.md` to record the completed enhancement.

## Open Questions
- Is a 3-degree limit sufficient for your use case, or do you anticipate needing a "Full Graph" (unlimited) option specifically scoped to an entity? (Recommendation: Keep it to 3 for now, as >3 degree relationship chaining usually equates to viewing the entire bundle).

## Verification Plan
1. Select an entity with deep dependencies in the sidebar.
2. Navigate to the "Relationships" tab -> Map View.
3. Validate that 1st Degree perfectly mimics current production behavior.
4. Toggle to 2nd Degree and 3rd Degree, verifying that the `dagre` layout smoothly expands to include adjacent nodes without freezing the UI.
