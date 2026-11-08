---
title: Pharmnos Lite Stage 3 Current Source Runtime Evidence
date: 2026-11-07
status: Partial acceptance; current-source action-path and disposable restore evidence complete
---

# Target and controls

The authorized current-source campaign used the immutable disposable target
`pharmnos_financial_e2e_20261107b`, loopback port `55602`, Compose project
`pharmnoslite-financial-e2e-20261107b`, and restricted runtime role
`pharmnos_e2e_runtime`. Provisioning, initialization, runtime probes, Purchase
GST, and Sales GST matched target fingerprint
`925039cfb6870476f5b28551a4b018314fc1a59e51d2abd78c0f0786b729636a`.
Credentials were loaded from the approved environment contract and were not
printed.

## Results

- Provisioning: PASS through the current generated artifact; 19 non-internal
  triggers and the dedicated finalized-delete triggers were verified.
- Purchase GST: PASS 16/16; exact totals, GST acceptance, tenant isolation,
  retry/concurrency, rollback, posting, stock movement, supplier ledger, and
  audit readbacks passed.
- Sales/Purchase application campaign: GST-014, GST-015, GST-016,
  sales idempotency/retry/conflict/rollback, purchase success, inter-state
  IGST, stale-revision posting, incomplete-legacy hold, and customer/supplier
  payments passed.
- Finalized invoice mutation attempts: rejected and persisted snapshots
  remained unchanged.

Evidence: `26-authorized-disposable-runtime-evidence.json`, including target
binding, source hash, initialization, application suite, trigger/deletion
observations, restore comparison, security attributes, and cleanup.

This is server/action-path evidence, not authenticated browser E2E proof.
The exact disposable application target was removed through the authorized
Compose cleanup lifecycle and verified absent. No Playwright dependency or
authenticated browser harness exists in this repository.

## Current-source remediation rerun

After the supplier-document locking correction and finalized-purchase
immutability hardening, the same explicitly authorized disposable target
contract was revalidated without selecting a target by convenience. The
target was `127.0.0.1:55605`,
`pharmnos_financial_e2e_targeted_20261107a`, Compose project
`pharmnoslite-financial-e2e-targeted-20261107a`, with restricted runtime role
`pharmnos_e2e_runtime`. The application suite passed all exercised scenarios,
including GST, purchase, payment, retry/rollback, tenant checks, and
immutability probes. Expected `42501` rejection output from negative
finalized-invoice mutation probes was observed and asserted.

The append-only structured artifact
`27-current-source-targeted-runtime-evidence.json` records the target binding,
schema artifact hash, runtime role boundary, and hashes for the purchase,
supplier-document, migration, provisioning, and runner sources. Fixture
database cleanup was initially deferred by the runner
(`DATABASE_LEVEL_DEFERRED`), then the exact target was disposed through the
authorized contract-bound Compose cleanup and verified absent. This rerun is
still action-path evidence, not browser proof, and does not close the
independent security, financial-policy, or recovery gates.

## Restore result

A second exact disposable target,
`127.0.0.1:55603` / `pharmnos_financial_e2e_restore_20261107a`, was restored
from a data-only export. The first plain restore failed and rolled back on
circular foreign-key ordering. The retry used disposable-only
`session_replication_role=replica` and passed. Thirty-four public data tables
matched by row count and deterministic checksum; table/policy/trigger/role
catalog observations and authorized tenant readback matched. The restore target
was then disposed and verified absent.

The previously deferred application-target cleanup was subsequently resolved:
the exact target contract, Compose project, service, isolation label, loopback
port, and run fingerprint matched. Contract-bound `down` completed with
`verifiedAbsent: true`; no unrelated stopped Pharmnos container was removed.
