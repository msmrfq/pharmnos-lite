---
title: Financial Reconciliation Decision Log
date: 2026-11-08
status: Owner Approved
---

## Owner authorization history

On 2026-11-08, the owner explicitly authorized Decisions A–O: “The project owner has explicitly authorized Decisions A–O.” The recommendations are approved as written, with no amendments stated. This approval-status update supersedes the pending statuses recorded when this log was created; decision statements and policy text are unchanged.

On 2026-11-08 the owner approved the 13 scenario resolutions in the [scenario matrix](./financial-reconciliation-scenario-matrix.md): S-07/08/09/10, S-18, S-22/23/24, and S-31/32/33/37/38. Unallocated valid payment contributes its usable amount to customer credit or supplier advance; allocations alter composition without changing net position, and reversal restores usable credit once. S-09 is all-or-nothing across its invoices; S-10 explicitly uses one ₹700 payment. S-37 distinguishes invoice face ₹2,000 from current outstanding ₹900 after ₹1,100 allocation. S-38 applies an approved ₹100 payable reduction to ₹2,000 outstanding, producing ₹1,900, with no invented further adjustment.

S-18 is a **commercial customer credit note**, not a GST or tax adjustment: excess requires review, changes no posted balance while pending, and on approval settles the remaining invoice balance with any approved excess becoming linked, audited unapplied credit. Rejection changes no posted balance. Approval establishes policy, not implementation or runtime acceptance; S-18 and S-38 workflows remain missing or unverified.

| ID | Decision statement | Options considered | Recommendation | Approval status | Approval date | Dependencies |
|---|---|---|---|---|---|---|
| A | How payments are allocated | Manual, automatic FIFO, hybrid | Manual allocation first; partial and many-to-many | Owner-approved | 2026-11-08 | Allocation model and open-item tests |
| B | How pre-invoice/unallocated money is represented | Force allocation, reject, unallocated credit/advance | Separate customer credit and supplier advance | Owner-approved | 2026-11-08 | Projection/report model |
| C | How overpayments are handled | Credit, auto-allocate, refund, explicit choice | Explicit choice; never negative invoice balance | Owner-approved | 2026-11-08 | Allocation and refund workflows |
| D | How refunds differ from adjustments/reversals | Conflated correction, distinct transaction types | Distinct refund, invoice adjustment, and reversal | Owner-approved | 2026-11-08 | Source linkage and compensating entries |
| E | How posted transactions are corrected | Edit, delete, compensate, reverse/repost | Immutable reverse and repost | Owner-approved | 2026-11-08 | Reversal model, permissions, audit |
| F | How aging is calculated | Invoice date, due date, derived due date | Due date, then credit-period derivation, then invoice-date fallback | Owner-approved | 2026-11-08 | Due-date policy and allocation |
| G | What is authoritative | Cache, ledger, event+allocation | Immutable source plus allocation/adjustment; caches are projections | Owner-approved | 2026-11-08 | Reconciliation checks |
| H | Accounting scope | AR/AP, cash/bank, full GL | Bounded AR/AP only | Owner-approved | 2026-11-08 | Scope acceptance |
| I | Where integrity is enforced | Application only, PostgreSQL only, split | PostgreSQL structural backstops plus app transactions | Owner-approved | 2026-11-08 | Data audit and additive migrations |
| J | How prior stock changes are classified | Accounting scope, separate inventory scope, revert | Retain and track separately | Owner-approved | 2026-11-08 | Separate inventory acceptance |
| K | How gross, unapplied, and signed net balances are named | Single balance, gross/net split | Always report all three separately | Owner-approved | 2026-11-08 | Report and equation normalization |
| L | How refunds interact with allocations | Leave allocation, reverse then refund, conflate with reversal | Reverse affected allocation then refund atomically | Owner-approved | 2026-11-08 | Refund state/linkage and race tests |
| M | How allocation concurrency is enforced | Lock-free check, trigger alone, deterministic parent locks | Shared `(tenant_id, parent_kind, parent_id)` lock order for allocation, refund, allocation reversal, payment reversal, and multi-invoice operations; post-lock reread | Owner-approved | 2026-11-08 | Transaction design and PostgreSQL tests |
| N | How historical payments enter allocation model | Infer, discard, legacy-unallocated, opening credit | Legacy-unallocated with formal cutover reconciliation and explicit exclusion from post-cutover aggregates | Owner-approved | 2026-11-08 | Cutover boundary and audit evidence |
| O | Aging and payment-method/receipt controls | Current entry-date/lossy/count behavior, corrected future controls | Due-date snapshot; event-specific strict as-of timing; reject unknown methods; serialized numbering | Owner-approved | 2026-11-08 | Validation, sequence, and as-of tests |

Owner approval authorizes the recommended policy direction; it does not prove implementation, runtime correctness, independent acceptance, or production readiness.
