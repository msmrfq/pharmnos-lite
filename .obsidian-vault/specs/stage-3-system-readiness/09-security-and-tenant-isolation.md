---
title: Pharmnos Lite Stage 3 Security and Tenant Isolation
date: 2026-11-07
time: 02-25-00
status: Investigated — residual risks open
---

# Security assessment

- Supabase user verification and active-membership checks are present before protected operations.
- Permission checks and tenant predicates are broadly applied across server actions.
- Existing restricted-role evidence and application-level cross-tenant document denial are reusable only where source/target binding is proven.
- RLS uses request claim GUCs. Existing evidence records that the restricted runtime role can set those GUCs; this is a residual HIGH risk if arbitrary SQL is exposed. The documented server-only boundary is a threat-model limitation, not cryptographic identity.
- Tenant-scoped relational foreign keys are incomplete, which weakens database defense in depth.
- No new exploitable bypass was proven by Wave 1 static review.

## Required Stage 3 evidence

Fresh target-bound restricted-role checks, cross-tenant reads/mutations/document denial, current source binding, and R1 technical/security acceptance. Do not claim security closure from static inspection alone.

