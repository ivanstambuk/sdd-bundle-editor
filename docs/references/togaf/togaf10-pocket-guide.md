# TOGAF 10 ADM Deliverables and Terminology

Reference data for ADM deliverables, terminology, and techniques from the TOGAF® Standard, 10th Edition.

---

## ADM Deliverables

The ADM produces specific deliverables at each phase. These represent the core work products of Enterprise Architecture.

### Deliverables by ADM Phase

| ADM Phase | Key Deliverables |
|-----------|------------------|
| **Preliminary** | Tailored Architecture Framework, Organizational Model for EA, Architecture Principles, Business Principles/Goals/Drivers, Request for Architecture Work |
| **Phase A** | Statement of Architecture Work, Architecture Vision, Communications Plan, Capability Assessment, Architecture Definition Document (draft) |
| **Phase B** | Architecture Definition Document (Business), Architecture Requirements Specification, Architecture Roadmap, Architecture Building Blocks |
| **Phase C** | Architecture Definition Document (Data & Application), Architecture Requirements Specification, Architecture Roadmap, Architecture Building Blocks |
| **Phase D** | Architecture Definition Document (Technology), Architecture Requirements Specification, Architecture Roadmap, Architecture Building Blocks |
| **Phase E** | Architecture Definition Document (updated), Architecture Building Blocks, Architecture Roadmap, Solution Building Blocks, Implementation and Migration Plan, Transition Architecture |
| **Phase F** | Architecture Roadmap (finalized), Implementation and Migration Plan (finalized), Transition Architecture, Implementation Governance Model |
| **Phase G** | Implementation Governance Model, Architecture Contracts, Change Request, Compliance Assessment |
| **Phase H** | Architecture updates, Changes to framework/principles, New Request for Architecture Work, Statement of Architecture Work (updated) |
| **Requirements Management** | Architecture Requirements Specification, Requirements Impact Assessment |

---

## Key Deliverable Definitions

### Tailored Architecture Framework
Contents:
- Tailored architecture method
- Tailored architecture content (deliverables and artifacts)
- Configured and deployed tools
- Interfaces with governance models and other frameworks:
  - Corporate Business Planning
  - Enterprise Architecture
  - Portfolio, Program, Project Management
  - System Development/Engineering
  - Operations (Services)

### Organizational Model for Enterprise Architecture
Contents:
- Scope of organizations impacted
- Maturity assessment, gaps, and resolution approach
- Roles and responsibilities for architecture team(s)
- Constraints on architecture work
- Budget requirements
- Governance and support strategy

### Architecture Principles
Template for defining principles:

| Element | Description |
|---------|-------------|
| **Name** | Essence of the rule, easy to remember |
| **Statement** | Succinct, unambiguous communication of the fundamental rule |
| **Rationale** | Business benefits using business terminology |
| **Implications** | Requirements for carrying out the principle (resources, costs, activities) |

Quality criteria: Completeness, Robustness, Understandability, Consistency, Stability

### Request for Architecture Work
Contents:
- Organization sponsors
- Organization's mission statement
- Business goals (and changes)
- Strategic plans of the business
- Time limits
- Changes in the business environment
- Organizational constraints
- Budget information, financial constraints
- External constraints, business constraints
- Current business system description
- Current architecture/IT system description
- Description of developing organization
- Description of resources available

### Statement of Architecture Work
Contents:
- Title
- Architecture Project request and background
- Architecture Project description and scope
- Overview of Architecture Vision
- Specific change of scope procedures
- Roles, responsibilities, and deliverables
- Acceptance criteria and procedures
- Architecture Project plan and schedule
- Approvals

### Architecture Vision
Contents:
- Problem description:
  - Stakeholders and their concerns
  - List of issues/scenarios to be addressed
- Objective of the Statement of Architecture Work
- Summary views for Business, Data, Application, and Technology Architectures
- Mapped requirements
- Reference to the Draft Architecture Definition Document

### Communications Plan
Contents:
- Identification of stakeholders and grouping by communication requirements
- Identification of communication needs, key messages, risks, and CSFs
- Identification of communication mechanisms (meetings, newsletters, repositories)
- Identification of communication timetable

### Capability Assessment
Contents:
- **Business Capability Assessment:**
  - Capabilities of the business
  - Baseline state assessment of performance level
  - Future state aspiration for performance level
  - Baseline/future state of how capability is realized
  - Assessment of impacts to business organization
- **IT Capability Assessment:**
  - Baseline and target maturity level of change process
  - Baseline and target maturity level of operational processes
  - Baseline capability and capacity assessment
  - Assessment of impacts to IT organization
- **Architecture Maturity Assessment:**
  - Architecture Governance processes, organization, roles, responsibilities
  - Architecture skills assessment
  - Breadth, depth, quality of landscape/standards/reference models
  - Assessment of re-use potential
- **Business Transformation Readiness Assessment:**
  - Readiness factors
  - Vision for each readiness factor
  - Current and target readiness ratings
  - Readiness risks

### Architecture Definition Document
The main deliverable container for core architectural artifacts.

Contents:
- Scope
- Goals, objectives, and constraints
- Architecture Principles
- Baseline Architecture
- Architecture models (Business, Data, Application, Technology)
- Rationale and justification for architectural approach
- Mapping to Architecture Repository (Landscape, reference models, standards)
- Re-use assessment
- Gap analysis
- Impact assessment
- Transition Architecture

#### 7.10.1 Business Architecture Section
- Baseline Business Architecture
- Target Business Architecture:
  - Organization structure
  - Business goals and objectives
  - Business functions
  - Business capabilities
  - Business services
  - Products
  - Business processes (with measures and deliverables)
  - Business roles (including skills requirements)
  - Business data model
  - Correlation of organization and functions

#### 7.10.2 Information Systems Architectures Section
- Baseline/Target Data Architecture:
  - Business data model
  - Logical data model
  - Data management process models
  - Data Entity/Business Function matrix
- Baseline/Target Application Architecture
- Corresponding views for stakeholder concerns

#### 7.10.3 Technology Architecture Section
- Baseline/Target Technology Architecture:
  - Technology components and relationships to information systems
  - Technology platforms and decomposition ("stack")
  - Environments and locations
  - Expected processing load and distribution
  - Physical (network) communications
  - Hardware and network specifications

### Architecture Requirements Specification
Quantitative statements for implementation compliance.

Contents:
- Success measures
- Architecture requirements
- Business service contracts
- Application service contracts
- Implementation guidelines
- Implementation specifications
- Implementation standards
- Interoperability requirements
- IT service management requirements
- Constraints
- Assumptions

### Architecture Roadmap
Contents:
- Work package portfolio
- Implementation Factor Catalog
- Consolidated Gaps, Solutions, and Dependencies Matrix
- Capability increments
- Transition Architectures (timeline)
- Implementation recommendations:
  - Criteria/measures of effectiveness
  - Risks and issues
  - SBBs

### Architecture Building Blocks (ABBs)
Architecture documentation and models from the Architecture Repository.

Characteristics:
- Capture architecture requirements (business, data, application, technology)
- Direct and guide development/procurement of SBBs

Specification contents (minimum):
- Fundamental functionality and attributes (semantics, security, manageability)
- Interfaces (APIs, data formats, protocols, hardware interfaces, standards)
- Interoperability and relationship with other building blocks
- Dependent building blocks with required functionality

### Solution Building Blocks (SBBs)
Implementation choices from the Solutions Continuum.

Specification contents (minimum):
- Specific functionality and attributes
- Interfaces (the implemented set)
- Required SBBs used with functionality and interface names
- Mapping from SBBs to IT topology and operational policies
- Specifications of attributes (security, manageability, localizability, scalability)
- Performance, configurability
- Design drivers and constraints (including physical architecture)
- Relationships between SBBs and ABBs

### Implementation and Migration Plan
Contents:
- **Implementation and Migration Strategy:**
  - Strategic implementation direction
  - Implementation sequencing approach
- **Project and portfolio breakdown:**
  - Allocation of work packages to project/portfolio
  - Capabilities delivered by projects
  - Milestones and timing
  - Work breakdown structure
  - Impact on existing portfolio, program, projects
- **May contain:**
  - Project charters (work packages, business value, risks/issues/assumptions)
  - Resource requirements and costs
  - Benefits of migration
  - Estimated costs of migration options

### Transition Architecture
For incremental implementation approaches.

Contents:
- Definition of transition states
- Business Architecture for each transition state
- Data Architecture for each transition state
- Application Architecture for each transition state
- Technology Architecture for each transition state

### Implementation Governance Model
Contents:
- Governance processes
- Governance organization structure
- Governance roles and responsibilities
- Governance checkpoints and success/failure criteria

### Architecture Contracts
Joint agreements on deliverables, quality, and fitness-for-purpose.

### Change Request
Contents:
- Description of the proposed change
- Rationale for the proposed change
- Impact assessment of the proposed change
- Recommendations

### Compliance Assessment
Compliance of a project to the architecture.

### Requirements Impact Assessment
Contents:
- Reference to specific requirements
- Phases to be revisited
- Phase and activities impacted
- Results of phase investigations and revised priorities
- Recommendations on management of requirements
- Repository reference number

---

## Glossary Definitions 

### Agile Architecture
1. **The "act"** – the development of architecture that reacts quickly and easily to changes through delivery of iterative architectures providing incremental value-generating outcomes
2. **The "thing"** – an architecture that is flexible; easy to change or adapt

### Application Architecture
A description of the structure and interaction of the applications as groups of capabilities that provide key business functions and manage the data assets.

### Architecture
1. The fundamental concepts or properties of a system in its environment embodied in its elements, relationships, and in the principles of its design and evolution
2. The structure of components, their inter-relationships, and the principles and guidelines governing their design and evolution over time

### Architecture Building Block (ABB)
A constituent of the architecture model that describes a single aspect of the overall model.

### Architecture Continuum
A part of the Enterprise Continuum. A repository of architectural elements with increasing detail and specialization.

### Architecture Project
An endeavor undertaken to define and describe the Enterprise Architecture to be implemented. Encompasses all activities within ADM Phases A to F and Requirements Management.

### Business Architecture
A representation of holistic, multi-dimensional business views of: capabilities, end-to-end value delivery, information, and organizational structure; and the relationships among these business views and strategies, products, policies, initiatives, and stakeholders.

### Capability
An ability that an organization, person, or system possesses.

### Capability Architecture
A highly detailed description of the architectural approach to realize a particular solution or solution aspect.

### Data Architecture
A description of the structure and interaction of the enterprise's major types and sources of data, logical data assets, physical data assets, and data management resources.

### Enterprise
The highest level (typically) of description of an organization and typically covers all missions and functions. An enterprise will often span multiple organizations.

### Enterprise Architecture
1. The process of translating business vision and strategy into effective enterprise change (Source: Gartner®)
2. A set of abstractions and models that simplify and communicate complex structures, processes, rules, and constraints (Source: DoDAF)

### Gap
A statement of difference between two states. Used in gap analysis, where the difference between the Baseline and Target Architecture is identified.

### Metamodel
A model that describes how and with what the architecture will be described in a structured way.

### Minimum Viable Architecture (MVA)
The minimum (Enterprise) Architecture that is realizable and adds business value. An architecture that enables delivery of product features with just enough content to be deployed in a given phase.

### Practitioner
The person tasked to develop, maintain, and use an Enterprise Architecture.

### Product
An outcome generated by the business to be offered to customers. Products include materials and/or services.

### Requirement
A statement of need that must be met by a particular architecture or work package.

### Segment Architecture
A detailed, formal description of areas within an enterprise, used at the program or portfolio level to organize and align change activity.

### Service
A repeatable activity; a discrete behavior that a building block may be requested or otherwise triggered to perform.

### Solution Building Block (SBB)
A candidate solution which conforms to the specification of an Architecture Building Block (ABB).

### Technology Architecture
A description of the structure and interaction of the technology services, and logical and physical technology components.

### Transition Architecture
A formal description of one state of the architecture at an architecturally significant point in time.

### Value Stream
A representation of an end-to-end collection of value-adding activities that create an overall result for a customer, stakeholder, or end user.

### Work Package
A set of actions identified to achieve one or more objectives for the business. A work package can be a part of a project, a complete project, or a program.

---

## ADM Techniques Summary

### Stakeholder Management
Identify key players, update throughout each phase. Output forms start of Communications Plan.

### Gap Analysis
Matrix-based technique comparing Baseline ABBs vs Target ABBs. Mark as "Included", "New", or "Eliminated".

### Risk Management Activities
1. Risk classification
2. Risk identification
3. Initial risk assessment
4. Risk mitigation and residual risk assessment
5. Risk monitoring

### Migration Planning Techniques

#### Implementation Factor Catalog
| Factor | Description | Deduction |
|--------|-------------|-----------|
| Name | Description of Factor | Impact on Migration Plan |

#### Consolidated Gaps, Solutions, and Dependencies Matrix
Groups gaps, assesses potential solutions and dependencies.

#### Architecture Definition Increments Table
Plans series of Transition Architectures with project deliverables.

#### Transition Architecture State Evolution Table
Shows proposed state of architectures using enterprise taxonomy.

#### Business Value Assessment Matrix
Value Index vs Risk Index dimensions for project assessment.

---

## Architecture Levels (Partitioning)

| Level | Description | Scope |
|-------|-------------|-------|
| **Strategic Architecture** | Executive-level direction setting | Enterprise-wide |
| **Segment Architecture** | Program/portfolio level organizing | Program/Portfolio |
| **Capability Architecture** | Detailed change activity | Capability increments |

---

## Key Relationships for SDD Bundle

Based on this Pocket Guide, a TOGAF SDD bundle should capture:

### Deliverable Entities
- Request for Architecture Work
- Statement of Architecture Work
- Architecture Vision
- Architecture Definition Document
- Architecture Requirements Specification
- Architecture Roadmap
- Implementation and Migration Plan
- Transition Architecture
- Architecture Contract
- Change Request
- Compliance Assessment
- Capability Assessment
- Communications Plan

### Building Block Entities
- Architecture Building Block (ABB)
- Solution Building Block (SBB)

### Governance Entities
- Architecture Principle
- Architecture Contract
- Implementation Governance Model
- Compliance Assessment

### State Entities
- Baseline Architecture
- Target Architecture
- Transition Architecture
- Gap

### Work Management Entities
- Work Package
- Capability Increment
- Project
- Program
- Portfolio

### Stakeholder Entities
- Stakeholder
- Concern
- Requirement
