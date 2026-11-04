---
title: Q17 obsolete GST-note target cleanup
date: 2026-11-04
status: VERIFIED - CLEANUP COMPLETE
---

## Goal

Investigate the six local Q17 PostgreSQL targets on ports 55461–55466,
establish their origin and ownership from independent evidence, and remove
only the obsolete GST credit/debit-note test resources.

## Acceptance Criteria

- [x] Each candidate is identified by its exact container, database, Compose
  project, network, and host port.
- [x] Each candidate is independently linked to the obsolete GST-note
  workflow, rather than selected by port, name, or timestamp alone.
- [x] Current usage, storage boundaries, repository references, and retained
  resources are checked before cleanup.
- [x] Only the six authorized containers and their six private networks are
  removed.
- [x] Container, network, port, retained-target, repository-reference, and
  Git-state verification passes after cleanup.

## Out of Scope

The retained operator-owned target on port 55460, other financial-E2E
containers, production or Live Supabase resources, application code, GST
accounting logic, migrations, database backfills, and unrelated Docker
resources were not changed.

## Evidence

The rollback-era GST-note evidence in commit `2506510` maps the candidates to
these exact campaign contracts:

| Port | Database | Compose project | Contract run | Historical campaign evidence |
|---:|---|---|---|---:|
| 55461 | `pharmnos_financial_e2e_q17_20261104_0251` | `pharmnoslite-financial-e2e-q17-20261104-0251` | `gst_note_q17_20261104_0251` | 15 failed campaigns |
| 55462 | `pharmnos_financial_e2e_q17_20261104_033101_8b306f` | `pharmnoslite-financial-e2e-q17-20261104_033101_8b306f` | `gst_note_q17_20261104_033101_8b306f` | 1 failed campaign |
| 55463 | `pharmnos_financial_e2e_q17_20261104_033353_14ab23` | `pharmnoslite-financial-e2e-q17_20261104_033353-14ab23` | `gst_note_q17_20261104_033353_14ab23` | 1 failed campaign |
| 55464 | `pharmnos_financial_e2e_q17_q17_20261104_034122_44072c` | `pharmnoslite-financial-e2e-q17-q17_20261104_034122_44072c` | `gst_note_q17_20261104_034122_44072c` | 1 failed campaign |
| 55465 | `pharmnos_financial_e2e_q17_20261104_034516_9f4e27` | `pharmnoslite-financial-e2e-q17-20261104_034516_9f4e27` | `gst_note_q17_20261104_034516_9f4e27` | 1 failed campaign |
| 55466 | `pharmnos_financial_e2e_q17_20261104_034756_4a0574` | `pharmnoslite-financial-e2e-q17-20261104_034756_4a0574` | `gst_note_q17_20261104_034756_4a0574` | 7 failed campaigns |

Every historical evidence record reported
`cleanup.status = NOT_ATTEMPTED` and required separate operator
authorization for target disposal. The current repository has reverted the
GST-note implementation and contains no supported note workflow.

Before removal, every candidate had:

- `postgres:17-alpine`, service `financial-e2e-postgres`, and the repository
  Compose file `docker-compose.financial-e2e.yml`.
- A unique Compose project and a private network attached to exactly one
  container.
- `/var/lib/postgresql/data` on tmpfs, no bind mounts, and no named volumes.
- 51 public tables with RLS enabled, including the GST-note tables and
  populated note-era fixtures.
- No other PostgreSQL activity in `pg_stat_activity` apart from the
  read-only probe sessions.
- Campaign-scoped tenant and user IDs beginning with `gst_note_`; no
  production or shared-user identity was present.

Representative exact note-table row counts were:

| Port | `gst_note_configuration_versions` | `gst_note_number_series` | `gst_note_posting_lines` | `gst_note_posting_operations` |
|---:|---:|---:|---:|---:|
| 55461 | 28 | 11 | 156 | 40 |
| 55462 | 2 | 2 | 40 | 10 |
| 55463 | 2 | 2 | 44 | 11 |
| 55464 | 2 | 2 | 46 | 12 |
| 55465 | 2 | 2 | 46 | 12 |
| 55466 | 14 | 19 | 382 | 99 |

The exact container identities were:

| Port | Container ID | Network ID |
|---:|---|---|
| 55461 | `e876aeb44fef30d577154cc08a35b55bd275eb75fdc0c06ec1fc5eb954444cf4` | `ce7b558a9274f673eb510a332bef6cf2d470499a61a78f17a961421e5937818f` |
| 55462 | `2a1d420e4a077d72fdbb03e47489095005113fbc9e5e53a70b2130c56b5304f0` | `8043d4f6f4a881c3d173e2c3bb9134c6768f317eb5f95f2c0e327c06a6348262` |
| 55463 | `d9a573d8961cd0fb19cf49f9512a94b0fe98c392b7dea6d1901f4299e0f433d5` | `a6f6c1ffc536b0957e11fbd567392c68a6257011b5522a941898381c5076eec3` |
| 55464 | `07c063ac5a9cf62f856b743af8096dabb0d6b76682a0f4a8a72c03775c96f243` | `aadd66a81daf526ff93768cc6aad61fe22a172546470d9cd559039c4636902b2` |
| 55465 | `8b90e32949ec70005d112430e559195307b39ce49b5a3d98c1183f450d1e6c27` | `bc0c7ec327331834775c07be1251aeeaf76ee13ab4627faa757203986af8ab14` |
| 55466 | `4fb1a242f53ac39c15195074e32191c78435103d6f3e62d76d07f06d7338ff20` | `6246fb395c785819b5fbad01451da78ad8627f66f7147064053d8baf655c307b` |

## Cleanup Operation

After the evidence gate passed, the exact six container IDs were removed with
`docker rm -f`. The exact six network IDs above were then removed with
`docker network rm`. No wildcard, prune, migration, database `DELETE`, or
application cleanup operation was used.

## Verification

- All six container IDs return absent from Docker.
- All six network IDs return absent from Docker.
- Ports 55461–55466 have no listening process.
- The retained container
  `74e204f30cb1c3f2fd254f051d49cfd41793e0d5378f733ccf2e1c35457f8c87`
  remains exited under project `pharmnoslite-financial-e2e-gstnote-9d7f20f7`
  on port 55460.
- No exact candidate container, project, database, or campaign target
  reference remains in current source, scripts, tests, Prisma files, or
  configuration.
- `git status --porcelain=v1` remained 92 lines with SHA-256
  `82CEEB7AA8BEBF37D4B1C4BA8A50AC59DEA3A6F44453F2CF2F9CC74865577A25`
  before and after the Docker cleanup, before the intentional documentation
  edits recorded for this task.
- `git diff --check` passed.

## Remaining Resources and Blockers

No unresolved status remains among the six investigated candidates. The
retained 55460 target and unrelated exited financial-E2E containers remain
preserved because they were outside this exact cleanup authorization.
