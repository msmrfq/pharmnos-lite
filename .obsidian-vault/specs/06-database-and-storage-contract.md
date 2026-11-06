---
title: Invoice Database and Storage Contract
date: 2026-11-06
time: 20-48-02
status: Draft
---

# Database and Storage Contract

All invoice and document records are tenant-scoped. Finalization data is append-only or guarded immutable. Supplier originals and finalized PDFs use private storage, metadata references, protected paths, content validation, replacement history, and authorization checks. Large binaries do not belong in purchase rows.

Any schema change must be forward-only, migration-backed, reviewed by the lead, and runtime-applied only to a verified disposable target. No production/shared mutation or `db push`.
