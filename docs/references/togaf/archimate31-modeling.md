# ArchiMate 3.1 Practical Modeling Reference

Reference data for ArchiMate® 3.1 enterprise architecture modeling, focused metamodels, and practical patterns.

---

## ArchiMate Element Hierarchy

ArchiMate categorizes elements into two main categories:

### Structural Elements (Nouns)
Elements describing objects and entities.

| Category | Description | Examples |
|----------|-------------|----------|
| **Active Structural** | Elements that perform actions | Application Component, Business Actor, Node |
| **Passive Structural** | Elements that actions are performed on | Data Object, Business Object, Artifact |
| **External Active** | Exposed to surrounding environment | Interface elements |
| **Internal Active** | Internal to the system | Component elements |

### Behavioral Elements (Verbs)
Elements describing actions that structural elements perform.

| Category | Description | Examples |
|----------|-------------|----------|
| **Internal Behavior** | How elements get the job done | Process, Function, Interaction |
| **External Behavior** | What elements provide to environment | Service elements |

---

## ArchiMate Layer Color Coding

Standard color themes for architecture layers:

| Layer | Standard Color | RGB | Description |
|-------|----------------|-----|-------------|
| **Business** | Yellow/Orange | 255, 165, 0 | Business Architecture elements |
| **Application** | Blue | 65, 105, 225 | Application Architecture elements |
| **Technology** | Green | 0, 100, 0 | Technology Architecture elements |
| **Strategy** | - | - | Motivation and Strategy elements |
| **Implementation** | - | - | Migration and Implementation elements |

---

## Element Alignment Across Layers

ArchiMate elements have complementary elements in other layers with similar characteristics:

| Concept | Business Layer | Application Layer | Technology Layer |
|---------|---------------|-------------------|------------------|
| **Active Structure** | Business Actor | Application Component | Node |
| **Internal Behavior** | Business Process | Application Process | Technology Process |
| **External Behavior** | Business Service | Application Service | Technology Service |
| **Passive Structure** | Business Object | Data Object | Artifact |
| **Interface** | Business Interface | Application Interface | Technology Interface |
| **Collaboration** | Business Collaboration | Application Collaboration | Technology Collaboration |
| **Function** | Business Function | Application Function | Technology Function |
| **Interaction** | Business Interaction | Application Interaction | Technology Interaction |
| **Event** | Business Event | Application Event | Technology Event |

---

## Focused Metamodels by Layer

### Application Component Focused Metamodel

The Application Component can:
- Be **assigned to**: Application Function, Application Process, Application Service
- **Compose**: Application Interfaces, other Application Components
- Be **served by**: Technology Service
- **Access**: Data Objects
- **Realize**: Business Services, Business Processes

### Technology Node Focused Metamodel

The Node element can:
- Be **assigned to**: System Software, Technology Functions, Processes, Interactions, Events
- **Compose**: Devices, other Nodes
- **Serve**: Application Components
- **Realize**: Technology Services

### Business Service Focused Metamodel

Business Services:
- Are **assigned to**: Business Actors, Business Roles, Business Collaborations
- Are **realized by**: Business Processes, Business Functions
- **Serve**: Business Actors (external), other Business Roles
- Can be **automated by**: Application Services

---

## Business Architecture Elements

### Business Structural Elements

| Element | Definition | Icon |
|---------|------------|------|
| **Business Actor** | Organizational entity capable of performing behavior | Person icon |
| **Business Role** | Expected behavior of a business actor | T-shaped person |
| **Business Collaboration** | Aggregate of actors/roles working together | Two circles |
| **Business Interface** | Access point to business services | Rectangle with line |
| **Business Object** | Passive element representing data/information | Folded corner rectangle |

### Business Behavioral Elements

| Element | Definition | Key Characteristic |
|---------|------------|--------------------|
| **Business Service** | Explicitly defined behavior exposed to environment | External, visible to consumers |
| **Business Process** | Sequence of behaviors achieving specific result | Has sequence, ordered steps |
| **Business Function** | Collection of behavior based on criteria | No sequence, abstracted |
| **Business Interaction** | Collective behavior by collaboration | Requires multiple actors |
| **Business Event** | State change that triggers behavior | Instantaneous, no duration |

### Key Distinctions

**Business Process vs Business Function:**
- Process: Has sequence, details how things are done
- Function: No sequence, answers what business performs internally

**Business Service vs Business Process:**
- Service: External, visible to consumers
- Process: Internal, implements the service

---

## Application Architecture Elements

### Application Structural Elements

| Element | Definition |
|---------|------------|
| **Application Component** | Encapsulation of application functionality, modular and replaceable |
| **Application Interface** | Access point through which application services are accessed |
| **Application Collaboration** | Aggregate of components working together |
| **Data Object** | Passive element representing data in application context |

### Application Behavioral Elements

| Element | Definition |
|---------|------------|
| **Application Service** | Discrete behavior requestable from an application |
| **Application Process** | Sequence of application behaviors |
| **Application Function** | Automated behavior performed by component |
| **Application Interaction** | Unit of collective application behavior |
| **Application Event** | State change within application environment |

---

## Technology Architecture Elements

### Technology Structural Elements

| Element | Definition | Examples |
|---------|------------|----------|
| **Node** | Computational or physical resource | Generic infrastructure |
| **Device** | Physical IT resource | Servers, routers, phones |
| **System Software** | Software providing environment for execution | OS, RDBMS, app servers |
| **Technology Interface** | How technology services can be accessed | APIs, UIs, sockets |
| **Technology Collaboration** | Aggregate of nodes working together | Server clusters |
| **Artifact** | Physical form of data | Files, .jar, .war |
| **Communication Network** | Medium for communication between nodes | LAN, WAN, Internet |
| **Path** | Link between nodes through which they communicate | Network connections |

### Technology Behavioral Elements

| Element | Definition |
|---------|------------|
| **Technology Service** | Externally visible unit of functionality |
| **Technology Function** | Internal behavior providing services |
| **Technology Process** | Sequence of technology behaviors |
| **Technology Interaction** | Collective behavior by collaborating nodes |
| **Technology Event** | State change within technology environment |

### Physical Elements

| Element | Definition | Examples |
|---------|------------|----------|
| **Equipment** | Physical machines not typically modeled as devices | Manufacturing equipment |
| **Facility** | Physical structure housing equipment | Data center, warehouse |
| **Distribution Network** | Physical medium for transportation | Power grid, pipes |
| **Material** | Tangible physical matter | Raw materials, products |
| **Location** | Physical or logical place | Building, region |

---

## Strategy Layer Elements

### Capability

> "A capability represents an ability that an active structure element possesses."

Capabilities answer: **What can the organization do?**

Characteristics:
- Business-focused, not technology-focused
- Stable over longer planning horizons
- Can be decomposed into sub-capabilities
- Served by Value Streams
- Realized by Business Functions, Processes

### Value Stream

> "A value stream represents a sequence of activities that create an overall result for a customer, stakeholder, or end-user."

Characteristics:
- Strategic high-level sequence
- Shows end-to-end value creation
- Realized by Business Processes, Functions
- Served by Capabilities

**Value Stream vs Process:**
- Value Stream: Strategic, high-level, shows value creation
- Process: Operational, detailed, shows how work is done

### Resource

> "A resource represents an asset owned or controlled by an individual or organization."

Examples: People, money, data, software, hardware

### Course of Action

> "A course of action represents an approach or plan for achieving goals through actions."

Represents strategic initiatives or programs.

---

## Implementation and Migration Elements

### Plateau

> "A plateau represents a relatively stable state of the architecture at a point in time."

Use for:
- Baseline Architecture
- Target Architecture
- Transition Architectures

### Gap

> "A gap represents a difference between the baseline and target states."

Identifies what needs to change.

### Work Package

> "A work package represents a series of actions identified to achieve objectives."

Links to projects, programs, portfolios.

### Deliverable

> "A deliverable represents an outcome or output of a work package."

Tangible results of projects.

### Implementation Event

> "An implementation event represents a state change within the implementation."

Milestones in the roadmap.

---

## Relationship Types

### Structural Relationships

| Relationship | Notation | Description |
|--------------|----------|-------------|
| **Composition** | Filled diamond | Part-of relationship (strong ownership) |
| **Aggregation** | Open diamond | Group-of relationship (weak ownership) |
| **Assignment** | Circle with line | Allocation of responsibility |
| **Realization** | Dashed with triangle | Implementation relationship |

### Dependency Relationships

| Relationship | Notation | Description |
|--------------|----------|-------------|
| **Serving** | Arrow | Provides functionality to |
| **Access** | Dashed arrow | Reads/writes data |
| **Influence** | Dashed with dot | Affects another element |
| **Association** | Plain line | Unspecified relationship |

### Dynamic Relationships

| Relationship | Notation | Description |
|--------------|----------|-------------|
| **Triggering** | Arrow with bar | Temporal causation |
| **Flow** | Dashed arrow | Transfer between elements |

### Other Relationships

| Relationship | Description |
|--------------|-------------|
| **Specialization** | More specific form of |
| **Junction** | AND/OR logic connectors |

---

## Inter-Layer Relationships

Standard pattern for cross-layer relationships:

```
Upper levels → depend on → Lower levels
Lower levels → serve → Upper levels

Business Layer
    ↑ serves / ↓ realized by
Application Layer
    ↑ serves / ↓ realized by
Technology Layer
```

---

## Modeling Best Practices

### Diagram Quality

1. **Keep diagrams focused** - One main concept per diagram
2. **Fit on single page** - Avoid scrolling
3. **Add only necessary information** - Avoid clutter
4. **Pay attention to appearance** - Consistent styling
5. **Know your audience** - Appropriate level of detail

### Notation Consistency

1. **Don't mix notations** - Use rectangular OR borderless, not both
2. **Consistent colors** - Same shade for same layer
3. **Consistent naming** - Standard naming conventions
4. **Use metamodels** - Reference for valid relationships

### Repository Governance

1. **Element reuse** - Reuse elements across diagrams, don't duplicate
2. **Version management** - Track changes over time
3. **Sandboxes** - Test changes before committing
4. **Security** - Control access to sensitive content
5. **Backup and restore** - Regular backups

---

## Catalog Types

### Business Catalogs
- Business Actors Catalog
- Business Roles Catalog
- Business Services Catalog
- Business Processes Catalog
- Business Functions Catalog
- Business Objects Catalog

### Application Catalogs
- Application Components Catalog
- Application Services Catalog
- Application Interfaces Catalog
- Data Objects Catalog

### Technology Catalogs
- Technology Components Catalog
- System Software Catalog
- Technology Services Catalog
- Equipment Catalog
- Network Catalog

### Strategy Catalogs
- Capabilities Catalog
- Value Streams Catalog
- Resources Catalog

### Implementation Catalogs
- Work Packages Catalog
- Gaps Catalog
- Plateaus Catalog

---

## Practical Tips

### Agile EA Principles

1. **Start with MVP** - Minimum Viable Product for artifacts
2. **Iterate** - Enhance as the work progresses
3. **Focus on value** - Deliver useful artifacts to stakeholders
4. **Avoid scope creep** - Don't try to model everything at once
5. **Use focused metamodels** - Smaller, easier to understand

### Common Pitfalls to Avoid

1. **Effort Blackhole** - Infinite tasks never completing a phase
2. **Ivory Tower** - Disconnected from reality
3. **Boiling the Ocean** - Trying to do too much at once
4. **Theoretical Documents** - Unactionable deliverables
5. **Inconsistent Terminology** - Confusing stakeholders

### Starting an EA Repository

1. Create the repository file
2. Establish focused metamodels as needed
3. Start with a single diagram (Application Component Context is common)
4. Build catalogs gradually
5. Add governance as architecture matures
