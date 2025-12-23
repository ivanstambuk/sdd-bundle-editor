# TOGAF Content Metamodel

## Overview

TOGAF (The Open Group Architecture Framework) is the most popular Enterprise Architecture framework. This reference covers both **TOGAF 9.2** and **TOGAF Standard 10th Edition** metamodels.

## Official Sources

| Version | Source | Released |
|---------|--------|----------|
| TOGAF 9.2 | [Chapter 30 - Content Metamodel](https://pubs.opengroup.org/architecture/togaf9-doc/arch/chap30.html) | 2018 |
| TOGAF 10 | [The Open Group TOGAF Standard](https://www.opengroup.org/togaf) | 2022 |

## Version Comparison

### TOGAF 9.2 Content Metamodel
- **Structure**: Monolithic document divided into seven parts
- **Focus**: Comprehensive coverage with extension modules
- **Terminology**: "Content Framework and Metamodel"
- **Entities**: 35 object types with extensive cross-cutting relationships

### TOGAF 10 Enterprise Metamodel
- **Structure**: Modular approach with "Fundamental Content" + "Series Guides"
- **Focus**: Core metamodel with simplified essential entities
- **Terminology**: "TOGAF Content Framework and TOGAF Enterprise Metamodel"
- **Entities**: 10 core entities (streamlined from 9.2)
- **Enhanced**: Agile integration, digital transformation, cloud, microservices guidance

## Key Differences

| Aspect | TOGAF 9.2 | TOGAF 10 |
|--------|-----------|----------|
| Structure | Monolithic | Modular |
| Core Entities | 35 (with extensions) | 10 (core minimal set) |
| Governance | Formal procedures | Continuous/adaptive |
| ADM Approach | Linear/prescriptive | Iterative/feedback-driven |
| Agile Support | Limited | Explicit integration |
| Technology Guidance | Traditional | Cloud, microservices, DevOps |
| "Technology Service" | Present | Renamed to "Platform Service" |

## TOGAF 10 Core Entities

The TOGAF 10 Enterprise Metamodel provides a **minimal set** of essential entities:

| Entity | Description |
|--------|-------------|
| **Actor** | Person, organization, or system external to the architecture that interacts with it |
| **Role** | Specific tasks an actor can undertake; an actor assumes a role to perform a task |
| **Organization Unit** | Self-contained unit of resources with goals, objectives, and measures |
| **Function** | Delivers business capabilities; units of business capability at all granularities |
| **Business Service** | Supports business capabilities through a defined interface; governed by organization |
| **Information System Service** | Automated elements of a business service |
| **Data Entity** | Encapsulation of data recognized by business domain experts |
| **Application Component** | Encapsulation of application functionality aligned to implementation |
| **Technology Component** | Encapsulation of technology infrastructure; class or specific product |
| **Platform Service** | Technical capability providing enabling infrastructure for applications |

## TOGAF 9.2 Full Entity Set

TOGAF 9.2 provides a more detailed metamodel organized by **Extension Modules**:

### Core Module (Always Included)
- Actor, Assumption, Business Capability, Business Service, Capability
- Constraint, Course of Action, Data Entity, Function, Gap, Location
- Logical Application Component, Organization Unit, Physical Technology Component
- Principle, Process, Requirement, Role, Technology Service, Value Stream, Work Package

### Motivation Extension
- Driver, Goal, Objective

### Process Extension
- Control, Event, Product

### Governance Extension
- Contract, Measure, Service Quality

### Services Extension
- Information System Service

### Data Extension
- Logical Data Component, Physical Data Component

### Infrastructure Consolidation Extension
- Logical Technology Component, Physical Application Component

## TOGAF 10 Series Guides

TOGAF 10 introduces specialized guides that extend the core framework:

| Guide | Focus Area |
|-------|------------|
| Business Architecture Guide | Business capabilities, value streams, organization |
| Information Architecture Guide | Data management, information governance |
| Security Architecture Guide | Security patterns, risk management |
| Technology Architecture Guide | Infrastructure, platforms, deployment |
| Agile Architecture Guide | Iterative development, continuous delivery |
| Digital Guide | Digital transformation, modern practices |
| Microservices Architecture Guide | MSA patterns, service decomposition |
| SOA Guide | Service-oriented architecture patterns |

## Architecture Artifacts

TOGAF defines three types of artifacts for documenting architecture:

### Catalogs (Lists)
Inventories of building blocks:
- Application Portfolio Catalog
- Technology Standards Catalog
- Business Capability Catalog
- Data Entity Catalog
- Organization/Actor Catalog

### Matrices (Relationships)
Mappings between elements:
- Application/Business Process Matrix
- Application/Data Matrix
- Business Service/Function Matrix
- System/Technology Matrix

### Diagrams (Visualizations)
Visual representations:
- Business Capability Map
- Value Stream Diagram
- Application Communication Diagram
- Technology Standards Diagram
- Deployment Diagram

## Recommendation for SDD Bundles

Given the two versions, we recommend:

### Option 1: TOGAF 10 Core Bundle
- Implement the 10 core entities from TOGAF 10
- Simpler, modern, aligned with current practices
- Easier to maintain and understand

### Option 2: TOGAF 9.2 Full Bundle
- Implement all 35 entities with extension modules
- Comprehensive coverage for traditional EA
- Use tags or categories for extension module filtering

### Option 3: Both Versions
- Create separate bundles for each version
- Allow users to choose based on their TOGAF certification/practice

## Files in This Directory

| File | Description | Status |
|------|-------------|--------|
| `README.md` | This overview and version comparison | ✅ Complete |
| `source.md` | TOGAF 9.2 detailed object and relationship definitions | ✅ Complete |
| `togaf10-entities.md` | TOGAF 10 core entities with 9.2 mapping | ✅ Complete |
| `togaf10-official.md` | Official TOGAF 10 entity definitions | ✅ Complete |
| `togaf10-diagrams.md` | Key TOGAF 10 conceptual diagrams | ✅ Complete |
| `togaf10-pocket-guide.md` | ADM deliverables and terminology | ✅ Complete |
| **`togaf10-metamodel.md`** | **Core Enterprise Metamodel - 36 entities & relationships** | ✅ **Key File** |
| `archimate31-modeling.md` | ArchiMate 3.1 elements, focused metamodels, best practices | ✅ Complete |
| `images/` | Metamodel and conceptual diagrams | ✅ 5 images |
| `metamodel.json` | Machine-readable metamodel | 🔜 Planned |

## External Resources

### Official
- [The Open Group TOGAF Portal](https://www.opengroup.org/togaf)
- [TOGAF 9.2 Online (Members)](https://pubs.opengroup.org/architecture/togaf92-doc/arch/)
- [TOGAF Standard 10th Edition](https://pubs.opengroup.org/togaf-standard/)

### Community
- [TOGAF Wikipedia](https://en.wikipedia.org/wiki/The_Open_Group_Architecture_Framework)
- [Visual Paradigm TOGAF Guide](https://www.visual-paradigm.com/guide/togaf/)
- [EA School Comparison](https://enterprisearchitectschool.com/)

### Books
- "TOGAF 9.2 Foundation Study Guide" - The Open Group
- "Enterprise Architecture As Strategy" - MIT Sloan

## Version History

| Date | Version | Notes |
|------|---------|-------|
| 2011 | TOGAF 9.1 | Major update with improved guidance |
| 2018 | TOGAF 9.2 | Updated business architecture, content metamodel |
| 2022 | TOGAF 10 | Modular structure, agile integration, simplified core |
