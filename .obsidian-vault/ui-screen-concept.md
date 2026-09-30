# Pharmnos Lite Screen-by-Screen UI Concept

Status: Draft v2
Document Type: Screen-by-screen UI concept
Design Direction: Pharmnos Lite following `DESIGN.md`

## 1. Design North Star

Pharmnos Lite now follows a clean, calm, product-led design language inspired by the system defined in `DESIGN.md`.

The product should feel like:

- a friendly modern SaaS product
- operationally clear and easy to trust
- clean on white canvas
- quietly premium instead of over-designed
- product-first rather than illustration-first
- tailored for pharmaceutical wholesale workflows

The visual identity should combine:

- white canvas
- black primary CTAs
- strong display hierarchy
- light-gray cards
- real product UI fragments inside those cards
- a dark footer that closes the page

## 2. Global UI Language

### 2.1 Core Tone

- White canvas as the default page floor
- Black used for primary CTAs and headline emphasis
- Inter for all body UI, with Cal Sans-style display fallback rules from `DESIGN.md`
- Generous whitespace
- Light-gray card surfaces instead of dark chrome
- Product screens embedded directly inside marketing and explanatory cards
- Minimal accent color use

### 2.2 Layout DNA

Authenticated product pages and public marketing pages should both feel part of one system:

- clear top navigation or section header
- strong editorial banding
- product fragments inside cards
- restrained surfaces
- one primary action per band

### 2.3 Signature Design Elements

- Nav pill group
- Black primary button
- Light-gray feature cards
- White product mockup cards
- Batch chips
- Expiry tags
- Soft table chrome
- Circular avatars
- Dark closing footer

### 2.4 Motion Rules

Motion should be:

- minimal
- fast
- functional
- used for reveal or state confirmation only

Motion should not be:

- cinematic
- floating
- decorative
- 3D-like
- constantly animated

### 2.5 3D Rules

3D is no longer part of the core direction.

Do not use:

- 3D hero objects
- immersive 3D scenes
- pointer-reactive hero sculptures
- glossy futuristic motion blocks

If depth is needed, use:

- real product chrome
- layered cards
- subtle shadows
- nested surfaces

## 3. Global App Shell

### 3.1 Authenticated App Navigation

Primary navigation items:

- Dashboard
- Billing
- Purchases
- Inventory
- Customers
- Suppliers
- Reports
- Audit
- Settings

Design concept:

- clean white top context bar
- left navigation rail or sidebar in product app
- black text and restrained active states
- light-gray surface for grouped controls
- badges only where helpful

### 3.2 Top Context Bar

Contents:

- current page title
- breadcrumb when needed
- global search
- quick actions
- user menu

Design concept:

- white background
- hairline divider
- concise controls
- product-like calm, not dashboard drama

### 3.3 Global Command / Search Surface

Purpose:

- search products
- jump to invoice
- open customer
- start purchase
- find batches

Design concept:

- input-like search bar
- white fill
- hairline border
- strong clarity, not futuristic treatment

## 4. Page Inventory

The complete concept is grouped into:

- Public pages
- Auth pages
- Onboarding pages
- Core operational pages
- Relationship and ledger pages
- Report pages
- Settings and control pages
- Future phase pages

## 5. Public Pages

### 5.1 Landing Page

Purpose:

- explain product value
- build trust
- show actual product sophistication
- move users to sign up or request demo

Layout concept:

- white hero band with 7/5 split
- left side: display headline, concise copy, black CTA
- right side: real product mockup card
- lower sections alternate between white canvas and light-gray cards
- dark footer closes the full page

Signature components:

- hero app mockup card
- nav pill group
- feature cards on `surface-card`
- product mockup cards showing real UI fragments
- CTA light band

Motion:

- minimal section reveal only
- no animated hero object
- no kinetic decorative layers

Mobile behavior:

- hero stacks
- mockup card moves below copy
- feature grid becomes 1-up

### 5.2 Product Overview Page

Purpose:

- explain modules in structured detail

Layout concept:

- white canvas
- section headers with display typography
- clusters of light-gray feature cards
- real product fragments shown in white cards

Signature components:

- feature card
- product mockup card
- category tabs inside nav pill group

### 5.3 Contact / Demo Page

Purpose:

- convert interested businesses

Layout concept:

- clean split layout
- left side: trust copy
- right side: form card

Design style:

- credible and quiet
- no visual overreach

## 6. Auth Pages

### 6.1 Sign In Page

Purpose:

- allow secure entry

Layout concept:

- centered auth card or split layout
- white background
- concise trust copy
- black CTA

Signature components:

- simple auth card
- clean input fields
- minimal helper text

### 6.2 Sign Up Page

Purpose:

- create new business owner account

Layout concept:

- step-aware form card
- business-first copy
- minimal supporting visuals

Signature components:

- progress treatment through tabs or section labels
- input stack
- black primary CTA

### 6.3 Forgot Password Page

Purpose:

- recovery

Layout concept:

- minimal single-card layout

### 6.4 Invite Acceptance Page

Purpose:

- allow staff users to join tenant

Layout concept:

- invitation summary card
- business info
- role preview

## 7. Onboarding Pages

### 7.1 Welcome / Business Creation Page

Purpose:

- create business profile and tenant

Layout concept:

- calm onboarding wizard
- left summary or steps
- right active form
- white canvas with soft dividers

Stages:

- business identity
- tax and license details
- invoice settings
- first admin review

Signature components:

- step tabs
- form card
- small business preview block

### 7.2 Initial Setup Checklist Page

Purpose:

- help user complete first-time setup

Layout concept:

- white canvas
- checklist cards
- one primary next step

Tiles:

- add products
- add customers
- add suppliers
- import opening stock
- invite staff

### 7.3 Import Data Page

Purpose:

- import master data and stock

Layout concept:

- upload card
- mapping card
- validation summary card

Signature components:

- product-like mapping rows
- soft error and success messaging

### 7.4 Team Invite Page

Purpose:

- add staff and assign roles

Layout concept:

- compact user table
- invite form card

## 8. Dashboard Pages

### 8.1 Main Dashboard

Purpose:

- answer what matters now

Layout concept:

- white page canvas
- top metric row in light cards
- middle action cards
- lower real product fragments for queues and reports

Signature components:

- light metric cards
- white operational detail cards
- expiry and due signals through badges and chips

Design rule:

- do not use loud analytics styling
- show calm operational control

### 8.2 Role-Based Dashboard Variants

Admin dashboard focus:

- revenue
- due collections
- payables
- stock risk
- staff activity

Billing dashboard focus:

- today invoices
- quick billing actions
- recent customer activity

Inventory dashboard focus:

- low stock
- near expiry
- recent inward
- stock discrepancies

Manager dashboard focus:

- collections
- supplier balance
- product movement
- audit events

## 9. Billing Pages

### 9.1 New Invoice Page

Purpose:

- fastest daily billing experience

Layout concept:

- clean two-column workspace
- left: search and invoice lines
- right: customer, totals, payment, and quick status

Signature components:

- strong product table chrome
- input fields using light borders
- black primary CTA
- batch chips and quantity controls

Interaction model:

- keyboard-first
- simple and fast
- visual clarity over visual effects

### 9.2 Invoice Success / Print Preview Page

Purpose:

- confirm billing completion
- trigger print or share

Layout concept:

- centered confirmation and preview card
- one strong CTA row

### 9.3 Sales Invoice List Page

Purpose:

- review and search invoices

Layout concept:

- clean data table
- tabs or filters inside pill groups
- detail drawer or detail route

Saved views:

- today
- unpaid
- cancelled
- high-value

### 9.4 Invoice Detail Page

Purpose:

- review invoice lifecycle

Layout concept:

- white header summary
- line-item card
- payment card
- history card

## 10. Purchase Pages

### 10.1 Purchase List Page

Purpose:

- monitor all purchase entries

Layout concept:

- table-first screen
- supplier filters
- status pill group

### 10.2 New Purchase Entry Page

Purpose:

- capture supplier invoice and create stock

Layout concept:

- structured two-column form
- line items in white card
- batch and expiry blocks in secondary card

Signature components:

- grouped field stacks
- batch chips
- simple validation messaging

### 10.3 Purchase Detail Page

Purpose:

- inspect purchase and stock effect

Layout concept:

- summary header
- line items
- linked batches
- supplier summary

## 11. Inventory Pages

### 11.1 Inventory Overview Page

Purpose:

- understand current stock state quickly

Layout concept:

- light summary cards
- central table
- side or lower grouped risk cards

Signature components:

- stock chips
- expiry tags
- lightweight visual summaries

### 11.2 Product Master List Page

Purpose:

- browse all products

Layout concept:

- clear product table
- filtering shelf
- add product CTA

Columns emphasize:

- product
- manufacturer
- GST
- reorder level
- stock summary
- risk state

### 11.3 Product Detail Page

Purpose:

- full product workspace

Layout concept:

- product summary card
- pricing card
- stock card
- batch card
- linked activity card

Design rule:

- card-based product workspace
- white and light-gray only

### 11.4 Batch List Page

Purpose:

- review all batches across products

Layout concept:

- table with expiry-first sorting
- clean pill tags

Signature components:

- batch badge
- expiry tag
- availability pill

### 11.5 Batch Detail Page

Purpose:

- inspect one batch deeply

Layout concept:

- header summary card
- inward and outward cards
- audit card

### 11.6 Low Stock Page

Purpose:

- handle replenishment risk

Layout concept:

- queue table with simple urgency markers
- no loud warning-dashboard treatment

### 11.7 Near Expiry Page

Purpose:

- handle expiry risk proactively

Layout concept:

- pill-group horizon filters:
- 30 days
- 60 days
- 90 days

Signature components:

- expiry tags
- action chips
- white queue cards

### 11.8 Stock Adjustment Page

Purpose:

- perform controlled stock correction

Layout concept:

- serious but clean form workflow
- before-and-after summary cards

## 12. Customer Pages

### 12.1 Customer List Page

Purpose:

- browse and manage wholesale customers

Layout concept:

- relationship table
- account summary chips
- overdue or credit signals shown with subtle badge treatment

### 12.2 Customer Detail Page

Purpose:

- full customer workspace

Layout concept:

- profile summary card
- outstanding summary card
- invoices card
- payments card
- notes and activity card

### 12.3 Customer Ledger Page

Purpose:

- focused receivable view

Layout concept:

- statement table
- aging summary cards

## 13. Supplier Pages

### 13.1 Supplier List Page

Purpose:

- manage suppliers and balances

Layout concept:

- dense but calm table
- payable state shown by chips and muted text hierarchy

### 13.2 Supplier Detail Page

Purpose:

- full supplier workspace

Layout concept:

- supplier profile card
- purchase history card
- payable summary card
- linked batch card

### 13.3 Supplier Ledger Page

Purpose:

- focused payable tracking

Layout concept:

- statement-centric screen
- aging summary row

## 14. Report Pages

### 14.1 Sales Report Page

Purpose:

- analyze sales with precision

Layout concept:

- top filters
- quiet metric row
- chart or trend block in white card
- detailed table

Design rule:

- analytical but still within the white-card system

### 14.2 Inventory Report Page

Purpose:

- summarize stock, movement, and risk

Layout concept:

- stock summary cards
- inventory table
- grouped product fragments

### 14.3 Receivables Report Page

Purpose:

- understand outstanding collection risk

Layout concept:

- aging summary
- customer drilldown table

### 14.4 Payables Report Page

Purpose:

- understand supplier dues

Layout concept:

- aging summary
- supplier drilldown table

### 14.5 Product Performance Page

Purpose:

- identify movers and slow movers

Layout concept:

- trend block
- ranking table

## 15. Audit and Control Pages

### 15.1 Audit Log Page

Purpose:

- provide traceability and investigation capability

Layout concept:

- clean event table
- right detail card or full detail view
- light severity tagging

### 15.2 Activity Timeline Page

Purpose:

- broad cross-module operational history

Layout concept:

- chronological list inside cards
- no forensic dark-mode treatment

## 16. Settings Pages

### 16.1 Business Profile Settings Page

Purpose:

- manage company identity and regulatory basics

Layout concept:

- grouped form sections in white cards

Sections:

- business details
- GST details
- drug-license fields
- address
- contact data

### 16.2 Team and Roles Page

Purpose:

- manage staff access

Layout concept:

- team table
- invite card
- role explanation cards

### 16.3 Invoice Settings Page

Purpose:

- configure numbering and document behavior

Layout concept:

- config form
- invoice preview fragment card

### 16.4 Tax and Compliance Settings Page

Purpose:

- configure tax defaults and compliance preferences

Layout concept:

- simple settings sections
- helper copy in muted text

### 16.5 Preferences Page

Purpose:

- local preferences and app behavior

Possible controls:

- date format
- theme
- dashboard mode
- table density

## 17. Empty, Loading, and Error States

### 17.1 Empty States

Empty states should be:

- clean
- friendly
- product-specific
- lightly guided

Examples:

- no products yet
- no near-expiry batches
- no outstanding dues

### 17.2 Loading States

Use:

- table skeletons
- card skeletons
- mock product placeholders

Avoid:

- spinner-only waiting states
- animated futuristic loaders

### 17.3 Error States

Use:

- clear recovery action
- simple language
- clean inline or card-level feedback

## 18. Mobile Screen Behavior

The product remains web-first, but mobile must still feel polished and calm.

### 18.1 Mobile Strategy

- keep hierarchy short
- stack cards vertically
- preserve black CTA and white canvas language
- reduce card density
- keep product mockups legible

### 18.2 Best Mobile-Optimized Screens

- Dashboard
- Invoice lookup
- Customer detail
- Batch detail
- Low stock queue
- Near expiry queue

### 18.3 Desktop-Preferred Screens

- purchase entry
- stock adjustment
- long ledgers
- advanced reports

## 19. Motion by Page Cluster

### 19.1 Dashboard

- soft reveal
- count changes only when needed

### 19.2 Billing

- row insertion
- total refresh

### 19.3 Inventory

- filter transitions
- drawer open and close

### 19.4 Reports

- quiet chart fade-in

### 19.5 Settings

- almost static

## 20. Visual Rules To Preserve

- White is the main canvas
- Black is the action color
- Display typography carries the brand feel
- Product fragments must be shown directly in cards
- Light-gray cards carry explanatory bands
- Dark surface is reserved for the footer and rare featured surfaces only
- Accent colors are sparse and supportive, never dominant

## 21. Page Priority for Design Execution

Design these first:

1. Landing page
2. Main Dashboard
3. New Invoice
4. Purchase Entry
5. Inventory Overview
6. Product Detail
7. Customer Detail
8. Supplier Detail
9. Audit Log
10. Settings

## 22. Final Design Direction

If executed correctly, Pharmnos Lite will feel like:

- a clean modern SaaS product
- product-led and trustworthy
- friendlier than ERP software
- more refined than a generic admin template
- aligned with the visual system described in `DESIGN.md`

It should not feel like:

- a dark cinematic dashboard
- a 3D-heavy SaaS concept
- a loud AI-generated marketing page
- a generic template recolored for pharmacy use
