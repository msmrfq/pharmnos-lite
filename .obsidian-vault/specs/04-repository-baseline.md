---
title: Invoice Modernization Repository Baseline
date: 2026-11-06
time: 20-48-02
status: Captured
---

# Repository Baseline

- Branch: `main`; HEAD at baseline capture: `eaf1e6a Financial + GST First Check`.
- Worktree was already dirty. Existing modified files included generated briefing mirrors, canonical vault state, daily notes, and an existing decision file. No pre-existing changes were reverted.
- Stack: Next.js 14 App Router, TypeScript, Prisma 5, PostgreSQL/Supabase, pnpm.
- Invoice surfaces include `src/app/billing/**`, `src/app/purchases/**`, sales/purchase actions, repositories, GST services, print data/pages, storage adapters, Prisma schema and migrations.
- Existing tests cover financial E2E safety, GST, finalization integrity, sales/purchase immutability, storage paths, authorization, RLS, and target contracts.
- Existing migrations include baseline, GST facts/snapshots, purchase acceptance, valuation history, supplier uniqueness, and finalized purchase immutability.
- Existing implementation and all user work must be preserved.
