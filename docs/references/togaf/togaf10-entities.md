# TOGAF 10 Core Entities

> **Source:** The Open Group TOGAF Standard, 10th Edition (2022)
> 
> This document describes the simplified core metamodel introduced in TOGAF 10.

## Overview

TOGAF 10 introduces a streamlined **Core Metamodel** with 10 essential entities, designed for:
- Maximum traceability across architecture artifacts
- Flexibility to extend with Series Guides
- Alignment with agile and modern practices

## Core Entities

### Actor
A person, organization, or system **external** to the architecture model that interacts with it.

**Key characteristics:**
- External to the system being architected
- Interacts with the architecture through defined interfaces
- Assumes Roles to perform specific tasks
- Can be human (users, stakeholders) or non-human (external systems)

**Example:** A customer using an e-commerce platform, a regulatory body auditing compliance.

---

### Role
Defines the specific tasks an **Actor can undertake** within the architecture.

**Key characteristics:**
- An Actor assumes a Role to perform a task
- Provides abstraction layer between Actors and Functions
- Enables reusability of behavior definitions
- Multiple Actors can assume the same Role

**Example:** "Order Approver" role can be assumed by different Actors (Manager, Director, System).

---

### Organization Unit
A **self-contained unit of resources** with goals, objectives, and measures.

**Key characteristics:**
- Has line management responsibility
- Contains internal and external parties
- May include business partner organizations
- Owns and governs Business Services
- Contains Actors

**Example:** Product Development Division, Regional Sales Office, Partner Organization.

---

### Function
Delivers **business capabilities** closely aligned to an organization.

**Key characteristics:**
- Units of business capability at all levels of granularity
- Not necessarily explicitly governed (unlike Business Services)
- Can be decomposed into sub-functions
- Closely aligned to organizational structure

**Example:** Order Processing, Customer Onboarding, Financial Reporting.

---

### Business Service
Supports **business capabilities through a defined interface** and is governed by an organization.

**Key characteristics:**
- Explicitly defined interface
- Explicitly governed
- Acts as a boundary for one or more Functions
- Can be realized by Information System Services
- Has defined service levels and contracts

**Example:** "Account Opening Service" with defined SLAs offered to customers.

---

### Information System Service
The **automated elements** of a Business Service.

**Key characteristics:**
- Delivers or supports part/all of Business Services
- Implemented by Application Components
- Can be composed of other Information System Services
- Represents the IT capability supporting business

**Example:** REST API for account creation, batch processing service for reconciliation.

---

### Data Entity
An **encapsulation of data** recognized by business domain experts as a discrete concept.

**Key characteristics:**
- Business-meaningful data grouping
- Can be tied to applications, repositories, and services
- May be structured according to implementation considerations
- Foundation for data architecture

**Example:** Customer, Order, Product, Invoice, Contract.

---

### Application Component
An **encapsulation of application functionality** aligned to implementation structuring.

**Key characteristics:**
- Fundamental units supporting business capabilities
- May be logical (vendor-independent) or physical (specific product)
- Supports implementation of Information System Services
- Can communicate with other Application Components

**Example:** CRM Module, Payment Gateway, Inventory Management System.

---

### Technology Component
An **encapsulation of technology infrastructure**.

**Key characteristics:**
- Represents a class of technology product OR a specific product
- Forms technological building blocks
- Supports Application Components
- Can be logical (e.g., "Web Server") or physical (e.g., "Apache 2.4.x")

**Example:** Database Server, Message Queue, Container Runtime, Load Balancer.

---

### Platform Service
**Technical capability** required to provide enabling infrastructure for applications.

**Key characteristics:**
- Supports the delivery of applications
- Provides technical capabilities consumed by Application Components
- Represents infrastructure services
- Replaces "Technology Service" from TOGAF 9.2

**Example:** Identity Management Platform, API Gateway Service, Container Orchestration.

---

## Core Relationships

The TOGAF 10 Core Metamodel defines these fundamental relationships:

```
Organization Unit ──contains──► Actor
Actor ──assumes──► Role
Role ──performs──► Function
Function ──realized by──► Business Service
Business Service ──realized by──► Information System Service
Information System Service ──uses──► Data Entity
Information System Service ──implemented by──► Application Component
Application Component ──supported by──► Technology Component
Technology Component ──provides──► Platform Service
```

## Diagram: Core Metamodel

```
┌─────────────────┐
│Organization Unit│
└────────┬────────┘
         │ contains
         ▼
    ┌────────┐      ┌──────┐
    │ Actor  │─────►│ Role │
    └────────┘assumes└──┬───┘
                        │ performs
                        ▼
                  ┌──────────┐
                  │ Function │
                  └────┬─────┘
                       │ realized by
                       ▼
              ┌────────────────┐
              │Business Service│
              └───────┬────────┘
                      │ realized by
                      ▼
         ┌────────────────────────┐
         │Information System Svc  │◄────┐
         └───────────┬────────────┘     │
                     │                  │uses
        ┌────────────┴──────────┐       │
        │ implemented by        │       │
        ▼                       ▼       │
┌───────────────────┐    ┌─────────────┐
│Application Comp.  │    │ Data Entity │
└────────┬──────────┘    └─────────────┘
         │ supported by
         ▼
┌────────────────────┐
│Technology Component│
└────────┬───────────┘
         │ provides
         ▼
  ┌────────────────┐
  │Platform Service│
  └────────────────┘
```

## Mapping TOGAF 9.2 → TOGAF 10

| TOGAF 9.2 Entity | TOGAF 10 Equivalent | Notes |
|------------------|---------------------|-------|
| Actor | Actor | Unchanged |
| Role | Role | Unchanged |
| Organization Unit | Organization Unit | Unchanged |
| Function | Function | Unchanged |
| Business Service | Business Service | Unchanged |
| Information System Service | Information System Service | Unchanged |
| Data Entity | Data Entity | Unchanged |
| Logical Application Component | Application Component | Merged logical/physical |
| Physical Application Component | Application Component | Merged logical/physical |
| Logical Technology Component | Technology Component | Merged logical/physical |
| Physical Technology Component | Technology Component | Merged logical/physical |
| Technology Service | Platform Service | **Renamed** |
| Business Capability | → Function | Absorbed |
| Value Stream | → Business Service | Absorbed |
| Goal, Objective, Driver | → Series Guides | Moved to extensions |
| Process, Event, Control | → Series Guides | Moved to extensions |
| Contract, Measure, Service Quality | → Series Guides | Moved to extensions |
| Gap, Principle, Requirement | → Cross-cutting | Still available |
| Assumption, Constraint | → Cross-cutting | Still available |
| Location | → Cross-cutting | Still available |
| Work Package | → Series Guides | Moved to extensions |

## Extension Content

TOGAF 10's modular approach allows extending core entities through **Series Guides**:

### Business Architecture Guide
- Business Capability (detailed)
- Value Stream
- Value Proposition
- Business Model Canvas elements

### Information Architecture Guide
- Data Governance entities
- Master Data Management
- Data Quality dimensions

### Security Architecture Guide
- Security Domains
- Threat Actors
- Controls (extended)

### Digital Transformation Guide
- Digital Channels
- Customer Journeys
- Ecosystem Participants

## Implementation Recommendation

For SDD bundle implementation, we recommend:

1. **Start with TOGAF 10 Core** (10 entities)
   - Simpler to implement and validate
   - Covers essential EA concepts
   - Modern, agile-compatible

2. **Add extensions as needed**
   - Business capabilities from Business Architecture Guide
   - Security entities if required
   - Governance entities for mature EA practices

3. **Consider TOGAF 9.2 for completeness**
   - If organization uses TOGAF 9.2 certification
   - Need comprehensive cross-cutting relationships
   - Legacy EA repository migration
