# Purchase GST Persistence and Workflow Design

**Date:** 2026-10-22  
**Time:** 22-19-01 (IST)  
**Phase:** POST-P7 — PRE-PRODUCTION VALIDATION  
**Status:** Design only; implementation and migration are not authorized

This is the single canonical persistence proposal for the accepted purchase GST
policy in [gst-audit-validation-and-plan.md](./gst-audit-validation-and-plan.md).
It incorporates the read-only Prisma 5.22.0 feasibility findings. It does not
authorize schema changes, migrations, database execution, data correction,
production use, or workflow implementation.

## 1. Decisions and boundaries

The design preserves three distinct facts:

1. Supplier-declared source evidence.
2. Application-calculated expected values.
3. Accounting-accepted values.

Supplier evidence is immutable. Calculations are versioned immutable results.
Accounting acceptance is an immutable decision record. Purchase fields that
identify the current revision, current calculation, current decision, status,
and optimistic version are mutable projections.

Existing purchase totals, aggregate `gst_amount`, invoice statuses, two-decimal
line behavior, whole-unit invoice rounding, and signed `round_off` remain
unchanged. Supplier, calculated, and accepted values never overwrite those
existing fields implicitly.

## 2. Prisma feasibility rules used by this proposal

Every compound relation below references an exact declared `@@unique` target.
The corresponding referencing fields are also unique when the relation is
one-to-one.

Required targets on existing models:

```prisma
model purchase_invoices {
  @@unique([tenant_id, id])
  @@unique([tenant_id, id, current_gst_evidence_revision_id])
}

model purchase_invoice_items {
  @@unique([tenant_id, purchase_id, id])
}

model memberships {
  @@unique([tenant_id, id])
}
```

The second `purchase_invoices` key is required because Prisma requires the
defining side of the nullable one-to-one current-revision relation to be
unique.

The existing purchase-item relation must be changed, not duplicated:

```prisma
model purchase_invoices {
  items purchase_invoice_items[] @relation("purchase_invoice_items")
}

model purchase_invoice_items {
  purchase purchase_invoices
    @relation(
      "purchase_invoice_items",
      fields: [tenant_id, purchase_id],
      references: [tenant_id, id],
      onDelete: Cascade,
      map: "purchase_invoice_items_purchase_fkey"
    )
}
```

This removes the existing `purchase_id`-only ownership path. The exact complete
schema still requires `prisma validate` before implementation authorization.

## 3. Purchase invoice projection

Add these nullable/defaulted projection fields to `purchase_invoices`:

```prisma
gst_reconciliation_status
  PurchaseGstReconciliationStatus @default(NOT_RECONCILED)

gst_accounting_acceptance_status
  PurchaseGstAccountingAcceptanceStatus @default(NOT_ACCEPTED)

current_gst_evidence_revision_id String?
current_gst_calculation_id       String?
current_gst_accounting_decision_id String?
gst_record_version               Int @default(0)
```

The current evidence relation is the only proposed current-pointer relation:

```prisma
current_gst_evidence_revision
  purchase_gst_evidence_revisions?
  @relation(
    "purchase_current_gst_evidence_revision",
    fields: [
      tenant_id,
      id,
      current_gst_evidence_revision_id
    ],
    references: [
      tenant_id,
      purchase_invoice_id,
      id
    ],
    onDelete: Restrict,
    map: "purchase_invoices_current_gst_evidence_fkey"
  )
```

The target is:

```prisma
@@unique([tenant_id, purchase_invoice_id, id])
```

Therefore a non-null pointer can reference only a revision belonging to the
same tenant and purchase invoice. A null pointer remains valid for legacy
purchases without evidence.

Current calculation and decision pointers must use the same purchase-aware
pattern:

```text
purchase_invoices:
  (tenant_id, id, current_gst_calculation_id)
    -> purchase_gst_calculations:
       (tenant_id, purchase_invoice_id, id)

purchase_invoices:
  (tenant_id, id, current_gst_accounting_decision_id)
    -> purchase_gst_accounting_decisions:
       (tenant_id, purchase_invoice_id, id)
```

Each pointer requires a corresponding unique target on the referenced model and
a unique three-column referencing key on `purchase_invoices`. Exact Prisma
relation syntax must be confirmed by `prisma validate`.

## 4. Immutable supplier evidence

```prisma
model purchase_gst_evidence_revisions {
  id                    String @id @default(cuid())
  tenant_id             String
  purchase_invoice_id   String
  revision_number      Int
  revision_kind        PurchaseGstEvidenceRevisionKind
  supersedes_revision_id String?

  source_document_reference String?
  capture_channel           String
  capture_provenance       Json?
  correction_reason        String?
  captured_at              DateTime @default(now())
  captured_by_membership_id String

  declared_taxable_value_raw String?
  declared_cgst_raw          String?
  declared_sgst_raw          String?
  declared_igst_raw          String?
  declared_cess_raw          String?
  declared_invoice_total_raw String?
  declared_round_off_raw     String?

  declared_taxable_value Decimal? @db.Decimal(20, 4)
  declared_cgst          Decimal? @db.Decimal(20, 4)
  declared_sgst          Decimal? @db.Decimal(20, 4)
  declared_igst          Decimal? @db.Decimal(20, 4)
  declared_cess          Decimal? @db.Decimal(20, 4)
  declared_invoice_total Decimal? @db.Decimal(20, 4)
  declared_round_off     Decimal? @db.Decimal(20, 4)

  supplier_state_at_transaction  String?
  recipient_state_at_transaction String?
  delivery_state_at_transaction  String?
  supply_scenario                String?
  supply_facts                   Json?
  source_fingerprint             String?

  purchase purchase_invoices
    @relation(
      "purchase_invoice_gst_revisions",
      fields: [tenant_id, purchase_invoice_id],
      references: [tenant_id, id],
      onDelete: Restrict,
      map: "purchase_gst_evidence_purchase_fkey"
    )

  current_for_purchase purchase_invoices?
    @relation("purchase_current_gst_evidence_revision")

  superseded_revision purchase_gst_evidence_revisions?
    @relation(
      "purchase_gst_revision_chain",
      fields: [
        tenant_id,
        purchase_invoice_id,
        supersedes_revision_id
      ],
      references: [
        tenant_id,
        purchase_invoice_id,
        id
      ],
      onDelete: Restrict,
      map: "purchase_gst_evidence_supersedes_fkey"
    )

  correcting_revisions purchase_gst_evidence_revisions[]
    @relation("purchase_gst_revision_chain")

  captured_by memberships
    @relation(
      "purchase_gst_evidence_capture_actor",
      fields: [tenant_id, captured_by_membership_id],
      references: [tenant_id, id],
      onDelete: Restrict,
      map: "purchase_gst_evidence_capture_actor_fkey"
    )

  line_evidence purchase_gst_line_evidence[]
  calculations purchase_gst_calculations[]
  decisions purchase_gst_accounting_decisions[]
  reconciliation_events purchase_gst_reconciliation_events[]

  @@unique([tenant_id, purchase_invoice_id, id])
  @@unique([tenant_id, purchase_invoice_id, revision_number])
  @@index([tenant_id, purchase_invoice_id, captured_at])
  @@index([tenant_id, purchase_invoice_id, revision_kind])
  @@index([tenant_id, purchase_invoice_id, supersedes_revision_id])
  @@index([tenant_id, source_fingerprint])
}
```

`source_document_reference` remains nullable during incomplete draft capture.
The workflow must later decide whether it is mandatory before reconciliation,
acceptance, or posting. Missing references are not fabricated.

Corrections insert a new revision with a new number and
`supersedes_revision_id`; the original revision is never updated or deleted by
the application workflow. The compound self-relation prevents supersession
across purchases or tenants.

## 5. Immutable line evidence

Line evidence is required in the first schema slice because invoice-only
evidence cannot provide line reconciliation, component reporting, mixed-rate
traceability, or discrepancy attribution.

```prisma
model purchase_gst_line_evidence {
  id                       String @id @default(cuid())
  tenant_id                String
  purchase_invoice_id      String
  evidence_revision_id     String
  purchase_invoice_item_id String

  declared_taxable_value_raw String?
  declared_cgst_raw          String?
  declared_sgst_raw          String?
  declared_igst_raw          String?
  declared_cess_raw          String?
  declared_line_total_raw    String?

  declared_taxable_value Decimal? @db.Decimal(20, 4)
  declared_cgst          Decimal? @db.Decimal(20, 4)
  declared_sgst          Decimal? @db.Decimal(20, 4)
  declared_igst          Decimal? @db.Decimal(20, 4)
  declared_cess          Decimal? @db.Decimal(20, 4)
  declared_line_total    Decimal? @db.Decimal(20, 4)

  tenant tenants
    @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

  evidence_revision purchase_gst_evidence_revisions
    @relation(
      fields: [
        tenant_id,
        purchase_invoice_id,
        evidence_revision_id
      ],
      references: [
        tenant_id,
        purchase_invoice_id,
        id
      ],
      onDelete: Restrict,
      map: "purchase_gst_line_evidence_revision_fkey"
    )

  purchase_item purchase_invoice_items
    @relation(
      fields: [
        tenant_id,
        purchase_invoice_id,
        purchase_invoice_item_id
      ],
      references: [
        tenant_id,
        purchase_id,
        id
      ],
      onDelete: Restrict,
      map: "purchase_gst_line_evidence_item_fkey"
    )

  event_links purchase_gst_reconciliation_event_lines[]

  @@unique([
    tenant_id,
    purchase_invoice_id,
    evidence_revision_id,
    id
  ])
  @@unique([
    tenant_id,
    evidence_revision_id,
    purchase_invoice_item_id
  ])
  @@index([tenant_id, purchase_invoice_id, purchase_invoice_item_id])
  @@index([tenant_id, purchase_invoice_id, evidence_revision_id])
}
```

Calculated and accepted line values are stored in the calculation and decision
models described below, keyed to this evidence row where line-level results are
available. Missing source components remain missing, not zero.

## 6. Versioned calculation results

The evidence revision is not mutated when the application recalculates:

```prisma
model purchase_gst_calculations {
  id                    String @id @default(cuid())
  tenant_id             String
  purchase_invoice_id   String
  evidence_revision_id  String
  rule_version          String
  calculated_at         DateTime @default(now())
  calculation_provenance Json?
  input_fingerprint     String?

  calculated_taxable_value Decimal? @db.Decimal(20, 4)
  calculated_cgst          Decimal? @db.Decimal(20, 4)
  calculated_sgst          Decimal? @db.Decimal(20, 4)
  calculated_igst          Decimal? @db.Decimal(20, 4)
  calculated_cess          Decimal? @db.Decimal(20, 4)
  calculated_invoice_total Decimal? @db.Decimal(20, 4)
  calculated_round_off     Decimal? @db.Decimal(20, 4)

  purchase purchase_invoices
    @relation(
      fields: [tenant_id, purchase_invoice_id],
      references: [tenant_id, id],
      onDelete: Restrict,
      map: "purchase_gst_calculation_purchase_fkey"
    )

  evidence_revision purchase_gst_evidence_revisions
    @relation(
      fields: [
        tenant_id,
        purchase_invoice_id,
        evidence_revision_id
      ],
      references: [
        tenant_id,
        purchase_invoice_id,
        id
      ],
      onDelete: Restrict,
      map: "purchase_gst_calculation_revision_fkey"
    )

  @@unique([tenant_id, purchase_invoice_id, id])
  @@index([tenant_id, purchase_invoice_id, evidence_revision_id])
  @@index([tenant_id, rule_version])
}
```

The calculation result must have a non-empty `rule_version` at the application
boundary. Prisma can enforce non-null but not non-empty text.

Line-level calculated results may be added as a separate child model keyed to
`purchase_gst_calculations` and the same line-evidence ownership tuple. Exact
mandatory component coverage remains an approval decision; the first schema
must not claim line-level calculated completeness where facts are unavailable.

## 7. Immutable accounting decisions

```prisma
model purchase_gst_accounting_decisions {
  id                    String @id @default(cuid())
  tenant_id             String
  purchase_invoice_id   String
  evidence_revision_id  String
  calculation_id        String

  accepted_taxable_value Decimal? @db.Decimal(20, 4)
  accepted_cgst          Decimal? @db.Decimal(20, 4)
  accepted_sgst          Decimal? @db.Decimal(20, 4)
  accepted_igst          Decimal? @db.Decimal(20, 4)
  accepted_cess          Decimal? @db.Decimal(20, 4)
  accepted_invoice_total Decimal? @db.Decimal(20, 4)
  accepted_round_off     Decimal? @db.Decimal(20, 4)

  accepted_value_source       String
  decision_reference          String
  decision_outcome            String
  rationale                   String
  decided_at                  DateTime @default(now())
  decided_by_membership_id    String

  purchase purchase_invoices
    @relation(
      fields: [tenant_id, purchase_invoice_id],
      references: [tenant_id, id],
      onDelete: Restrict,
      map: "purchase_gst_decision_purchase_fkey"
    )

  evidence_revision purchase_gst_evidence_revisions
    @relation(
      fields: [
        tenant_id,
        purchase_invoice_id,
        evidence_revision_id
      ],
      references: [
        tenant_id,
        purchase_invoice_id,
        id
      ],
      onDelete: Restrict,
      map: "purchase_gst_decision_revision_fkey"
    )

  decided_by memberships
    @relation(
      "purchase_gst_accounting_decision_actor",
      fields: [tenant_id, decided_by_membership_id],
      references: [tenant_id, id],
      onDelete: Restrict,
      map: "purchase_gst_decision_actor_fkey"
    )

  @@unique([tenant_id, purchase_invoice_id, id])
  @@unique([
    tenant_id,
    purchase_invoice_id,
    evidence_revision_id,
    decision_reference
  ])
  @@index([tenant_id, purchase_invoice_id, evidence_revision_id])
}
```

Accounting acceptance requires complete valid accepted values according to the
approved field matrix, a non-empty decision reference, rationale, actor,
timestamp, and an authorized application decision. The schema cannot enforce
that the actor is authorized or that the accepted values are legally correct.

Line-level accepted values require a separate child decision model if line-level
acceptance is approved as mandatory. They must never be written into supplier
evidence.

## 8. Append-only reconciliation events

```prisma
model purchase_gst_reconciliation_events {
  id                   String @id @default(cuid())
  tenant_id            String
  purchase_invoice_id  String
  evidence_revision_id String

  event_kind       PurchaseGstReconciliationEventKind
  from_status      PurchaseGstReconciliationStatus?
  to_status        PurchaseGstReconciliationStatus?
  operation        String
  idempotency_key  String
  request_payload_hash String?
  decision_reference String?
  rule_version       String?
  actor_membership_id String?
  declared_snapshot Json?
  calculated_snapshot Json?
  accepted_snapshot Json?
  discrepancy_details Json?
  metadata Json?
  created_at DateTime @default(now())

  tenant tenants
    @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

  purchase purchase_invoices
    @relation(
      fields: [tenant_id, purchase_invoice_id],
      references: [tenant_id, id],
      onDelete: Restrict,
      map: "purchase_gst_event_purchase_fkey"
    )

  evidence_revision purchase_gst_evidence_revisions
    @relation(
      fields: [
        tenant_id,
        purchase_invoice_id,
        evidence_revision_id
      ],
      references: [
        tenant_id,
        purchase_invoice_id,
        id
      ],
      onDelete: Restrict,
      map: "purchase_gst_event_revision_fkey"
    )

  actor memberships?
    @relation(
      "purchase_gst_event_actor",
      fields: [tenant_id, actor_membership_id],
      references: [tenant_id, id],
      onDelete: Restrict,
      map: "purchase_gst_event_actor_fkey"
    )

  line_links purchase_gst_reconciliation_event_lines[]

  @@unique([tenant_id, purchase_invoice_id, evidence_revision_id, id])
  @@unique([tenant_id, operation, idempotency_key])
  @@index([tenant_id, purchase_invoice_id, created_at])
  @@index([tenant_id, evidence_revision_id, created_at])
  @@index([tenant_id, event_kind, created_at])
  @@index([tenant_id, actor_membership_id])
}
```

The event’s `decision_reference` is intentionally not part of a broad unique
constraint. Separate legitimate events may have the same payload or no
decision reference. Resolution and acceptance actions must validate decision
reference uniqueness through the accounting-decision unique key and application
state checks.

The primary idempotency constraint is:

```prisma
@@unique([tenant_id, operation, idempotency_key])
```

For an identical retry, the application loads the existing event, compares the
incoming payload hash, and returns the original committed result only when the
payload is equivalent. Reusing the key with a different payload is rejected.
A matching payload hash under a different key does not prevent a legitimate
event.

## 9. Technically feasible optional event-line association

The earlier direct optional relation used nullable fields in a compound
relation. That shape requires full Prisma validation and is not retained here.

Use a separate join model so every compound foreign key is required on its
defining side. An event has no line association when no join row exists:

```prisma
model purchase_gst_reconciliation_event_lines {
  id                   String @id @default(cuid())
  tenant_id            String
  purchase_invoice_id  String
  evidence_revision_id String
  event_id             String
  line_evidence_id     String

  event purchase_gst_reconciliation_events
    @relation(
      fields: [
        tenant_id,
        purchase_invoice_id,
        evidence_revision_id,
        event_id
      ],
      references: [
        tenant_id,
        purchase_invoice_id,
        evidence_revision_id,
        id
      ],
      onDelete: Restrict,
      map: "purchase_gst_event_line_event_fkey"
    )

  line_evidence purchase_gst_line_evidence
    @relation(
      fields: [
        tenant_id,
        purchase_invoice_id,
        evidence_revision_id,
        line_evidence_id
      ],
      references: [
        tenant_id,
        purchase_invoice_id,
        evidence_revision_id,
        id
      ],
      onDelete: Restrict,
      map: "purchase_gst_event_line_evidence_fkey"
    )

  @@unique([tenant_id, purchase_invoice_id, evidence_revision_id, id])
  @@unique([
    tenant_id,
    purchase_invoice_id,
    evidence_revision_id,
    event_id,
    line_evidence_id
  ])
}
```

This avoids the mixed-nullability direct relation entirely. It enforces that an
event-line link references the same tenant, purchase, and evidence revision on
both sides. The target keys are:

```prisma
purchase_gst_reconciliation_events
  @@unique([tenant_id, purchase_invoice_id, evidence_revision_id, id])

purchase_gst_line_evidence
  @@unique([tenant_id, purchase_invoice_id, evidence_revision_id, id])
```

The join model is optional by cardinality, not by nullable foreign-key fields.

## 10. Actor relations and authorization

Add these opposite fields to `memberships`:

```prisma
captured_gst_evidence_revisions
  purchase_gst_evidence_revisions[]
  @relation("purchase_gst_evidence_capture_actor")

accounting_decisions
  purchase_gst_accounting_decisions[]
  @relation("purchase_gst_accounting_decision_actor")

gst_reconciliation_events
  purchase_gst_reconciliation_events[]
  @relation("purchase_gst_event_actor")
```

Capture and accounting-decision actors are required for their records. Event
actors are nullable only for explicitly system-generated events.

The schema enforces tenant ownership through:

```prisma
(tenant_id, actor_membership_id)
  -> memberships (tenant_id, id)
```

Actorless system-event restrictions are application-level. Prisma schema alone
does not enforce event-kind-dependent actor requirements. Application code must
require an active, authorized membership for user-driven events and must
identify system provenance for actorless events. A database trigger or check
constraint would require separate review.

## 11. State, acceptance, and posting rules

`MATCHED` means declared and calculated values are complete, valid, and equal
under the approved comparison policy. It never implies accounting acceptance.

`RESOLVED` requires a current review-required discrepancy, explicit decision,
rationale, approver, timestamp, calculation rule version, and complete valid
accepted values recorded in an accounting decision.

Neither `MATCHED` nor `RESOLVED` is postable without explicit authorized
accounting acceptance. The posting guard fails closed for missing evidence,
legacy aggregate-only records, unresolved discrepancies, incomplete or invalid
accepted values, missing rule versions, stale revisions, mismatched decisions,
and unauthorized actors.

No discrepancy tolerance, posting precedence, legal place-of-supply rule,
decimal precision, or accepted-value selection rule is invented here.

## 12. Tenant guarantees and application-only invariants

Schema-enforceable guarantees include:

- purchase-to-evidence same-tenant and same-purchase ownership;
- current-pointer same-tenant and same-purchase ownership;
- revision-chain same-tenant and same-purchase ownership;
- line-evidence-to-revision ownership;
- line-evidence-to-item ownership;
- event-to-purchase and event-to-revision ownership;
- event-line-to-event and event-line-to-line ownership;
- tenant-scoped membership actor ownership;
- unique revisions per purchase;
- unique line evidence per revision/item;
- unique event idempotency keys;
- unique accounting decision references per purchase/revision.

Prisma cannot enforce:

- immutable rows or append-only deletes;
- revision numbering and no-cycle semantics;
- current revision pointer update discipline;
- active membership or role permission;
- segregation of duties;
- actorless event-kind restrictions;
- non-empty strings;
- JSON fact validity;
- accounting or GST correctness;
- posting authorization;
- transaction atomicity unless all writes use one transaction.

Database triggers, restricted roles, or equivalent database immutability controls
remain a separate approval decision.

## 13. Numeric and rounding policy

Raw supplier strings preserve source representation and remain distinct from
parsed decimals. Invalid or blank source text is retained as source evidence
and classified invalid; `NULL` remains missing.

The proposed `Decimal(20,4)` precision is provisional and requires accounting
approval. It must not be used to silently round or normalize source strings.

Existing purchase behavior remains unchanged:

- line gross, discount, taxable, and aggregate GST values remain two decimals;
- invoice subtotal remains whole-unit rounded by the current calculator;
- signed `round_off` remains preserved;
- existing aggregate purchase totals are not silently rewritten.

## 14. Legacy compatibility

Legacy purchases without GST evidence remain readable through existing aggregate
`total_tax`, `round_off`, `net_amount`, and line `gst_amount` fields. No source
facts or components are fabricated.

Existing finalized legacy purchases retain their operational status. Existing
legacy drafts require an approved treatment but cannot gain a new unreviewed
posting bypass.

New purchases created after strict workflow activation cannot post without
evidence, reconciliation, explicit authorized accounting acceptance, complete
accepted values, and the required application authorization.

## 15. Atomic workflow boundaries

Each state transition and its append-only event must commit in one transaction:

| Operation | Atomic contents |
|---|---|
| Evidence capture | Evidence revision, line evidence, current revision projection, `NOT_RECONCILED` state, and capture event |
| Calculation/reconciliation | Calculation result, reconciliation projection, version, and calculation/match/discrepancy event |
| Correction | New evidence revision, new calculation as applicable, current pointer, reset state, version, and correction event |
| Accounting decision | Immutable decision, current decision pointer, acceptance status, version, and decision event |
| Final posting | Eligibility recheck, stock, supplier ledger, payable, sequence, invoice finalization, version, and finalization event |

Use `gst_record_version` and current revision/calculation/decision IDs as
optimistic tokens. A failed conditional update is a retryable conflict.

## 16. Migration and rollback

### Expand

Add enums, required compound unique targets, tenant-aware purchase-item
relations, projection fields, evidence, calculation, decision, event, and
event-line models. Add explicitly mapped foreign keys and indexes.

Do not alter existing purchase amounts, aggregate GST, statuses, or rounding.

### Compatibility and classification

Deploy readers that tolerate absent evidence. Existing legacy rows remain
aggregate-only. Do not infer historical facts from mutable masters and do not
rewrite test data.

### Verification before workflow enablement

The later authorized implementation must run:

1. `prisma validate`.
2. Prisma client generation.
3. Generated migration SQL review.
4. Relation tests for every compound target listed in this document.
5. Cross-purchase and cross-tenant rejection tests.
6. Current-pointer and revision-chain tests.
7. Event-line join ownership tests.
8. Actor membership ownership tests.
9. Idempotency identical-retry and changed-payload tests.
10. Optimistic-version conflict tests.
11. Legacy read and existing purchase-write regressions.
12. Existing rounding regressions.
13. Evidence/calculation/decision immutability tests.
14. Atomic state/event transaction tests in an authorized isolated database.
15. RLS and application authorization tests when available.

No revised-schema validation has been run in this documentation task.

### Rollback

Stop new GST writers, disable strict workflow activation, retain additive schema
for mixed-version compatibility, and continue legacy aggregate reads. Restore
only an authorized disposable database snapshot if test data was changed.
Destructive DDL rollback and evidence/history deletion require separate approval.

## 17. Outstanding approvals

Still unresolved:

- exact mandatory timing for `source_document_reference`;
- exact decimal precision and scale;
- line-level mandatory-field matrix;
- whether database triggers/restricted roles are required for immutability;
- audit retention and tenant deletion behavior;
- actor roles and segregation of duties;
- system-event provenance;
- supplier correction after posting;
- accepted-value precedence;
- discrepancy materiality and tolerance;
- purchase place-of-supply interpretation;
- cess applicability;
- component and invoice rounding interpretation;
- legacy draft treatment; and
- rejection, credit-note, debit-note, and later-reconciliation workflows.

Product/accounting approval and qualified GST-professional review remain
required before schema or workflow implementation.

## 18. Implementation status

This revision changed documentation only. No Prisma schema, application code,
tests, migration files, database state, Supabase connection, fixtures,
environment variables, deployment configuration, generated mirrors, commit, or
push was changed.
