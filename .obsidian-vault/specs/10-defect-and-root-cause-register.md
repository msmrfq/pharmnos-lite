---
title: Invoice Modernization Defect and Root Cause Register
date: 2026-11-06
time: 20-48-02
status: Active
---

# Defect Register

| ID | Defect/root cause | Impact | Status |
|---|---|---|---|
| INV-001 | Finalized print re-rendering still reads mutable related records instead of the complete immutable snapshot; PDF/browser runtime evidence is not established | historical reproducibility and acceptance gap | Open |
| INV-002 | Financial-year invoice numbering and concurrent finalization must be proven against current source | duplicate/gap behavior risk | Investigate |
| INV-003 | Supplier document history/access coverage is incomplete or unverified | document integrity and tenant-isolation gap | Open |
| INV-004 | Production/shared runtime evidence is unavailable and prohibited in this campaign | release evidence gap | Open |
| INV-005 | Financial-E2E artifact manifest was stale after migration 0017 changed the schema | false pre-execution failure; no database mutation occurred | Fixed; 281/281 regression passes |
| INV-006 | QR/barcode values are exposed as text/data attributes, not rendered machine-readable elements | printed invoice cannot be scanned | Open |
