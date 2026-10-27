# Pharmnos Lite GST Disposable Test Suite — Assertion Mapping

**Date:** 2026-10-25  
**Time:** 21-40-01 (IST)  
**Working stage:** POST-P7 — PRE-PRODUCTION VALIDATION  
**Status:** Read-only review document; no execution authorization

## Scope and evidence rule

This document maps the assertions required for a future isolated GST/Financial
E2E verification run to the repository sources that define them. It does not
approve the checked-in expectation package, SQL artifacts, database
initialization, GST execution, broader Financial E2E execution, or cleanup.

The following classifications are used:

- **PRISMA/SQL EXTRACTABLE** — the object, field, enum, constraint, or index can
  be read directly from the Prisma schema or generated SQL.
- **MANIFEST/PACKAGE EXTRACTABLE** — the path, hash, order, or classification is
  defined by the checked-in artifact manifest and can be verified offline by
  the artifact-package module and tests.
- **REVIEWED SECURITY/RLS** — the requirement is specified in a review-only
  security/RLS artifact but is not proof of a live database state.
- **SOURCE INCOMPLETE** — the repository describes the requirement without
  defining enough exact names, values, or implementation details for a safe
  expectation.
- **OWNER APPROVAL REQUIRED** — the source identifies an unresolved
  authorization, role, policy, grant, or implementation choice.
- **CONNECTED VERIFICATION REQUIRED** — the assertion can only be proven from
  an authorized isolated database run.
- **SERVICE-LEVEL** — the behavior is enforced or primarily specified in
  application services and is not a catalog assertion.

## Current package state

[`financial-e2e-reviewed-expectations.json`](../../scripts/financial-e2e-reviewed-expectations.json)
contains only `public` and `pharmnos_e2e_runtime`; all object, constraint,
index, trigger, function, grant, table, and policy lists are empty. It remains
`approved: false` with status
`REVIEW_ONLY_PENDING_OWNER_APPROVAL`.

The package naming `public` is not evidence that the schema exists, is owned by
the intended principal, or contains the generated objects. The generated
from-empty SQL uses unqualified object DDL; it does not independently prove
schema creation, ownership, search-path placement, or applied database state.

[`financial-e2e-artifact-manifest.json`](../../prisma/financial-e2e-artifact-manifest.json)
contains five review-only artifacts with deterministic order and hashes. It
also remains `approved: false` and
`REVIEW_ONLY_PENDING_OWNER_APPROVAL`. Its verification steps require future
connected identity, catalog, RLS, runtime, and sanitized-evidence checks; they
do not authorize those operations.

## Assertion mapping

| ID | Category and assertion | Expected property or evidence | Classification | Authoritative source | Existing coverage and limitation |
|---|---|---|---|---|---|
| CAT-001 | `public` schema exists | Exact schema name `public` | EXPECTATION-CONTRACT EXTRACTABLE; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-reviewed-expectations.json`](../../scripts/financial-e2e-reviewed-expectations.json:6); [`financial-e2e-schema-provisioning.generated.sql`](../../prisma/financial-e2e-schema-provisioning.generated.sql:1-4), “Generated offline…” header | The expectation file names it; the generated SQL header is baseline context only and does not prove schema creation, ownership, placement, or live state |
| CAT-002 | Prisma enums exist | `SystemRole`, `PermissionAction`, `InvoiceStatus`, `TaxDataStatus`, `PurchaseGstReconciliationStatus`, `PurchaseGstAccountingAcceptanceStatus`, `PurchaseGstEvidenceRevisionKind`, `PurchaseGstReconciliationEventKind`, `PaymentMode`, `StockMovementType`, `ScheduleClass`, `AuditEventType`, `LedgerEntryType`, with exact labels/order from Prisma | PRISMA/SQL EXTRACTABLE; CONNECTED VERIFICATION REQUIRED | [`schema.prisma`](../../prisma/schema.prisma:21); generated enum DDL begins at [`financial-e2e-schema-provisioning.generated.sql`](../../prisma/financial-e2e-schema-provisioning.generated.sql:5) | Static guard checks enum names in source and generated SQL; GST-TEST-04 requires live `pg_type`/`pg_enum` comparison |
| CAT-003 | Application tables exist | The 26 Prisma models are present with the source-defined columns and names | PRISMA/SQL EXTRACTABLE; CONNECTED VERIFICATION REQUIRED | [`schema.prisma`](../../prisma/schema.prisma:172); generated `CREATE TABLE` statements | Static guard compares model/table presence; does not prove deployment |
| CAT-004 | Tenant key shape | Tenant-owned tables use `tenant_id`; `tenants` uses `id`; `users` and `role_permissions` are relation-scoped RLS exceptions | REVIEWED SECURITY/RLS; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:88); [`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:25) | Static text checks only; no live column/policy evidence |
| CAT-005 | GST evidence model | Supplier-declared raw/parsed values, source provenance, capture actor/time, correction chain, and transaction facts are preserved | PRISMA/SQL EXTRACTABLE; CONNECTED VERIFICATION REQUIRED | [`schema.prisma`](../../prisma/schema.prisma:534); [`purchase-gst-persistence-design.md`](./purchase-gst-persistence-design.md:1), “1. Decisions and boundaries” | Schema and generated SQL represent fields; design is explicitly not implementation authorization; no connected persistence or immutability test |
| CAT-006 | GST calculation model | Rule version, provenance, input fingerprint, calculated taxable/tax/total/round-off values are stored | PRISMA/SQL EXTRACTABLE; CONNECTED VERIFICATION REQUIRED | [`schema.prisma`](../../prisma/schema.prisma:616) | Source inspection only; no live catalog evidence |
| CAT-007 | Accounting decision model | Accepted values remain distinct and are linked to evidence and calculation, with actor, rationale, outcome, and reference | PRISMA/SQL EXTRACTABLE; CONNECTED VERIFICATION REQUIRED | [`schema.prisma`](../../prisma/schema.prisma:643); [`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:81-83), “GST-APP-03” and “GST-APP-05” | Static Option B check covers one relation; no runtime decision test |
| CAT-008 | Reconciliation event model | Event and line-link records preserve evidence revision, actor, event kind, and historical relationships | PRISMA/SQL EXTRACTABLE; CONNECTED VERIFICATION REQUIRED | [`schema.prisma`](../../prisma/schema.prisma:674) | Schema representation only; append-only behavior is not live-verified |
| CON-001 | Primary and unique keys | Source-defined primary keys, tenant-aware unique keys, and indexes | PRISMA/SQL EXTRACTABLE; CONNECTED VERIFICATION REQUIRED | [`schema.prisma`](../../prisma/schema.prisma:172); generated index section [`financial-e2e-schema-provisioning.generated.sql`](../../prisma/financial-e2e-schema-provisioning.generated.sql:616) | Static guard checks model/table and selected markers only; it does not establish complete constraint/index equivalence or live catalog state |
| CON-002 | `calculation_id` relation | Composite `(tenant_id, purchase_invoice_id, calculation_id)` FK; mapped name `purchase_gst_decision_calculation_fkey`; `ON DELETE RESTRICT` | PRISMA/SQL EXTRACTABLE; OWNER APPROVAL REQUIRED for execution policy; CONNECTED VERIFICATION REQUIRED | [`schema.prisma`](../../prisma/schema.prisma:667); [`financial-e2e-schema-provisioning.generated.sql`](../../prisma/financial-e2e-schema-provisioning.generated.sql:1000); [`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:81), “GST-APP-03” | Static guard checks the relation and mapped FK; no orphan/cross-tenant/delete runtime tests |
| CON-003 | Current GST pointers | Nullable invoice pointers use tenant/invoice composite support keys and guarded `ON DELETE RESTRICT` FKs | PRISMA/SQL EXTRACTABLE; CONNECTED VERIFICATION REQUIRED | [`schema.prisma`](../../prisma/schema.prisma:465-469); [`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:82), “GST-APP-04” | Generated artifact and static checks represent source; no live nullability or pointer tests |
| CON-004 | Purchase posting uniqueness | Unique `(tenant_id, idempotency_key)` and `(tenant_id, purchase_invoice_id)` | PRISMA/SQL EXTRACTABLE; CONNECTED VERIFICATION REQUIRED | [`schema.prisma`](../../prisma/schema.prisma:499-501); [`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:84), “GST-APP-06” | Keys are represented in the baseline; duplicate/concurrency behavior remains unexecuted |
| SEC-001 | Bootstrap/runtime separation | Reviewed model intends `pharmnos_e2e` to provision/own baseline objects and `pharmnos_e2e_runtime` to be the ordinary verifier; roles must be distinct | REVIEWED SECURITY/RLS; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:6); [`financial-e2e-initialization-contract.mjs`](../../scripts/financial-e2e-initialization-contract.mjs:105) | Pure tests reject role collision and superuser/BYPASSRLS runtime evidence; intended ownership is not verified current database state |
| SEC-002 | Runtime role attributes | Runtime must be `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS` | REVIEWED SECURITY/RLS; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-initialization-contract.mjs`](../../scripts/financial-e2e-initialization-contract.mjs:105); provisioning artifact review | Synthetic evidence tests only; actual `pg_authid` state is unknown |
| SEC-003 | Schema/default privileges | Revoke public defaults; runtime has schema `USAGE` and no schema `CREATE` | REVIEWED SECURITY/RLS; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:28) | Static guard rejects unsafe text; effective ACLs are unverified |
| SEC-004 | Runtime table grants | Ordinary tables permit only the reviewed runtime operations; GST history is SELECT/INSERT only; immutable history has no UPDATE/DELETE; tenant/audit logs have no runtime DELETE | REVIEWED SECURITY/RLS; OWNER APPROVAL REQUIRED for final effective matrix; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:43-82); [`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:79,83), “GST-APP-01” and “GST-APP-05” | Review artifact provides a grant direction; expectation file has no grants; no `role_table_grants` evidence |
| SEC-005 | Public/browser boundary | No direct browser CRUD and no implicit `anon`/`authenticated` role is assumed by this local package | REVIEWED SECURITY/RLS; OWNER APPROVAL REQUIRED for final role model; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:82); [`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:79), “GST-APP-01” | Static forbidden-grant checks only; effective database privileges unknown |
| RLS-001 | RLS enabled and forced | Every listed tenant-scoped table must have `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` | REVIEWED SECURITY/RLS; OWNER APPROVAL REQUIRED for any exception; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:13); provisioning artifact review | Static guard checks textual coverage; no `pg_class` evidence |
| RLS-002 | Direct tenant predicate | `tenant_id::text = NULLIF(current_setting('request.jwt.claim.tenant_id', true), '')` in both `USING` and `WITH CHECK` | REVIEWED SECURITY/RLS; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:25) | Static marker checks; no `pg_policies` definition comparison |
| RLS-003 | `tenants` exception | Use `id::text`; deterministic `tenant_select_tenants`, `tenant_insert_tenants`, `tenant_update_tenants` policies | REVIEWED SECURITY/RLS; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:34) | Review text only; no live policy rows |
| RLS-004 | `users` exception | Relation-scoped `EXISTS` through memberships and tenant claim; deterministic select/insert/update policies | REVIEWED SECURITY/RLS; SOURCE INCOMPLETE for executable full definition; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:47) | No explicit executable policy artifact or live evidence |
| RLS-005 | `role_permissions` exception | Relation-scoped `EXISTS` through roles and tenant claim; deterministic select/insert/update policies | REVIEWED SECURITY/RLS; SOURCE INCOMPLETE for executable full definition; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:69) | No explicit executable policy artifact or live evidence |
| RLS-006 | Policy family | `tenant_select_<table>` and `tenant_insert_<table>` for each table; update only for mutable tables; policy role/command must be explicit | REVIEWED SECURITY/RLS; SOURCE INCOMPLETE for complete executable set; CONNECTED VERIFICATION REQUIRED | Provisioning artifact review and RLS review artifact | Static guard checks broad policy markers; expectation file has no policies |
| RLS-007 | Immutable GST RLS boundary | Six GST-history tables receive SELECT/INSERT only; no direct UPDATE/DELETE policy | REVIEWED SECURITY/RLS; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:117); security controls | Static text and pure contract checks; no live policy/privilege behavior |
| RLS-008 | Audit-log boundary | No audit-log update/delete policy and no runtime DELETE privilege | REVIEWED SECURITY/RLS; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:75-82); [`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:79,83), “GST-APP-01” and “GST-APP-05” | Textual review only |
| RLS-009 | Tenant isolation behavior | Same-tenant permitted access; cross-tenant reads/writes denied; absent, empty, malformed, and mismatched claims fail closed | OWNER DIRECTION RECORDED; EXECUTABLE SPECIFICATION AND CONNECTED VERIFICATION REQUIRED | [`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:80,140), “GST-APP-02” and “GST-TEST-07” | No connected test has passed; pure contracts cannot prove isolation |
| INT-001 | Immutable-history triggers | Bootstrap-owned trigger controls reject UPDATE/DELETE on six GST history tables, with SQLSTATE `42501` | REVIEWED SECURITY/RLS; SOURCE INCOMPLETE for exact function/trigger definitions; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:176) | Static marker checks only; generated baseline contains no such controls |
| INT-002 | Finalized-invoice protection | GST pointers, statuses, and finalized GST facts cannot be mutated through ordinary paths | REVIEWED SECURITY/RLS; SOURCE INCOMPLETE; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:155-180); [`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:83), “GST-APP-05” | Exact trigger/control names and definitions are not provided |
| INT-003 | Posting state transition | Only `PROCESSING -> COMPLETED` or `PROCESSING -> FAILED`; unresolved material GST discrepancies block posting | SERVICE-LEVEL; REVIEWED SECURITY/RLS for intended database safeguards; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:186-194); [`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:84), “GST-APP-06” | Pure lifecycle tests exist; no database atomicity or transition test |
| INT-004 | Posting idempotency and atomicity | Duplicate requests deterministic; payload conflicts rejected; concurrent claims are safe; invoice/stock/ledger/audit changes are atomic | SERVICE-LEVEL; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:191-194); [`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:84), “GST-APP-06” | Not expressible as a catalog-only expectation; no connected evidence |
| INT-005 | Additive provisioning | Empty-target guard, stop-on-conflict, no destructive rollback, fresh target after unsafe partial failure | REVIEWED SECURITY/RLS; OWNER APPROVAL REQUIRED for executable application; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-additive-provisioning.review.sql`](../../prisma/financial-e2e-additive-provisioning.review.sql:1); [`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:86), “GST-APP-08” | Static guard and artifact tests; wrapper intentionally rolls back and remains review-only |
| GST-001 | GST supplier evidence | Declared taxable/tax/total/round-off source values, raw values, provenance, actor/time, and corrections remain distinct | PRISMA/SQL EXTRACTABLE; CONNECTED VERIFICATION REQUIRED | [`schema.prisma`](../../prisma/schema.prisma:534); [`purchase-gst-persistence-design.md`](./purchase-gst-persistence-design.md:11), “1. Decisions and boundaries”; [`pgst-01-purchase-gst-workflow-policy.md`](./pgst-01-purchase-gst-workflow-policy.md:1), “1. Recorded Product-owner decisions” | Product/design direction is not complete policy approval; model and generated SQL only; no persistence/history test |
| GST-002 | GST calculation | Rule version, calculation provenance, input fingerprint, calculated components, total, and round-off are preserved | PRISMA/SQL EXTRACTABLE; CONNECTED VERIFICATION REQUIRED | [`schema.prisma`](../../prisma/schema.prisma:616); [`purchase-gst-persistence-design.md`](./purchase-gst-persistence-design.md:11), “1. Decisions and boundaries”; [`pgst-01-purchase-gst-workflow-policy.md`](./pgst-01-purchase-gst-workflow-policy.md:1), status and implementation-authorization boundary | No live catalog or calculation persistence evidence |
| GST-003 | Accounting acceptance | Accepted values are separate from supplier and calculated values, with decision actor, reference, rationale, and outcome | PRISMA/SQL EXTRACTABLE; SERVICE-LEVEL; CONNECTED VERIFICATION REQUIRED | [`schema.prisma`](../../prisma/schema.prisma:643); [`pgst-01-purchase-gst-workflow-policy.md`](./pgst-01-purchase-gst-workflow-policy.md:1), status and implementation-authorization boundary; [`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:83-84), “GST-APP-05” and “GST-APP-06” | Schema represents fields; workflow authority and runtime behavior remain unverified |
| GST-004 | Reconciliation history | Events and line links are append-only, traceable to evidence revisions, and preserve actor/order | PRISMA/SQL EXTRACTABLE; REVIEWED SECURITY/RLS; CONNECTED VERIFICATION REQUIRED | [`schema.prisma`](../../prisma/schema.prisma:674); [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:155-180); [`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:83), “GST-APP-05” | No trigger/function implementation or connected append-only test |
| GST-005 | GST posting relationship | Posting operation is tenant/invoice scoped, starts in `PROCESSING`, and obeys idempotency and unresolved-discrepancy gates | PRISMA/SQL EXTRACTABLE for fields/keys; SERVICE-LEVEL for workflow; CONNECTED VERIFICATION REQUIRED | [`schema.prisma`](../../prisma/schema.prisma:484); [`financial-e2e-schema-provisioning.generated.sql`](../../prisma/financial-e2e-schema-provisioning.generated.sql:727-730); [`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:84), “GST-APP-06” | Structural keys are present; workflow remains unexecuted |
| RUN-001 | Catalog evidence shape | Future evidence must include RLS flags, policy names/commands/roles/expressions, grants, routine grants, function owner/security attributes, role attributes, constraints, and triggers | REVIEWED SECURITY/RLS; SOURCE INCOMPLETE for exact expected rows | Provisioning artifact review, catalog checklist | Initialization contract currently accepts summary booleans; no connected evidence |
| RUN-002 | Runtime identity evidence | Independent runtime connection must bind target, role, run, attempt, and freshness; bootstrap evidence cannot substitute | SERVICE-LEVEL; CONNECTED VERIFICATION REQUIRED | [`financial-e2e-initialization-contract.mjs`](../../scripts/financial-e2e-initialization-contract.mjs:37); safety module identity validator | Pure validators and tests cover binding/freshness; no actual runtime connection |
| ART-001 | Artifact provenance | Checked-in source/artifact paths, hashes, order, and review-only classifications must match manifest | MANIFEST/PACKAGE EXTRACTABLE; OFFLINE-VERIFIABLE; CONNECTED VERIFICATION REQUIRED only to compare an applied database with an approved package | [`financial-e2e-artifact-manifest.json`](../../prisma/financial-e2e-artifact-manifest.json:1); [`financial-e2e-artifact-package.mjs`](../../scripts/financial-e2e-artifact-package.mjs:1); artifact package tests | Hash/path/order tests are offline package checks; they do not prove database application or authorize execution |
| ART-002 | Application order | Baseline, security, RLS, additive wrapper, and guard references remain deterministic and review-only | REVIEWED SECURITY/RLS; OWNER APPROVAL REQUIRED for execution | Additive wrapper; static guard; manifest | Static cross-reference tests; no artifact applied |

## Source-backed schema sub-inventory

The following is an offline source inventory, not a claim that these objects
exist in a database. `?` means nullable in Prisma. `default(...)` and
`@updatedAt` are recorded exactly where declared. Decimal precision is
preserved because it is material to GST and financial behavior.

### Enums and labels

| Enum | Ordered labels | Source |
|---|---|---|
| `SystemRole` | `ADMIN`, `BILLING`, `INVENTORY`, `MANAGER` | [`schema.prisma`](../../prisma/schema.prisma:21) |
| `PermissionAction` | `manage_users`, `manage_roles`, `manage_business_profile`, `create_product`, `edit_product`, `view_product`, `create_customer`, `edit_customer`, `view_customer`, `create_supplier`, `edit_supplier`, `view_supplier`, `create_purchase`, `edit_purchase`, `view_purchase`, `accept_purchase_gst`, `finalize_purchase`, `create_invoice`, `edit_invoice`, `view_invoice`, `finalize_invoice`, `cancel_invoice`, `view_inventory`, `adjust_stock`, `manage_batches`, `view_customer_ledger`, `view_supplier_ledger`, `view_reports`, `view_audit_log` | [`schema.prisma`](../../prisma/schema.prisma:28) |
| `InvoiceStatus` | `DRAFT`, `FINALIZED`, `CANCELLED` | [`schema.prisma`](../../prisma/schema.prisma:71) |
| `TaxDataStatus` | `UNVERIFIED_DRAFT`, `COMPLETE`, `LEGACY_AGGREGATE_ONLY`, `PARTIAL`, `UNRESOLVED` | [`schema.prisma`](../../prisma/schema.prisma:77) |
| `PurchaseGstReconciliationStatus` | `NOT_RECONCILED`, `MATCHED`, `DISCREPANCY_REQUIRES_REVIEW`, `RESOLVED` | [`schema.prisma`](../../prisma/schema.prisma:85) |
| `PurchaseGstAccountingAcceptanceStatus` | `NOT_ACCEPTED`, `ACCEPTED` | [`schema.prisma`](../../prisma/schema.prisma:92) |
| `PurchaseGstEvidenceRevisionKind` | `INITIAL`, `CORRECTION` | [`schema.prisma`](../../prisma/schema.prisma:97) |
| `PurchaseGstReconciliationEventKind` | `EVIDENCE_CAPTURED`, `CALCULATION_RECORDED`, `MATCHED`, `DISCREPANCY_REQUIRES_REVIEW`, `RESOLVED`, `ACCOUNTING_ACCEPTED`, `CORRECTED` | [`schema.prisma`](../../prisma/schema.prisma:102) |
| `PaymentMode` | `CASH`, `CARD`, `UPI`, `CREDIT`, `MIXED` | [`schema.prisma`](../../prisma/schema.prisma:112) |
| `StockMovementType` | `PURCHASE_IN`, `SALE_OUT`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `SALES_RETURN_IN`, `PURCHASE_RETURN_OUT`, `OPENING_STOCK` | [`schema.prisma`](../../prisma/schema.prisma:120) |
| `ScheduleClass` | `H`, `H1`, `X`, `SCHEDULE_H`, `SCHEDULE_H1`, `SCHEDULE_X`, `OTC`, `OTHER` | [`schema.prisma`](../../prisma/schema.prisma:130) |
| `AuditEventType` | `AUTH_LOGIN`, `AUTH_LOGOUT`, `USER_INVITED`, `USER_ROLE_CHANGED`, `BUSINESS_PROFILE_UPDATED`, `INVOICE_CREATED`, `INVOICE_FINALIZED`, `INVOICE_CANCELLED`, `PURCHASE_CREATED`, `PURCHASE_FINALIZED`, `STOCK_ADJUSTED`, `PRICE_UPDATED`, `PRODUCT_CREATED`, `PRODUCT_UPDATED` | [`schema.prisma`](../../prisma/schema.prisma:141) |
| `LedgerEntryType` | `INVOICE`, `PAYMENT_RECEIVED`, `CREDIT_NOTE`, `PURCHASE`, `PAYMENT_MADE`, `DEBIT_NOTE`, `OPENING_BALANCE` | [`schema.prisma`](../../prisma/schema.prisma:158) |

The generated baseline contains corresponding `CREATE TYPE ... AS ENUM`
statements beginning at [`financial-e2e-schema-provisioning.generated.sql`](../../prisma/financial-e2e-schema-provisioning.generated.sql:5).
The static guard compares every Prisma enum name with generated SQL, but does
not compare live `pg_enum` labels or ordering. GST-TEST-04 requires that future
connected comparison.

### Model and column inventory

Each entry lists `name type [precision] [nullable] [default/update behavior]`.
Relations are omitted from this column list and are mapped separately below.

| Model | Columns from Prisma | Source |
|---|---|---|
| `tenants` | `id String @id default(cuid())`; `slug String @unique`; `business_name String`; `created_at DateTime default(now())`; `updated_at DateTime @updatedAt` | [`schema.prisma`](../../prisma/schema.prisma:172) |
| `users` | `id String @id default(cuid())`; `external_id String? @unique`; `email String @unique`; `full_name String?`; `phone String?`; `avatar_url String?`; `created_at DateTime default(now())`; `updated_at DateTime @updatedAt` | [`schema.prisma`](../../prisma/schema.prisma:201) |
| `memberships` | `id String @id default(cuid())`; `tenant_id String`; `user_id String`; `role_id String`; `status String default("active")`; `invited_by String?`; `invited_at DateTime?`; `joined_at DateTime?`; `created_at DateTime default(now())`; `updated_at DateTime @updatedAt` | [`schema.prisma`](../../prisma/schema.prisma:215) |
| `roles` | `id String @id default(cuid())`; `tenant_id String`; `name String`; `system_role SystemRole?`; `description String?`; `is_default Boolean default(false)`; `created_at DateTime default(now())`; `updated_at DateTime @updatedAt` | [`schema.prisma`](../../prisma/schema.prisma:240) |
| `role_permissions` | `id String @id default(cuid())`; `role_id String`; `permission PermissionAction`; `created_at DateTime default(now())` | [`schema.prisma`](../../prisma/schema.prisma:257) |
| `business_profiles` | `id String @id default(cuid())`; `tenant_id String @unique`; `address_line_1 String?`; `address_line_2 String?`; `city String?`; `state String?`; `pincode String?`; `country String default("India")`; `gstin String?`; `pan String?`; `drug_license_no_1 String?`; `drug_license_no_2 String?`; `contact_phone String?`; `contact_email String?`; `invoice_prefix String default("INV")`; `invoice_next_seq Int default(1)`; `purchase_prefix String default("PUR")`; `purchase_next_seq Int default(1)`; `default_gst_rate Decimal? @db.Decimal(5,2)`; `near_expiry_days Int default(60)`; `created_at DateTime default(now())`; `updated_at DateTime @updatedAt` | [`schema.prisma`](../../prisma/schema.prisma:269) |
| `products` | `id String @id default(cuid())`; `tenant_id String`; `sku String?`; `name String`; `generic_name String?`; `manufacturer String?`; `pack_size String?`; `hsn_code String?`; `gst_rate Decimal @db.Decimal(5,2)`; `schedule_classification ScheduleClass?`; `mrp Decimal? @db.Decimal(12,2)`; `standard_sale_rate Decimal? @db.Decimal(12,2)`; `purchase_rate Decimal? @db.Decimal(12,2)`; `reorder_level Int default(0)`; `is_active Boolean default(true)`; `created_at DateTime default(now())`; `updated_at DateTime @updatedAt`; `created_by String?` | [`schema.prisma`](../../prisma/schema.prisma:300) |
| `product_batches` | `id String @id default(cuid())`; `tenant_id String`; `product_id String`; `batch_no String`; `expiry_date DateTime?`; `mrp Decimal? @db.Decimal(12,2)`; `purchase_rate Decimal? @db.Decimal(12,2)`; `sale_rate Decimal? @db.Decimal(12,2)`; `received_qty Int default(0)`; `available_qty Int default(0)`; `supplier_id String?`; `purchase_id String?`; `is_blocked Boolean default(false)`; `created_at DateTime default(now())`; `updated_at DateTime @updatedAt` | [`schema.prisma`](../../prisma/schema.prisma:332) |
| `customers` | `id String @id default(cuid())`; `tenant_id String`; `code String?`; `business_name String`; `contact_person String?`; `phone String?`; `mobile String?`; `email String?`; `billing_address_1 String?`; `billing_address_2 String?`; `billing_city String?`; `billing_state String?`; `billing_pincode String?`; `gstin String?`; `drug_license_no_1 String?`; `drug_license_no_2 String?`; `credit_limit Decimal? @db.Decimal(14,2)`; `opening_balance Decimal? @db.Decimal(14,2)`; `receivable_balance Decimal @db.Decimal(14,2) default(0)`; `is_active Boolean default(true)`; `created_at DateTime default(now())`; `updated_at DateTime @updatedAt` | [`schema.prisma`](../../prisma/schema.prisma:362) |
| `suppliers` | `id String @id default(cuid())`; `tenant_id String`; `code String?`; `business_name String`; `contact_person String?`; `phone String?`; `mobile String?`; `email String?`; `address_1 String?`; `address_2 String?`; `city String?`; `state String?`; `pincode String?`; `gstin String?`; `drug_license_no String?`; `opening_balance Decimal? @db.Decimal(14,2)`; `payable_balance Decimal @db.Decimal(14,2) default(0)`; `is_active Boolean default(true)`; `created_at DateTime default(now())`; `updated_at DateTime @updatedAt` | [`schema.prisma`](../../prisma/schema.prisma:396) |
| `purchase_invoices` | `id String @id default(cuid())`; `tenant_id String`; `invoice_no String`; `supplier_id String`; `supplier_invoice_no String?`; `invoice_date DateTime`; `status InvoiceStatus default(DRAFT)`; `gst_reconciliation_status PurchaseGstReconciliationStatus default(NOT_RECONCILED)`; `gst_accounting_acceptance_status PurchaseGstAccountingAcceptanceStatus default(NOT_ACCEPTED)`; `current_gst_evidence_revision_id String?`; `current_gst_calculation_id String?`; `current_gst_accounting_decision_id String?`; `gst_record_version Int default(0)`; `gross_amount Decimal @db.Decimal(14,2)`; `total_discount Decimal @db.Decimal(14,2) default(0)`; `total_tax Decimal @db.Decimal(14,2) default(0)`; `round_off Decimal @db.Decimal(10,2) default(0)`; `net_amount Decimal @db.Decimal(14,2)`; `notes String?`; `created_by String?`; `finalized_at DateTime?`; `cancelled_at DateTime?`; `cancelled_by String?`; `created_at DateTime default(now())`; `updated_at DateTime @updatedAt` | [`schema.prisma`](../../prisma/schema.prisma:432) |
| `purchase_posting_operations` | `id String @id default(cuid())`; `tenant_id String`; `purchase_invoice_id String`; `idempotency_key String`; `request_payload_hash String`; `status String default("PROCESSING")`; `result_invoice_no String?`; `result_purchase_id String?`; `created_at DateTime default(now())`; `updated_at DateTime @updatedAt` | [`schema.prisma`](../../prisma/schema.prisma:484) |
| `purchase_invoice_items` | `id String @id default(cuid())`; `tenant_id String`; `purchase_id String`; `product_id String`; `batch_no String`; `expiry_date DateTime?`; `quantity Int`; `free_qty Int default(0)`; `purchase_rate Decimal @db.Decimal(12,2)`; `discount_pct Decimal? @db.Decimal(5,2)`; `discount_amount Decimal @db.Decimal(12,2) default(0)`; `gst_rate Decimal @db.Decimal(5,2)`; `gst_amount Decimal @db.Decimal(12,2) default(0)`; `mrp Decimal? @db.Decimal(12,2)`; `sale_rate Decimal? @db.Decimal(12,2)`; `line_total Decimal @db.Decimal(14,2)`; `created_at DateTime default(now())` | [`schema.prisma`](../../prisma/schema.prisma:504) |
| `purchase_gst_evidence_revisions` | `id String @id default(cuid())`; `tenant_id String`; `purchase_invoice_id String`; `revision_number Int`; `revision_kind PurchaseGstEvidenceRevisionKind`; `supersedes_revision_id String?`; `source_document_reference String?`; `capture_channel String`; `capture_provenance Json?`; `correction_reason String?`; `captured_at DateTime default(now())`; `captured_by_membership_id String`; declared raw fields `declared_taxable_value_raw`, `declared_cgst_raw`, `declared_sgst_raw`, `declared_igst_raw`, `declared_cess_raw`, `declared_invoice_total_raw`, `declared_round_off_raw` are `String?`; declared numeric fields `declared_taxable_value`, `declared_cgst`, `declared_sgst`, `declared_igst`, `declared_cess`, `declared_invoice_total`, `declared_round_off` are `Decimal? @db.Decimal(20,4)`; `supplier_state_at_transaction String?`; `recipient_state_at_transaction String?`; `delivery_state_at_transaction String?`; `supply_scenario String?`; `supply_facts Json?`; `source_fingerprint String?` | [`schema.prisma`](../../prisma/schema.prisma:534) |
| `purchase_gst_line_evidence` | `id String @id @default(cuid())`; `tenant_id String`; `purchase_invoice_id String`; `evidence_revision_id String`; `purchase_invoice_item_id String`; declared raw fields `declared_taxable_value_raw`, `declared_cgst_raw`, `declared_sgst_raw`, `declared_igst_raw`, `declared_cess_raw`, `declared_line_total_raw` are `String?`; declared numeric fields `declared_taxable_value`, `declared_cgst`, `declared_sgst`, `declared_igst`, `declared_cess`, `declared_line_total` are `Decimal? @db.Decimal(20,4)` | [`schema.prisma`](../../prisma/schema.prisma:586-601) |
| `purchase_gst_calculations` | `id String @id @default(cuid())`; `tenant_id String`; `purchase_invoice_id String`; `evidence_revision_id String`; `rule_version String`; `calculated_at DateTime default(now())`; `calculation_provenance Json?`; `input_fingerprint String?`; `calculated_taxable_value Decimal? @db.Decimal(20,4)`; `calculated_cgst Decimal? @db.Decimal(20,4)`; `calculated_sgst Decimal? @db.Decimal(20,4)`; `calculated_igst Decimal? @db.Decimal(20,4)`; `calculated_cess Decimal? @db.Decimal(20,4)`; `calculated_invoice_total Decimal? @db.Decimal(20,4)`; `calculated_round_off Decimal? @db.Decimal(20,4)` | [`schema.prisma`](../../prisma/schema.prisma:616-640) |
| `purchase_gst_accounting_decisions` | `id String @id @default(cuid())`; `tenant_id String`; `purchase_invoice_id String`; `evidence_revision_id String`; `calculation_id String`; accepted fields `accepted_taxable_value`, `accepted_cgst`, `accepted_sgst`, `accepted_igst`, `accepted_cess`, `accepted_invoice_total`, `accepted_round_off` are `Decimal? @db.Decimal(20,4)`; `accepted_value_source String`; `decision_reference String`; `decision_outcome String`; `rationale String`; `decided_at DateTime default(now())`; `decided_by_membership_id String` | [`schema.prisma`](../../prisma/schema.prisma:643-671) |
| `purchase_gst_reconciliation_events` | `id String @id @default(cuid())`; `tenant_id String`; `purchase_invoice_id String`; `evidence_revision_id String`; `event_kind PurchaseGstReconciliationEventKind`; `from_status PurchaseGstReconciliationStatus?`; `to_status PurchaseGstReconciliationStatus?`; `operation String`; `idempotency_key String`; `request_payload_hash String?`; `decision_reference String?`; `rule_version String?`; `actor_membership_id String?`; `declared_snapshot Json?`; `calculated_snapshot Json?`; `accepted_snapshot Json?`; `discrepancy_details Json?`; `metadata Json?`; `created_at DateTime default(now())` | [`schema.prisma`](../../prisma/schema.prisma:674-707) |
| `purchase_gst_reconciliation_event_lines` | `id String @id @default(cuid())`; `tenant_id String`; `purchase_invoice_id String`; `evidence_revision_id String`; `event_id String`; `line_evidence_id String` | [`schema.prisma`](../../prisma/schema.prisma:709-722) |
| `sales_invoices` | `id String @id default(cuid())`; `tenant_id String`; `invoice_no String`; `customer_id String?`; `invoice_date DateTime`; `status InvoiceStatus default(DRAFT)`; `tax_data_status TaxDataStatus?`; `place_of_supply_code String?`; `is_cash_sale Boolean default(false)`; `gross_amount Decimal @db.Decimal(14,2)`; `total_discount Decimal @db.Decimal(14,2) default(0)`; `total_tax Decimal @db.Decimal(14,2) default(0)`; `round_off Decimal @db.Decimal(10,2) default(0)`; `net_amount Decimal @db.Decimal(14,2)`; `paid_amount Decimal @db.Decimal(14,2) default(0)`; `balance_due Decimal @db.Decimal(14,2) default(0)`; `payment_mode PaymentMode?`; `notes String?`; `created_by String?`; `finalized_at DateTime?`; `cancelled_at DateTime?`; `cancelled_by String?`; `cancel_reason String?`; seller snapshot fields `seller_name_snapshot`, `seller_address_line_1_snapshot`, `seller_address_line_2_snapshot`, `seller_city_snapshot`, `seller_state_snapshot`, `seller_pincode_snapshot`, `seller_gstin_snapshot` are `String?`; customer snapshot fields `customer_name_snapshot`, `customer_address_line_1_snapshot`, `customer_address_line_2_snapshot`, `customer_city_snapshot`, `customer_state_snapshot`, `customer_pincode_snapshot`, `customer_gstin_snapshot` are `String?`; `created_at DateTime default(now())`; `updated_at DateTime @updatedAt` | [`schema.prisma`](../../prisma/schema.prisma:728) |
| `sales_invoice_items` | `id String @id default(cuid())`; `tenant_id String`; `invoice_id String`; `product_id String`; `batch_id String?`; `batch_no String`; `quantity Int`; `free_qty Int default(0)`; `sale_rate Decimal @db.Decimal(12,2)`; `mrp Decimal? @db.Decimal(12,2)`; `discount_pct Decimal? @db.Decimal(5,2)`; `discount_amount Decimal @db.Decimal(12,2) default(0)`; `taxable_amount Decimal? @db.Decimal(14,2)`; `gst_rate Decimal @db.Decimal(5,2)`; `gst_amount Decimal @db.Decimal(12,2) default(0)`; `cgst_amount Decimal? @db.Decimal(12,2)`; `sgst_amount Decimal? @db.Decimal(12,2)`; `igst_amount Decimal? @db.Decimal(12,2)`; `cess_amount Decimal? @db.Decimal(12,2)`; product snapshot fields `product_name_snapshot`, `generic_name_snapshot`, `hsn_code_snapshot` are `String?`; `batch_expiry_snapshot DateTime?`; `line_total Decimal @db.Decimal(14,2)`; `created_at DateTime default(now())` | [`schema.prisma`](../../prisma/schema.prisma:782) |
| `payments` | `id String @id default(cuid())`; `tenant_id String`; `customer_id String?`; `invoice_id String?`; `entry_type LedgerEntryType`; `payment_mode PaymentMode?`; `amount Decimal @db.Decimal(14,2)`; `reference_no String?`; `payment_date DateTime`; `notes String?`; `created_by String?`; `created_at DateTime default(now())` | [`schema.prisma`](../../prisma/schema.prisma:820) |
| `stock_movements` | `id String @id default(cuid())`; `tenant_id String`; `product_id String`; `batch_id String?`; `movement_type StockMovementType`; `quantity_delta Int`; `reference_type String?`; `reference_id String?`; `unit_rate Decimal? @db.Decimal(12,2)`; `notes String?`; `created_by String?`; `created_at DateTime default(now())` | [`schema.prisma`](../../prisma/schema.prisma:848) |
| `customer_ledgers` | `id String @id default(cuid())`; `tenant_id String`; `customer_id String`; `entry_type LedgerEntryType`; `debit Decimal @db.Decimal(14,2) default(0)`; `credit Decimal @db.Decimal(14,2) default(0)`; `balance Decimal @db.Decimal(14,2)`; `reference_type String?`; `reference_id String?`; `invoice_id String?`; `narration String?`; `entry_date DateTime`; `created_at DateTime default(now())` | [`schema.prisma`](../../prisma/schema.prisma:877) |
| `supplier_ledgers` | `id String @id default(cuid())`; `tenant_id String`; `supplier_id String`; `entry_type LedgerEntryType`; `debit Decimal @db.Decimal(14,2) default(0)`; `credit Decimal @db.Decimal(14,2) default(0)`; `balance Decimal @db.Decimal(14,2)`; `reference_type String?`; `reference_id String?`; `purchase_id String?`; `narration String?`; `entry_date DateTime`; `created_at DateTime default(now())` | [`schema.prisma`](../../prisma/schema.prisma:901) |
| `audit_logs` | `id String @id default(cuid())`; `tenant_id String`; `event_type AuditEventType`; `actor_id String?`; `target_type String?`; `target_id String?`; `metadata Json?`; `ip_address String?`; `user_agent String?`; `created_at DateTime default(now())` | [`schema.prisma`](../../prisma/schema.prisma:929) |

The inventory above records source declarations only. It does not infer
database ownership, applied defaults, physical types beyond the Prisma
generated SQL, or runtime behavior.

### Keys, indexes, and foreign keys

The complete source-backed key/index inventory is the `@@id`, `@@unique`, and
`@@index` declarations in the model ranges above and their generated
`CREATE INDEX` statements in
[`financial-e2e-schema-provisioning.generated.sql`](../../prisma/financial-e2e-schema-provisioning.generated.sql:616).
The FK inventory below individually enumerates the `@relation(... fields,
references, onDelete, map)` declarations and generated
`ALTER TABLE ... ADD CONSTRAINT` statements. `ON UPDATE` is included only
where the generated SQL states it. A composite FK containing `tenant_id` is
marked tenant-scoped. This is a source inventory, not proof of an applied
catalog.
Important GST/posting keys include:

- current invoice pointers: `purchase_invoices_current_gst_evidence_fkey`,
  `purchase_invoices_current_gst_calculation_fkey`, and
  `purchase_invoices_current_gst_accounting_decision_fkey`, all composite,
  nullable-supporting, `ON DELETE RESTRICT`;
- `purchase_gst_decision_calculation_fkey`, composite and `ON DELETE RESTRICT`;
- evidence revision identity/revision-number uniques;
- event operation/idempotency unique;
- posting idempotency and invoice uniques;
- tenant/invoice/revision/line composite identities.

| Source table | Source fields -> referenced table/fields | Tenant scope | `ON DELETE` | `ON UPDATE` | Generated constraint name | Source / generated SQL |
|---|---|---|---|---|---|
| `memberships` | `tenant_id` -> `tenants.id` | yes | CASCADE | CASCADE | `memberships_tenant_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:227); generated:901 |
| `memberships` | `user_id` -> `users.id` | no | CASCADE | CASCADE | `memberships_user_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:228); generated:904 |
| `memberships` | `role_id` -> `roles.id` | no | RESTRICT | CASCADE | `memberships_role_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:229); generated:907 |
| `role_permissions` | `role_id` -> `roles.id` | no | CASCADE | CASCADE | `role_permissions_role_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:263); generated:910 |
| `business_profiles` | `tenant_id` -> `tenants.id` | yes | CASCADE | CASCADE | `business_profiles_tenant_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:293); generated:913 |
| `products` | `tenant_id` -> `tenants.id` | yes | CASCADE | CASCADE | `products_tenant_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:320); generated:916 |
| `product_batches` | `tenant_id` -> `tenants.id` | yes | CASCADE | CASCADE | `product_batches_tenant_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:349); generated:919 |
| `product_batches` | `product_id` -> `products.id` | no | CASCADE | CASCADE | `product_batches_product_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:350); generated:922 |
| `product_batches` | `supplier_id` -> `suppliers.id` | no | SET NULL | CASCADE | `product_batches_supplier_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:351); generated:925 |
| `product_batches` | `purchase_id` -> `purchase_invoices.id` | no | SET NULL | CASCADE | `product_batches_purchase_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:352); generated:928 |
| `customers` | `tenant_id` -> `tenants.id` | yes | CASCADE | CASCADE | `customers_tenant_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:386); generated:931 |
| `suppliers` | `tenant_id` -> `tenants.id` | yes | CASCADE | CASCADE | `suppliers_tenant_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:418); generated:934 |
| `purchase_invoices` | `tenant_id` -> `tenants.id` | yes | CASCADE | CASCADE | `purchase_invoices_tenant_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:459); generated:937 |
| `purchase_invoices` | `supplier_id` -> `suppliers.id` | no | RESTRICT | CASCADE | `purchase_invoices_supplier_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:460); generated:940 |
| `purchase_invoices` | composite `tenant_id,id,current_gst_evidence_revision_id` -> `purchase_gst_evidence_revisions.tenant_id,purchase_invoice_id,id` | yes | RESTRICT | CASCADE | `purchase_invoices_current_gst_evidence_fkey` | [`schema.prisma`](../../prisma/schema.prisma:465); generated:943 |
| `purchase_invoices` | composite `tenant_id,id,current_gst_calculation_id` -> `purchase_gst_calculations.tenant_id,purchase_invoice_id,id` | yes | RESTRICT | CASCADE | `purchase_invoices_current_gst_calculation_fkey` | [`schema.prisma`](../../prisma/schema.prisma:467); generated:946 |
| `purchase_invoices` | composite `tenant_id,id,current_gst_accounting_decision_id` -> `purchase_gst_accounting_decisions.tenant_id,purchase_invoice_id,id` | yes | RESTRICT | CASCADE | `purchase_invoices_current_gst_accounting_decision_fkey` | [`schema.prisma`](../../prisma/schema.prisma:469); generated:949 |
| `purchase_posting_operations` | `tenant_id` -> `tenants.id` | yes | CASCADE | CASCADE | `purchase_posting_operations_tenant_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:496); generated:952 |
| `purchase_posting_operations` | composite `tenant_id,purchase_invoice_id` -> `purchase_invoices.tenant_id,id` | yes | RESTRICT | CASCADE | `purchase_posting_operations_tenant_id_purchase_invoice_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:497); generated:955 |
| `purchase_invoice_items` | `tenant_id` -> `tenants.id` | yes | CASCADE | CASCADE | `purchase_invoice_items_tenant_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:523); generated:958 |
| `purchase_invoice_items` | composite `tenant_id,purchase_id` -> `purchase_invoices.tenant_id,id` | yes | CASCADE | CASCADE | `purchase_invoice_items_purchase_fkey` | [`schema.prisma`](../../prisma/schema.prisma:524); generated:961 |
| `purchase_invoice_items` | `product_id` -> `products.id` | no | RESTRICT | CASCADE | `purchase_invoice_items_product_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:525); generated:964 |
| `purchase_gst_evidence_revisions` | composite `tenant_id,purchase_invoice_id` -> `purchase_invoices.tenant_id,id` | yes | RESTRICT | CASCADE | `purchase_gst_evidence_purchase_fkey` | [`schema.prisma`](../../prisma/schema.prisma:568); generated:967 |
| `purchase_gst_evidence_revisions` | composite `tenant_id,purchase_invoice_id,supersedes_revision_id` -> same table `tenant_id,purchase_invoice_id,id` | yes | RESTRICT | CASCADE | `purchase_gst_evidence_supersedes_fkey` | [`schema.prisma`](../../prisma/schema.prisma:570); generated:970 |
| `purchase_gst_evidence_revisions` | composite `tenant_id,captured_by_membership_id` -> `memberships.tenant_id,id` | yes | RESTRICT | CASCADE | `purchase_gst_evidence_capture_actor_fkey` | [`schema.prisma`](../../prisma/schema.prisma:572); generated:973 |
| `purchase_gst_line_evidence` | `tenant_id` -> `tenants.id` | yes | CASCADE | CASCADE | `purchase_gst_line_evidence_tenant_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:605); generated:976 |
| `purchase_gst_line_evidence` | composite `tenant_id,purchase_invoice_id,evidence_revision_id` -> `purchase_gst_evidence_revisions.tenant_id,purchase_invoice_id,id` | yes | RESTRICT | CASCADE | `purchase_gst_line_evidence_revision_fkey` | [`schema.prisma`](../../prisma/schema.prisma:606); generated:979 |
| `purchase_gst_line_evidence` | composite `tenant_id,purchase_invoice_id,purchase_invoice_item_id` -> `purchase_invoice_items.tenant_id,purchase_id,id` | yes | RESTRICT | CASCADE | `purchase_gst_line_evidence_item_fkey` | [`schema.prisma`](../../prisma/schema.prisma:607); generated:982 |
| `purchase_gst_calculations` | composite `tenant_id,purchase_invoice_id` -> `purchase_invoices.tenant_id,id` | yes | RESTRICT | CASCADE | `purchase_gst_calculation_purchase_fkey` | [`schema.prisma`](../../prisma/schema.prisma:633); generated:985 |
| `purchase_gst_calculations` | composite `tenant_id,purchase_invoice_id,evidence_revision_id` -> `purchase_gst_evidence_revisions.tenant_id,purchase_invoice_id,id` | yes | RESTRICT | CASCADE | `purchase_gst_calculation_revision_fkey` | [`schema.prisma`](../../prisma/schema.prisma:635); generated:988 |
| `purchase_gst_accounting_decisions` | composite `tenant_id,purchase_invoice_id` -> `purchase_invoices.tenant_id,id` | yes | RESTRICT | CASCADE | `purchase_gst_decision_purchase_fkey` | [`schema.prisma`](../../prisma/schema.prisma:663); generated:991 |
| `purchase_gst_accounting_decisions` | composite `tenant_id,purchase_invoice_id,evidence_revision_id` -> `purchase_gst_evidence_revisions.tenant_id,purchase_invoice_id,id` | yes | RESTRICT | CASCADE | `purchase_gst_decision_revision_fkey` | [`schema.prisma`](../../prisma/schema.prisma:665); generated:994 |
| `purchase_gst_accounting_decisions` | composite `tenant_id,decided_by_membership_id` -> `memberships.tenant_id,id` | yes | RESTRICT | CASCADE | `purchase_gst_decision_actor_fkey` | [`schema.prisma`](../../prisma/schema.prisma:666); generated:997 |
| `purchase_gst_accounting_decisions` | composite `tenant_id,purchase_invoice_id,calculation_id` -> `purchase_gst_calculations.tenant_id,purchase_invoice_id,id` | yes | RESTRICT | CASCADE | `purchase_gst_decision_calculation_fkey` | [`schema.prisma`](../../prisma/schema.prisma:667); generated:1000 |
| `purchase_gst_reconciliation_events` | `tenant_id` -> `tenants.id` | yes | CASCADE | CASCADE | `purchase_gst_reconciliation_events_tenant_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:695); generated:1003 |
| `purchase_gst_reconciliation_events` | composite `tenant_id,purchase_invoice_id` -> `purchase_invoices.tenant_id,id` | yes | RESTRICT | CASCADE | `purchase_gst_event_purchase_fkey` | [`schema.prisma`](../../prisma/schema.prisma:696); generated:1006 |
| `purchase_gst_reconciliation_events` | composite `tenant_id,purchase_invoice_id,evidence_revision_id` -> `purchase_gst_evidence_revisions.tenant_id,purchase_invoice_id,id` | yes | RESTRICT | CASCADE | `purchase_gst_event_revision_fkey` | [`schema.prisma`](../../prisma/schema.prisma:697); generated:1009 |
| `purchase_gst_reconciliation_events` | composite `tenant_id,actor_membership_id` -> `memberships.tenant_id,id` | yes | RESTRICT | CASCADE | `purchase_gst_event_actor_fkey` | [`schema.prisma`](../../prisma/schema.prisma:698); generated:1012 |
| `purchase_gst_reconciliation_event_lines` | composite `tenant_id,purchase_invoice_id,evidence_revision_id,event_id` -> `purchase_gst_reconciliation_events.tenant_id,purchase_invoice_id,evidence_revision_id,id` | yes | RESTRICT | CASCADE | `purchase_gst_event_line_event_fkey` | [`schema.prisma`](../../prisma/schema.prisma:717); generated:1015 |
| `purchase_gst_reconciliation_event_lines` | composite `tenant_id,purchase_invoice_id,evidence_revision_id,line_evidence_id` -> `purchase_gst_line_evidence.tenant_id,purchase_invoice_id,evidence_revision_id,id` | yes | RESTRICT | CASCADE | `purchase_gst_event_line_evidence_fkey` | [`schema.prisma`](../../prisma/schema.prisma:718); generated:1018 |
| `sales_invoices` | `tenant_id` -> `tenants.id` | yes | CASCADE | CASCADE | `sales_invoices_tenant_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:769); generated:1021 |
| `sales_invoices` | `customer_id` -> `customers.id` | no | SET NULL | CASCADE | `sales_invoices_customer_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:770); generated:1024 |
| `sales_invoice_items` | `tenant_id` -> `tenants.id` | yes | CASCADE | CASCADE | `sales_invoice_items_tenant_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:809); generated:1027 |
| `sales_invoice_items` | `invoice_id` -> `sales_invoices.id` | no | CASCADE | CASCADE | `sales_invoice_items_invoice_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:810); generated:1030 |
| `sales_invoice_items` | `product_id` -> `products.id` | no | RESTRICT | CASCADE | `sales_invoice_items_product_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:811); generated:1033 |
| `sales_invoice_items` | `batch_id` -> `product_batches.id` | no | SET NULL | CASCADE | `sales_invoice_items_batch_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:812); generated:1036 |
| `payments` | `tenant_id` -> `tenants.id` | yes | CASCADE | CASCADE | `payments_tenant_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:834); generated:1039 |
| `payments` | `customer_id` -> `customers.id` | no | SET NULL | CASCADE | `payments_customer_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:835); generated:1042 |
| `payments` | `invoice_id` -> `sales_invoices.id` | no | SET NULL | CASCADE | `payments_invoice_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:836); generated:1045 |
| `stock_movements` | `tenant_id` -> `tenants.id` | yes | CASCADE | CASCADE | `stock_movements_tenant_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:862); generated:1048 |
| `stock_movements` | `product_id` -> `products.id` | no | CASCADE | CASCADE | `stock_movements_product_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:863); generated:1051 |
| `stock_movements` | `batch_id` -> `product_batches.id` | no | SET NULL | CASCADE | `stock_movements_batch_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:864); generated:1054 |
| `customer_ledgers` | `tenant_id` -> `tenants.id` | yes | CASCADE | CASCADE | `customer_ledgers_tenant_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:892); generated:1057 |
| `customer_ledgers` | `customer_id` -> `customers.id` | no | CASCADE | CASCADE | `customer_ledgers_customer_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:893); generated:1060 |
| `customer_ledgers` | `invoice_id` -> `sales_invoices.id` | no | SET NULL | CASCADE | `customer_ledgers_invoice_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:894); generated:1063 |
| `supplier_ledgers` | `tenant_id` -> `tenants.id` | yes | CASCADE | CASCADE | `supplier_ledgers_tenant_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:916); generated:1066 |
| `supplier_ledgers` | `supplier_id` -> `suppliers.id` | no | CASCADE | CASCADE | `supplier_ledgers_supplier_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:917); generated:1069 |
| `supplier_ledgers` | `purchase_id` -> `purchase_invoices.id` | no | SET NULL | CASCADE | `supplier_ledgers_purchase_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:918); generated:1072 |
| `audit_logs` | `tenant_id` -> `tenants.id` | yes | CASCADE | CASCADE | `audit_logs_tenant_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:941); generated:1075 |
| `audit_logs` | `actor_id` -> `users.id` | no | SET NULL | CASCADE | `audit_logs_actor_id_fkey` | [`schema.prisma`](../../prisma/schema.prisma:942); generated:1078 |

The source does not provide an independent physical catalog dump. Complete
live equivalence, including every index definition and FK action, remains
CONNECTED VERIFICATION REQUIRED.

The model-level key/index inventory is:

| Model | Primary/unique declarations | Index declarations |
|---|---|---|
| `tenants` | `id`; unique `slug` | `slug` |
| `users` | `id`; unique `external_id`, `email` | none beyond unique indexes |
| `memberships` | `id`; unique `(tenant_id,user_id)`, `(tenant_id,id)` | `tenant_id`, `user_id` |
| `roles` | `id`; unique `(tenant_id,name)` | `tenant_id` |
| `role_permissions` | `id`; unique `(role_id,permission)` | `role_id` |
| `business_profiles` | `id`; unique `tenant_id` | none beyond unique index |
| `products` | `id`; unique `(tenant_id,sku)` | `tenant_id`, `(tenant_id,name)`, `(tenant_id,is_active)` |
| `product_batches` | `id`; unique `(tenant_id,product_id,batch_no)` | `tenant_id`, `(tenant_id,expiry_date)`, `(tenant_id,available_qty)` |
| `customers` | `id`; unique `(tenant_id,code)` | `tenant_id`, `(tenant_id,business_name)` |
| `suppliers` | `id`; unique `(tenant_id,code)` | `tenant_id`, `(tenant_id,business_name)` |
| `purchase_invoices` | `id`; unique `(tenant_id,invoice_no)`, `(tenant_id,id)`, `(tenant_id,id,current_gst_evidence_revision_id)`, `(tenant_id,id,current_gst_calculation_id)`, `(tenant_id,id,current_gst_accounting_decision_id)` | `tenant_id`, `(tenant_id,status)`, `(tenant_id,supplier_id)`, `(tenant_id,invoice_date)` |
| `purchase_posting_operations` | `id`; unique `(tenant_id,idempotency_key)`, `(tenant_id,purchase_invoice_id)` | `(tenant_id,purchase_invoice_id,status)` |
| `purchase_invoice_items` | `id`; unique `(tenant_id,purchase_id,id)` | `tenant_id`, `purchase_id`, `product_id` |
| `purchase_gst_evidence_revisions` | `id`; unique `(tenant_id,purchase_invoice_id,id)`, `(tenant_id,purchase_invoice_id,revision_number)` | `(tenant_id,purchase_invoice_id,captured_at)`, `(tenant_id,purchase_invoice_id,revision_kind)`, `(tenant_id,purchase_invoice_id,supersedes_revision_id)`, `(tenant_id,source_fingerprint)` |
| `purchase_gst_line_evidence` | `id`; unique `(tenant_id,purchase_invoice_id,evidence_revision_id,id)`, `(tenant_id,evidence_revision_id,purchase_invoice_item_id)` | `(tenant_id,purchase_invoice_id,purchase_invoice_item_id)`, `(tenant_id,purchase_invoice_id,evidence_revision_id)` |
| `purchase_gst_calculations` | `id`; unique `(tenant_id,purchase_invoice_id,id)` | `(tenant_id,purchase_invoice_id,evidence_revision_id)`, `(tenant_id,rule_version)` |
| `purchase_gst_accounting_decisions` | `id`; unique `(tenant_id,purchase_invoice_id,id)`, `(tenant_id,purchase_invoice_id,evidence_revision_id,decision_reference)` | `(tenant_id,purchase_invoice_id,evidence_revision_id)` |
| `purchase_gst_reconciliation_events` | `id`; unique `(tenant_id,purchase_invoice_id,evidence_revision_id,id)`, `(tenant_id,operation,idempotency_key)` | `(tenant_id,purchase_invoice_id,created_at)`, `(tenant_id,evidence_revision_id,created_at)`, `(tenant_id,event_kind,created_at)`, `(tenant_id,actor_membership_id)` |
| `purchase_gst_reconciliation_event_lines` | `id`; unique `(tenant_id,purchase_invoice_id,evidence_revision_id,id)`, `(tenant_id,purchase_invoice_id,evidence_revision_id,event_id,line_evidence_id)` | none |
| `sales_invoices` | `id`; unique `(tenant_id,invoice_no)` | `tenant_id`, `(tenant_id,status)`, `(tenant_id,customer_id)`, `(tenant_id,invoice_date)` |
| `sales_invoice_items` | `id` | `tenant_id`, `invoice_id`, `product_id`, `batch_id` |
| `payments` | `id` | `tenant_id`, `(tenant_id,customer_id)`, `(tenant_id,invoice_id)`, `(tenant_id,payment_date)` |
| `stock_movements` | `id` | `tenant_id`, `(tenant_id,product_id)`, `(tenant_id,batch_id)`, `(tenant_id,movement_type)`, `(tenant_id,created_at)` |
| `customer_ledgers` | `id` | `tenant_id`, `(tenant_id,customer_id)`, `(tenant_id,entry_date)` |
| `supplier_ledgers` | `id` | `tenant_id`, `(tenant_id,supplier_id)`, `(tenant_id,entry_date)` |
| `audit_logs` | `id` | `tenant_id`, `(tenant_id,event_type)`, `(tenant_id,created_at)`, `(tenant_id,actor_id)` |

All model foreign-key declarations, including their tenant scope and
`onDelete` actions, are in the `@relation` lines at
[`schema.prisma`](../../prisma/schema.prisma:172) through line 947. The
generated constraint names and actions are in the complete `ALTER TABLE`
section at [`financial-e2e-schema-provisioning.generated.sql`](../../prisma/financial-e2e-schema-provisioning.generated.sql:900)
through the end of the file. No relation or action is inferred beyond those
source declarations; unresolved physical-state questions remain connected
verification requirements.

### Exact reviewed RLS policy coverage

The reviewed RLS artifact lists these 26 tables: `tenants`, `users`,
`memberships`, `roles`, `role_permissions`, `business_profiles`, `products`,
`product_batches`, `customers`, `suppliers`, `purchase_invoices`,
`purchase_posting_operations`, `purchase_invoice_items`,
`purchase_gst_evidence_revisions`, `purchase_gst_line_evidence`,
`purchase_gst_calculations`, `purchase_gst_accounting_decisions`,
`purchase_gst_reconciliation_events`,
`purchase_gst_reconciliation_event_lines`, `sales_invoices`,
`sales_invoice_items`, `payments`, `stock_movements`, `customer_ledgers`,
`supplier_ledgers`, and `audit_logs`.

For each table, the reviewed contract requires:

- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`;
- `ALTER TABLE ... FORCE ROW LEVEL SECURITY`;
- `tenant_select_<table>` and `tenant_insert_<table>` for the runtime role
  `pharmnos_e2e_runtime`;
- `tenant_update_<table>` with `USING` and `WITH CHECK` for mutable tables;
- DELETE-policy requirements are unspecified in the reviewed RLS artifact. The
  reviewed runtime grant block does not grant DELETE on mutable tables; the
  source explicitly documents no runtime DELETE for immutable GST history and
  `audit_logs`, without generalizing that requirement beyond those sources;
- direct predicate
  `tenant_id::text = NULLIF(current_setting('request.jwt.claim.tenant_id', true), '')`
  in `USING` and `WITH CHECK`, unless a documented relation-scoped exception
  applies.

Exceptions specified by source are:

- `tenants`: `id::text` predicate;
- `users`: `EXISTS` through `memberships`;
- `role_permissions`: `EXISTS` through `roles`;
- six immutable GST-history tables: SELECT/INSERT only and no update/delete
  policies;
- `audit_logs`: no update/delete policy.

Source: [`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:13)
and the companion privilege contract
[`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:88).
These are reviewed specifications, not executable policy DDL or live
`pg_policies` evidence. The static guard checks textual markers and policy-name
coverage only; it does not establish policy command/role/expression equality or
actual `pg_class` RLS state.

### Privileges, ownership, and prohibited inheritance

The reviewed intended model specifies:

- `pharmnos_e2e` as the bootstrap/object-owner role for baseline-created
  objects, and `pharmnos_e2e_runtime` as the ordinary runtime verifier;
- `USAGE` on `public` for runtime and no runtime `CREATE`;
- revoked public default table, sequence, and function privileges for objects
  created by `pharmnos_e2e`;
- reviewed table grants to runtime, with GST history limited to SELECT/INSERT;
- runtime UPDATE/DELETE revoked for six immutable GST-history tables;
- runtime DELETE revoked for `tenants` and `audit_logs`;
- no runtime ownership of privileged functions and no caller-invocable
  controlled function in the current review artifact;
- if a future caller-invocable `SECURITY DEFINER` function is approved, fixed
  `search_path`, explicit arguments, no caller-controlled dynamic SQL, narrow
  `EXECUTE`, and revoked PUBLIC execution are required.

Source: [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:28)
and the GST-APP-01 decision/evidence record
[`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:79).
Exact effective table, sequence, routine, default-ACL, inherited-privilege,
ownership, and `EXECUTE` rows are not specified as a complete final matrix.
They are OWNER APPROVAL REQUIRED and CONNECTED VERIFICATION REQUIRED.

### Immutable history, finalized pointers, and posting controls

The security review requires a future owner-controlled trigger function that
raises SQLSTATE `42501` for UPDATE/DELETE on the six GST-history tables, plus a
second control rejecting changes to GST pointers, GST statuses, and GST record
version after invoice finalization. It also requires a future control allowing
only `PROCESSING -> COMPLETED` and `PROCESSING -> FAILED`, rejecting other
direct status changes with SQLSTATE `23514`.

Source: [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:155).
The generated baseline contains no installed trigger/function definitions; the
review SQL states requirements rather than supplying executable definitions.
Therefore names, timing, events, bodies, owner rows, and effective privileges
are SOURCE INCOMPLETE. These controls remain OWNER APPROVAL REQUIRED and
CONNECTED VERIFICATION REQUIRED.

Structural posting fields and keys are separate from behavior:

- structural: `status` defaults to `"PROCESSING"`, `request_payload_hash`
  exists, and the two posting uniques/index exist
  ([`schema.prisma`](../../prisma/schema.prisma:484));
- service-level: unresolved material GST blocking, payload-hash conflict
  handling, idempotency semantics, concurrency-safe claims, retry behavior,
  and atomic invoice/stock/ledger/audit writes.

The latter are SERVICE-LEVEL assertions and cannot be replaced by catalog
expectations. GST-APP-06 and GST-TEST-11/12 define required future evidence;
they do not report passed connected behavior.

### Runtime evidence provenance and persistence

The initialization contract validates synthetic evidence for target/run/attempt
binding, freshness, marker independence, role separation, runtime
`NOSUPERUSER`/`NOBYPASSRLS`, and summary catalog flags. Current offline
validation accepts supplied summary evidence objects and cannot validate actual
catalog contents field-by-field while the expectation lists remain empty.

Source: [`financial-e2e-initialization-contract.mjs`](../../scripts/financial-e2e-initialization-contract.mjs:37)
and [`financial-e2e-initialization-contract.test.mjs`](../../tests/financial-e2e-initialization-contract.test.mjs:1).
Passing these tests is not proof that a connected observation is truthful.
Independent runtime connection provenance and live RLS behavior remain CONNECTED
VERIFICATION REQUIRED.

Sanitized evidence is currently in-memory only. No append-only evidence store,
approved-path restriction, access-control enforcement, or retention mechanism is
implemented. The artifact manifest's future evidence requirement does not
change that status.

## Reconciliation of evidence types

| Evidence type | Current repository status | What it does not prove |
|---|---|---|
| Prisma schema | Current model, enum, relationship, default, index, and constraint source | That the database contains those objects |
| Generated SQL | Deterministic from-empty baseline corresponding to the Prisma schema | Safe additive migration, deployment, ownership, grants, RLS, or live state |
| Security/RLS review SQL | Reviewed design contracts for roles, grants, predicates, policies, and controls | Executable authorization or actual ACL/policy/function state |
| Static provisioning guard | Offline textual marker checks and source-to-baseline presence checks | Complete constraint/index equivalence, database identity, effective privileges, RLS catalog state, trigger behavior, or tenant isolation |
| Pure initialization/safety tests | Binding, freshness, role-attribute, and fail-closed contract behavior using supplied evidence objects | Truthfulness of connected observations or real runtime-role behavior |
| Artifact package tests | Hash, path, ordering, and review-only package integrity | Database readiness or execution approval |
| GST-APP-01 through GST-APP-08 | Owner direction and required evidence categories | Implementation completion, migration rollout, or connected financial correctness |
| GST-TEST-01 through GST-TEST-15 | Future connected test plan | Any passed database result; the source explicitly records these as not passed |

## Owner direction versus execution authorization

The rollout record states that GST-APP-01 through GST-APP-08 are recorded as
Owner's Decision. Those entries establish product/security direction and
required evidence; they do not approve an executable SQL package, migration,
database run, RLS rollout, or financial test. The same record explicitly states
that implementation, database rollout, and runtime verification remain
separate evidence gates at
[`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:72).

PGST-01 remains pending for formal policy approval and explicitly records that
implementation, database/migration, testing, pilot, and production
authorization are not granted at
[`pgst-01-purchase-gst-workflow-policy.md`](./pgst-01-purchase-gst-workflow-policy.md:1).

## Prioritized source gaps and smallest next step

1. **P0 — Exact reviewed expectation contract is incomplete.**  
   **Gap:** The JSON has no table, policy, grant, constraint, index, trigger, or
   function entries.  
   **Smallest next step:** Owner and security/database reviewers approve a
   source-backed field structure and populate only assertions that can be
   traced to the schema or reviewed artifacts.

2. **P0 — Effective role/grant model is not complete.**  
   **Gap:** The review SQL gives a runtime grant direction, but the final
   effective ACL matrix and prohibited principals are not represented.  
   **Smallest next step:** Review and approve the exact role, ownership,
   schema, table, sequence, routine, and default-ACL matrix before drafting
   grant expectations.

3. **P0 — Executable RLS policy definitions are incomplete.**  
   **Gap:** Policy families and predicates are described, but no complete
   executable policy artifact or exact `pg_policies` expected rows exist.  
   **Smallest next step:** Resolve policy role/command choices and produce a
   reviewed table-by-table policy matrix, including `tenants`, `users`, and
   `role_permissions` exceptions.

4. **P1 — Immutable and posting controls lack exact catalog definitions.**  
   **Gap:** Trigger/function names, timing, owner, definitions, and effective
   privileges are not fully specified.  
   **Smallest next step:** Document the approved trigger/function contract and
   exact catalog evidence fields without enabling execution.

5. **P1 — Runtime behavior cannot be reduced to catalog assertions.**  
   **Gap:** Tenant isolation, claim failure, posting atomicity, idempotency,
   concurrency, and correction history require service/database tests.  
   **Smallest next step:** Keep these as separate connected-verification
   scenarios in the GST-TEST matrix rather than inventing JSON catalog values.

6. **P1 — Connected evidence provenance remains unproven.**  
   **Gap:** Offline validators verify shape, binding, and freshness of supplied
   evidence but cannot establish that evidence came from a real independent
   runtime connection.  
   **Smallest next step:** Preserve the pre-connection blocker and define the
   authorized evidence record required for a future isolated run.

7. **P2 — Artifact package remains intentionally review-only.**  
   **Gap:** No gap should be “fixed” by approving the manifest.  
   **Smallest next step:** Retain hash verification and review-only status until
   owner authorization and all P0/P1 source gaps are resolved.

## Readiness status

- **Offline contract readiness:** Partial and review-only.
- **Target isolation:** Unverified; offline validators only.
- **Database initialization:** Blocked by the unconditional pre-connection
  blocker and unapproved manifest.
- **GST execution:** Blocked.
- **Broader Financial E2E execution:** Blocked.
- **Cleanup:** Unexecuted; no database fixtures exist.
- **Evidence persistence:** Not implemented; sanitized evidence remains
  in-memory only.
- **Live Supabase:** NO-GO.

## Conclusion

The repository has sufficient reviewed material to begin a controlled
expectation-file drafting review, but it does not yet have sufficient complete
and approved source material to produce an executable expectation package.
No connected readiness claim is made.

**SOURCE GAPS REQUIRE REVIEW**
