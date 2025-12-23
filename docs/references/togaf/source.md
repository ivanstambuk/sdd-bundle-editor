# TOGAF 9.2 Content v1.0 Metamodel - Source Content

> **Source:** https://pubs.opengroup.org/architecture/togaf9-doc/arch/chap30.html
> 
> **Note:** Content derived from The Open Group TOGAF 9.2 specification.

## Overview

TOGAF being the most popular Enterprise Architecture framework, its content metamodel can be helpful when describing enterprises and their digital twins.

The metamodel includes all prescribed objects and associations that comprise the TOGAF structure. Elements are color-coded by architecture domain:
- Business Architecture (yellow)
- Data Architecture (blue)
- Application Architecture (green)
- Technology Architecture (purple)

### Extension Modules

TOGAF splits the metamodel elements into various extensions, recommending inclusion or exclusion of specific subsections based on use cases:
- **Core** - Fundamental elements always included
- **Motivation** - Strategic motivation elements
- **Process** - Business process elements
- **Governance** - Governance and compliance
- **Services** - Service-oriented elements
- **Data** - Data architecture elements
- **Infrastructure Consolidation** - Physical/logical component mappings

### Object Attributes

The original content metamodel prescribes specific attributes to objects. When implementing as SDD schemas, these attributes should be captured in the JSON Schema `properties`.

---

## Objects

### Actor
A person, organization, or system that has a role that initiates or interacts with activities; for example, a sales representative who travels to visit customers. Actors may be internal or external to an organization. In the automotive industry, an original equipment manufacturer would be considered an actor by an automotive dealership that interacts with its supply chain activities. 
**Extension module: Core.**

### Assumption
A statement of probable fact that has not been fully validated at this stage, due to external constraints. For example, it may be assumed that an existing application will support a certain set of functional requirements, although those requirements may not yet have been individually validated. 
**Extension module: Core.**

### Business Capability
A particular ability that a business may possess or exchange to achieve a particular purpose. 
**Extension module: Core.**

### Business Service
Supports business capabilities through an explicitly defined interface and is explicitly governed by an organization. 
**Extension module: Core.**

### Capability
A business-focused outcome that is delivered by the completion of one or more work packages. Using a capability-based planning approach, change activities can be sequenced and grouped in order to provide continuous and incremental business value. 
**Extension module: Core.**

### Constraint
An external factor that prevents an organization from pursuing particular approaches to meet its goals. For example, customer data is not harmonized within the organization, regionally or nationally, constraining the organization's ability to offer effective customer service. 
**Extension module: Core.**

### Contract
An agreement between a service consumer and a service provider that establishes functional and non-functional parameters for interaction. 
**Extension module: Governance.**

### Control
A decision-making step with accompanying decision logic used to determine execution approach for a process or to ensure that a process complies with governance criteria. For example, a sign-off control on the purchase request processing process that checks whether the total value of the request is within the sign-off limits of the requester, or whether it needs escalating to higher authority. 
**Extension module: Process.**

### Course of Action
Direction and focus provided by strategic goals and objectives, often to deliver the value proposition characterized in the business model. 
**Extension module: Core.**

### Data Entity
An encapsulation of data that is recognized by a business domain expert as a thing. Logical data entities can be tied to applications, repositories, and services and may be structured according to implementation considerations. 
**Extension module: Core.**

### Driver
An external or internal condition that motivates the organization to define its goals. An example of an external driver is a change in regulation or compliance rules which, for example, require changes to the way an organization operates; i.e., Sarbanes-Oxley in the US. 
**Extension module: Motivation.**

### Event
An organizational state change that triggers processing events; may originate from inside or outside the organization and may be resolved inside or outside the organization. 
**Extension module: Process.**

### Function
Delivers business capabilities closely aligned to an organization, but not necessarily explicitly governed by the organization. Also referred to as "business function". 
**Extension module: Core.**

### Gap
A statement of difference between two states. Used in the context of gap analysis, where the difference between the Baseline and Target Architecture is identified. 
**Extension module: Core.**

### Goal
A high-level statement of intent or direction for an organization. Typically used to measure success of an organization. 
**Extension module: Motivation.**

### Information System Service
The automated elements of a business service. An information system service may deliver or support part or all of one or more business services. 
**Extension module: Services.**

### Location
A place where business activity takes place and can be hierarchically decomposed. 
**Extension module: Core.**

### Logical Application Component
An encapsulation of application functionality that is independent of a particular implementation. For example, the classification of all purchase request processing applications implemented in an enterprise. 
**Extension module: Core.**

### Logical Data Component
A boundary zone that encapsulates related data entities to form a logical location to be held; for example, external procurement information. 
**Extension module: Data.**

### Logical Technology Component
An encapsulation of technology infrastructure that is independent of a particular product. A class of technology product; for example, supply chain management software as part of an Enterprise Resource Planning (ERP) suite, or a Commercial Off-The-Shelf (COTS) purchase request processing enterprise service. 
**Extension module: Infrastructure Consolidation.**

### Measure
An indicator or factor that can be tracked, usually on an ongoing basis, to determine success or alignment with objectives and goals. 
**Extension module: Governance.**

### Objective
A time-bounded milestone for an organization used to demonstrate progress towards a goal; for example, "Increase capacity utilization by 30% by the end of 2019 to support the planned increase in market share". 
**Extension module: Motivation.**

### Organization Unit
A self-contained unit of resources with goals, objectives, and measures. Organization units may include external parties and business partner organizations. 
**Extension module: Core.**

### Physical Application Component
An application, application module, application service, or other deployable component of functionality. For example, a configured and deployed instance of a Commercial Off-The-Shelf (COTS) Enterprise Resource Planning (ERP) supply chain management application. 
**Extension module: Infrastructure Consolidation.**

### Physical Data Component
A boundary zone that encapsulates related data entities to form a physical location to be held. For example, a purchase order business object, comprising purchase order header and item business object nodes. 
**Extension module: Data.**

### Physical Technology Component
A specific technology infrastructure product or technology infrastructure product instance. For example, a particular product version of a Commercial Off-The-Shelf (COTS) solution, or a specific brand and version of server. 
**Extension module: Core.**

### Principle
A qualitative statement of intent that should be met by the architecture. Has at least a supporting rationale and a measure of importance. 
**Extension module: Core.**

### Process
A process represents flow of control between or within functions and/or services (depends on the granularity of definition). Processes represent a sequence of activities that together achieve a specified outcome, can be decomposed into sub-processes, and can show operation of a function or service (at next level of detail). Processes may also be used to link or compose organizations, functions, services, and processes. 
**Extension module: Core.**

### Product
Output generated by the business. The business product of the execution of a process. 
**Extension module: Process.**

### Requirement
A quantitative statement of business need that must be met by a particular architecture or work package. 
**Extension module: Core.**

### Role
The usual or expected function of an actor, or the part somebody or something plays in a particular action or event. An actor may have a number of roles. 
**Extension module: Core.**

### Service Quality
A preset configuration of non-functional attributes that may be assigned to a service or service contract. 
**Extension module: Governance.**

### Technology Service
A technical capability required to provide enabling infrastructure that supports the delivery of applications. 
**Extension module: Core.**

### Value Stream
A representation of an end-to-end collection of value-adding activities that create an overall result for a customer, stakeholder, or end-user. 
**Extension module: Core.**

### Work Package
A set of actions identified to achieve one or more objectives for the business. A work package can be a part of a project, a complete project, or a program. 
**Extension module: Core.**

---

## Associations

### Actor Relationships

- **Actor::Generates (Event) <-> Event::Is generated by (Actor)**
  - Extension module: Process.

- **Actor::Resolves (Event) <-> Event::Is resolved by (Actor)**
  - Extension module: Process.

- **Actor::Interacts with (Function) <-> Function::Supports (Actor)**
  - Extension module: Core.

- **Actor::Performs (Function) <-> Function::Is performed by (Actor)**
  - Extension module: Core.

- **Actor::Participates in (Value Stream) <-> Value Stream::Involves (Actor)**
  - Extension module: Core.

- **Actor::Triggers (Value Stream) <-> Value Stream::Is triggered by (Actor)**
  - Extension module: Core.

- **Actor::Performs task in (Role) <-> Role::Is performed by (Actor)**
  - Extension module: Core.

- **Actor::Consumes (Business Service) <-> Business Service::Is provided to (Actor)**
  - Extension module: Core.

- **Actor::Decomposes (Actor) <-> Actor::Is decomposed by (Actor)**
  - Extension module: Core.

- **Actor::Supplies or consumes (Data Entity) <-> Data Entity::Is supplied or consumed by (Actor)**
  - Extension module: Core.

### Business Capability Relationships

- **Business Capability::Enables (Value Stream) <-> Value Stream::Is enabled by (Business Capability)**
  - Extension module: Core.

### Contract Relationships

- **Contract::Governs and measures (Business Service) <-> Business Service::Is governed and measured by (Contract)**
  - Extension module: Governance.

### Control Relationships

- **Control::Ensures correct operation of (Process) <-> Process::Is guided by (Control)**
  - Extension module: Process.

### Course of Action Relationships

- **Course of Action::Influences (Business Capability) <-> Business Capability::Is influenced by (Course of Action)**
  - Extension module: Core.

- **Course of Action::Realizes (Goal) <-> Goal::Is realized by (Course of Action)**
  - Extension module: Motivation.

- **Course of Action::Influences (Function) <-> Function::Is influenced by (Course of Action)**
  - Extension module: Core.

- **Course of Action::Influences (Value Stream) <-> Value Stream::Is influenced by (Course of Action)**
  - Extension module: Core.

### Data Entity Relationships

- **Data Entity::Uses (Information System Service) <-> Information System Service::Used by (Data Entity)**
  - Extension module: Services.

- **Data Entity::Decomposes (Data Entity) <-> Data Entity::Is decomposed by (Data Entity)**
  - Extension module: Core.

- **Data Entity::Relates to (Data Entity) <-> Data Entity::Is related to (Data Entity)**
  - Extension module: Core.

### Driver Relationships

- **Driver::Creates (Goal) <-> Goal::Addresses (Driver)**
  - Extension module: Motivation.

- **Driver::Motivates (Organization Unit) <-> Organization Unit::Is motivated by (Driver)**
  - Extension module: Motivation.

- **Driver::Decomposes (Driver) <-> Driver::Is decomposed by (Driver)**
  - Extension module: Motivation.

### Function Relationships

- **Function::Delivers (Business Capability) <-> Business Capability::Is delivered by (Function)**
  - Extension module: Core.

- **Function::Decomposes (Function) <-> Function::Is decomposed by (Function)**
  - Extension module: Core.

- **Function::Communicates with (Function) <-> Function::Is communicated by (Function)**
  - Extension module: Core.

### Goal Relationships

- **Goal::Decomposes (Goal) <-> Goal::Is decomposed by (Goal)**
  - Extension module: Motivation.

### Information System Service Relationships

- **Information System Service::Realizes (Business Service) <-> Business Service::Is realized through (Information System Service)**
  - Extension module: Services.

### Logical Application Component Relationships

- **Logical Application Component::Implements (Business Service) <-> Business Service::Is realized through (Logical Application Component)**
  - Extension module: Core.

- **Logical Application Component::Decomposes (Logical Application Component) <-> Logical Application Component::Is decomposed by (Logical Application Component)**
  - Extension module: Core.

- **Logical Application Component::Communicates with (Logical Application Component) <-> Logical Application Component::Is communicated by (Logical Application Component)**
  - Extension module: Core.

- **Logical Application Component::Implements (Information System Service) <-> Information System Service::Is realized through (Logical Application Component)**
  - Extension module: Services.

### Logical Data Component Relationships

- **Logical Data Component::Uses (Logical Application Component) <-> Logical Application Component::Used by (Logical Data Component)**
  - Extension module: Data.

- **Logical Data Component::Encapsulates (Data Entity) <-> Data Entity::Resides within (Logical Data Component)**
  - Extension module: Data.

### Logical Technology Component Relationships

- **Logical Technology Component::Serves (Logical Application Component) <-> Logical Application Component::Is served by (Logical Technology Component)**
  - Extension module: Infrastructure Consolidation.

- **Logical Technology Component::Supplies (Technology Service) <-> Technology Service::Is supplied by (Logical Technology Component)**
  - Extension module: Core.

- **Logical Technology Component::Provides platform for (Business Service) <-> Business Service::Is implemented on (Logical Technology Component)**
  - Extension module: Core.

- **Logical Technology Component::Decomposes (Logical Technology Component) <-> Logical Technology Component::Is decomposed by (Logical Technology Component)**
  - Extension module: Core.

- **Logical Technology Component::Is dependent on (Logical Technology Component) <-> Logical Technology Component::Is depended by (Logical Technology Component)**
  - Extension module: Core.

### Measure Relationships

- **Measure::Sets performance criteria for (Objective) <-> Objective::Is tracked against (Measure)**
  - Extension module: Governance.

- **Measure::Sets performance criteria for (Business Service) <-> Business Service::Is tracked against (Measure)**
  - Extension module: Governance.

- **Measure::Decomposes (Measure) <-> Measure::Is decomposed by (Measure)**
  - Extension module: Governance.

### Objective Relationships

- **Objective::Realizes (Goal) <-> Goal::Is realized through (Objective)**
  - Extension module: Motivation.

- **Objective::Decomposes (Objective) <-> Objective::Is decomposed by (Objective)**
  - Extension module: Motivation.

### Organization Unit Relationships

- **Organization Unit::Contains (Actor) <-> Actor::Belongs to (Organization Unit)**
  - Extension module: Core.

- **Organization Unit::Uses (Business Capability) <-> Business Capability::Used by (Organization Unit)**
  - Extension module: Core.

- **Organization Unit::Owns (Function) <-> Function::Is owned by (Organization Unit)**
  - Extension module: Core.

- **Organization Unit::Produces (Product) <-> Product::Is produced by (Organization Unit)**
  - Extension module: Process.

- **Organization Unit::Participates in (Process) <-> Process::Involves (Organization Unit)**
  - Extension module: Core.

- **Organization Unit::Owns and governs (Business Service) <-> Business Service::Is owned and governed by (Organization Unit)**
  - Extension module: Core.

- **Organization Unit::Decomposes (Organization Unit) <-> Organization Unit::Is decomposed by (Organization Unit)**
  - Extension module: Core.

### Physical Application Component Relationships

- **Physical Application Component::Realizes (Logical Application Component) <-> Logical Application Component::Is realized by (Physical Application Component)**
  - Extension module: Infrastructure Consolidation.

- **Physical Application Component::Decomposes (Physical Application Component) <-> Physical Application Component::Is decomposed by (Physical Application Component)**
  - Extension module: Core.

- **Physical Application Component::Communicates with (Physical Application Component) <-> Physical Application Component::Is communicated by (Physical Application Component)**
  - Extension module: Core.

### Physical Data Component Relationships

- **Physical Data Component::Realizes (Logical Data Component) <-> Logical Data Component::Is realized by (Physical Data Component)**
  - Extension module: Data.

- **Physical Data Component::Decomposes (Physical Data Component) <-> Physical Data Component::Is decomposed by (Physical Data Component)**
  - Extension module: Core.

- **Physical Data Component::Uses (Physical Application Component) <-> Physical Application Component::Used by (Physical Data Component)**
  - Extension module: Data.

### Physical Technology Component Relationships

- **Physical Technology Component::Serves (Physical Application Component) <-> Physical Application Component::Is served by (Physical Technology Component)**
  - Extension module: Core.

- **Physical Technology Component::Realizes (Logical Application Component) <-> Logical Technology Component::Is realized by (Physical Technology Component)**
  - Extension module: Infrastructure Consolidation.

- **Physical Technology Component::Decomposes (Physical Technology Component) <-> Physical Technology Component::Is decomposed by (Physical Technology Component)**
  - Extension module: Core.

- **Physical Technology Component::Is dependent on (Physical Technology Component) <-> Physical Technology Component::Is depended by (Physical Technology Component)**
  - Extension module: Core.

### Process Relationships

- **Process::Operationalizes (Business Capability) <-> Business Capability::Is operationalized by (Process)**
  - Extension module: Core.

- **Process::Generates (Event) <-> Event::Is generated by (Process)**
  - Extension module: Process.

- **Process::Resolves (Event) <-> Event::Is resolved by (Process)**
  - Extension module: Process.

- **Process::Orchestrates (Function) <-> Function::Supports (Process)**
  - Extension module: Core.

- **Process::Decomposes (Function) <-> Function::Is realized by (Process)**
  - Extension module: Core.

- **Process::Produces (Product) <-> Product::Is produced by (Process)**
  - Extension module: Process.

- **Process::Orchestrates (Business Service) <-> Business Service::Supports (Process)**
  - Extension module: Core.

- **Process::Decomposes (Business Service) <-> Business Service::Is realized by (Process)**
  - Extension module: Core.

- **Process::Operationalizes (Value Stream) <-> Value Stream::Is operationalized by (Process)**
  - Extension module: Core.

- **Process::Decomposes (Process) <-> Process::Is decomposed by (Process)**
  - Extension module: Core.

- **Process::Precedes (Process) <-> Process::Follows (Process)**
  - Extension module: Core.

### Role Relationships

- **Role::Participates in (Process) <-> Process::Involves (Role)**
  - Extension module: Core.

- **Role::Performs (Process) <-> Process::Is performed by (Role)**
  - Extension module: Core.

- **Role::Decomposes (Role) <-> Role::Is decomposed by (Role)**
  - Extension module: Core.

### Business Service Relationships

- **Business Service::Provides (Data Entity) <-> Data Entity::Is provided by (Business Service)**
  - Extension module: Core.

- **Business Service::Consumes (Data Entity) <-> Data Entity::Is consumed by (Business Service)**
  - Extension module: Core.

- **Business Service::Resolves (Event) <-> Event::Is resolved by (Business Service)**
  - Extension module: Process.

- **Business Service::Provides governed interface to access (Function) <-> Function::Is bounded by (Business Service)**
  - Extension module: Core.

- **Business Service::Consumes (Business Service) <-> Business Service::Is consumed by (Business Service)**
  - Extension module: Core.

- **Business Service::Decomposes (Business Service) <-> Business Service::Is decomposed by (Business Service)**
  - Extension module: Core.

### Service Quality Relationships

- **Service Quality::Applies to (Contract) <-> Contract::Meets (Service Quality)**
  - Extension module: Governance.

- **Service Quality::Applies to (Business Service) <-> Business Service::Meets (Service Quality)**
  - Extension module: Governance.

### Technology Service Relationships

- **Technology Service::Serves (Information System Service) <-> Information System Service::Is served by (Technology Service)**
  - Extension module: Services.

### Work Package Relationships

- **Work Package::Delivers (Capability) <-> Capability::Is delivered by (Work Package)**
  - Extension module: Core.

---

## Cross-Cutting Associations

Every primary object type can have the following cross-cutting relationships:

- **[Object]::Principle(s) <-> Principle::Applies to ([Object])**
- **[Object]::Constraint(s) <-> Constraint::Applies to ([Object])**
- **[Object]::Assumption(s) <-> Assumption::Applies to ([Object])**
- **[Object]::Requirement(s) <-> Requirement::Applies to ([Object])**
- **[Object]::Location(s) <-> Location::Applies to ([Object])**
- **[Object]::Gap(s) <-> Gap::Applies to ([Object])**
- **[Object]::Work Package(s) <-> Work Package::Applies to ([Object])**

Objects that support these cross-cutting associations:
- Actor
- Business Capability
- Contract (Governance module)
- Control (Process module)
- Course of Action
- Data Entity
- Driver (Motivation module)
- Event (Process module)
- Function
- Goal (Motivation module)
- Information System Service (Services module)
- Logical Application Component
- Logical Data Component (Data module)
- Logical Technology Component (Infrastructure Consolidation module)
- Measure (Governance module)
- Objective (Motivation module)
- Organization Unit
- Physical Application Component (Infrastructure Consolidation module)
- Physical Data Component (Data module)
- Physical Technology Component
- Process
- Product (Process module)
- Role
- Service Quality (Governance module)
- Technology Service
- Value Stream

---

## See Also

- [TOGAF 9.2 Content Metamodel - The Open Group](https://pubs.opengroup.org/architecture/togaf9-doc/arch/chap30.html)
- [TOGAF Standard](https://www.opengroup.org/togaf)
