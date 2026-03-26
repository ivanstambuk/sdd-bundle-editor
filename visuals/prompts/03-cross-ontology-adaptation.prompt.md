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
  - Technical processes (on onboarding workflows, orchestration logic, lifecycle states).
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
"Spec Studio Ecosystem — Federated Bounded Contexts"

Goal:
- Draw a single, visually striking infographic showing the transition away from a monolithic "Mega Ontology" into a federated system of Bounded Contexts, bridged by AI.
- This serves as "Slide 3" of the hero sequence, demonstrating cross-ontology change propagation.

Overall layout:
- Use a top-to-bottom hierarchical layout separated into three distinct horizontal bands.
- Place a title at the top center of the canvas: "AI-Assisted Cross-Ontology Propagation" in a large, bold heading.

Top region — "Strategic Layer":
- Region heading: "Organizational Ontology".
- Show a high-level structure (e.g., a corporate building icon or a clean, simple node network). 
- Insert an indicator of a new decision: A bright highlighted node or an incoming pulse labeled "Strategic decision or requirement change".

Middle region — "The AI Bridge":
- Region heading: "AI Translation & Impact Engine".
- Draw a prominent, glowing AI core or translation matrix (e.g., layered gears with an AI spark).
- Visual action: Draw arrows flowing from the top region (the strategic decision) into this core. 
- Sub-labels attached to the processing core: "Impact Calculation" and "Cross-Ontology Adaptation".

Bottom region — "Operational Layer (Bounded Contexts)":
- Region heading: "Isolated Project Ontologies".
- Draw three distinct, separated containers representing isolated projects. They should look physically distinct to emphasize "Bounded Contexts" and clearly NOT a "Mega Ontology".
- Container 1 (Left): "Project A (Small)" - containing a simple 3-node graph.
- Container 2 (Center): "Project B (Complex)" - containing a larger, more intricate graph.
- Container 3 (Right): "Department C" - containing domain-specific icons.
- Visual action: The AI engine (from the middle region) shoots downward arrows that translate and inject that top-level strategic change specifically into the relevant parts of each separate project container.
- Include a small, crossed-out/rejected monolith icon fading in the background or side corner with the label: "Anti-pattern: Mega Ontology", ensuring the viewer understands the contrast.

Visual connections:
- A clean top-down flow: The singular strategic change flows down, hits the AI bridge, and fans out elegantly into the isolated operational domains.

Footer sentence (bottom strip):
AI assists in isolating changes and deriving bounded contexts, enabling cross-ontology adaptation without the fragility of a universal mega-ontology.
