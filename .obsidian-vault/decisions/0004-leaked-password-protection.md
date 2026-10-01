---
title: Leaked Password Protection Disabled
date: 2026-10-01
status: Proposed
---

## Context
Supabase Security Advisor reports "Leaked Password Protection Disabled" as a WARN level finding. This feature prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Currently, this protection is disabled in the Supabase Auth configuration.

## Decision
Keep leaked-password protection disabled for now, but document as a pre-deployment security hardening action.

## Consequences
- **Positive**: No immediate impact on existing users or demo tenant. No risk of blocking legitimate users during testing/validation phase.
- **Negative**: Users could potentially use compromised passwords. This is a security hardening gap that should be addressed before production deployment.
- **Risk**: Low during development/validation phase; should be enabled before production go-live.

## Recommendation
Enable leaked-password protection in Supabase Auth settings before production deployment as part of the go-live checklist. This is a Supabase project-level setting, not an application code change.