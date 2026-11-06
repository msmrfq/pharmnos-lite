---
title: Pharmnos Lite Stage 3 Frozen Acceptance Matrix
date: 2026-11-07
time: 02-25-00
status: Frozen before remediation — 100-point denominator
---

# Frozen Stage 3 matrix

| ID | Criterion | Weight | Required evidence | Owner |
|---|---|---:|---|---|
| ST3-A | Architecture and system boundaries are coherent for supported workflows, with no unresolved critical boundary defect | 8 | Source review, boundary contracts, defect disposition | S1 |
| ST3-B | Authentication, authorization, tenant isolation, and document access are secure for the defined server-only threat model | 12 | Source/tests plus restricted disposable runtime evidence and security review | S2/S3 |
| ST3-C | Database schema, constraints, migration sequence, and migration drift risks are assessed and safe for Stage 4 planning | 12 | Schema/migration inspection, disposable validation, recovery prerequisites, defect disposition | S4 |
| ST3-D | Supported GST calculations and tax-treatment boundaries are correct and fail closed outside scope | 10 | Focused tests, purchase/sales contracts, policy separation, runtime where required | S5 |
| ST3-E | Purchase, supplier, goods receipt, inventory, and valuation behavior is correct and auditable for supported scope | 12 | Source/tests, target-bound workflow, stock/valuation evidence, policy boundaries | S6 |
| ST3-F | Sales, customer, invoice, and document workflows remain correct for supported scope | 10 | Reused accepted evidence plus current-source regression proof | S7 |
| ST3-G | Ledgers, payments, reconciliation, transaction atomicity, idempotency, correction, and retry behavior are reliable | 12 | Exact-decimal reconciliation, contracts, runtime scenarios, duplicate/rollback evidence | S6/S8 |
| ST3-H | Automated, browser, runtime, and operational verification is sufficient and evidence classes are not conflated | 8 | Test inventory, current-source browser/runtime proof, target lifecycle and cleanup | S8 |
| ST3-I | Migration backup/recovery, deployment/configuration separation, observability, and Stage 4 prerequisites are documented and credible | 6 | Backup/restore plan or evidence, deployment gates, config/ops review | S4/S8 |
| ST3-J | Independent technical/security and business/financial reviewers accept every mandatory criterion | 10 | Two independent reports with explicit decisions | R1/R2 |
| **Total** |  | **100** |  |  |

Only criteria marked accepted by both required evidence and applicable independent review receive completion credit. Stage 4 execution and production release remain outside the matrix.

