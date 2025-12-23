# TOGAF 10 Official Definitions

Official definitions from the TOGAF® Standard, 10th Edition for use in creating SDD bundle schemas.

---

## Core Architecture Concepts

### Architecture
1. The fundamental concepts or properties of a system in its environment embodied in its elements, relationships, and in the principles of its design and evolution. *(Source: ISO/IEC/IEEE 42010: 2011)*
2. The structure of components, their inter-relationships, and the principles and guidelines governing their design and evolution over time.

### Architecture Domain
The architectural area being considered. The TOGAF framework follows the tradition of dividing Enterprise Architecture into **four primary architecture domains**:
- **Business**
- **Data**
- **Application**
- **Technology**

Other domains (motivation, security, governance, etc.) may span those four primary domains.

### Architecture Framework
A conceptual structure used to plan, develop, implement, govern, and sustain an architecture.

### Enterprise
The highest level (typically) of description of an organization and typically covers all missions and functions. An enterprise will often span multiple organizations.

---

## Entity Definitions (Official)

### Actor
A person, organization, or system that has one or more roles that initiates or interacts with activities; for example, a sales representative who travels to visit customers. Actors may be internal or external to an organization.

> *Note: In the automotive industry, an original equipment manufacturer would be considered an actor by an automotive dealership that interacts with its supply chain activities.*

### Role
1. The usual or expected behavior of an actor, or the part somebody or something plays in a particular process or event. An actor may have a number of roles.
2. The part an individual plays in an organization and the contribution they make through the application of their skills, knowledge, experience, and abilities.

### Business Capability
A particular ability that a business may possess or exchange to achieve a specific purpose.

### Business Function
A collection of business behavior based on a chosen set of criteria, closely aligned to an organization.

### Business Service
Supports the business by encapsulating a unique "element of business behavior". A service offered external to the enterprise may be supported by business services.

### Capability
An ability that an organization, person, or system possesses.

> *Note: This is a general-purpose definition. See Business Capability for how this concept is refined for business use.*

### Application Component 
An encapsulation of application functionality aligned to implementation structure, which is modular and replaceable. It encapsulates its behavior and data, provides services, and makes them available through interfaces.

> *Example: A business application such as an accounting, payroll, or CRM system.*
>
> *Note: An application component usually maintains a data component. It is enabled by technology services provided by technology components.*

### Application Service 
A discrete behavior requestable from an application; an automated element supporting or delivering part or all of one or more business services.

### Technology Component 
1. A technology building block. A generic infrastructure technology that supports and enables application or data components (directly or indirectly) by providing technology services.
2. An encapsulation of technology infrastructure that represents a class of technology product or specific technology product.

### Technology Service 
A technical capability required to provide enabling infrastructure that supports the delivery of applications.

---

## Architecture Work Products

### Artifact 
An architectural work product that describes an aspect of the architecture.

### Deliverable 
An architectural work product that is contractually specified and in turn formally reviewed, agreed, and signed off by the stakeholders.

> *Note: Deliverables represent the output of projects and those deliverables that are in documentation form will typically be archived at completion of a project, or transitioned into an Architecture Repository as a reference model, standard, or snapshot of the Architecture Landscape at a point in time.*

### Building Block 
A potentially re-usable component that can be combined with other building blocks to deliver architectures and solutions.

> *Note: Building blocks can be defined at various levels of detail, depending on what stage of architecture development has been reached. For instance, at an early stage, a building block can simply consist of a name or an outline description. Later on, a building block may be decomposed into multiple supporting building blocks and may be accompanied by a full specification. Building blocks can relate to "architectures" or "solutions".*

### Architecture Building Block (ABB) 
An architectural component that specifies the required Solution Building Blocks (SBBs) at a more logical (or supplier-independent) level.

### Solution Building Block (SBB) 
A physical or implementation-specific component that realizes part or all of one or more logical Architecture Building Blocks (ABBs).

> *Note: There are business, application, and technology SBBs.*

---

## Architecture Views and Viewpoints

### Architecture View 
A representation of a system from the perspective of a related set of concerns.

> *Note: In some sections of this standard, the term "view" is used as a synonym for "architecture view".*

### Architecture Viewpoint 
A specification of the conventions for a particular kind of architecture view.

> *Note: An architecture viewpoint can also be seen as the definition or schema for that kind of architecture view. It establishes the conventions for constructing, interpreting, and using an architecture view to address a specific concern (or set of concerns) about a system-of-interest.*

### Concern 
An interest in a system relevant to one or more of its stakeholders.

> *Note: Concerns may pertain to any aspect of the system's functioning, development, or operation, including considerations such as performance, reliability, security, distribution, and evolvability and may determine the acceptability of the system.*

### Stakeholder 
An individual, team, organization, or class thereof, having an interest in a system.

---

## Architecture Repository

### Architecture Repository 
A structured store for architecture artifacts, standards, and reference material.

### Architecture Landscape 
The architectural representation of assets in use, or planned, by the enterprise at particular points in time.

### Architecture Continuum 
A categorization mechanism, with increasing detail and specialization, for the components and artifacts stored in the Architecture Landscape or Reference Library (part of the Architecture Repository).

> *Note: This Continuum begins with foundational definitions like reference models, core strategies, and basic building blocks. From there it spans to Industry Architectures and all the way to an Organization-Specific Architecture.*

### Enterprise Continuum 
A categorization mechanism for classifying architecture and Solution Building Blocks (SBBs) as they evolve from generic to specific applicability (or vice versa).

### Solutions Continuum 
A categorization mechanism, with increasing detail and specialization, for the components and artifacts stored in the Solutions Landscape or Reference Library (part of the Architecture Repository).

---

## Governance and Management

### Governance 
The discipline of monitoring and guiding the management of a business (or IS/IT landscape) to deliver the business outcomes required.

### Architecture Governance 
The practice of monitoring and directing architecture-related work. The goal is to deliver desired outcomes and adhere to relevant principles, standards, and roadmaps.

### Business Governance 
Concerned with ensuring that the business processes and policies (and their operation) deliver the business outcomes and adhere to relevant business regulation.

---

## Architecture States

### Baseline 
A specification that has been formally reviewed and agreed upon, that thereafter serves as the basis for further development or change and that can be changed only through formal change control procedures or a type of procedure such as configuration management.

### Target Architecture 
The description of a future state of the architecture being developed for an organization.

> *Note: There may be several future states developed as a roadmap to show the evolution of the architecture to a target state.*

### Transition Architecture 
A formal description of one state of the architecture at an architecturally significant point in time.

> *Note: One or more Transition Architectures may be used to describe the progression in time from the Baseline to the Target Architecture.*

### Gap 
A statement of difference between two states. Used in the context of gap analysis, where the difference between the Baseline and Target Architecture is identified.

---

## Metamodel Concepts

### Metamodel 
A model that describes the entities used in building an Architecture Description, their characteristics, and the key relationships between those entities.

### Enterprise Metamodel 
The TOGAF Standard encourages development of an Enterprise Metamodel, which defines the types of entity to appear in the models that describe the enterprise, together with the relationships between these entities.

> *For example, one type in an Enterprise Metamodel might be Role. Then the enterprise's Business Architecture models might include such instances of Role as Teller, Pilot, Manager, Volunteer, Customer, or Firefighter.*

#### Value of Enterprise Metamodel 
An Enterprise Metamodel provides value in several ways:
- It gives architects a starter set of the types of thing to investigate and to cover in their models
- It provides a form of completeness-check for any architecture modeling language, or architecture metamodel, that is proposed for use in an enterprise
- It can help ensure:
  - Consistency
  - Completeness
  - Traceability

### Content Framework 
The Content Framework defines a categorization framework to be used to describe the building blocks and artifacts reflecting decisions taken in creating the overall architecture deliverables.

**The TOGAF Content Framework is intended to:**
- Provide a detailed model of architectural work products
- Drive consistency in the outputs created when following the ADM
- Provide a comprehensive checklist of architecture output that could be created
- Reduce the risk of gaps within the final architecture deliverable set
- Help an enterprise mandate standard architecture concepts, terms, and deliverables

---

## Additional Concepts

### Architecture Principle 
A qualitative statement of intent that should be met by the architecture.

### Architecture Vision 
A succinct description of the Target Architecture that describes its business value and the changes to the enterprise that will result from its successful deployment. It serves as an aspirational vision and a boundary for detailed architecture development.

### Requirement 
A statement of need, which is unambiguous, testable or measurable, and necessary for acceptability.

### Pattern 
A technique for putting building blocks into context; for example, to describe a re-usable solution to a problem.

> *Note: Building blocks are what you use: (architecture) patterns can tell you how you use them, when, why, and what trade-offs you have to make in doing so.*

### Reference Model 
An abstract framework for understanding significant relationships among the entities of [an] environment, and for the development of consistent standards or specifications supporting that environment.

> *Note: A reference model is based on a small number of unifying concepts and may be used as a basis for education and explaining standards to a non-specialist. A reference model is not directly tied to any standards, technologies, or other concrete implementation details, but it does seek to provide common semantics that can be used unambiguously across and between different implementations.*

### Roadmap 
An abstracted plan for business or technology change, typically operating across multiple disciplines over multiple years. Normally used in the phrases Technology Roadmap, Architecture Roadmap, etc.

### Value Stream 
A representation of an end-to-end collection of activities that create an overall result for a customer, stakeholder, or end user.

### Work Package 
A set of actions identified to achieve one or more objectives for the business. A work package can be a part of a project, a complete project, or a program.

---

## Abstraction Levels 

### Contextual Abstraction Level
The scope, context, and boundaries of the architecture.

### Conceptual Abstraction Level
High-level, abstract representations of the architecture.

### Logical Abstraction Level
Implementation-independent definition of the architecture.

### Physical Abstraction Level
Real-world, tangible implementations of the architecture.

---

## Architecture Domains Detailed

### Business Architecture 
A representation of holistic, multi-dimensional business views of: capabilities, end-to-end value delivery, information, and organizational structure; and the relationships among these business views and strategies, products, policies, processes, initiatives, and stakeholders.

### Data Architecture 
A description of the structure of the enterprise's major types and sources of data, logical data assets, physical data assets, and data management resources.

### Application Architecture 
A description of the structure and interaction of the applications that provide key business capabilities and manage the data assets.

### Technology Architecture 
A description of the structure and interaction of the technology services and technology components.

---

## Interoperability and Integration

### Interoperability 
1. The ability to share information and services.
2. The ability of two or more systems or components to exchange and use information.
3. The ability of systems to provide and receive services from other systems and to use the services so interchanged to enable them to operate effectively together.

### Boundaryless Information Flow™ 
A shorthand representation of "access to integrated information to support business process improvements" representing a desired state of an enterprise's infrastructure specific to the business needs of the organization.

---

## TOGAF Series Guides Referenced

The TOGAF 10 standard references numerous Series Guides for extended content:

| Guide | Topic |
|-------|-------|
| G176 | Business Scenarios |
| G178 | Value Streams |
| G184 | Leader's Guide to EA Capability |
| G186 | Practitioners' Approach to ADM |
| G211 | Business Capabilities, Version 2 |
| G18A | Business Models |
| G20F | Enabling Enterprise Agility |
| G152 | Integrating Risk and Security |
| G206 | Organization Mapping |
| G190 | Information Mapping |
| G21B | Customer Master Data Management |
| G212 | Digital Technology Adoption |

---

## Notes for SDD Bundle Implementation

Based on the official TOGAF 10 definitions, the core entities for an SDD bundle should include:

### Core Entities 
1. **Actor** (4.2) - External interacting parties
2. **Role** (4.66) - Behavior/contribution definitions
3. **Business Capability** (4.28) - Business abilities
4. **Business Function** (4.29) - Business behavior collections
5. **Business Service** (4.32) - Encapsulated business behavior
6. **Application Component** (4.5) - Application functionality encapsulation
7. **Application Service** (4.6) - Requestable application behavior
8. **Technology Component** (4.81) - Infrastructure technology
9. **Technology Service** (4.82) - Technical enabling capability

### Work Product Entities
10. **Artifact** (4.23) - Architectural work product
11. **Deliverable** (4.40) - Contractual work product
12. **Building Block** (4.26) - Reusable component (ABB/SBB)

### State Management Entities
13. **Baseline** (4.24) - Current state specification
14. **Target Architecture** (4.78) - Future state description
15. **Gap** (4.47) - Difference between states
16. **Transition Architecture** (4.83) - Intermediate state

### Governance Entities
17. **Requirement** (4.64) - Statement of need
18. **Architecture Principle** (4.19) - Qualitative intent
19. **Stakeholder** (4.75) - Interest holder
20. **Concern** (4.37) - Stakeholder interest

### Strategic Entities
21. **Value Stream** (4.84) - End-to-end value activities
22. **Roadmap** (4.65) - Change plan
23. **Work Package** (4.88) - Action set for objectives
