---
title: Financial E2E Validation Harness
date: 2026-10-01
status: Draft
---

## Goal
Create a safe, disposable financial end-to-end validation harness for Pharmnos Lite to verify runtime financial behavior including purchase finalization, sale finalization, FEFO allocation, rollback behavior, invoice sequence behavior, payment behavior, and tenant isolation.

## Acceptance Criteria
- [ ] Harness implements hard safety guards (ALLOW_FINANCIAL_E2E, TEST_DATABASE_URL, TEST_DATABASE_NAME, TEST_DATABASE_MARKER)
- [ ] Harness refuses to run if safety gates not satisfied
- [ ] Purchase success test: verifies finalization, totals, stock movements, supplier ledger, audit log
- [ ] Purchase rollback test: verifies atomicity on failure
- [ ] Sale success test: verifies FEFO allocation, stock movements, customer ledger, invoice sequence
- [ ] Insufficient-stock rollback test: verifies no partial state remains
- [ ] Invoice sequence rollback test: verifies sequence behavior on failure
- [ ] Payment E2E test: verifies payment atomicity, ledger updates, balance updates
- [ ] Tenant isolation test: verifies tenant A cannot access tenant B data
- [ ] Harness refuses to run if TEST_DATABASE_URL not configured or equals DATABASE_URL
- [ ] Harness requires explicit ALLOW_FINANCIAL_E2E=true flag
- [ ] Harness requires TEST_DATABASE_MARKER=pharmnos-financial-e2e
- [ ] Harness requires application_name=pharmnos-financial-e2e in connection string
- [ ] Harness verifies connected database identity before any mutation
- [ ] Cleanup strategy: disposable test tenant with complete cleanup

## Out of Scope
- Modifying production business logic to make tests pass
- Creating a full CI/CD platform
- Adding unnecessary dependencies
- Modifying existing financial business logic
- Deploying to Vercel
- Modifying production data or demo tenant data

## Safety Requirements
- Harness must refuse to run if TEST_DATABASE_URL is missing
- Harness must refuse to run if TEST_DATABASE_URL equals DATABASE_URL
- Harness must refuse to run if TEST_DATABASE_NAME doesn't contain "test" or "e2e"
- Harness must refuse to run if TEST_DATABASE_MARKER != "pharmnos-financial-e2e"
- Harness must require ALLOW_FINANCIAL_E2E=true
- Harness must verify connected database identity before any mutation
- Harness must NOT fall back to DATABASE_URL for financial mutation tests
- Harness must NOT print database passwords or full connection strings in logs
- Cleanup must NEVER target the existing demo tenant
- Cleanup must run on success and failure

## Test Cases
1. Purchase success: create draft purchase → finalize → verify stock, ledger, audit
2. Purchase rollback: trigger failure → verify no partial state remains
3. Sale success: create batches with different expiries → finalize sale → verify FEFO allocation
4. Insufficient-stock rollback: attempt sale with insufficient stock → verify full rollback
5. Invoice sequence rollback: verify sequence behavior on failed transaction
5. Payment E2E: create sale → execute payment → verify ledger, balance, atomicity
6. Tenant isolation: create tenant A and B → verify isolation