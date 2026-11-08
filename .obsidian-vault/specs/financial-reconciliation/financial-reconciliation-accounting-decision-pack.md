---
title: Financial Reconciliation Accounting Decision Pack
date: 2026-11-08
status: Pending Owner Approval
---

## Purpose and approval boundary

This pack closes accounting-policy questions for owner approval. It does not change application behavior. Every recommendation below is **Pending** until the owner explicitly approves it. The current product remains a bounded AR/AP subledger; it is not a general ledger.

## Evidence baseline

- `prisma/schema.prisma` defines `payments` with optional customer/supplier references and a nullable sales-only `invoice_id`, but no allocation, refund, reversal, status, or purchase-invoice payment model.
- `src/app/_actions/sales.actions.ts:createCustomerPaymentAction` and `createSupplierPaymentAction` lock the counterparty balance, reject account-level overpayment, create a payment and subledger row, and update the cached balance. Both write no allocation and do not update invoice `paid_amount` or `balance_due`.
- `customer_ledgers` and `supplier_ledgers` are AR/AP subledgers. `LedgerImpactService` is a parallel posting helper, while the active invoice/payment actions write directly.
- `CustomerLedgerRepository.getAgingBuckets` and its supplier counterpart bucket ledger rows by entry date and skip credit rows; this is not invoice-level aging.
- Payment and ledger repository mutation is now blocked, but no compensating payment reversal workflow exists.
- Previous campaign stock changes are reviewed separately in Decision J; they are not treated as accounting-policy approval.

## Decision A — Payment allocation

### Problem
Account-level payments cannot prove which invoice was settled. A customer can pay one invoice in several installments, or one payment can cover several invoices, but current records cannot represent either relationship reliably.

### Current behavior
Customer and supplier payments are posted against the counterparty balance. `payments.invoice_id` is nullable and sales-only; the active actions write `invoice_id: null`. No allocation table or allocation transaction exists.

### Options

| Option | Advantages | Disadvantages |
|---|---|---|
| Manual invoice-specific allocation | Explicit, auditable, predictable, simple user mental model | Requires user selection; unallocated money needs a visible workflow |
| Automatic FIFO allocation | Low input effort; deterministic if dates and tie-breakers are fixed | Hidden behavior, disputes when dates are ambiguous, harder corrections |
| Hybrid manual plus optional automatic allocation | Supports speed and exceptions | More UI, policy, and test surface; automatic behavior still needs clear consent |

### Recommendation — Pending
Use **manual allocation as the MVP policy**, with optional automatic allocation deferred until the owner approves a deterministic rule. Permit one payment to allocate to many invoices, one invoice to receive many payments, and partial allocations. Preserve an unallocated remainder rather than forcing an allocation.

Allocation changes after posting should be append-only: reverse the original allocation and create a replacement allocation in one transaction. Never edit allocation history in place.

### Examples

- Customer invoice `SI-101` = ₹1,000. Two payments of ₹400 and ₹600 allocate to `SI-101`; outstanding becomes ₹0.
- Customer payment `PAY-201` = ₹1,500 allocates ₹1,000 to `SI-101` and ₹500 to `SI-102`; both invoice balances reduce by their allocated portions.
- Supplier invoice `PI-301` = ₹2,000 with a ₹750 payment has outstanding ₹1,250.

### Data and transaction implications
Add a tenant-scoped allocation record referencing a payment and the correct sales or purchase invoice, with amount > 0, tenant-consistent parties, and uniqueness only for the allocation identity—not the amount. Payment creation and allocation must be atomic when submitted together. Allocation changes must lock the payment and invoice/counterparty rows, verify remaining payment and invoice amounts, write immutable history, and update projections.

### Required tests
Multiple payments per invoice, one payment across invoices, partial allocation, unallocated remainder, concurrent allocation, tenant mismatch, duplicate allocation retry, and allocation correction.

### Owner approval question
**Approve manual invoice allocation for sales and purchases, allowing one payment across multiple invoices, multiple payments per invoice, partial allocation, and append-only allocation corrections?** (Yes / No / Amend)

## Decision B — Advance payments and unallocated money

### Problem
Money can arrive before an invoice exists or remain partly unused after allocation. Treating it as invoice settlement creates false closure.

### Current behavior
There is no advance or unallocated balance model. Current actions reject payments above the account-level outstanding balance, so genuine advances and overpayments cannot be recorded.

### Options

| Option | Advantages | Disadvantages |
|---|---|---|
| Unallocated counterparty credit/advance | Preserves money and traceability; later allocation is explicit | Requires separate reporting and reconciliation |
| Force allocation to an existing invoice | Simple data model | Cannot represent pre-invoice money and encourages false settlement |
| Reject all pre-invoice money | Minimal implementation | Operationally unusable for common supplier/customer workflows |

### Recommendation — Pending
Record customer advances as unallocated customer credit and supplier advances as unallocated supplier advance. Do not treat either as invoice settlement until an allocation exists. Show these amounts separately in dues/payables reports: customer receivable excludes customer credit, while a credit-balance section shows the credit; supplier payable excludes supplier advance, while a supplier-advance section shows the advance.

### Examples

- Customer pays ₹500 before any invoice: gross customer receivable = ₹0; unapplied customer credit = ₹500; net customer position = -₹500.
- A later customer invoice of ₹800 receives a ₹500 allocation: invoice outstanding = ₹300; unallocated credit = ₹0.
- Supplier is paid ₹1,000 before receiving an invoice: gross supplier payable = ₹0; unapplied supplier advance = ₹1,000; net supplier position = -₹1,000. A later ₹1,400 purchase invoice allocated ₹1,000 leaves gross payable/net position ₹400.

### Data and transaction implications
Use the payment record as the source transaction and allocation records as the only settlement link. Reports must calculate unallocated amount as payment amount less valid allocations, less approved refund/reversal effects.

### Required tests
Pre-invoice customer and supplier payments, later allocation, partial allocation remainder, report exclusion from outstanding, and concurrent allocation.

### Owner approval question
**Approve separate unallocated customer-credit and supplier-advance balances that are excluded from invoice outstanding until explicitly allocated?** (Yes / No / Amend)

## Decision C — Overpayments and credit balances

### Problem
An amount above an invoice can be a genuine credit, a payment intended for another invoice, or an error. Silently discarding it or making an invoice negative is not acceptable.

### Current behavior
Account-level actions reject payments greater than current account dues. No excess-credit or refund workflow exists.

### Options

| Option | Advantages | Disadvantages |
|---|---|---|
| Keep unapplied credit | No money disappears; supports future invoices | Requires user follow-up |
| Auto-allocate to other invoices | Reduces credits quickly | May settle the wrong invoice |
| Refund excess | Clears credit | Requires explicit refund controls and cash evidence |
| Require explicit user choice | Safe and transparent | Adds workflow friction |

### Recommendation — Pending
Never allow an invoice outstanding below zero. Require an explicit user choice: allocate the excess to selected open invoices, keep it as unapplied credit/advance, or initiate a separate refund workflow. Do not auto-allocate without approval of a deterministic rule.

### Examples

- Invoice S-103 = ₹1,000; payment = ₹1,200. Allocate ₹1,000; ₹200 remains credit, is allocated to another invoice, or is refunded after explicit choice.
- If ₹200 is retained as credit, S-103 outstanding = ₹0 and customer credit = ₹200.
- Supplier invoice `PI-303` = ₹900; supplier payment `PAY-303` = ₹1,000. ₹100 is supplier advance or refund candidate; `PI-303` outstanding = ₹0.

### Data and transaction implications
Allocation validation must enforce allocated-to-date <= invoice total and allocated-to-date <= payment usable amount. Credit and advance projections must be derived, not manually reduced.

### Required tests
Exact payment, overpayment, cross-invoice allocation, retained credit, refund selection, and negative-balance rejection.

### Owner approval question
**For overpayments, should the application require an explicit choice among unapplied credit, allocation to another invoice, and refund, with no automatic disposition?** (Yes / No / Amend)

## Decision D — Refunds

### Problem
Returning money is different from correcting an invoice or cancelling an erroneous payment. Conflation would distort both history and balances.

### Current behavior
No refund, credit-note, debit-note, or payment-reversal action exists. The ledger enum contains note labels, but no complete workflow uses them.

### Options

| Event | Policy option | Consequence |
|---|---|---|
| Actual money returned to customer | Refund transaction linked to original payment/credit | Reduces customer credit or increases receivable; preserves original |
| Money received back from supplier | Supplier refund receipt linked to original supplier payment/advance | Reduces supplier advance or payable credit |
| Commercial invoice reduction | Credit note/adjustment linked to invoice | Changes invoice obligation; not a cash refund |
| Erroneous payment cancellation | Payment reversal/void with reason | Reverses financial effect; does not erase source |

### Recommendation — Pending
Use distinct immutable transaction types:
1. **Refund** for actual money movement.
2. **Credit/debit note or invoice adjustment** for commercial correction.
3. **Payment reversal** for an erroneous posted payment.
Each links to its source, preserves the original, creates a compensating subledger effect, and records actor, date, reason, and idempotency key.

### Examples

- Customer has ₹200 credit and receives ₹200: original payment remains ₹200, refund = ₹200, customer credit becomes ₹0; two traceable transactions exist.
- Supplier advance ₹300 is returned: original supplier payment remains ₹300, supplier refund receipt = ₹300, supplier advance becomes ₹0.
- Invoice S-104 ₹1,000 is reduced by a ₹100 credit note: invoice obligation becomes ₹900; no cash payment or refund is implied.

### Data and transaction implications
Refunds need source linkage and amount limits. Reversals need a one-to-one or explicitly bounded relationship to the original. Adjustments need invoice linkage and approval rules. All effects must be atomic with ledger and projection updates.

### Required tests
Refund partial/full, supplier money-back, credit note after payment, reversal after allocation, duplicate reversal, and source-overrun rejection.

### Owner approval question
**Approve separate refund, invoice-adjustment/credit-note, and payment-reversal transaction types, each preserving the original record and writing a compensating effect?** (Yes / No / Amend)

## Decision E — Reversals and corrections

### Problem
Posted records must remain historically true while allowing operational correction.

### Current behavior
Ledger and payment repository mutation is blocked, but there is no application reversal workflow. Payment idempotency prevents duplicate retries, not mistaken real-world payments.

### Options

| Option | Advantages | Disadvantages |
|---|---|---|
| Edit posted record | Simple UI | Destroys audit history and breaks reconciliation |
| Delete posted record | Simple database operation | Loses evidence and can orphan ledger effects |
| Immutable compensating transaction | Preserves history and balances | Requires explicit correction workflow |
| Reverse and repost | Strong traceability for complex corrections | More records and approval/test surface |

### Recommendation — Pending
Disallow edit/delete after posting. Use immutable compensating transactions. Incorrect amount: reverse original and post the correct payment. Incorrect date: reverse and repost with the approved date, retaining both dates. Incorrect allocation: reverse allocation and create a replacement. Duplicate payment: preserve both source records and reverse the duplicate only after explicit confirmation. Failed/uncommitted transactions create no financial record.

### Owner approval question
**Approve immutable reverse-and-repost corrections for all posted payments, allocations, and ledger impacts, with no edit/delete path?** (Yes / No / Amend)

## Decision F — Receivable and payable aging

### Problem
Current aging uses ledger entry dates and does not match credits to invoice open items. It cannot reliably identify which invoices are overdue.

### Current behavior
`getAgingBuckets` assigns positive ledger rows to date buckets and skips credits. No invoice due-date model is used in reporting.

### Options

| Option | Advantages | Disadvantages |
|---|---|---|
| Invoice date | Always available and simple | Ignores agreed credit terms |
| Explicit due date | Matches contractual terms | Requires capture and validation |
| Derived due date from credit period | Consistent where terms exist | Requires customer/supplier terms and fallback policy |

### Recommendation — Pending
Use invoice due date as the aging basis. If absent, derive due date from the approved counterparty credit period; if neither exists, use invoice date and disclose the fallback. Apply valid allocations and approved adjustments before bucketing the remaining invoice amount. Exclude unallocated credits/advances from overdue amounts and report them separately. Use the same rule for sales and purchases unless owner-approved supplier-specific terms require a difference.

### Examples

- Invoice ₹1,000, due 2026-10-01, payment allocation ₹400: overdue exposure = ₹600, not ₹1,000.
- Invoice ₹1,000 with ₹1,000 unallocated customer credit but no allocation: invoice remains ₹1,000 outstanding; credit is shown separately.
- No due date and 30-day approved terms: invoice date 2026-10-01 gives due date 2026-10-31.

### Owner approval question
**Approve due-date aging, with credit-period derivation and invoice-date fallback, after allocations and adjustments, while excluding unallocated credit/advances from overdue balances?** (Yes / No / Amend)

## Decision G — Authoritative financial balance

### Problem
Invoice fields, counterparty cached balances, ledger rows, payments, and reports can disagree because no complete reconciliation invariant connects them.

### Current behavior
Source payments and subledger rows are transactionally written, while `receivable_balance`/`payable_balance` and invoice `paid_amount`/`balance_due` are denormalized. Reports consume cached balances and ledger-derived aging.

### Options

| Option | Advantages | Disadvantages |
|---|---|---|
| Cached balance authoritative | Fast reads | Can drift; weak auditability |
| Ledger authoritative | Existing model; traceable | Does not provide invoice open items or allocation |
| Event + allocation model authoritative, caches projections | Complete reconciliation and explainability | Requires additive allocation/adjustment model |

### Recommendation — Pending
Make immutable source transactions plus valid allocations, refunds, reversals, and invoice adjustments authoritative. Derive invoice outstanding, counterparty net balance, allocated totals, and unallocated credit/advance from those records. Keep cached balances only as projections, update them transactionally, and run a reconciliation check that reports—not silently repairs—differences.

### Core equations

- Invoice outstanding = invoice amount − valid allocations − approved invoice credits + approved debit adjustments.
- Payment usable amount = payment amount − valid allocations − refunds/reversals.
- Unallocated customer credit = usable customer receipts not allocated to sales invoices.
- Unallocated supplier advance = usable supplier payments not allocated to purchase invoices.
- Gross customer receivable = outstanding finalized sales-invoice and debit-adjustment exposure.
- Unapplied customer credit = valid customer receipts/credits not allocated to sales invoices.
- Net customer position = gross customer receivable − unapplied customer credit.
- Gross supplier payable = outstanding finalized purchase-invoice and credit-adjustment exposure.
- Unapplied supplier advance = valid supplier payments not allocated to purchase invoices.
- Net supplier position = gross supplier payable − unapplied supplier advance.

### Owner approval question
**Approve immutable source transactions plus allocations and adjustments as authoritative, with cached balances treated as verified projections and discrepancies surfaced rather than silently corrected?** (Yes / No / Amend)

## Decision H — Scope of ledger functionality

### Problem
Reconciliation must be completed without implying capabilities the implementation does not have.

### Current capability
The implementation supports bounded customer AR and supplier AP subledgers, transactional invoice/payment postings, and cached counterparty balances. It does not support a chart of accounts, balanced journal headers/lines, cash/bank accounts, payment-provider settlement, or full double-entry general-ledger accounting.

### Recommendation — Pending
Complete the current objective within bounded AR/AP: invoice allocation, advances/credits, refunds/reversals, open-item aging, and reconciliation checks. Do not redesign into a general ledger unless a separate owner-approved requirement exists.

### Owner approval question
**Approve bounded AR/AP as the current accounting scope, explicitly excluding cash/bank reconciliation and full general-ledger accounting?** (Yes / No / Amend)

## Decision I — Database integrity and atomicity

### Problem
Application validation alone cannot guarantee financial consistency when concurrent or direct database writes occur.

### Required guarantees

| Guarantee | PostgreSQL responsibility | Application responsibility |
|---|---|---|
| Tenant-consistent references | Composite tenant-aware FKs or equivalent guarded constraints where feasible | Validate context and reject mismatches |
| Duplicate retry prevention | Non-null/validated tenant-scoped idempotency for new writes | Stable request key and payload hash |
| Allocation limits | Positive amount checks and guarded transactional constraints | Lock payment/invoice and calculate remaining amounts |
| No negative invoice outstanding | Check/trigger or guarded update compatible with approved model | Validate before commit |
| Reversal integrity | Source linkage, uniqueness, and immutable-history enforcement | Permission, reason, workflow, and idempotency |
| Atomic effects | FK/check/trigger backstops | One transaction for source, allocation, ledger, and projection |

### Recommendation — Pending
Use PostgreSQL for structural invariants, tenant-safe references, positive amounts, valid party combinations, source-link uniqueness, and immutable-history backstops. Use application transactions for policy, permission, allocation choice, correction reasons, and user-facing errors. Add no migration until policy approval and data audit.

### Owner approval question
**Approve PostgreSQL structural constraints plus application-level transactional policy checks as the split of responsibility for the approved reconciliation model?** (Yes / No / Amend)

## Decision J — Previous stock movement changes

### Evidence
The previous campaign changed `src/domain/services/stock-movement.service.ts` to use a conditional outbound decrement, reject invalid quantities, initialize new batches at zero before incrementing, and make `recordMany` one transaction. Focused contracts and typecheck pass; the independent review found no significant issue.

### Assessment
These changes address inventory concurrency and atomicity, not invoice allocation or accounting policy. They are relevant to financial correctness because stock and purchase/sales finalization are financially coupled, but they are a separate inventory-integrity objective with separate tests.

### Recommendation — Pending scope decision
Retain the changes in the worktree because they are already implemented, narrowly scoped, and reduce a demonstrated oversell/partial-commit risk. Track them as a separate inventory-integrity workstream in acceptance reporting; do not use them as evidence that accounting reconciliation is complete.

### Owner approval question
**Approve retaining the stock changes as a separate inventory-integrity workstream while excluding them from the accounting-policy acceptance score?** (Yes / No / Amend)

## Cross-cutting corrections and technical acceptance criteria

### Balance terminology

The terms below are mandatory for every future report and scenario:

- Gross customer receivable is outstanding finalized sales-invoice and debit-adjustment exposure.
- Unapplied customer credit is a valid customer receipt/credit not allocated to an invoice.
- Net customer position is `gross customer receivable - unapplied customer credit`; positive means the customer owes Pharmnos and negative means Pharmnos holds customer credit.
- Gross supplier payable is outstanding finalized purchase-invoice and credit-adjustment exposure owed to the supplier.
- Unapplied supplier advance is a valid supplier payment not allocated to a purchase invoice.
- Net supplier position is `gross supplier payable - unapplied supplier advance`; positive means Pharmnos owes the supplier and negative means Pharmnos holds an excess supplier advance.

Therefore: ₹500 customer advance before invoices means gross AR ₹0, unapplied credit ₹500, net position -₹500. An ₹800 invoice plus that credit means gross AR ₹800, credit ₹500, net position ₹300. Allocating ₹500 makes gross AR ₹300, credit ₹0, and leaves net position ₹300. Supplier advances follow the same signed convention.

### Refunds after allocation

The proposed default is Pending owner approval: request, approval, and completed cash refund are separate states. A refund request records intent only and does not reserve funds unless the owner explicitly approves reservation semantics. A completed ₹200 refund against a ₹1,000 payment allocated to a ₹1,000 sales invoice must atomically:

1. Validate refundable amount and active allocation.
2. Reverse the corresponding ₹200 allocation.
3. Reopen ₹200 invoice outstanding.
4. Record the completed ₹200 refund linked to the payment.
5. Recompute payment usable amount and allocation totals.

Failure rolls back all five effects. An unapplied-credit refund does not alter invoice allocations. Partial refunds are bounded by the refundable amount; full refunds reverse all remaining allocations. Repeated requests use an idempotency key. A payment reversal is a separate compensating event and is not a refund. Supplier refunds/returns use an explicitly linked supplier-side cash receipt/refund event; no unsupported inventory-return behavior is implied. Credit notes and invoice adjustments change commercial exposure, not cash movement.

### Shared concurrency lock-order protocol

The following is one proposed future protocol for allocation creation, refund completion, allocation reversal, payment reversal, and multi-invoice allocation. It is not implemented. The canonical lock key is `(tenant_id, parent_kind, parent_id)`, ordered lexicographically by tenant, then `parent_kind` (`counterparty`, `payment`, `invoice`), then identifier. Every workflow locks all of its balance-bearing parents using this same order. Multiple invoice IDs are sorted by the same key before acquisition; a multi-invoice request never locks invoices in request order.

| Workflow | Required parent locks | Why |
|---|---|---|
| Allocation creation | Payment and every target invoice; counterparty parent when a maintained counterparty projection is changed | Serializes payment usability, invoice outstanding, and projection updates |
| Refund completion | Source payment, every affected invoice, and counterparty parent | Prevents allocation/refund races and bounds refundable amount |
| Allocation reversal | Source payment, affected invoice, and counterparty parent | Prevents reversal races with allocation, refund, and payment reversal |
| Payment reversal | Source payment, every active-allocation invoice, and counterparty parent | Reverses allocations and consumes payment exactly once |
| Multi-invoice allocation | Payment, all sorted target invoices, and counterparty parent if projection-bearing | Uses the same global order as single-invoice operations |

After acquiring the complete lock set, each workflow validates tenant ownership and idempotency, rereads active allocations, completed refunds, completed reversals, adjustments, and invoice/counterparty state, recalculates payment usable amount and invoice balances, and applies all source, allocation, refund/reversal, ledger, and projection effects in one transaction. Refunds and reversals must use this exact protocol, so allocation versus refund, allocation versus payment reversal, refund versus allocation reversal, payment reversal versus allocation reversal, concurrent refunds, and multi-invoice versus single-invoice allocation are serialized on the same parent rows.

If a new future refund or reversal record becomes a separate balance-bearing parent, it must be added to the protocol before implementation; no such record exists in the current schema. Deadlocks are reduced by the total order. Serialization failures, deadlocks, and retryable transaction failures must roll back and retry the complete operation with the same idempotency key; a conflicting payload fails. A normal PostgreSQL `CHECK` cannot enforce a cross-row `SUM()` over allocation rows. A trigger alone is not safe unless these parent locks (or an equivalent guarded aggregate update with the same serialization) are used. Required future tests cover every pairwise race, stale reads, same-key retries, and tenant-crossing references.

### Historical payment cutover

Safest proposed default, Pending owner approval: preserve all pre-cutover payments as legacy-unallocated records; infer no allocation from dates, amounts, or apparent matches. At the owner-approved cutover timestamp, establish an opening reconciliation per tenant and counterparty:

`opening legacy payment amount = opening legacy payment allocations (zero by default) + opening legacy unapplied amount`

and separately evidence that `opening ledger balance = opening cached balance`, while recording existing invoice `paid_amount`/`balance_due` as historical fields rather than silently backfilling them. A legacy payment has a `legacy_unallocated` classification and is excluded from new allocation aggregates and post-cutover unapplied-credit aggregates unless a later audited manual-allocation event explicitly reclassifies a stated amount. This classification, not date matching, is the double-counting control. Reports show legacy balances and post-cutover allocations in separate columns; a combined net position adds each exactly once.

Manual historical allocation is permitted only with actor, timestamp, reason, target invoice, evidence, and audit record. It decreases the legacy-unallocated amount and creates one post-cutover allocation for the same amount in one transaction. Legacy opening reports remain unchanged; post-cutover reconciliation reports include the audited allocation; historical as-of reports before the recorded event show no allocation, while later reports show it with its effective and recorded timestamps. No historical allocation is inferred.

### Additional pending boundaries

- Unknown payment methods are rejected or explicitly mapped; they never silently become `CREDIT`. A method label does not prove cash/bank settlement.
- Receipt numbers require a tenant-scoped serialized sequence and unique constraint; current count-based numbering remains unsafe.
- Excess credit-note amounts require explicit adjustment policy; they do not silently become cash credit.
- Customer credits cannot transfer between counterparties without a separate authorized, audited workflow.
- Current scope is single-currency; unsupported currency mismatches are rejected, with no implicit conversion.
- Effective dates and recorded timestamps are both retained; as-of reports must not backdate later-recorded knowledge.
- Finalized invoice edits require linked adjustments/reversals, not direct mutation of immutable snapshots.

For aging as of timestamp `T`: invoice creation/finalization contributes the finalized due-date exposure only if recorded by `T`; payment creation affects an as-of report only when its recorded timestamp is at or before `T`; allocation reduces the target invoice only when its allocation effective and recorded event is included; allocation reversal restores exposure only when included; a refund request has no balance effect; a completed refund affects balances only when recorded by `T`; payment reversal and credit/debit adjustments follow the same rule. A backdated event recorded after `T` is excluded from strict knowledge-as-of reporting and may appear only in an explicitly labelled restated report. A finalized due date never changes because later payment terms change.

## Approval protocol

An owner response should identify Decisions A-O as **Approve**, **Reject**, or **Amend**, with any changed rule. Until then, all recommendations remain Pending and no implementation phase should begin.

## Out of Scope

Recovery/PITR, provider backup/restore, production operations, GST filing/ITC automation, and full general-ledger redesign.
