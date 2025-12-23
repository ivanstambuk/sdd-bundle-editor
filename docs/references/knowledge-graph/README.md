# Knowledge Graph Metamodel

## Overview

A Knowledge Graph is a simple, flexible structure for representing any kind of knowledge using nodes and edges.

## Source

- **Wikipedia:** https://en.wikipedia.org/wiki/Knowledge_graph

## Key Concepts

Enterprise Architecture deals with lots of knowledge that doesn't always fit under predefined metamodels. When knowledge is too generic or the metamodel cannot be defined in advance, a knowledge graph provides maximum flexibility.

A knowledge graph consists of:
- **Nodes** - Any piece of information considered in isolation
- **Edges** - Connections between nodes for traversal, dependency analysis, and relationship mapping

## Entity Types (Objects)

| Entity | Description |
|--------|-------------|
| Node | Any object, place, or person that can connect to other Nodes via Edges |

## Relationships (Associations)

| Relationship | Description |
|--------------|-------------|
| **Node::Outgoing Edges <-> Node::Incoming Edges** | Nodes on the other end of directed edges. Edge originates from current node (outgoing) or ends at current node (incoming). |

## Use Cases

Knowledge graphs are useful for:
- Describing business structures and leadership
- Mapping organizational hierarchies
- Representing any domain where relationships matter
- Rapid prototyping before defining a formal metamodel
- Cross-domain knowledge integration

## Example

Describing a company structure:
1. Create Nodes for the company and its business lines
2. Create Nodes for leadership (CEO, division heads)
3. Connect with labeled edges ("leads", "reports to", "part of")

## Files

- `README.md` - This overview
- `source.md` - Full content (to be created)
- `metamodel.json` - Structured JSON representation (to be created)

## Implementation Notes

This is the simplest possible metamodel - just one entity type with self-referential relationships. The power comes from:
1. Flexible edge labeling
2. Arbitrary node types (via attributes/tags)
3. No predefined constraints

When implementing as an SDD bundle, consider:
- Using `title` for node name
- Using `tags` for node categorization
- Relationship labels become the semantic meaning
