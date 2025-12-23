# C4 Model Metamodel

## Overview

The C4 model is a hierarchical approach for visualizing software architecture at different levels of abstraction, created by Simon Brown.

## Source

- **Official Website:** https://c4model.com/
- **Simon Brown's Blog:** https://www.codingthearchitecture.com/

## Key Concepts

C4 describes software architecture at four levels:
1. **Context** - Software systems and their interactions
2. **Container** - Separately deployable units within a system
3. **Component** - Groupings of related functionality within containers
4. **Code** - Implementation details (typically omitted for EA purposes)

Plus supplementary diagrams:
- System Landscape
- Dynamic Diagrams
- Deployment Diagrams

## Entity Types (Objects)

| Entity | Description |
|--------|-------------|
| Software System | Highest level abstraction; delivers value to users. Owned by a single team. |
| Person | Human user of the software system (actors, roles, personas). |
| Container | Context/boundary for code execution or data storage. Separately deployable. |
| Technology | Framework, library, or runtime supporting containers (e.g., MS SQL, Spring Boot). |
| Deployment Node | Infrastructure: physical, virtualized, containerized, or execution environment. |
| Infrastructure Node | Separately hosted technology/runtime (DNS, load balancers, firewalls). |
| Component | Grouping of related functionality behind a well-defined interface. |
| Technology Concept | Concept within a specific technology (e.g., Spring Boot Controller). |

## Diagram Levels

### Level 1: System Context Diagram
- Object types: Person, Software System

### Level 2: Container Diagram
- Object types: Container, Technology, Deployment Node, Infrastructure Node
- Supporting: Person, Software System

### Level 3: Component Diagram
- Object types: Component, Technology Concept
- Supporting: Person, Software System, Container, Technology

### Supplementary: Deployment Diagram
- Object types: Container, Deployment Node, Infrastructure Node

## Relationships (Associations)

### Person Relationships
- **Person::Uses Software Systems <-> Software System::Is Used by Persons**
- **Person::Uses Containers <-> Container::Is Used by Persons**
- **Person::Uses Components <-> Component::Is Used by Persons**
- **Person::Interacts with Persons <-> Person::Is Interacted by Persons**

### Software System Relationships
- **Software System::Serves Persons <-> Person::Is Served by Software Systems**
- **Software System::Accesses Software Systems <-> Software System::Is Accessed by Software Systems**
- **Software System::Consists of Containers <-> Container::Belongs to Software System**
- **Software System::Accesses Containers <-> Container::Is Accessed by Software Systems**
- **Software System::Accesses Components <-> Component::Is Accessed by Software Systems**

### Container Relationships
- **Container::Accesses Software Systems <-> Software System::Is Accessed by Containers**
- **Container::Serves Persons <-> Person::Is Served by Containers**
- **Container::Accesses Containers <-> Container::Is Accessed by Containers**
- **Container::Uses Technologies <-> Technology::Is Used by Containers**
- **Container::Is Deployed to Nodes <-> Deployment Node::Hosts Containers**
- **Container::Uses Infrastructure Nodes <-> Infrastructure Node::Is Used by Containers**
- **Container::Consists of Components <-> Component::Belongs to Container**
- **Container::Accesses Components <-> Component::Is Accessed by Containers**

### Component Relationships
- **Component::Accesses Software Systems <-> Software System::Is Accessed by Components**
- **Component::Serves Persons <-> Person::Is Served by Components**
- **Component::Accesses Containers <-> Container::Is Accessed by Components**
- **Component::Accesses Components <-> Component::Is Accessed by Components**
- **Component::Implements Technology Concepts <-> Technology Concept::Is Implemented by Components**

### Node Relationships
- **Deployment Node::Child Nodes <-> Deployment Node::Parent Nodes** - Nesting
- **Infrastructure Node::Child Nodes <-> Infrastructure Node::Parent Nodes** - Nesting
- **Technology::Concepts <-> Technology Concept::Originates from Technology**

## Files

- `README.md` - This overview
- `source.md` - Full content (to be created)
- `metamodel.json` - Structured JSON representation (to be created)

## See Also

- [c4model.com](https://c4model.com/)
- [Structurizr](https://structurizr.com/) - Tooling for C4 diagrams
