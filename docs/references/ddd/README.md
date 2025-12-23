# Domain-Driven Design (DDD) Metamodel

## Overview

Domain-Driven Design (DDD) is a software design approach by Eric Evans that focuses on modeling complex business domains.

## Source

- **Book:** [Domain-Driven Design: Tackling Complexity in the Heart of Software](https://www.amazon.com/Domain-Driven-Design-Tackling-Complexity-Software/dp/0321125215) by Eric Evans
- **DDD Reference:** https://www.domainlanguage.com/ddd/reference/
- **Domain Language:** https://www.domainlanguage.com/

## Key Concepts

DDD provides strategic and tactical patterns:
- **Strategic Design** - Bounded Contexts, Context Mapping
- **Tactical Design** - Entities, Value Objects, Aggregates, Repositories
- **Model-Driven Design** - Layers, Modules, Services

## Entity Types (Objects)

### Strategic Patterns

| Entity | Description |
|--------|-------------|
| Bounded Context | Explicit context within which a model applies. Has boundaries in team organization, application usage, and physical manifestations. |
| Team | Group of people who own Bounded Context(s). |
| Application | Software system corresponding to Bounded Context(s). |
| Published Language | Well-documented shared language for domain communication. |
| Big Ball of Mud | Part of system with mixed models and inconsistent boundaries. |

### Tactical Patterns

| Entity | Description |
|--------|-------------|
| Layer | Horizontal partition of Bounded Context with dependency direction. |
| Module | Cohesive slice grouping interrelated concepts. |
| Entity | Object distinguished by identity rather than attributes. |
| Value Object | Object distinguished by attributes rather than identity. |
| Domain Event | Representation of something that happened in the domain. |
| Service | Standalone interface for significant process or transformation. |
| Aggregate Root | Entity that is root of an Aggregate cluster. |
| Repository | Service providing in-memory collection illusion for Aggregates. |
| Factory | Encapsulates creation of complex objects and Aggregates. |

### Distillation Patterns

| Entity | Description |
|--------|-------------|
| Cohesive Mechanism | Conceptually cohesive framework mechanism (the "how"). |
| Framework Interface | Intention-revealing interface exposed by a Cohesive Mechanism. |

## Context Mapping Relationships

- **Partner Bounded Contexts** - Mutual partnership
- **Shared Kernel** - Shared context between bounded contexts
- **Customer/Supplier** - Customer-supplier relationship
- **Conformist** - One context conforms to another
- **Anti-Corruption Layer** - Isolation layer between contexts

## Relationships (Associations)

### Bounded Context Relationships
- **Team::Owns Bounded Contexts <-> Bounded Context::Owner Teams**
- **Application::Implements Bounded Contexts <-> Bounded Context::Applications Implementing this BC**
- **Bounded Context::Consists of Layers <-> Layer::Belongs to Bounded Context**
- **Bounded Context::Consists of Modules <-> Module::Belongs to Bounded Context**
- **Bounded Context::Understands Published Languages <-> Published Language::Is Understood by Bounded Contexts**
- **Bounded Context::Partner Bounded Contexts** (bidirectional)
- **Bounded Context::Shared Kernels <-> Bounded Context::Is Shared Kernel of BCs**
- **Bounded Context::Customer Bounded Contexts <-> Bounded Context::Supplier Bounded Contexts**
- **Bounded Context::Conforms to Bounded Contexts <-> Bounded Context::Conformist Bounded Contexts**
- **Bounded Context::Has Anti-Corruption Layer for BCs <-> Bounded Context::BCs with Anti-Corruption Layer**
- **Bounded Context::Core Domain Module <-> Module::Is Core Domain of Bounded Context**
- **Bounded Context::Generic Subdomain Modules <-> Module::Is Generic Subdomain of Bounded Context**
- **Bounded Context::Cohesive Mechanisms <-> Cohesive Mechanism::Belongs to Bounded Context**
- **Bounded Context::Abstract Core Modules <-> Module::Is Abstract Core of Bounded Context**
- **Big Ball of Mud::Consists of Bounded Contexts <-> Bounded Context::Is Part of Big Ball of Mud**

### Layer & Module Relationships
- **Layer::Depends on Layers <-> Layer::Dependent Layers**
- **Layer::Consists of [Entities|Value Objects|Domain Events|Services|Aggregate Roots|Repositories|Factories]**
- **Module::Depends on Modules <-> Module::Dependent Modules**
- **Module::Consists of [Entities|Value Objects|Domain Events|Services|Aggregate Roots|Repositories|Factories]**

### Tactical Relationships
- **Entity::Dispatches Domain Events <-> Domain Event::Describes Entities**
- **Entity::Nested Entities <-> Entity::Parent Entities**
- **Entity::Nested Value Objects <-> Value Object::Parent Entities**
- **Value Object::Nested Entities <-> Entity::Parent Value Objects**
- **Service::Transforms Aggregates <-> Aggregate Root::Is Transformed by Services**
- **Aggregate Root::Dispatches Domain Events <-> Domain Event::Describes Aggregate Roots**
- **Aggregate Root::Nested Entities <-> Entity::Parent Aggregate Roots**
- **Aggregate Root::Nested Value Objects <-> Value Object::Parent Aggregate Roots**
- **Repository::Stores Aggregate Root <-> Aggregate Root::Is Stored by Repository**
- **Factory::Assembles Aggregates <-> Aggregate Root::Is Assembled by Factory**

### Framework Relationships
- **Cohesive Mechanism::Exposed Interfaces <-> Framework Interface::Belongs to Cohesive Mechanism**

## Files

- `README.md` - This overview
- `source.md` - Full content (to be created)
- `metamodel.json` - Structured JSON representation (to be created)

## See Also

- [Domain-Driven Design book](https://www.amazon.com/Domain-Driven-Design-Tackling-Complexity-Software/dp/0321125215)
- [DDD Reference](https://www.domainlanguage.com/ddd/reference/)
- [domainlanguage.com](https://www.domainlanguage.com/)
