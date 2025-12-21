# UI Patterns

Reusable UI patterns for the SDD Bundle Editor.

---

## Syntax Highlighting with Prism.js

### Theme-Aware Highlighting

Use CSS variables for colors that adapt to light/dark theme.

**React Component Pattern:**
```tsx
import { useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';  // or prism-json

// Memoize the highlighted output for performance
const highlightedContent = useMemo(() => {
  return Prism.highlight(content, Prism.languages['yaml'], 'yaml');
}, [content]);

// Render with dangerouslySetInnerHTML
return (
  <pre className="code-block yaml-block">
    <code
      className="language-yaml"
      dangerouslySetInnerHTML={{ __html: highlightedContent }}
    />
  </pre>
);
```

**Key Points:**
- Use `useMemo` to avoid re-highlighting on every render
- The `language-*` class enables Prism token styling
- Use `*-block` class (e.g., `yaml-block`, `json-block`) for theme-aware colors

---

## CSS Variables for Syntax Highlighting

Add these to your theme definitions for consistent, theme-aware syntax colors.

**Dark Theme (Dracula-inspired):**
```css
:root {
  /* Syntax highlighting colors for dark mode */
  --syntax-key: #8be9fd;       /* cyan - property names, keys */
  --syntax-string: #f1fa8c;    /* yellow - string values */
  --syntax-number: #bd93f9;    /* purple - numbers */
  --syntax-boolean: #ff79c6;   /* pink - booleans, null, keywords */
  --syntax-comment: #6272a4;   /* muted gray - comments */
  --syntax-punctuation: #6272a4; /* muted gray - punctuation */
  --syntax-green: #50fa7b;     /* green - anchors, aliases */
}
```

**Light Theme (GitHub-inspired):**
```css
[data-theme="light"] {
  /* Syntax highlighting colors for light mode */
  --syntax-key: #0969da;       /* blue - property names, keys */
  --syntax-string: #0a3069;    /* dark blue - string values */
  --syntax-number: #8250df;    /* purple - numbers */
  --syntax-boolean: #cf222e;   /* red - booleans, null, keywords */
  --syntax-comment: #6e7781;   /* gray - comments */
  --syntax-punctuation: #57606a; /* dark gray - punctuation */
  --syntax-green: #116329;     /* green - anchors, aliases */
}
```

**Usage in Token Styles:**
```css
/* YAML/JSON highlighting (theme-aware) */
.yaml-block .token.key,
.json-block .token.property {
  color: var(--syntax-key);
}

.yaml-block .token.string,
.json-block .token.string {
  color: var(--syntax-string);
}

.yaml-block .token.number,
.json-block .token.number {
  color: var(--syntax-number);
}

.yaml-block .token.boolean,
.yaml-block .token.null,
.yaml-block .token.keyword,
.json-block .token.boolean,
.json-block .token.null {
  color: var(--syntax-boolean);
}

.yaml-block .token.punctuation,
.json-block .token.punctuation {
  color: var(--syntax-punctuation);
}
```

---

## Dependency Graph Grouping by Relation

When displaying relationships, group by relation name rather than flat list.

```tsx
// Group incoming edges by relationship display name
const incomingByRelation = incoming.reduce((acc, edge) => {
  const relationName = getFieldDisplay(edge.fromEntityType, edge.fromField);
  if (!acc[relationName]) {
    acc[relationName] = [];
  }
  acc[relationName].push(edge);
  return acc;
}, {} as Record<string, typeof incoming>);

// Sort relationship groups alphabetically
const relationGroups = Object.entries(incomingByRelation).sort((a, b) => 
  a[0].localeCompare(b[0])
);

// Render each group with its relation name as header
{relationGroups.map(([relationName, edges]) => (
  <div key={relationName} className="graph-branch">
    <div className="graph-branch-label">{relationName}</div>
    <div className="graph-children">
      {edges.map((edge, idx) => (
        // Render each entity in the group
      ))}
    </div>
  </div>
))}
```

**Benefits:**
- Semantically groups related items
- Removes redundant "(relationship name)" suffix per item
- Same relation name across entity types grouped together

---

## React Flow: EdgeLabelRenderer (HTML Labels Above Edges)

When edge labels are crossed by connection lines, use `EdgeLabelRenderer` to render labels as HTML divs above the SVG layer.

**Problem:** React Flow's default SVG labels render in the same group as edge paths, allowing lines to cross over labels depending on layout position.

**Solution:** Create a custom edge component using `EdgeLabelRenderer`:

```tsx
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from 'reactflow';

export interface LabeledEdgeData {
    label: string;
    offset?: number;  // For parallel edges
}

export function LabeledEdge({
    id, sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition, style, markerEnd, data,
}: EdgeProps<LabeledEdgeData>) {
    // getSmoothStepPath returns [path, labelX, labelY]
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX, sourceY, sourcePosition,
        targetX, targetY, targetPosition,
        offset: data?.offset,
        borderRadius: 8,
    });

    return (
        <>
            <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
            {data?.label && (
                <EdgeLabelRenderer>
                    <div style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                        pointerEvents: 'none',
                        fontSize: 11,
                        fontWeight: 500,
                        color: 'var(--color-text-secondary)',
                        backgroundColor: 'var(--color-surface-secondary)',
                        padding: '4px 6px',
                        borderRadius: 4,
                        whiteSpace: 'nowrap',
                    }}>
                        {data.label}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}
```

**Usage in ReactFlow:**
```tsx
// Define edge types (must be memoized!)
const edgeTypes: EdgeTypes = useMemo(
    () => ({ labeled: LabeledEdge }),
    []
);

// Use in edges array
const edges: Edge<LabeledEdgeData>[] = [{
    id: 'edge-1',
    source: 'nodeA',
    target: 'nodeB',
    type: 'labeled',
    data: { label: 'connected to [*]', offset: 30 },
    style: { stroke: 'var(--color-border)', strokeWidth: 1.5 },
}];

// Pass edgeTypes to ReactFlow
<ReactFlow
    edgeTypes={edgeTypes}
    defaultEdgeOptions={{ type: 'labeled' }}
    // ...
/>
```

**Key Points:**
- `EdgeLabelRenderer` is a React portal rendering HTML outside SVG
- Label coordinates (`labelX`, `labelY`) come from path utility functions
- `transform: translate(-50%, -50%)` centers the label on the coordinates
- `offset` param curves parallel edges to avoid overlap
- Edge types must be memoized outside render to prevent recreation

---

## React Flow: Container Sizing (Avoiding 0px Height)

React Flow requires explicit height on its container. Using `flex: 1` in a flexbox layout can cause the container to collapse to 0px.

**Problem:** The container has `flex: 1` and `height: 400px`, but the graph doesn't render because computed height is 0px.

**Root Cause:** `flex: 1` expands to `flex: 1 1 0%`. The `flex-basis: 0%` combined with no content causes the container to shrink. The explicit `height` is ignored when `flex-shrink` is active.

**Solution:** Use `flex: none` with explicit height:

```css
/* ❌ WRONG - flex: 1 causes height to collapse to 0px */
.graphContainer {
    flex: 1;
    height: 400px;  /* Ignored due to flex-basis: 0% */
}

/* ✅ CORRECT - flex: none respects explicit height */
.graphContainer {
    flex: none;     /* Don't grow or shrink */
    height: 400px;  /* Now respected */
    overflow: hidden;
}
```

**Also add style to ReactFlow component:**
```tsx
<ReactFlow
    style={{ height: '400px', width: '100%' }}
    // ... other props
>
```

**When to use:**
- Any React Flow graph in a flexbox layout
- Containers that need fixed height regardless of content
- Grid cells where you want explicit sizing

**Debug tip:** If React Flow renders blank, check computed styles:
```javascript
// Browser console
document.querySelector('.react-flow').getBoundingClientRect();
// If height is 0, check parent's flex property

