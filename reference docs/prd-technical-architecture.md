# Pharmnos Lite PRD + Technical Architecture

Status: Draft v1
Product: Pharmnos Lite
Document Type: Integrated Product Requirements Document and Technical Architecture
Primary Goal: Build a free-first, migration-safe pharmacy wholesale web application for India

## 1. Executive Summary

Pharmnos Lite is a multi-tenant pharmacy wholesale web application built for small and mid-sized Indian wholesale businesses that need the daily essentials of billing, batch-wise inventory, expiry control, purchases, customer ledgers, supplier tracking, and business visibility without paying for a heavy ERP.

The product is intentionally designed as:

- free to start
- simple to operate
- usable on mobile and desktop
- safe for pharmacy workflows
- flexible enough to migrate later without a rewrite

The first release will focus on the operational core that directly replaces the daily workload currently handled in MARG-like ERP systems, while avoiding deep enterprise features that increase cost and complexity.

## 2. Product Vision

Create a lightweight, reliable, and affordable operating system for Indian pharmacy wholesale businesses that covers daily operations from stock receipt to invoice generation and due tracking, while remaining portable across hosting providers and infrastructure vendors.

## 3. Problem Statement

Small pharmacy wholesale businesses often pay for large ERP suites even though they use only a fraction of the features. Existing systems may be expensive, heavy, desktop-oriented, hard to customize, and difficult to access from modern devices.

The client needs:

- a browser-based application
- one link for access
- support for desktop and mobile devices
- separate isolated business profiles for each customer
- batch and expiry-aware inventory workflows
- GST-ready billing
- low operational cost
- an architecture that starts free and can later migrate safely

## 4. Product Goals

### 4.1 Primary Goals

- Replace the daily operating core of a pharmacy wholesale ERP
- Support multi-tenant onboarding so each business gets a separate workspace
- Provide fast billing and stock movement workflows
- Track inventory at batch and expiry level
- Track receivables and payables
- Provide basic dashboards and alerts
- Operate with a free-first infrastructure footprint
- Remain portable so future migration does not require a rewrite

### 4.2 Non-Goals for v1

- Full financial accounting and statutory books
- Deep CRM or field-sales automation
- Advanced procurement workflows
- Multi-branch transfer optimization
- Marketplace or self-service ordering portal
- Manufacturer claims automation
- Custom report builder
- Full retail prescription dispensing workflow

## 5. Target Users

### 5.1 Business Owner / Admin

Needs:

- business setup
- staff management
- dashboard visibility
- sales and outstanding overview
- inventory risk visibility
- permission control

### 5.2 Billing Operator

Needs:

- fast item search
- invoice creation
- payment mode capture
- customer credit lookup
- minimal screen friction

### 5.3 Purchase / Inventory Operator

Needs:

- supplier purchase entry
- inward stock creation by batch
- batch expiry and quantity management
- stock adjustments
- low-stock and near-expiry review

### 5.4 Manager / Accountant

Needs:

- customer ledgers
- supplier ledgers
- invoice tracking
- returns tracking
- summary reports

## 6. Product Scope

### 6.1 MVP Scope

The MVP includes:

- multi-tenant business onboarding
- user authentication
- role-based access control
- product master
- customer master
- supplier master
- purchase entry
- batch creation and inward stock
- sales billing
- GST calculation
- inventory movement and available stock tracking
- customer dues and supplier dues
- low-stock alerts
- near-expiry alerts
- dashboard summary
- audit logging for critical events

### 6.2 Phase 2 Scope

- sales return
- purchase return
- printable invoice formats
- CSV import and export
- improved dashboard widgets
- approval controls for cancellations and adjustments
- barcode-assisted product search

### 6.3 Later Scope

- multi-warehouse support
- branch transfers
- e-invoice integration
- e-way bill support
- advanced reporting
- customer-specific pricing rules
- self-service ordering portal
- native mobile app if later justified

## 7. Core Product Principles

### 7.1 Free-First

The system must run entirely on free infrastructure for MVP and early use.

### 7.2 Migration-Safe

No important business logic should be tightly coupled to a single cloud vendor.

### 7.3 Pharmacy-Safe

Batch, expiry, tax, and audit considerations are first-class concerns.

### 7.4 Fast Operator Experience

The most-used workflows should require minimal clicks and fast keyboard support.

### 7.5 Tenant Isolation

Each business must operate in a separate logical workspace with isolated data.

## 8. Functional Requirements

### 8.1 Tenant and Business Profile Management

The system shall:

- allow a new business owner to sign up
- create a dedicated tenant record for each new business
- keep users, data, settings, invoices, and stock isolated by tenant
- allow tenant admins to invite staff users
- support business profile fields such as business name, address, GSTIN, drug-license details, contact numbers, invoice prefix, and default tax settings

### 8.2 Authentication and Authorization

The system shall:

- support secure sign-in and sign-out
- support role-based access by page and action
- support at least four initial roles: Admin, Billing, Inventory, Manager
- prevent unauthorized access to tenant data
- log key account actions such as user invite, role change, and business setting change

### 8.3 Product Master

The system shall:

- create and edit products
- store product name, generic name, manufacturer, pack size, HSN, GST rate, MRP, standard sale rate, purchase rate, reorder level, and schedule classification
- allow product search by name and code
- support active and inactive product states

### 8.4 Supplier Management

The system shall:

- create and edit suppliers
- store supplier business details and payment details
- track payable balance
- display recent purchase history for a supplier

### 8.5 Customer Management

The system shall:

- create and edit wholesale customers
- store business name, contact details, GSTIN, drug-license information, credit limit, and billing address
- track receivable balance
- show ledger entries per customer

### 8.6 Purchase Entry

The system shall:

- record purchase invoices from suppliers
- create product batches during purchase entry
- capture batch number, expiry date, purchase rate, MRP, and quantity
- update stock automatically on purchase save
- support draft and final states

### 8.7 Inventory and Stock Control

The system shall:

- maintain stock at product-plus-batch level
- calculate available stock from stock movement records
- support FEFO allocation logic for sale suggestions
- block sale of expired batches
- show low-stock and near-expiry alerts
- support stock adjustment with audit logging

### 8.8 Sales Billing

The system shall:

- create tax-ready sales invoices
- search products quickly
- support manual item selection in MVP
- calculate GST in real time
- support cash, card, UPI, credit, and mixed collection entries
- generate invoice number using tenant-specific numbering rules
- reduce stock automatically when an invoice is finalized
- support cancellation with permission and audit log

### 8.9 Returns

The system shall eventually:

- support sales returns
- support purchase returns
- restore stock correctly with batch awareness

Returns are deferred from strict MVP but should be considered in the initial data model.

### 8.10 Dashboard and Reporting

The system shall show:

- today sales
- current month sales
- receivables
- payables
- low-stock count
- near-expiry count
- top-selling products

### 8.11 Audit Logging

The system shall create audit log records for:

- login events
- user and role changes
- invoice cancellation
- stock adjustments
- price changes
- business setting changes
- critical purchase and sales events

## 9. Compliance and Domain Assumptions

This document is a product and technical planning artifact, not legal advice. Before production launch, tax and drug-compliance rules should be validated with a chartered accountant and local compliance expert.

The system is designed with the following domain assumptions:

- wholesale pharmacy businesses operate with GST obligations
- batch and expiry tracking are required for stock safety and business control
- invoice edits must be auditable
- some products may fall under stricter schedule classifications
- business users need reliable invoice numbering and traceability

For v1, the system will be GST-ready at a practical level but will not implement every advanced statutory automation.

## 10. Success Metrics

### 10.1 Business Metrics

- a new business can onboard within one day
- staff can complete purchase to sale flow without external ERP dependency
- owners can view outstanding balances and stock risk daily

### 10.2 Product Metrics

- invoice creation time under 2 minutes for a typical operator
- purchase entry time under 5 minutes for a medium invoice
- dashboard loads within 3 seconds for normal tenant size
- critical stock update accuracy above 99 percent under tested workflows

## 11. User Journeys

### 11.1 New Business Onboarding

1. Owner signs up
2. System creates tenant
3. Owner completes business profile
4. Owner invites staff
5. Owner loads products, customers, suppliers, and opening stock

### 11.2 Purchase to Stock Flow

1. Inventory staff selects supplier
2. Staff creates purchase entry
3. Staff adds product lines with batch and expiry
4. System creates stock movement
5. Dashboard and inventory update

### 11.3 Billing Flow

1. Billing staff selects customer
2. Staff adds products
3. System suggests FEFO-eligible batches
4. System calculates GST and totals
5. Staff records payment mode
6. Invoice is finalized
7. Stock and ledger update automatically

## 12. Technical Architecture Overview

### 12.1 Architecture Goals

- deploy fully free in MVP
- keep the app portable
- avoid deep vendor lock-in
- support multi-tenant isolation
- keep maintenance low
- allow later migration to paid infrastructure

### 12.2 Recommended Baseline Stack

Frontend:

- Next.js with App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui or equivalent component layer

Application Layer:

- Next.js server actions and route handlers
- Zod for validation
- service-layer modules for business rules

Persistence Layer:

- PostgreSQL
- Prisma ORM with schema migrations

Free-First Infrastructure:

- Vercel Hobby for hosting during MVP and validation
- Supabase Free for PostgreSQL and optional storage
- GitHub Free for repository and CI

Optional Supporting Services:

- Supabase Auth adapter for MVP authentication
- Supabase Storage adapter for invoice PDFs and file uploads

### 12.3 Architecture Principle: Provider-Independent Core

The system must separate:

- business logic
- data access
- authentication implementation
- storage implementation
- deployment target

This ensures later migration affects infrastructure adapters rather than the full application.

## 13. High-Level System Design

```text
Browser (desktop/mobile)
  -> Next.js Web App
      -> UI Layer
      -> Server Actions / Route Handlers
      -> Domain Services
      -> Repository Layer
          -> PostgreSQL
      -> Auth Adapter
      -> Storage Adapter

Free MVP Providers
  -> Hosting: Vercel Hobby
  -> Database: Supabase Postgres
  -> Auth: Supabase Auth adapter
  -> Storage: Supabase Storage adapter

Later Migration Options
  -> Hosting: Cloudflare / Render / Fly.io / VPS / Docker
  -> Database: Neon / Railway / RDS / self-hosted Postgres
  -> Auth: Auth.js / Clerk / custom auth
  -> Storage: S3 / R2 / local object storage
```

## 14. Logical Architecture Layers

### 14.1 Presentation Layer

Responsibilities:

- responsive web UI
- forms
- tables
- dashboards
- keyboard-friendly billing screen
- input validation feedback

Key rules:

- presentation layer must not contain business-critical rules
- UI can guide FEFO and tax behavior, but final validation must occur on server side

### 14.2 Application Layer

Responsibilities:

- use-case orchestration
- validation
- permission checks
- transaction workflows
- audit generation

Example use cases:

- create tenant
- invite user
- create purchase invoice
- finalize sales invoice
- adjust stock
- fetch dashboard summary

### 14.3 Domain Layer

Responsibilities:

- business rules
- tenant isolation rules
- stock movement calculations
- billing and GST calculation logic
- expiry validation
- ledger impact logic

This layer is the core of migration safety.

### 14.4 Infrastructure Layer

Responsibilities:

- database connection
- auth provider implementation
- storage provider implementation
- logging
- scheduled jobs

## 15. Proposed Repository Structure

```text
e:\PharmnosLite
  docs/
    prd-technical-architecture.md
  src/
    app/
      (marketing)/
      (auth)/
      dashboard/
      billing/
      purchases/
      inventory/
      customers/
      suppliers/
      settings/
      api/
    components/
      ui/
      billing/
      inventory/
      dashboard/
      forms/
    features/
      auth/
      tenants/
      products/
      customers/
      suppliers/
      purchases/
      inventory/
      billing/
      dashboard/
      audit/
    lib/
      db/
      auth/
      storage/
      permissions/
      validation/
      utils/
    domain/
      entities/
      services/
      rules/
    repositories/
      product-repository.ts
      customer-repository.ts
      supplier-repository.ts
      purchase-repository.ts
      invoice-repository.ts
      stock-repository.ts
    adapters/
      auth/
      storage/
      database/
    types/
    config/
  prisma/
    schema.prisma
    migrations/
  public/
  tests/
```

## 16. Frontend Architecture

### 16.1 UI Strategy

- mobile-friendly responsive screens
- desktop-optimized operational layouts
- table-heavy views for inventory and ledgers
- fast form interactions for billing and purchase entry

### 16.2 Route Areas

- public marketing and landing pages
- auth pages
- tenant dashboard
- product master
- customer master
- supplier master
- purchases
- inventory
- billing
- settings
- reports

### 16.3 State Management

Use:

- server components for read-heavy screens where appropriate
- client components for interactive forms
- URL search params for filters
- minimal client-side state for operational UX

Avoid heavy global client state unless proven necessary.

## 17. Backend Architecture

### 17.1 API Style

Use a hybrid approach:

- server actions for trusted form workflows inside the app
- route handlers for programmatic APIs, exports, and future integrations

### 17.2 Validation Strategy

All incoming data must be validated with schemas before use.

Examples:

- business signup payload
- purchase line items
- sales invoice totals
- stock adjustment data

### 17.3 Transaction Strategy

Critical operations must be transactional:

- purchase save
- invoice finalization
- stock adjustment
- returns in future phases

The transaction must update:

- primary document
- related line items
- stock movements
- ledger impact
- audit log

## 18. Multi-Tenant Design

### 18.1 Isolation Model

Use a shared database with strict tenant scoping.

Every tenant-owned table must include:

- tenant_id
- created_at
- updated_at
- created_by where relevant

### 18.2 Tenant Enforcement Rules

- every business query must filter by tenant_id
- every mutation must validate tenant context
- repository methods must require tenant context explicitly
- composite unique constraints should include tenant_id where necessary

### 18.3 RLS Readiness

The schema should remain compatible with future PostgreSQL row-level security if needed. However, the MVP must not depend solely on vendor-specific policy features for correctness. Application-layer tenant enforcement remains mandatory.

## 19. Authentication and Role Model

### 19.1 MVP Authentication

Recommended MVP path:

- Supabase Auth adapter for simple startup
- session handled through the app
- tenant membership stored in app tables

### 19.2 Role Model

Initial roles:

- Admin
- Billing
- Inventory
- Manager

### 19.3 Permission Model

Permissions should be action-based rather than screen-only.

Examples:

- create invoice
- cancel invoice
- create purchase
- edit stock
- manage users
- view reports

## 20. Data Model Overview

### 20.1 Core Entities

- tenants
- users
- memberships
- business_profiles
- roles
- permissions
- products
- product_batches
- customers
- suppliers
- purchase_invoices
- purchase_invoice_items
- sales_invoices
- sales_invoice_items
- payments
- stock_movements
- customer_ledgers
- supplier_ledgers
- audit_logs

### 20.2 Key Entity Notes

#### tenants

Stores the business account root.

#### memberships

Maps users to tenants and roles.

#### products

Stores product master data and default commercial properties.

#### product_batches

Stores batch-level inventory state with expiry and pricing context.

#### stock_movements

Stores immutable stock changes generated by purchases, sales, adjustments, and returns.

#### sales_invoices and sales_invoice_items

Store billing documents and invoice lines.

#### purchase_invoices and purchase_invoice_items

Store supplier-side purchasing documents and inward line items.

#### ledger tables

Track financial movement summaries without attempting to become a full accounting system in v1.

## 21. Example Table Design Guidance

### 21.1 products

Important fields:

- id
- tenant_id
- sku
- name
- generic_name
- manufacturer
- pack_size
- gst_rate
- hsn_code
- reorder_level
- schedule_classification
- is_active

### 21.2 product_batches

Important fields:

- id
- tenant_id
- product_id
- batch_no
- expiry_date
- mrp
- purchase_rate
- sale_rate
- received_qty
- available_qty
- supplier_id

### 21.3 stock_movements

Important fields:

- id
- tenant_id
- product_id
- product_batch_id
- movement_type
- quantity_delta
- reference_type
- reference_id
- notes
- created_by
- created_at

## 22. Inventory Logic Design

### 22.1 Stock Source of Truth

The source of truth should be stock movements, not editable summary counters alone.

Batch availability may be materialized for performance, but movement history remains the auditable foundation.

### 22.2 FEFO Logic

Sales flow should prefer eligible batches in this order:

1. non-expired
2. earliest expiry
3. available quantity

Operators may override only within allowed rules and with audit visibility where necessary.

### 22.3 Expiry Handling

- expired batches cannot be sold
- near-expiry threshold should be configurable
- batches may be flagged as hold or blocked

## 23. Billing and Ledger Logic

### 23.1 Invoice States

Suggested states:

- draft
- finalized
- cancelled

### 23.2 Payment Modes

Support:

- cash
- card
- UPI
- credit
- mixed collection

### 23.3 Ledger Updates

On invoice finalization:

- customer receivable should increase for unpaid balance
- cash collection may be recorded immediately
- stock movements must be posted

## 24. Reporting Strategy

### 24.1 MVP Reports

- daily sales summary
- monthly sales summary
- customer outstanding
- supplier outstanding
- low-stock report
- near-expiry report
- top products

### 24.2 Query Strategy

Use optimized SQL queries and database indexes before introducing analytics infrastructure.

## 25. Performance and Non-Functional Requirements

### 25.1 Performance

- main dashboard should load quickly for small and medium tenants
- billing save should complete within a normal operator tolerance window
- product search should remain responsive

### 25.2 Security

- hashed or provider-managed credentials only
- strict tenant scoping
- secure session handling
- validated inputs
- server-side permission checks

### 25.3 Reliability

- transactional writes for critical workflows
- audit logs for important actions
- no silent destructive edits to critical records

### 25.4 Usability

- responsive mobile access
- desktop-first operational efficiency
- simple forms
- consistent tables and filters

## 26. Observability and Error Handling

### 26.1 Logging

Store:

- application errors
- failed validations
- auth issues
- critical workflow failures

### 26.2 Monitoring

For MVP:

- use platform logs
- use simple error reporting
- add structured server logs for critical operations

### 26.3 Audit vs Error Logs

Keep audit logs separate from application error logs.

## 27. Deployment Architecture

### 27.1 MVP Environments

- local development
- preview deployment
- production

### 27.2 Free-First Deployment

MVP target:

- app hosted on Vercel Hobby
- database on Supabase Free
- storage on Supabase Free if needed
- code on GitHub Free

### 27.3 Environment Variables

Keep provider credentials and settings in environment variables only.

Examples:

- database URL
- auth keys
- storage keys
- invoice prefix defaults
- feature flags

## 28. Migration-Safe Architecture Strategy

This is one of the most important design requirements of Pharmnos Lite.

### 28.1 Hard Rules

- do not scatter vendor SDK calls across business modules
- do not embed business logic directly inside provider callbacks
- keep database schema PostgreSQL-standard
- keep all migrations in repository
- keep auth and storage behind adapters
- avoid provider-only features unless optional

### 28.2 Migration Paths

#### Hosting Migration

From:

- Vercel Hobby

To:

- Cloudflare
- Fly.io
- Render
- VPS with Docker

Impact:

- deployment config changes
- minimal code change if app stays standards-based

#### Database Migration

From:

- Supabase Postgres

To:

- Neon
- Railway
- RDS
- self-hosted PostgreSQL

Impact:

- update connection string
- run schema migrations
- migrate data dump

#### Auth Migration

From:

- Supabase Auth adapter

To:

- Auth.js
- Clerk
- custom auth

Impact:

- adapter rewrite
- session and user mapping migration
- core business modules unchanged

#### Storage Migration

From:

- Supabase Storage adapter

To:

- S3
- R2
- local object storage

Impact:

- storage adapter rewrite
- data migration script
- business modules unchanged

## 29. Suggested Development Phases

### Phase 0: Foundation

- repo setup
- design system baseline
- authentication setup
- tenant model
- initial schema
- environment configuration

### Phase 1: Masters

- business profile
- users and roles
- products
- customers
- suppliers

### Phase 2: Purchases and Inventory

- purchase entry
- batch creation
- stock movements
- low-stock and near-expiry logic

### Phase 3: Billing and Ledger

- invoice flow
- GST calculation
- payment capture
- customer dues

### Phase 4: Dashboard and Audit

- KPIs
- alerts
- audit log views
- basic reports

### Phase 5: Hardening

- exports
- better permissions
- performance tuning
- backup and recovery planning

---

## Working phase crosswalk (29a) — Project-wide MANDATORY numbering P1…P7

> ⚠️ **Phase numbering convention clarification (read this before planning):**
> The 6 phases above (Phase 0…Phase 5) are the original PRD suggested phases written during Phase 0 planning. **For day-to-day work, commit messages, vault notes, status updates, TODO lists, and AI planning prompts — USE THE 7 WORKING PHASES P1…P7 BELOW exclusively.** The 6 PRD phases above remain for historical-reference / coverage-area mapping only; never re-use Phase 0…Phase 5 in conversation. All 7 working phases live-tracked in `PHASE_TRACKER.md` at project root (central source of truth, current phase indicator, % complete, last updated date).

| Working Phase | Title (day-to-day name) | Status (as of 2026-09-30) | PRD §29 phase area covered |
|---|---|---|---|
| P1 | Foundation & Scaffold (Next.js 14, Prisma, Design System, 4 routes, typecheck/lint clean) | ✅ DONE 2026-09-29 | PRD Phase 0 Foundation |
| P2 | Dashboard Shells + 17 Repositories + 4 Domain Services + Auth Forms + Supabase Cloud Go-Live + Seed Live + Triage | ✅ DONE 2026-09-29 | PRD Phase 1 first half (business profile, users, roles, schema) |
| P3 | Core Masters CRUD — Products → Customers → Suppliers (list + new form + Zod + repo tx + opening balance ledger rows) | 🚧 CURRENT (5% spec done, code next) | PRD Phase 1 second half (products, customers, suppliers) |
| P4 | Purchases + Inventory Transactions (purchase entry, FEFO batch consumption, stock adjusts, low-stock/near-expiry tabs live) | 🔴 NOT STARTED | PRD Phase 2 Purchases and Inventory |
| P5 | Billing + Ledgers + Payments (sales invoice flow, GST calc, payment capture, customer dues aging) | 🔴 NOT STARTED | PRD Phase 3 Billing and Ledger |
| P6 | Reports + Audit + Dashboard KPIs (paginated reports, audit log timeline, KPI widgets live data) | 🔴 NOT STARTED | PRD Phase 4 Dashboard and Audit |
| P7 | Hardening + Release (RLS tenant_id policies, Storage bucket bug resolved, exports, perf tuning, backup SOP, go-live checklist) | 🔴 NOT STARTED | PRD Phase 5 Hardening |

## 30. Risks and Mitigations

### 30.1 Free Tier Limits

Risk:

- hosting, database, or storage limits may be reached

Mitigation:

- keep architecture portable
- monitor usage early
- upgrade infrastructure without rewriting the app

### 30.2 Domain Complexity

Risk:

- pharmacy workflows may grow beyond the lean MVP

Mitigation:

- keep v1 tightly scoped
- design data model with future returns and branches in mind

### 30.3 Compliance Changes

Risk:

- tax and regulatory rules may change

Mitigation:

- keep configurable rule tables where possible
- validate launch scope with experts

### 30.4 Performance Degradation

Risk:

- billing and search may slow down as data grows

Mitigation:

- index major fields
- optimize queries
- avoid unnecessary client-heavy state

## 31. Acceptance Criteria for MVP

The MVP is successful when:

- a new business can sign up and create a tenant
- an admin can create staff users and assign roles
- products, customers, and suppliers can be added
- purchase entry creates batch-wise stock
- billing creates sales invoices with GST totals
- stock reduces correctly after invoice finalization
- receivables and payables are visible
- dashboard shows daily business summaries
- critical actions are auditable
- the system runs on a free-first deployment stack

## 32. Open Decisions for Implementation Start

These decisions should be finalized before coding begins:

- exact auth implementation details for MVP
- invoice print format design
- barcode support timing
- dashboard chart priorities
- import format for opening stock and masters
- whether returns are included in initial sprint or post-MVP sprint

## 33. Final Recommendation

Pharmnos Lite should be built as a lean, modular, multi-tenant web application with a provider-independent core and a free-first infrastructure setup.

The right technical direction is:

- Next.js
- TypeScript
- PostgreSQL
- Prisma migrations
- adapter-based auth and storage
- modular domain and repository layers
- Vercel Hobby plus Supabase Free for MVP

This approach best satisfies all current product constraints:

- free at the start
- accessible from a single link
- usable on desktop and mobile
- practical for pharmacy wholesale operations
- safe to migrate later
