---
title: Corrected GST Schema Rollout Design Review
date: 2026-10-24
status: Review only - not approved for execution
---

# Corrected GST Schema Rollout Design Review

This document is a review-only rollout design for the GST/posting schema gap
identified in the intended Supabase database. It is not a migration, does not
authorize execution, and does not replace an approved migration baseline.

No database, Prisma schema, SQL asset, application code, environment file,
roadmap, batch number, or Git state is changed by this document.

## Evidence boundary

### Repository-confirmed

- The canonical model definitions are in `prisma/schema.prisma`.
- The seven GST/posting models are declared at lines 484-727.
- The four GST enum types are declared at lines 85-109.
- The RLS verifier in `scripts/rls-rollout-verifier.mjs` validates a supplied
  snapshot only. It never connects to PostgreSQL or executes SQL.
- The checked-in `prisma/01-apply-schema-with-rls.sql` is a destructive,
  older bootstrap and does not create the seven GST/posting tables.
- `prisma/05-rls-tenant-policies.sql` contains guarded additive RLS policy
  logic, but does not create the seven tables.
- No committed `prisma/migrations/` baseline exists.

### Live metadata baseline

The read-only baseline reported on 2026-10-24 observed:

- Database `postgres`, connected role `postgres`, `rolsuper = false`,
  `rolbypassrls = true`.
- `public.tenants`, `public.purchase_invoices`,
  `public.purchase_invoice_items`, and `public.memberships` exist.
- The seven GST/posting tables are absent.
- The four GST enum types are absent.
- The six GST/version fields on `purchase_invoices` are absent.
- The required tenant-aware composite keys on the three parent tables are
  absent.
- The existing parent tables have RLS enabled but not forced.
- Existing `anon` and `authenticated` table grants are broad and include DML
  and `TRUNCATE`.
- `public.jwt_tenant_id()` exists and reads `app_metadata.tenant_id`.

The baseline did not read business rows and did not validate pointer values.
The `BYPASSRLS` inspection role is not evidence of ordinary-role isolation.

### Live-baseline provenance limitation

The observations above came from the authorized read-only catalog inspection
performed during this workstream on 2026-10-24. No persistent metadata export,
committed snapshot file, database snapshot identifier, or independently
reproducible baseline artifact exists in the repository. The evidence is
therefore recorded in project/session history rather than in a durable
machine-readable artifact.

Before any rollout approval, capture a sanitized, immutable metadata artifact
with approved target identity, query timestamp, catalog results, query
provenance, and inspection-role flags. It must exclude credentials, connection
strings, and business rows. Until that artifact exists, the live baseline is
useful review evidence but not a durable migration preflight record.

## Schema-to-live gap matrix

| Object | Repository expectation | Baseline observation | Design consequence |
|---|---|---|---|
| `PurchaseGstReconciliationStatus` | Four labels in `schema.prisma:85-90` | Missing | Add only after enum collision/label preflight |
| `PurchaseGstAccountingAcceptanceStatus` | `NOT_ACCEPTED`, `ACCEPTED` at `schema.prisma:92-95` | Missing | Required by `purchase_invoices`, although not used by the seven new tables |
| `PurchaseGstEvidenceRevisionKind` | `INITIAL`, `CORRECTION` at `schema.prisma:97-100` | Missing | Required by evidence revisions |
| `PurchaseGstReconciliationEventKind` | Seven labels at `schema.prisma:102-110` | Missing | Required by reconciliation events |
| `purchase_invoices` GST/version fields | Six fields at `schema.prisma:440-444` | All absent | Additive existing-table alteration required before current-pointer FKs |
| `purchase_invoices` `(tenant_id,id)` unique key | Declared at `schema.prisma:475` | Missing | Required by tenant-aware composite references |
| `purchase_invoice_items` `(tenant_id,purchase_id,id)` unique key | Declared at `schema.prisma:512` | Missing | Required by line-evidence FK |
| `memberships` `(tenant_id,id)` unique key | Declared at `schema.prisma:234` | Missing | Required by actor FKs |
| Seven GST/posting tables | Models at `schema.prisma:484-727` | All absent | Create only after parent compatibility checks |
| Current-pointer constraints | Three mapped FKs at `schema.prisma:465-469` | Absent | Add last, after target keys and tables |
| `public.jwt_tenant_id()` | Reads app metadata and fails closed on empty claim | Exists | Verify behavior under ordinary roles before RLS approval |

The live observations are metadata facts, not a claim that existing business
data is compatible with the current Prisma model.

## Required enum objects

The proposed rollout must account for these exact repository labels and order:

1. `PurchaseGstReconciliationStatus`
   - `NOT_RECONCILED`
   - `MATCHED`
   - `DISCREPANCY_REQUIRES_REVIEW`
   - `RESOLVED`
2. `PurchaseGstAccountingAcceptanceStatus`
   - `NOT_ACCEPTED`
   - `ACCEPTED`
3. `PurchaseGstEvidenceRevisionKind`
   - `INITIAL`
   - `CORRECTION`
4. `PurchaseGstReconciliationEventKind`
   - `EVIDENCE_CAPTURED`
   - `CALCULATION_RECORDED`
   - `MATCHED`
   - `DISCREPANCY_REQUIRES_REVIEW`
   - `RESOLVED`
   - `ACCOUNTING_ACCEPTED`
   - `CORRECTED`

The live baseline found none of these types. Before execution, a conflict
check must reject a same-named non-enum object or an incompatible existing enum.

## Existing-table additions

The current `purchase_invoices` model requires these fields:

| Field | PostgreSQL type | Default |
|---|---|---|
| `gst_reconciliation_status` | `PurchaseGstReconciliationStatus NOT NULL` | Prisma default `NOT_RECONCILED`; database default must be explicitly chosen |
| `gst_accounting_acceptance_status` | `PurchaseGstAccountingAcceptanceStatus NOT NULL` | Prisma default `NOT_ACCEPTED`; database default must be explicitly chosen |
| `current_gst_evidence_revision_id` | `text NULL` | none |
| `current_gst_calculation_id` | `text NULL` | none |
| `current_gst_accounting_decision_id` | `text NULL` | none |
| `gst_record_version` | `integer NOT NULL` | Prisma default `0`; database default must be explicitly chosen |

The two status fields and `gst_record_version` are non-null in Prisma.
The three current-pointer fields are nullable in Prisma. `@default(...)`
expresses the Prisma schema default; it does not by itself prove that a
PostgreSQL `DEFAULT` exists in the live database. Before adding `NOT NULL`,
the approved rollout must either:

1. add a temporary database default, backfill existing rows, validate
   non-nullability, then retain or remove the default by decision; or
2. perform an explicitly approved equivalent expand/backfill/contract sequence.

The choice must preserve legacy behavior and be tested against an isolated
database. No business rows were inspected, so duplicate, null, and backfill
impact remain open.

`id @default(cuid())` fields are application/Prisma-generated identifiers, not
server-side PostgreSQL defaults unless a later design explicitly adds one.
`@updatedAt` is Prisma client-managed timestamp behavior, not a guaranteed
database `DEFAULT` or trigger. `@default(now())` is a Prisma schema default
that the migration must deliberately map to a PostgreSQL default if that
behavior is required for direct SQL writers.

For PostgreSQL, Prisma `DateTime` in this schema maps to
`timestamp(3) without time zone` unless the connector/schema is deliberately
changed. The design must preserve that exact compatibility mapping for this
rollout; the installed best-practice guidance recommends `timestamptz` for
new designs, but changing to it here would be an intentional schema
deviation requiring separate approval.

The exact field nullability, precision, and default semantics must be emitted
from the reviewed Prisma schema, not inferred from this summary.

The required supporting unique constraints are:

```text
purchase_invoices:
  UNIQUE (tenant_id, id)
  UNIQUE (tenant_id, id, current_gst_evidence_revision_id)
  UNIQUE (tenant_id, id, current_gst_calculation_id)
  UNIQUE (tenant_id, id, current_gst_accounting_decision_id)

purchase_invoice_items:
  UNIQUE (tenant_id, purchase_id, id)

memberships:
  UNIQUE (tenant_id, id)
```

The first three pointer-supporting keys are required by the composite current
pointer references. PostgreSQL unique constraints treat nullable values in a
way that permits multiple nulls; the exact intended semantics must be accepted
before execution.

Only names explicitly supplied with Prisma `map:` are repository-normative:
`purchase_invoices_current_gst_*_fkey` and the mapped names shown below.
Unmapped Prisma `@@unique` and `@@index` objects have generated PostgreSQL
names; this design must not invent those names. A final migration may choose
explicit names only after the corresponding Prisma `map:` changes are
approved, or must record the generated names produced by the selected tooling.

## Seven-table object design

The seven table definitions, field types, defaults, mapped names, foreign keys,
unique constraints, and indexes are derived from
`prisma/schema.prisma:484-727`. The final generated DDL must be checked against
that source after the unresolved calculation relation is decided.

### PostgreSQL type and naming convention

The descriptions below use the Prisma PostgreSQL connector mapping:

- `String` -> `text`;
- `Int` -> `integer`;
- `Decimal @db.Decimal(p,s)` -> `numeric(p,s)`;
- `Json` -> `jsonb`;
- `DateTime` -> `timestamp(3) without time zone`;
- `@default(now())` -> a PostgreSQL `now()` default only when the migration
  intentionally preserves direct-SQL default behavior;
- `@default(cuid())` and `@updatedAt` have no assumed database default.

These are compatibility mappings, not a proposal to change the schema to
timezone-aware timestamps. The best-practice `schema-data-types.md` reference
recommends `timestamptz` for new designs; adopting it here would require a
separate Prisma and migration decision.

Mapped constraint/index/foreign-key names are reproduced exactly. For every
unmapped `@@unique`, `@@index`, or Prisma relation, this design records the
columns and referenced columns but leaves the physical generated name to
reviewed migration tooling. Unmapped physical names are generated and
non-normative until confirmed by that tooling. No generated name is treated as
a stable contract.

### `purchase_posting_operations`

Columns:

```text
id text NOT NULL
tenant_id text NOT NULL
purchase_invoice_id text NOT NULL
idempotency_key text NOT NULL
request_payload_hash text NOT NULL
status text NOT NULL DEFAULT 'PROCESSING'
result_invoice_no text NULL
result_purchase_id text NULL
created_at timestamp(3) without time zone NOT NULL DEFAULT now()
updated_at timestamp(3) without time zone NOT NULL
```

Keys and indexes:

```text
PRIMARY KEY (id)
UNIQUE (tenant_id, idempotency_key)
  mapped purchase_posting_idempotency_key
UNIQUE (tenant_id, purchase_invoice_id)
  mapped purchase_posting_purchase_key
INDEX (tenant_id, purchase_invoice_id, status)
  unmapped Prisma index name; generated name must be recorded after review
```

Foreign keys:

```text
(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
(tenant_id, purchase_invoice_id)
  REFERENCES purchase_invoices(tenant_id, id) ON DELETE RESTRICT
```

`status` remains free-form because the current Prisma schema declares it as
`String`. A database status check is a separate decision.

### `purchase_gst_evidence_revisions`

Field-by-field definition from `schema.prisma:535-577`:

| Field | PostgreSQL type | Nullability | Default / mapping |
|---|---|---|---|
| `id` | `text` | `NOT NULL` | Prisma `cuid()`; no assumed database default |
| `tenant_id` | `text` | `NOT NULL` | none |
| `purchase_invoice_id` | `text` | `NOT NULL` | none |
| `revision_number` | `integer` | `NOT NULL` | none |
| `revision_kind` | `PurchaseGstEvidenceRevisionKind` | `NOT NULL` | enum |
| `supersedes_revision_id` | `text` | `NULL` | none |
| `source_document_reference` | `text` | `NULL` | none |
| `capture_channel` | `text` | `NOT NULL` | none |
| `capture_provenance` | `jsonb` | `NULL` | none |
| `correction_reason` | `text` | `NULL` | none |
| `captured_at` | `timestamp(3) without time zone` | `NOT NULL` | Prisma `now()`; database default only by explicit decision |
| `captured_by_membership_id` | `text` | `NOT NULL` | none |
| `declared_taxable_value_raw` | `text` | `NULL` | none |
| `declared_cgst_raw` | `text` | `NULL` | none |
| `declared_sgst_raw` | `text` | `NULL` | none |
| `declared_igst_raw` | `text` | `NULL` | none |
| `declared_cess_raw` | `text` | `NULL` | none |
| `declared_invoice_total_raw` | `text` | `NULL` | none |
| `declared_round_off_raw` | `text` | `NULL` | none |
| `declared_taxable_value` | `numeric(20,4)` | `NULL` | none |
| `declared_cgst` | `numeric(20,4)` | `NULL` | none |
| `declared_sgst` | `numeric(20,4)` | `NULL` | none |
| `declared_igst` | `numeric(20,4)` | `NULL` | none |
| `declared_cess` | `numeric(20,4)` | `NULL` | none |
| `declared_invoice_total` | `numeric(20,4)` | `NULL` | none |
| `declared_round_off` | `numeric(20,4)` | `NULL` | none |
| `supplier_state_at_transaction` | `text` | `NULL` | none |
| `recipient_state_at_transaction` | `text` | `NULL` | none |
| `delivery_state_at_transaction` | `text` | `NULL` | none |
| `supply_scenario` | `text` | `NULL` | none |
| `supply_facts` | `jsonb` | `NULL` | none |
| `source_fingerprint` | `text` | `NULL` | none |

Mapped foreign keys are `purchase_gst_evidence_purchase_fkey`,
`purchase_gst_evidence_supersedes_fkey`, and
`purchase_gst_evidence_capture_actor_fkey`. The physical name of the
`current_for_purchase`, `line_evidence`, `calculations`, `decisions`, and
`reconciliation_events` relations is unmapped and generated.

Keys and indexes:

```text
PRIMARY KEY (id)
UNIQUE (tenant_id, purchase_invoice_id, id)
  mapped purchase_gst_evidence_revision_identity_key
UNIQUE (tenant_id, purchase_invoice_id, revision_number)
  mapped purchase_gst_evidence_revision_number_key
INDEX (tenant_id, purchase_invoice_id, captured_at)
  mapped purchase_gst_evidence_captured_at_idx
INDEX (tenant_id, purchase_invoice_id, revision_kind)
  mapped purchase_gst_evidence_revision_kind_idx
INDEX (tenant_id, purchase_invoice_id, supersedes_revision_id)
  mapped purchase_gst_evidence_supersedes_idx
INDEX (tenant_id, source_fingerprint)
  unmapped Prisma index name; generated name must be recorded after review
```

Foreign keys:

```text
(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
(tenant_id, purchase_invoice_id)
  REFERENCES purchase_invoices(tenant_id, id) ON DELETE RESTRICT
  mapped purchase_gst_evidence_purchase_fkey
(tenant_id, purchase_invoice_id, supersedes_revision_id)
  REFERENCES purchase_gst_evidence_revisions(tenant_id, purchase_invoice_id, id)
  ON DELETE RESTRICT
  mapped purchase_gst_evidence_supersedes_fkey
(tenant_id, captured_by_membership_id)
  REFERENCES memberships(tenant_id, id) ON DELETE RESTRICT
  mapped purchase_gst_evidence_capture_actor_fkey
```

The self-reference should be added after the composite unique key exists.

### `purchase_gst_line_evidence`

Columns:

```text
id, tenant_id, purchase_invoice_id, evidence_revision_id,
purchase_invoice_item_id
declared_taxable_value_raw, declared_cgst_raw, declared_sgst_raw,
declared_igst_raw, declared_cess_raw, declared_line_total_raw
declared_taxable_value, declared_cgst, declared_sgst, declared_igst,
declared_cess, declared_line_total
```

The raw fields are nullable `text`; numeric fields are nullable
`numeric(20,4)`. All identity and relation fields are non-null `text`.

Keys and indexes:

```text
PRIMARY KEY (id)
UNIQUE (tenant_id, purchase_invoice_id, evidence_revision_id, id)
UNIQUE (tenant_id, evidence_revision_id, purchase_invoice_item_id)
INDEX (tenant_id, purchase_invoice_id, purchase_invoice_item_id)
INDEX (tenant_id, purchase_invoice_id, evidence_revision_id)
  both index names are unmapped and must not be invented
```

Foreign keys:

```text
(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
(tenant_id, purchase_invoice_id, evidence_revision_id)
  REFERENCES purchase_gst_evidence_revisions(
    tenant_id, purchase_invoice_id, id
  ) ON DELETE RESTRICT
  mapped purchase_gst_line_evidence_revision_fkey
(tenant_id, purchase_invoice_id, purchase_invoice_item_id)
  REFERENCES purchase_invoice_items(tenant_id, purchase_id, id)
  ON DELETE RESTRICT
  mapped purchase_gst_line_evidence_item_fkey
```

### `purchase_gst_calculations`

Field-by-field definition from `schema.prisma:617-635`:

| Field | PostgreSQL type | Nullability | Default / mapping |
|---|---|---|---|
| `id` | `text` | `NOT NULL` | Prisma `cuid()`; no assumed database default |
| `tenant_id` | `text` | `NOT NULL` | none |
| `purchase_invoice_id` | `text` | `NOT NULL` | none |
| `evidence_revision_id` | `text` | `NOT NULL` | none |
| `rule_version` | `text` | `NOT NULL` | none |
| `calculated_at` | `timestamp(3) without time zone` | `NOT NULL` | Prisma `now()`; database default only by explicit decision |
| `calculation_provenance` | `jsonb` | `NULL` | none |
| `input_fingerprint` | `text` | `NULL` | none |
| `calculated_taxable_value` | `numeric(20,4)` | `NULL` | none |
| `calculated_cgst` | `numeric(20,4)` | `NULL` | none |
| `calculated_sgst` | `numeric(20,4)` | `NULL` | none |
| `calculated_igst` | `numeric(20,4)` | `NULL` | none |
| `calculated_cess` | `numeric(20,4)` | `NULL` | none |
| `calculated_invoice_total` | `numeric(20,4)` | `NULL` | none |
| `calculated_round_off` | `numeric(20,4)` | `NULL` | none |

Mapped foreign keys are `purchase_gst_calculation_purchase_fkey` and
`purchase_gst_calculation_revision_fkey`. The physical name of the
`current_for_purchase` relation is unmapped and generated.

Keys and indexes:

```text
PRIMARY KEY (id)
UNIQUE (tenant_id, purchase_invoice_id, id)
INDEX (tenant_id, purchase_invoice_id, evidence_revision_id)
INDEX (tenant_id, rule_version)
  both index names are unmapped and must not be invented
```

Foreign keys:

```text
(tenant_id, purchase_invoice_id)
  REFERENCES purchase_invoices(tenant_id, id) ON DELETE RESTRICT
  mapped purchase_gst_calculation_purchase_fkey
(tenant_id, purchase_invoice_id, evidence_revision_id)
  REFERENCES purchase_gst_evidence_revisions(
    tenant_id, purchase_invoice_id, id
  ) ON DELETE RESTRICT
  mapped purchase_gst_calculation_revision_fkey
```

### `purchase_gst_accounting_decisions`

Exact columns from `schema.prisma:642-669`:

```text
id text NOT NULL
tenant_id text NOT NULL
purchase_invoice_id text NOT NULL
evidence_revision_id text NOT NULL
calculation_id text NOT NULL
accepted_taxable_value numeric(20,4) NULL
accepted_cgst numeric(20,4) NULL
accepted_sgst numeric(20,4) NULL
accepted_igst numeric(20,4) NULL
accepted_cess numeric(20,4) NULL
accepted_invoice_total numeric(20,4) NULL
accepted_round_off numeric(20,4) NULL
accepted_value_source text NOT NULL
decision_reference text NOT NULL
decision_outcome text NOT NULL
rationale text NOT NULL
decided_at timestamp(3) without time zone NOT NULL
  Prisma default now(); database default requires explicit approval
decided_by_membership_id text NOT NULL
```

`id` has Prisma `@default(cuid())`; no PostgreSQL-generated ID is assumed.
There is no `@updatedAt` field and no other declared default.

Keys and indexes:

```text
PRIMARY KEY (id)
UNIQUE (tenant_id, purchase_invoice_id, id)
  mapped purchase_gst_decision_identity_key
UNIQUE (
  tenant_id, purchase_invoice_id, evidence_revision_id, decision_reference
)
  mapped purchase_gst_decision_reference_key
INDEX (tenant_id, purchase_invoice_id, evidence_revision_id)
  unmapped Prisma index name; generated name must be recorded after review
```

Foreign keys:

```text
(tenant_id, purchase_invoice_id)
  REFERENCES purchase_invoices(tenant_id, id) ON DELETE RESTRICT
  mapped purchase_gst_decision_purchase_fkey
(tenant_id, purchase_invoice_id, evidence_revision_id)
  REFERENCES purchase_gst_evidence_revisions(
    tenant_id, purchase_invoice_id, id
  ) ON DELETE RESTRICT
  mapped purchase_gst_decision_revision_fkey
(tenant_id, decided_by_membership_id)
  REFERENCES memberships(tenant_id, id) ON DELETE RESTRICT
  mapped purchase_gst_decision_actor_fkey
```

Nullable inverse relation:

```text
current_for_purchase -> purchase_invoices?
relation name: purchase_current_gst_accounting_decision
```

The physical foreign key belongs to the invoice's
`current_gst_accounting_decision_id` pointer. Do not add a separate foreign
key on the accounting-decision table for this inverse relation.

The current `calculation_id` scalar has no Prisma relation and therefore no
repository-confirmed calculation foreign key. Its integrity choice is
explicitly deferred to the decision section below.

### `purchase_gst_reconciliation_events`

Field-by-field definition from `schema.prisma:673-696`:

| Field | PostgreSQL type | Nullability | Default / mapping |
|---|---|---|---|
| `id` | `text` | `NOT NULL` | Prisma `cuid()`; no assumed database default |
| `tenant_id` | `text` | `NOT NULL` | none |
| `purchase_invoice_id` | `text` | `NOT NULL` | none |
| `evidence_revision_id` | `text` | `NOT NULL` | none |
| `event_kind` | `PurchaseGstReconciliationEventKind` | `NOT NULL` | enum |
| `from_status` | `PurchaseGstReconciliationStatus` | `NULL` | enum |
| `to_status` | `PurchaseGstReconciliationStatus` | `NULL` | enum |
| `operation` | `text` | `NOT NULL` | none |
| `idempotency_key` | `text` | `NOT NULL` | none |
| `request_payload_hash` | `text` | `NULL` | none |
| `decision_reference` | `text` | `NULL` | none |
| `rule_version` | `text` | `NULL` | none |
| `actor_membership_id` | `text` | `NULL` | none |
| `declared_snapshot` | `jsonb` | `NULL` | none |
| `calculated_snapshot` | `jsonb` | `NULL` | none |
| `accepted_snapshot` | `jsonb` | `NULL` | none |
| `discrepancy_details` | `jsonb` | `NULL` | none |
| `metadata` | `jsonb` | `NULL` | none |
| `created_at` | `timestamp(3) without time zone` | `NOT NULL` | Prisma `now()`; database default only by explicit decision |

Mapped foreign keys are `purchase_gst_event_purchase_fkey`,
`purchase_gst_event_revision_fkey`, and `purchase_gst_event_actor_fkey`.
The nullable actor relation uses the Prisma-mapped name
`purchase_gst_event_actor_fkey`. The `tenant` and `line_links` relation names
are unmapped.

Keys and indexes:

```text
PRIMARY KEY (id)
UNIQUE (tenant_id, purchase_invoice_id, evidence_revision_id, id)
UNIQUE (tenant_id, operation, idempotency_key)
  both unique names are unmapped and must not be invented
INDEX (tenant_id, purchase_invoice_id, created_at)
INDEX (tenant_id, evidence_revision_id, created_at)
INDEX (tenant_id, event_kind, created_at)
INDEX (tenant_id, actor_membership_id)
  unmapped Prisma index name; generated name must be recorded after review
```

Foreign keys:

```text
(tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
(tenant_id, purchase_invoice_id)
  REFERENCES purchase_invoices(tenant_id, id) ON DELETE RESTRICT
  mapped purchase_gst_event_purchase_fkey
(tenant_id, purchase_invoice_id, evidence_revision_id)
  REFERENCES purchase_gst_evidence_revisions(
    tenant_id, purchase_invoice_id, id
  ) ON DELETE RESTRICT
  mapped purchase_gst_event_revision_fkey
(tenant_id, actor_membership_id)
  REFERENCES memberships(tenant_id, id) ON DELETE RESTRICT
```

The actor reference is nullable.

### `purchase_gst_reconciliation_event_lines`

Columns:

```text
id, tenant_id, purchase_invoice_id, evidence_revision_id,
event_id, line_evidence_id
```

All are non-null `text`.

Keys:

```text
PRIMARY KEY (id)
UNIQUE (tenant_id, purchase_invoice_id, evidence_revision_id, id)
  mapped purchase_gst_event_line_identity_key
UNIQUE (
  tenant_id, purchase_invoice_id, evidence_revision_id,
  event_id, line_evidence_id
)
  mapped purchase_gst_event_line_pair_key
```

Foreign keys:

```text
(tenant_id, purchase_invoice_id, evidence_revision_id, event_id)
  REFERENCES purchase_gst_reconciliation_events(
    tenant_id, purchase_invoice_id, evidence_revision_id, id
  ) ON DELETE RESTRICT
  mapped purchase_gst_event_line_event_fkey
(tenant_id, purchase_invoice_id, evidence_revision_id, line_evidence_id)
  REFERENCES purchase_gst_line_evidence(
    tenant_id, purchase_invoice_id, evidence_revision_id, id
  ) ON DELETE RESTRICT
  mapped purchase_gst_event_line_evidence_fkey
```

## Dependency order and cycles

The proposed additive sequence is staged and must not be treated as executable
SQL until the preflight passes.

1. Verify identity, target separation, and absence of destructive statements.
2. Verify existing parent tables and required parent keys.
3. Verify enum name/type conflicts and create only the four missing enum types.
4. Add the six `purchase_invoices` GST/version fields with approved defaults and
   nullability handling for existing rows.
5. Add the required parent composite unique keys:
   `purchase_invoices(tenant_id,id)`,
   `purchase_invoice_items(tenant_id,purchase_id,id)`, and
   `memberships(tenant_id,id)`.
6. Create `purchase_gst_evidence_revisions` with its primary key, uniques,
   indexes, and non-cyclic foreign keys.
7. Add the evidence self-reference after its composite unique key exists.
8. Create `purchase_gst_calculations`.
9. Create `purchase_gst_accounting_decisions` with its purchase, evidence, and
   membership foreign keys. The `calculation_id` FK is deferred until its
   relation decision is approved.
10. Create `purchase_gst_line_evidence`.
11. Create `purchase_gst_reconciliation_events`.
12. Create `purchase_gst_reconciliation_event_lines` last among the seven
    tables because it references both event and line-evidence tables.
13. Add the three current-pointer unique constraints and foreign keys on
    `purchase_invoices` only after all target composite keys exist.
14. Apply separately approved RLS and privileges.
15. Re-read catalogs and run disposable-database behavior tests.

The cycles/deferred edges are:

- `purchase_invoices(tenant_id,id)` -> evidence revisions, calculations, and
  accounting decisions through the three current-pointer relations.
- Evidence revisions, calculations, and accounting decisions each point back
  to `purchase_invoices(tenant_id,id)`.
- Evidence revisions point to `memberships(tenant_id,id)` and self-reference
  through `(tenant_id,purchase_invoice_id,supersedes_revision_id)`.
- Accounting decisions point to both evidence revisions and memberships.
- Reconciliation events point to purchase invoices, evidence revisions, and
  optionally memberships.
- Event-line rows point to both reconciliation events and line evidence.
- If Option B is approved, accounting decisions additionally point to
  calculations through a tenant- and invoice-scoped composite relation.
- The three current pointers must be deferred until each target table's
  `(tenant_id,purchase_invoice_id,id)` unique key exists.

The staged approach avoids adding foreign keys before referenced unique keys
exist. It also keeps DDL transactions short; index creation and validation
must be planned around locks and table size in the disposable environment.

### Lock, validation, and transaction gates

Before any shared-database execution, the approved operator must record:

- a maximum lock-wait budget and statement timeout for every `ALTER TABLE`,
  index, constraint, and validation step;
- whether each operation runs in its own short transaction or a deliberately
  grouped transaction;
- the expected lock mode and an abort procedure if the budget is exceeded;
- whether unique indexes are built separately before attaching constraints;
- whether foreign keys are added as `NOT VALID` followed by an explicitly
  monitored validation step, if that compatibility approach is approved;
- the required maintenance window and concurrent-writer behavior.

No timeout, lock budget, transaction boundary, or `NOT VALID` strategy is
verified by the current repository or baseline. The best-practice
`lock-short-transactions.md` guidance supports short transactions and bounded
timeouts; it does not provide evidence for this database's table sizes or
lock behavior.

## `calculation_id` decision required

### Option A: application-validated identifier

Keep `calculation_id String` without a database foreign key.

Required schema/DDL shape:

- retain the current scalar `calculation_id text NOT NULL`;
- retain only the accounting-decision keys and indexes already declared in
  `schema.prisma:667-669`;
- do not add a calculation relation or calculation-target constraint;
- application validation must verify tenant, purchase invoice, and calculation
  identity inside the posting transaction.

Pros:

- no Prisma model change;
- smallest immediate database change;
- preserves current schema shape.

Risks:

- orphaned decisions are possible;
- cross-invoice or cross-tenant calculation references are not structurally
  rejected;
- deletion and retention behavior is undefined;
- database-level integrity cannot be proven independently of application code.

### Option B: tenant- and invoice-scoped foreign key

Add a Prisma relation and inverse relation using:

```text
(tenant_id, purchase_invoice_id, calculation_id)
  REFERENCES purchase_gst_calculations(
    tenant_id, purchase_invoice_id, id
  )
ON DELETE RESTRICT
```

Proposed relation field names and required cardinality, for review only:

```prisma
calculation purchase_gst_calculations
  @relation(
    "purchase_gst_decision_calculation",
    fields: [tenant_id, purchase_invoice_id, calculation_id],
    references: [tenant_id, purchase_invoice_id, id],
    onDelete: Restrict,
    map: "purchase_gst_decision_calculation_fkey"
  )

accounting_decisions purchase_gst_accounting_decisions[]
  @relation("purchase_gst_decision_calculation")
```

These are placeholders, not selected schema names. Before adoption, check
both names against all relation fields in the complete Prisma models, confirm
that the inverse cardinality is compatible, and approve the proposed mapped
foreign-key name. A naming conflict or incompatible relation shape must stop
the design rather than be silently renamed.

Required schema/DDL changes:

- add the corresponding Prisma relation on
  `purchase_gst_accounting_decisions`;
- add the inverse relation on `purchase_gst_calculations`;
- add a referenced unique key on
  `purchase_gst_calculations(tenant_id,purchase_invoice_id,id)` if the
  existing key remains the target; it already exists in the repository model;
- add the composite foreign key with an explicitly reviewed `map:` name;
- preserve the existing accounting-decision unique keys and add no
  `calculation_id` uniqueness unless separately justified.

This is the stronger integrity design, but it is a schema and Prisma change
requiring explicit approval, `prisma validate`, and generated-SQL review. No
option is selected here.

**Decision owner:** Product/accounting owner plus Security/Architecture and
database owner. No option is selected here.

## RLS, policies, and grants

The existing SQL asset proposes, for each GST/posting table:

```text
RLS enabled
tenant_isolation_policy
command: FOR ALL
role: authenticated
USING (tenant_id = public.jwt_tenant_id())
WITH CHECK (tenant_id = public.jwt_tenant_id())
```

The command and forced-RLS state are not fully verified by the snapshot
verifier. They must be explicit in the final design:

| Surface | Proposed review target | Status |
|---|---|---|
| Policy command | `FOR ALL` | Pending approval |
| Policy role | `authenticated` | Pending grant/role decision |
| `USING` | `tenant_id = public.jwt_tenant_id()` | Repository/verifier expectation |
| `WITH CHECK` | `tenant_id = public.jwt_tenant_id()` | Repository/verifier expectation |
| RLS enabled | `true` on all seven tables | Required |
| RLS forced | `true`, or documented `false` exception | Pending Security/Architecture decision |
| Verification role | non-superuser, non-`BYPASSRLS` | Required disposable test |

This policy shape is not sufficient to enforce immutable evidence, append-only
events, accounting authority, or posting state transitions.

The existing parent grant state is a security blocker. The baseline observed
broad `anon` and `authenticated` privileges, including DML and `TRUNCATE`.
The final GST rollout must not silently preserve that as the approved model.

### Proposed grant matrix (not approved)

The following is a review matrix, not executable authorization:

| Principal | Schema `USAGE` | `SELECT` | `INSERT` | `UPDATE` | `DELETE` | `TRUNCATE` |
|---|---:|---:|---:|---:|---:|---:|
| `anon` | no | no | no | no | no | no |
| `authenticated` | pending | pending | pending | pending | pending | no by default |
| restricted backend role | yes | as needed | as needed | workflow projections only | no for immutable history | no |
| controlled write function role | function-specific | function-specific | function-specific | function-specific | function-specific | no |

The final grant set must also state schema privileges, existing parent-table
privileges, default privileges, function `EXECUTE`, and the actual Prisma
role. The database owner and Security/Architecture reviewer must approve one
model. The verifier cannot pass a live snapshot without an explicitly approved
`expectedGrants` set.

Options for review:

1. Restricted backend/application role with no direct browser CRUD.
2. Controlled database write functions with narrowly granted execution and
   explicit security review.
3. A consciously approved alternative with documented business permissions,
   RLS behavior, bypass-role handling, and immutable-history controls.

Required approvals:

- Security/Architecture reviewer;
- database owner;
- product/accounting owner;
- qualified GST reviewer for covered policy behavior.

The connected `postgres` role has `BYPASSRLS`; it must not be used to claim
ordinary-role tenant isolation. The snapshot-only verifier remains a contract
checker and cannot collect live evidence.

## Preflight checklist

Execution must stop if any item fails:

- [ ] Identity matches the explicitly approved target and environment.
- [ ] Target is disposable or separately approved; production separation is
      positively verified.
- [ ] No target table, enum, index, constraint, policy, or function name has
      an incompatible existing object.
- [ ] Parent tables and exact scalar types are compatible.
- [ ] Required parent composite unique keys are present or explicitly included.
- [ ] The existing purchase-item relation is compatible with the
      tenant-aware target `(tenant_id,purchase_id,id)`; a purchase-id-only
      legacy relation is not accepted as equivalent.
- [ ] Existing `purchase_invoices` GST fields are absent or exactly compatible.
- [ ] Existing data has approved defaults/backfill treatment for non-null fields.
- [ ] No pointer values require validation without an authorized data check.
- [ ] No duplicate keys would block required unique constraints.
- [ ] Duplicate checks cover every proposed parent/table unique key before
      adding its constraint.
- [ ] Every proposed index has a reviewed name policy, access path, and lock
      budget; large indexes use an approved separately controlled plan.
- [ ] Every proposed foreign key has compatible types and an approved
      validation strategy; existing rows pass before validation is enabled.
- [ ] Every `NOT NULL` change has an approved default/backfill/validation
      sequence.
- [ ] All existing foreign-key candidates have compatible types and references.
- [ ] The calculation relation decision is recorded.
- [ ] `authenticated`/`anon` grant model is approved.
- [ ] RLS helper, policy predicates, and forced-RLS decision are approved.
- [ ] Final policy command and grant matrix are approved.
- [ ] SQL contains no `DROP`, `TRUNCATE`, `CASCADE` deletion, full-schema
      bootstrap, or unrelated table rewrite.
- [ ] Lock budgets, `statement_timeout`, transaction boundaries, and abort/
      retry behavior are reviewed.
- [ ] Any workflow-disable capability is verified; otherwise it is recorded
      as an execution prerequisite, not assumed.
- [ ] Backup/restore and rollback limits are documented.

The baseline did not inspect business rows, so duplicate-key detection,
existing pointer validity, null/default compatibility, and legacy backfill
impact remain outstanding.

## Disposable-database verification plan

Apply the reviewed design only to a separately identified disposable database:

1. Verify identity and record the approved metadata snapshot.
2. Apply only the additive enum, parent-column/key, table, constraint, and
   index operations.
3. Re-read catalogs and compare exact columns, types, defaults, keys, indexes,
   and foreign keys.
4. Apply the approved RLS/policy/grant design.
5. Test with normal non-superuser, non-`BYPASSRLS` roles.
6. Prove authorized same-tenant reads/writes.
7. Prove cross-tenant reads and writes are denied.
8. Verify missing tenant claims fail closed.
9. Test idempotency and unique constraints.
10. Test pointer integrity and event-line relationships.
11. Test application Prisma reads/writes against the revised schema.
12. Run the authorized financial persistence, concurrency, rollback, and
    cleanup tests.
13. Capture rollback evidence and document what cannot be reversed safely.

### Idempotency contract

Idempotency is not assumed for the rollout. For each supported object:

- missing enums, columns, tables, indexes, policies, and constraints may be
  created only after an exact catalog absence check;
- an exact existing definition may be a no-op only where the final migration
  explicitly verifies type, labels/order, nullability, default, key columns,
  referenced columns, policy expressions, role, and relevant options;
- a same-name object with a different definition must stop the rollout;
- ambiguous collisions, duplicate names, or an object in the wrong schema must
  stop the rollout;
- partial application must stop and produce a catalog report rather than
  blindly retrying;
- no object may be dropped or recreated to obtain idempotency.

PostgreSQL does not support `ADD CONSTRAINT IF NOT EXISTS`. Constraint guards
must use reviewed catalog checks and must reject incompatible definitions.
Whether enum/column/table creation uses explicit guards or a one-time
non-idempotent migration remains an approval decision.

## Rollback strategy and limitations

For a disposable database, restore a known snapshot or destroy and recreate
the disposable target after preserving evidence.

For a shared or production database:

- stop new GST writers only through a separately verified operational control;
  no such control is established by this document, so its availability is an
  execution prerequisite;
- retain additive objects for mixed-version reads where safe;
- do not delete evidence/history tables as an automatic rollback;
- do not drop enums, constraints, or foreign keys without a separate approved
  rollback plan and proof that dependent data is absent;
- treat existing-table column additions and any backfill as separately
  reviewable operations.

Object-specific limitations:

- enum types cannot be removed while dependent columns exist; removing labels
  is not an automatic rollback and may be impossible without data conversion;
- defaults can be removed only after confirming direct writers and legacy
  behavior do not depend on them;
- `NOT NULL` cannot be reversed without an approved nullability change and
  application compatibility review;
- parent unique constraints cannot be dropped while foreign keys depend on
  them and dropping them can invalidate tenant-integrity guarantees;
- indexes can be removed only after query/constraint dependency review;
- foreign keys cannot be removed as a routine rollback because doing so
  weakens integrity and may leave orphaned data;
- partially applied changes require catalog-based reconciliation, not a
  blind rerun;
- dropping tables or deleting history would destroy evidence and requires
  separate approval.

No rollback has been executed or verified.

## GO/NO-GO

**GO for corrected design review and metadata-baseline review.**

**NO-GO for rollout execution.**

Execution remains blocked by the unresolved `calculation_id` relation, the
unapproved grant/RLS model, missing non-bypass role tests, absent live
business-row compatibility evidence, missing disposable-database execution
evidence, and lack of approved rollback/backup proof.
# Owner decision addendum - 2026-10-25

The project owner selected GST-APP-03 Option B: `purchase_gst_accounting_decisions.calculation_id`
uses the tenant/invoice-scoped composite relation to
`purchase_gst_calculations`, with the Prisma inverse relation, `ON DELETE
RESTRICT`, and mapped constraint
`purchase_gst_decision_calculation_fkey`. Earlier Option A/Option B comparison
and pending-review language in this document is historical analysis and is not
reopened or deleted. Implementation and database verification remain
incomplete.
