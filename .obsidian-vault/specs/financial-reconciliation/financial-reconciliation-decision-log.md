---
title: Financial Reconciliation Decision Log
date: 2026-11-08
status: Pending Owner Approval
---

| ID | Decision statement | Options considered | Recommendation | Approval status | Approval date | Dependencies |
|---|---|---|---|---|---|---|
| A | How payments are allocated | Manual, automatic FIFO, hybrid | Manual allocation first; partial and many-to-many | Pending | — | Allocation model and open-item tests |
| B | How pre-invoice/unallocated money is represented | Force allocation, reject, unallocated credit/advance | Separate customer credit and supplier advance | Pending | — | Projection/report model |
| C | How overpayments are handled | Credit, auto-allocate, refund, explicit choice | Explicit choice; never negative invoice balance | Pending | — | Allocation and refund workflows |
| D | How refunds differ from adjustments/reversals | Conflated correction, distinct transaction types | Distinct refund, invoice adjustment, and reversal | Pending | — | Source linkage and compensating entries |
| E | How posted transactions are corrected | Edit, delete, compensate, reverse/repost | Immutable reverse and repost | Pending | — | Reversal model, permissions, audit |
| F | How aging is calculated | Invoice date, due date, derived due date | Due date, then credit-period derivation, then invoice-date fallback | Pending | — | Due-date policy and allocation |
| G | What is authoritative | Cache, ledger, event+allocation | Immutable source plus allocation/adjustment; caches are projections | Pending | — | Reconciliation checks |
| H | Accounting scope | AR/AP, cash/bank, full GL | Bounded AR/AP only | Pending | — | Scope acceptance |
| I | Where integrity is enforced | Application only, PostgreSQL only, split | PostgreSQL structural backstops plus app transactions | Pending | — | Data audit and additive migrations |
| J | How prior stock changes are classified | Accounting scope, separate inventory scope, revert | Retain and track separately | Pending | — | Separate inventory acceptance |
| K | How gross, unapplied, and signed net balances are named | Single balance, gross/net split | Always report all three separately | Pending | — | Report and equation normalization |
| L | How refunds interact with allocations | Leave allocation, reverse then refund, conflate with reversal | Reverse affected allocation then refund atomically | Pending | — | Refund state/linkage and race tests |
| M | How allocation concurrency is enforced | Lock-free check, trigger alone, deterministic parent locks | Shared `(tenant_id, parent_kind, parent_id)` lock order for allocation, refund, allocation reversal, payment reversal, and multi-invoice operations; post-lock reread | Pending | — | Transaction design and PostgreSQL tests |
| N | How historical payments enter allocation model | Infer, discard, legacy-unallocated, opening credit | Legacy-unallocated with formal cutover reconciliation and explicit exclusion from post-cutover aggregates | Pending | — | Cutover boundary and audit evidence |
| O | Aging and payment-method/receipt controls | Current entry-date/lossy/count behavior, corrected future controls | Due-date snapshot; event-specific strict as-of timing; reject unknown methods; serialized numbering | Pending | — | Validation, sequence, and as-of tests |

No decision in this log is owner-approved. Approval requires an explicit owner response identifying the decision ID and approving or amending the recommendation.
