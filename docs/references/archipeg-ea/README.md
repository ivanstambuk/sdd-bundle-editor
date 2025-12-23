# Enterprise Architecture Framework Metamodel

## Overview

A comprehensive Enterprise Architecture framework covering business, data, application, and technology domains with concrete, practical concepts.

## Key Concepts

The framework is organized into seven architectural domains:

### Business Architecture
1. **Business - Company Related** - Internal structure and processes (branches, business processes)
2. **Business - Customer Related** - Customer-facing landscape (contracts, end-users, products)
3. **Business - People Related** - Employee environment (roles, teams, activities)
4. **Business - Cross-Cutting** - Cross-cutting concepts (locations)

### Information Systems Architecture
5. **Information Systems - Data** - Data objects and associations
6. **Information Systems - Applications** - Applications and related concepts

### Technology Architecture
7. **Technology** - Supporting infrastructure (equipment, third-party software, servers)

## Entity Types (Objects)

### Business Domain

| Entity | Description |
|--------|-------------|
| Company | Root object describing the company as an enterprise |
| Branch | Branch or outlet of a Company |
| Solution | Highest-level solution provided to Customers |
| Business Process | Business process composed of Business Activities |
| Business Activity | Activity or collaboration following a Business Process |
| Capability | High-level functional capability, part of a Solution |
| Feature | Lowest-level functional or technical feature |
| Customer | Company's customer (typically an organization) |
| Contract | Agreement between parties for goods or services |
| End User | Individual utilizing Applications, Products, or Services |
| Employee | Individual working for the Company |
| Employee Role | Classification of Employee's role (Developer, Sales, etc.) |
| Team | Group of employees performing unified tasks |
| Product | Product offering provided to Customers |
| Service | Service offering provided to Customers |
| Vendor | Supplier of goods and services |
| Location | Physical or virtual location |

### Information Systems Domain

| Entity | Description |
|--------|-------------|
| Data Object | Cohesive piece of information for communication or processing |
| Application | Software offering produced for Customers |
| Application Component | Physical or conceptual subset; separately deployable unit |
| Application Technology | Digital product enabling Application building (frameworks, libraries) |

### Technology Domain

| Entity | Description |
|--------|-------------|
| Server | Physical or virtual server hosting Application Components |
| Equipment | Physical equipment serving Company or Employees |
| Third-Party Software | Software produced by third-party Vendors |

## Relationships (Associations)

### Application Relationships
- **Application::Associated Data Objects <-> Data Object::Related Applications**
- **Application::Features <-> Feature::Implemented by Applications**
- **Application::Application Components <-> Application Component::Owning Application**
- **Application::Upstream Applications <-> Application::Downstream Applications**

### Component Relationships
- **Application Component::Used Technologies <-> Application Technology::Used by Application Components**
- **Application Component::Related Servers <-> Server::Hosted Application Components**

### Business Relationships
- **Company::Branches <-> Branch::Company**
- **Company::Solutions <-> Solution::Provided by Company**
- **Solution::Capabilities in this Solution <-> Capability::Belongs to Solution**
- **Solution::Business Processes <-> Business Process::Related Solution**
- **Capability::Features in this Capability <-> Feature::Belongs to Capability**
- **Business Process::Business Activities <-> Business Activity::Parent Business Process**
- **Business Activity::Next Business Activities <-> Business Activity::Previous Business Activities**

### Customer Relationships
- **Customer::Related Contracts <-> Contract::Related Customers**
- **Customer::Employed End Users <-> End User::Employer Customer**
- **End User::Uses Applications <-> Application::End Users**
- **End User::Consumes Products <-> Product::End Users**
- **End User::Receives Services <-> Service::End Users**

### Employee Relationships
- **Employee::Assigned to Branch <-> Branch::Employees at this Branch**
- **Employee::Manages Company <-> Company::CEO**
- **Employee::Third-Party Software in use <-> Third-Party Software::Used by Employees**
- **Employee::Direct Reports <-> Employee::Direct Manager (Supervisor)**
- **Employee::Member of Teams <-> Team::Team Members**
- **Employee::Assigned Equipment <-> Equipment::Assigned to Employees**
- **Employee::Work Location <-> Location::Employees at this Location**
- **Employee::Employee Roles <-> Employee Role::Employees with this Role**

### Team Relationships
- **Team::Responsible for Applications <-> Application::Responsible Teams**
- **Team::Participates in Business Activities <-> Business Activity::Participating Teams**
- **Team::Responsible for Contracts <-> Contract::Responsible Teams**
- **Team::Location <-> Location::Teams at this Location**
- **Team::Responsible for Products <-> Product::Responsible Teams**
- **Team::Responsible for Services <-> Service::Responsible Teams**

### Contract Relationships
- **Contract::Covered Application Technologies <-> Application Technology::Related Contract**
- **Contract::Covered Equipment <-> Equipment::Related Contract**
- **Contract::Covered Servers <-> Server::Related Contract**
- **Contract::Covered Third-Party Software <-> Third-Party Software::Related Contract**
- **Vendor::Related Contracts <-> Contract::Related Vendors**

### Location Relationships
- **Branch::Location <-> Location::Branches at this Location**
- **Equipment::Location <-> Location::Equipment at this Location**
- **Server::Location <-> Location::Servers at this Location**

### Product/Service Relationships
- **Product::Delivered Features <-> Feature::Related Products**
- **Service::Delivered Features <-> Feature::Related Services**

### Technology Relationships
- **Server::Third-Party Software <-> Third-Party Software::Related Servers**

## Files

- `README.md` - This overview
- `source.md` - Full content (to be created)
- `metamodel.json` - Structured JSON representation (to be created)
