---
title: Financial date semantics and ledger date model design
date: 2026-11-09
status: Owner Authorized
---

## Goal

Design a reliable, IST-based financial date model without changing application code, schemas, historical records, or databases. This document proposes engineering direction; it does not approve accounting policy or authorize implementation.

## Acceptance Criteria

- [x] Inventory financial date producers and consumers with source evidence.
- [x] Distinguish business date, event instant, and knowledge time.
- [x] Specify safe historical classification, migration gates, and concrete tests.
- [x] Obtain independent review and identify owner decisions before implementation.

## Out of Scope

GST redesign, inventory, general ledger expansion, authentication, recovery, deployment, database access, schema changes, historical updates, and reopening existing accounting decisions.

## Executive conclusion and gate

**GO for non-destructive implementation planning only. NO-GO for schema changes, migration, historical updates, or claims of full-system IST correctness.** The current ledger `entry_date` can represent either a date-only marker or an instant. Its value alone does not reliably identify the intended interpretation. Exact historical impact is unknown; no records were inspected.

The recommended target is an event-specific **business/effective date**, an optional **genuine event instant** when known, and an independently recorded **knowledge instant**. A business date is an `Asia/Kolkata` calendar day, not a UTC instant. A verified date-only input must never be treated as evidence of a time of day. Accounting-effective rules, backdating, legacy exceptions, and the precise meaning of knowledge time need owner approval before execution.

## Current architecture and evidence

`customer_ledgers` and `supplier_ledgers` expose only `entry_date` and `created_at` as date fields ([schema](../../../prisma/schema.prisma#L1352)). The Prisma `DateTime` fields map to `TIMESTAMP(3)` in the current migrations, not timezone-aware instants ([baseline migration](../../../prisma/migrations/0001_baseline/migration.sql), [reconciliation migration](../../../prisma/migrations/0022_financial_reconciliation_foundation/migration.sql)). Sales posting copies the invoice date into the ledger, whereas a payment can use a submitted date or the `new Date()` fallback ([sales action](../../../src/app/_actions/sales.actions.ts#L936), [payment action](../../../src/app/_actions/sales.actions.ts#L1040)). Opening balances and reversals also use current instants ([master action](../../../src/app/_actions/masters.actions.ts#L388), [reconciliation service](../../../src/domain/services/financial-reconciliation.service.ts#L911)). Thus, even the same payment category can contain two meanings.

The prior IST work interprets due-date marker UTC components as the encoded business date while obtaining today's date explicitly in IST ([utility](../../../src/lib/utils/business-date.ts#L1), [aging repository](../../../src/repositories/ledger.repository.ts#L6)). That bounded offline correction is retained; it does not establish historical correctness or app-wide IST behavior. A VPN changes routing, not necessarily OS, browser, server, or database timezone.

## Producer inventory

The inventory groups producers with the same date contract; an application-generated timestamp is an observed JS instant, not proof that its legacy timezone-less database value can be reconstructed as one.

| Producer and evidence | Date source and behavior | Provenance, audit, and limitation |
|---|---|---|
| Sales draft and finalization ([creation](../../../src/app/_actions/sales.actions.ts#L458), [posting](../../../src/app/_actions/sales.actions.ts#L936)) | User invoice date is parsed from date input; due date derives by UTC-calendar addition on the marker; posting copies invoice date to ledger. | Invoice/ledger fields retain dates and timestamps, but original raw string and creation host timezone are not generally proven. Finalization guard and IST date tests exist ([tests](../../../tests/financial-ist-timezone.test.mjs)). |
| Purchase draft and posting ([creation](../../../src/app/_actions/purchases.actions.ts#L680), [posting](../../../src/app/_actions/purchases.actions.ts#L1850)) | User invoice date; current purchase due date copies invoice date; posting writes invoice date to ledger. | Invoice, source document references and finalized data provide potential corroboration, not universal raw-input proof. Purchase finalization contracts exist. |
| Customer and supplier payments ([customer](../../../src/app/_actions/sales.actions.ts#L1019), [supplier](../../../src/app/_actions/sales.actions.ts#L1162)) | Optional user `entry_date`; absent input falls back to `new Date()`; payment and ledger receive that value. | Payment references, actor, receipt and `created_at` exist ([schema](../../../prisma/schema.prisma#L1173)); cannot infer date kind from reference type alone. Payment/receipt contract tests exist. |
| Opening balances ([customer](../../../src/app/_actions/masters.actions.ts#L388), [supplier](../../../src/app/_actions/masters.actions.ts#L614)) | System-generated `new Date()` ledger entry. | Producer code is evidence for matching deployments, not automatic proof of all historical writes; actor/audit context requires per-record confirmation. |
| Shared ledger-impact methods ([service](../../../src/domain/services/ledger-impact.service.ts#L107)) and ledger repository ([repository](../../../src/repositories/ledger.repository.ts#L36)) | Callers may provide entry date; otherwise service defaults to current instant. Invoice/payment wrappers propagate inputs. | Caller provenance must be traced; update/delete are blocked in repository but not proof against every direct database write. |
| Allocation and allocation reversal ([service](../../../src/domain/services/financial-reconciliation.service.ts#L258), [reversal](../../../src/domain/services/financial-reconciliation.service.ts#L336), [schema](../../../prisma/schema.prisma#L1218)) | `allocated_at`/`reversed_at` and `created_at`; no separately modeled effective business date. | References, optional actor, idempotency, and reconciliation audit events support investigation; event timing semantics require policy. Contract tests do not prove historical runtime. |
| Refund request, approval, rejection, cancellation, completion ([service](../../../src/domain/services/financial-reconciliation.service.ts#L493), [completion](../../../src/domain/services/financial-reconciliation.service.ts#L659), [schema](../../../prisma/schema.prisma#L1264)) | Separate lifecycle timestamps; completion, not request, affects balances under accepted invariants. | State and actor fields/audit are evidence, but no universal separate effective date. |
| Payment reversal and any associated ledger entry ([service](../../../src/domain/services/financial-reconciliation.service.ts#L829), [schema](../../../prisma/schema.prisma#L1292)) | Reversal event time plus current-instant ledger entry. | Reversal reference and actor may link records; effective day is not automatically inherited from original payment. |
| Financial adjustments | Commercial credit/debit adjustments and exceptional workflows are not established as supported current-release financial producers; do not infer them from stock adjustment code. Future supported adjustments need their own event-date policy. | No new adjustment semantics or ledger behavior are approved here. |
| Audit records ([repository](../../../src/repositories/audit-log.repository.ts#L31), [schema](../../../prisma/schema.prisma#L1404)) | `created_at` and event metadata record selected actions. | Audit is not proven to be a complete row-version history or a commit-order oracle. |

Targeted source investigation found no scheduled financial producer; this is a repository observation, not proof about external jobs. Payment, allocation, refund and ledger source-contract tests exist, but none proves all producer timestamps or historical records. A future implementation must inventory raw SQL/import writers again at its frozen source revision.

## Consumer inventory

| Consumer | Current field, filtering, and risk |
|---|---|
| Daybook ([page](../../../src/app/reports/daybook/page.tsx#L74), [CSV](../../../src/app/_actions/exports.actions.ts#L505)) | `entry_date`; page uses host-local month defaults and inclusive UTC-coded bounds; opening balance uses `< from`, rows use `>= from` and `<= to`. Date-kind ambiguity affects inclusion and display near day boundaries. CSV has separate host-local bounds. No strict knowledge cutoff. |
| Customer statement ([repository](../../../src/repositories/ledger.repository.ts#L70), [print](../../../src/app/customers/%5BcustomerId%5D/statement/print/page.tsx#L61)) | Ordered ledger `entry_date`, with local date-range handling in print; mixed values can move across days. Current detail is capped and is not an immutable historical snapshot. |
| Supplier ledger and payables ([ledger](../../../src/repositories/ledger.repository.ts#L232), [report](../../../src/app/reports/supplier-payables/page.tsx#L63)) | Ledger history uses `entry_date`; payables report uses current outstanding and aging. No supplier statement print path was identified in the scoped source. |
| Customer/supplier aging ([repository](../../../src/repositories/ledger.repository.ts#L96), [supplier](../../../src/repositories/ledger.repository.ts#L255)) | Due-date calendar markers versus IST current day; due today is current. Buckets are current, 1–30, 31–60, 61–90, >90. Current balances/allocations are not a strict historical as-of reconstruction. Existing offline boundary tests do not prove DB behavior. |
| Sales/purchase registers and invoice print ([sales](../../../src/app/reports/sales-register/page.tsx#L67), [purchase](../../../src/app/reports/purchase-register/page.tsx#L67), [sales repository](../../../src/repositories/sales-invoice.repository.ts#L126)) | Invoice date is a business-date marker; sales uses inclusive date bounds, purchase report filters loaded records. Date-only displays should not be converted as if they were actual event instants. |
| Payment lists and unapplied credits ([repository](../../../src/repositories/payment.repository.ts#L88), [customer credits](../../../src/repositories/payment.repository.ts#L130), [supplier credits](../../../src/repositories/payment.repository.ts#L205)) | Lists sort by `payment_date`; credit/advance results expose `paymentDate`. It can encode a date marker or an instant. Future ordering and output must use separately classified business date and deterministic recording/ID tie-breakers, while disclosing unknown legacy values rather than pretending the old field has one meaning. |
| Dashboard and CSV ([dashboard](../../../src/app/dashboard/page.tsx#L81), [exports](../../../src/app/_actions/exports.actions.ts#L165)) | Current-state financial aggregates, invoice date markers, and recorded audit/creation instants. Selected displays use explicit IST; current aggregates are not historical as-of reports. |
| Strict as-of and restatement ([invariant](./financial-reconciliation-accounting-invariants.md#L77)) | Approved requirement distinguishes effective day and time recorded; current aging does not implement the complete two-cutoff event reconstruction. No strict knowledge-as-of acceptance is implied. |

Tests cover invoice aging boundaries, selected date rendering and export authorization; they do not prove daybook mixed-date filtering, historical statements, all producers, event/knowledge as-of behavior, or database transactions. Some input and statement range behavior remains host-dependent.

## Proposed canonical model and event rules

**Proposal, not approved schema:**

1. `business_date`/`effective_date`: PostgreSQL `date`, represented explicitly at API boundaries as a validated `YYYY-MM-DD` string; Prisma's `DateTime @db.Date` mapping requires a dedicated adapter and round-trip tests. Do not rely on a JS `Date`'s machine-local getters. Avoid claiming `timestamptz` stores the original timezone: it stores an instant, and display must select IST explicitly.
2. `occurred_at`: nullable PostgreSQL `timestamptz(3)` only for an actually known event instant, serialized as ISO 8601 with `Z` or an explicit offset; unknown is null, never invented as midnight.
3. `recorded_at`: separate system-controlled `timestamptz(3)` for recording/acceptance; never trust a caller-supplied backdate. The implementation must define if this is application acceptance, transaction start, or commit-visible knowledge. Transaction-start/default timestamps are not proof of commit visibility. Until a suitable mechanism is approved and tested, do not claim a strict commit-visible historical cutoff.
4. Preserve source/actor, operation kind, lineage and classification status; `created_at` is useful evidence but not automatically an economically effective instant or complete audit trail. Use existing event tables rather than a new generic event framework unless a demonstrated gap requires it.

| Event | Candidate business-date source | Event/knowledge time and policy gate |
|---|---|---|
| Invoice | Explicit invoice date; finalized due-date snapshot for aging. | Finalization instant and independent recording evidence; no unsupported historical snapshot claim. |
| User-dated payment | Explicit validated payment date; never infer time of day. | `occurred_at` only if independently captured; `recorded_at` when accepted. Backdating rights and disclosure require owner decision. |
| Undated system event, opening balance, allocation | Candidate IST date derived from genuine event instant. | Whether allocation/opening uses operation date or another effective date is an event-specific owner decision. |
| Allocation reversal or payment reversal | Candidate reversal's own approved effective date, linked to original; do not silently rewrite original day. | Capture actual reversal and recording instants; retroactive reversal vs current-day correction requires approval. |
| Refund | Request and completion are distinct events; request has no balance effect. Candidate completion business date derives from completion instant unless a separately approved effective date is supplied. | Preserve lifecycle instants and record-time evidence; never date completion solely from request. |
| Adjustment | Not a supported policy assumption; require event-specific approval before accepting any effective-date rule. | Preserve original, reason, actor, and separate recorded instant. |

Existing Decisions F/O approve due-date aging, due-date snapshots, and distinctions between effective and recorded history; they do not approve these new event-specific schema or backdating choices ([decision log](./financial-reconciliation-decision-log.md#L22), [invariants](./financial-reconciliation-accounting-invariants.md#L77)).

## Reports, API, and knowledge-time semantics

For business as-of date `D` and knowledge cutoff `T`, include an eligible event only if its approved effective date is `<= D` and its trustworthy recorded instant is `<= T`, plus event-specific state conditions. A refund request does not settle a balance; completion can contribute only after its effective and recorded conditions hold. Finalization must have been recorded by `T`. An event effective on day 1 but first recorded on day 2 is excluded from a day-1 knowledge snapshot and appears in an explicitly labelled later restatement. Date-only effective facts need no invented instant.

Date range inputs are IST business dates: specify inclusive day endpoints or an equivalent half-open `[from, day-after-to)` range on `DATE`; instant queries use explicitly converted IST boundaries and half-open intervals. Daybook and statements group classified events by `business_date`, with deterministic event/recorded/ID ordering and both cutoffs disclosed. Unclassified legacy rows must not silently disappear into a successful-looking total: show explicit exclusions/amount counts or block financial closure according to owner-approved policy. API rejects invalid dates, impossible offsets, unsupported backdating, and missing required provenance; UI labels effective, event, and recorded values distinctly.

## Historical classification and safe migration design

Classification is per row and producer/version, backed by durable source evidence; appearance, a midnight value, VPN location, or `created_at` alone is not proof.
Classify business date, event instant, and knowledge time **independently**. A proven date does not establish when the system knew it. If trustworthy knowledge-time evidence is absent, mark it unknown and exclude or qualify that row in strict `T` reports under the approved exception policy; do not infer `recorded_at` from a date marker or undocumented legacy `created_at`.

| Class | Sufficient evidence to consider, subject to review | Handling |
|---|---|---|
| Reliably identifiable business date | Immutable original document/request plus matching tenant, source ID, event identity, deployed producer/version, and validated date; disagreements block classification. | Preserve original; record rule, evidence reference and derived date. |
| Reliably identifiable event instant | Original zoned timestamp or trustworthy event/audit evidence plus verified producer and timezone contract. A timezone-less legacy value alone is insufficient. | Preserve original; store independently evidenced instant and IST date only when policy permits derivation. |
| Ambiguous/conflicting | Missing raw input, unknown producer/timezone, mixed payment fallback, conflicting evidence, or uncertain historical correction. | Preserve unchanged; quarantine with explicit reason and review status. Do not silently normalize, drop, or assert a date. |

Proposed future phases, requiring separate approval and an explicitly authorized isolated target: freeze inventory/source hashes; take a verified consistent snapshot; run a **read-only** deterministic dry-run classifier with no database writes; generate tenant-scoped counts, signed monetary totals and exception manifests; independently inspect evidence and approve mappings. Any actual additive migration must preserve originals and evidence, use least privilege/RLS, be reviewed separately, and never bulk-shift dates. Reconcile per tenant, period and event type: row counts, invoice/payment amounts, ledger debit/credit totals, allocations and reversals, refunds, and outstanding balances at exact decimal precision. Require zero unexplained differences and explicit ambiguous-item acceptance; mixed legacy rows are not proof of correct historical balances.

Use an additive compatibility/shadow-read plan with versioned classification rules, reproducible hashes and audit trail rather than replacing source fields. Gate each tenant cutover on authorization and comparison. Rollback switches reads back to preserved legacy data and retains new evidence; it does not reverse-transform or delete original rows. Once new writes exist, rollback must preserve and reconcile them rather than discard them. Backup/recovery execution is out of this mission. Index candidates start with tenant equality and business-date ranges, with recorded-time access paths chosen by measured query plans; two independent range predicates do not automatically benefit from one composite index.

## Regression plan with expected outcomes

Run all cases under `Asia/Kolkata`, `UTC`, and `America/Los_Angeles`; output must be identical across host timezones. These are **planned** tests, not runtime evidence.

| Case | Expected result |
|---|---|
| Payment instant 2026-11-09 23:30 IST (`18:00Z`) | Derived business day 2026-11-09, if this event's approved policy derives from its instant. |
| Payment instant 2026-11-10 02:00 IST (`2026-11-09T20:30Z`) | Derived day 2026-11-10 in all three hosts. |
| Explicit payment day Nov 9, recorded Nov 10 | Day is Nov 9; event instant remains unknown unless independently supplied. A Nov 9 knowledge cutoff excludes it; later restatement includes it with disclosure. |
| Independent `D` and `T` cutoffs | With effective date Nov 10 and recorded instant Nov 9 10:00Z, `D=Nov 9, T=Nov 11 00:00Z` excludes; `D=Nov 10, T=Nov 9 09:59:59Z` excludes; `D=Nov 10, T=Nov 9 10:00Z` includes if all other event and trustworthy-recording conditions hold. Equality is inclusive for both cutoffs. |
| Known business date, unknown knowledge instant | Preserve the proven date but explicitly mark knowledge time unknown; never include as proven in a strict `T` report, and disclose/block according to the approved exception policy. |
| Reversal recorded Nov 10 of Nov 9 payment | Original remains unchanged; reversal uses separately approved effective rule and appears only after recording cutoff. |
| Refund requested Nov 9, completed Nov 10 | Request alone changes no balance; completion affects the approved date only when recorded by cutoff. |
| Date marker with supported source evidence | Preserve original and map exact calendar date; no 5:30 shift; compare counts and amounts. |
| Zoned instant with reliable producer and source evidence | Preserve original instant; derive IST day only by approved event rule. |
| Ambiguous legacy value | No guessed classification; explicit exception/report exclusion or blocked closure and reconciled exception amount. |
| IST midnight and day boundaries | 18:29:59.999Z maps to preceding IST day; 18:30:00Z maps to next day. Aging tests cover -1, 0, 1, 29–32, 59–62, 89–92, 119–122 with five exclusive buckets and `current_30` preserved. |
| Daybook, both statements, daily totals | Group approved events by business date; inclusive endpoints and opening-balance reconciliation agree with export. Unknown legacy dates are visible and cannot yield an unqualified complete total. |
| Dry run / rerun / rollback | No source writes in dry run; deterministic evidence hash; counts and exact decimal totals reconcile including exceptions; disabling new reads restores legacy behavior without dropping post-cutover writes. |

## Owner decisions, tradeoffs, and implementation sequence

1. Approve event-specific effective dates and backdating permissions, including reversal/refund rules and whether correction dates restate closed periods.
2. Approve knowledge-time authority and precision, including commit visibility versus recorded acceptance and the treatment of late/backdated data.
3. Choose how unclassified rows affect reports: explicit exclusions with qualified totals versus fail-closed reporting. Neither is silently complete.
4. Review additive date/instant schema and data provenance, API contracts, compatibility, index plans, tenant isolation, and historical remediation separately.
5. After approval: implement typed write contracts for new events; test against an explicitly authorized isolated environment; introduce dual/shadow reads and exception-aware reports; perform separately approved dry-run classification; only then consider a gated migration and cutover.

Keeping existing mixed timestamps is least disruptive but cannot guarantee day assignment. A unified event-store redesign could centralize temporal reporting but expands scope and duplicates existing models; it is not recommended without a demonstrated need. `DATE` plus independently evidenced instants is the smallest proposed semantic separation, not an approved migration.

## Independent review

**ACCEPTED for design**, not implementation. The read-only reviewer identified one MAJOR omission: a supported legacy business date does not establish its knowledge time. This revision separately classifies each temporal fact and requires unknown knowledge to remain disclosed or excluded from strict `T` reporting. Two MINOR coverage gaps were also resolved: independent `D`/`T` equality tests and payment-date list/advance consumers were added. The reviewer confirmed all three findings resolved and independently checked 23:30/02:00 IST, refund and reversal distinctions, and the commit-visibility caveat. The reviewer ran existing focused offline tests 34/34; planned temporal/migration tests remain unexecuted.

## Verification and preservation

This design mission performs no database access or runtime verification. Baseline HEAD is `4c73beed70166f765c3cbf0b7edef16f9ce9fcd5`; 1,445 existing tracked and non-ignored untracked files were hashed, and staged/unstaged binary diffs were captured before this report. Final preservation and `git diff --check` are required before acceptance.
