# Visual Prompt

## Style Primer

The following instructions define the global visual style for a high-resolution 16:9 technical infographic.
 
IMPORTANT META RULES (DO NOT DRAW THESE WORDS):
- Treat this entire block as style guidance only.
- Do NOT render any heading or label that mentions "style", "primer", "template", "technical systems", or similar meta concepts.
- The ONLY text that should appear inside the image is:
  • The diagram title given in the slide-specific prompt, without quotation marks.
  • The region/box headings and labels described in the slide-specific prompt.
  • The one-line footer sentence provided in the slide-specific prompt (if any).
- Do NOT invent any extra top banner, header bar, or tagline summarizing the style guidelines.
 
GLOBAL VISUAL STYLE FOR TECHNICAL SYSTEM / PROCESS DIAGRAMS
 
Create a high-resolution 16:9 infographic suitable for technical presentations, research decks, architectural reviews, or product-strategy briefings.
 
Overall look:
- Very clean, flat, vector-illustration style.
- Visual tone similar to product one-pagers from modern AI/tech companies and enterprise-architecture diagrams.
- Palette: calm, professional colors — desaturated blues, teals, purples, and greys — with 1–2 accent colors (orange, lime, or magenta) used sparingly for emphasis.
- **WHITE BACKGROUND** (mandatory).
- Typography: geometric sans-serif, highly legible, with a clear hierarchy between title, section headings, and labels.
- Use thin but readable callout text; avoid long paragraphs — prefer short phrases and labels attached to nodes.
- No real company logos; instead use abstract icons and generic labels like "Module A", "Service X", "Engine", "Component", "Layer 1".
 
Visual grammar / metaphors:
- For flows, data movement, and processes:
  - Use arrows, pipelines, branching paths, circuit-flow lines, or conveyor-belt metaphors.
  - Represent linear sequences as chains of nodes or boxes with numbered arrows.
  - Represent feedback loops as circular or spiral flows.
- For modules, engines, and services:
  - Use packaged blocks, containers, pods, gears, stacked layers, or nested shapes.
  - "Black box" components should appear as opaque modules; configurable logic may be shown as partially transparent or layered.
- For APIs, interfaces, and boundaries:
  - Use ports, sockets, connectors, lego-style pieces, plug-in edges, or adapter blocks.
- For trust, validation, and correctness:
  - Use shields, checkmarks, certificates, audit sheets, or sealed boxes.
  - For probabilistic/heuristic algorithms, consider gradients, fuzzy boundaries, or overlapping zones.
- For flexibility and extensibility:
  - Use branching trees, interchangeable puzzle pieces, modular grids, or adapter layers.
- For constraints and limitations:
  - Use padlocks, chains, narrow pipes, bottleneck icons, or boxed-in shapes.
- For comparisons and trade-offs:
  - Use dual tracks, split-screen layouts, 2×2 matrices, mirrored diagrams, or balance scales.
- For hierarchy or decomposition:
  - Use layered-architecture diagrams, nested boxes, pyramid stacks, onion models, or hub-and-spoke patterns.
 
Image structure rules:
- Partition the canvas into 2–4 clearly separated regions (e.g. left/right columns, top/middle/bottom bands, or quadrants).
- Ensure each region contains at most one core idea plus 3–6 short labeled visual elements.
- Use arrows, numbering, or other directional cues to make the reading order unambiguous (typically left→right or top→bottom).
- Maintain ample whitespace; avoid overcrowding and visual noise.
- Reserve a small bottom strip for a concise caption or "key takeaway" sentence that summarizes the whole diagram in one line.
- When a slide-specific prompt provides a footer sentence, copy that sentence verbatim into the bottom strip. Do not prepend or append any extra wording such as "The diagram shows…", "Summary:", or similar phrases unless explicitly included in the slide-specific instructions.
 
Context focus (general-purpose):
- The diagram should adapt to arbitrary technical domains, such as:
  - System architectures (distributed systems, microservices, data pipelines).
  - Algorithms (cryptographic protocols, ML training & inference flows, distributed consensus).
  - Relationships between entities (clients ↔ servers, producers ↔ consumers, modules ↔ subsystems).
  - Technical processes (onboarding flows, orchestration logic, lifecycle states).
  - Conceptual frameworks (taxonomies, capability maps, layered models).
  - Research or experimental setups.
- Always show at least two interacting entities (e.g. Client ↔ Engine, Component ↔ Database).
- Represent data, control, or process flow in a clearly directional way (with arrows or equivalent).
- Make constraints, dependencies, and execution order visually explicit where relevant.
- Make trade-offs, separation of concerns, and layering visually obvious.
 
Reading orientation & storytelling:
- Use top→bottom when depicting phases, lifecycles, or algorithmic steps.
- Use left→right when depicting flows, pipelines, or before/after comparisons.
- Use center→periphery (hub-and-spoke or concentric patterns) when depicting ecosystems, central engines, or platforms with surrounding components.
- Ensure the final image tells a coherent "micro-story" at a glance: what the system is, how it behaves, and why the structure matters.
 
IMPORTANT LABELING RULES:
- Never use generic, structural labels such as "Panel 1", "Panel 2", "Panel A", "Upper panel", "Lower panel", "Top mini-panel", "Bottom mini-panel", or similar phrases anywhere in the image.
- Every region, box, or sub-panel that needs a heading must use a short, content-based title that reflects its subject matter, e.g. "System overview", "Input–output mapping", "Linearity property", "Time-invariance property", "Control loop", "Failure modes", etc.
- If multiple regions are related, distinguish them by concept, not by number, e.g. "Continuous-time view" vs "Discrete-time view", "Training phase" vs "Inference phase", "Sender side" vs "Receiver side".
- Apply this rule consistently to all titles, captions, legends, and labels inside the figure. Do not invent ordinal panel names; always describe what the viewer is seeing.
 
Bottom strip (final synthesis):
- In the narrow footer area, include exactly one concise one-line takeaway summarizing the main insight of the diagram, without quotation marks.
- The footer must consist only of that single sentence, with no leading text like "The diagram shows…", "This figure illustrates…", or "Summary:", unless explicitly included in the slide-specific instructions.

---

## Slide-Specific Instantiation

NOW INSTANTIATE THIS STYLE FOR:
"Spec Studio — The Transition to Semantic Architecture"

Goal:
- Draw a single, visually striking infographic contrasting traditional, siloed architecture documenting with the new modern paradigm of Spec Studio's executable ontology.
- This represents "Slide 1" of a two-part hero sequence. The narrative arc is left→right: fragmented/static past → integrated/executable future.

Overall layout:
- Partition the canvas into two equal vertical halves (left vs right), separated by a subtle vertical dashed line or a fade effect.
- Place a title at the top center of the canvas: "The Semantic Architecture Paradigm" in a large, bold heading.

Left region — "Traditional IT Delivery":
- Region heading: "Static Documentation".
- Use muted, desaturated styling (grey tones, dashed outlines) to convey the fragmented "before" state.
- Show 3 visual elements:
  1. Heavy, monolithic software icons (representing legacy tools like Sparx or ArchiMate) outputting static 2D documents. Label: "Fragmented Tooling"
  2. PDF or standard wiki-page icons layered over each other arbitrarily. Label: "Static, disconnected diagrams"
  3. A broken bridge or chasm separating a blueprint from actual terminal code. Label: "Manual handoffs & drift"

Right region — "Spec Studio way":
- Region heading: "Executable Ontology".
- Use vibrant accents (teal, purple, or orange) and solid, confident lines to clearly show the "after" state.
- Show 3 visual interacting elements:
  1. A central, glowing "MCP Graph" node connected to AI engine icons (Claude/Copilot). Label: "AI-Native & MCP driven"
  2. A bidirectional arrow showing specs transforming instantly into scaffolding. Label: "Full code generation"
  3. A live heartbeat line flowing from architecture to implementation. Label: "Living specifications"

Visual connections:
- Since it is a split vertical, ensure the left feels disconnected and stagnant, while the right feels fluid, interconnected, and dynamic.

Footer sentence (bottom strip):
Spec Studio bridges the chasm between static documentation and functional code by turning architectural models into machine-readable continuous enforcement engines.
