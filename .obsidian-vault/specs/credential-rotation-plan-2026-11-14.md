---
title: Credential Rotation and Repository Hygiene Plan
date: 2026-11-14
status: Plan — rotation not executed (no live/shared target authorized)
---

# Credential Rotation and Repository Hygiene Plan

## Goal

Remove the remaining exposure of disposable-verification credentials from the
tracked tree and Git history, and define a verifiable rotation sequence, without
recording any credential value in documentation, logs, or evidence.

## Exposure summary (values never reproduced)

| Asset | Location | Exposure class | Notes |
|---|---|---|---|
| `.env.financial-e2e-verify` | Tracked at `HEAD`; working tree neutralized | Disposable verification | Contains 32-character DB passwords, a 60+ character HMAC signing secret, loopback database URLs, and target-contract metadata at `HEAD`. |
| `scripts/debug-context.js` | Git history | Disposable verification | Prior revisions contained an assigned signing secret and database URLs. Working tree uses environment/variables. |
| `scripts/test-cross-tenant-isolation.js` | Git history | Disposable verification | Prior revisions contained an assigned signing secret and database URLs. |
| `scripts/test-context-isolation-simple.js` | Git history | Disposable verification | Prior revisions contained an assigned signing secret and database URLs. |
| `scripts/setup-runtime-role.sql` | Git history | Disposable verification | Prior revisions embedded a password in SQL text; current file uses psql variables and `\gexec`. |
| `scripts/verify-db-connection.js`, `check-roles.js`, `seed-roles.js`, `verify-private-schema.js`, `verify-runtime-role.js` | Git history | Disposable verification | Prior revisions contained database URLs. |

History probe (counts only): the ten files above contain PostgreSQL URL
matches and long base64-style literals in earlier revisions. No value was
printed during the probe.

No production or hosted-Supabase credential was found in tracked files. The
affected values are confined to the disposable verification environment class.
That reduces blast radius; it does not make the exposure acceptable.

## Contradiction to record

`specs/dsh-session-exposure-security-assessment-2026-11-13.md` states that
Git history contains zero remaining secret matches. The tracked
`.env.financial-e2e-verify` at `HEAD` and the historical script revisions
contradict that claim. The earlier assessment's history row must be treated as
incorrect for these disposable values.

## Rotation sequence

Rotation is an operator action. It was **not** performed in this campaign
because no production, shared, or hosted target is authorized, and no live
disposable database was running (Docker daemon unavailable).

1. **Declare the historical values compromised.** Record the declaration in the
   incident record without copying values.
2. **Rotate the signing secret** (`DATABASE_AUTH_CONTEXT_SIGNING_SECRET`) for
   every environment that used a value present in history. Generate a new
   high-entropy value per environment. Do not reuse the retired value.
3. **Rotate both disposable database passwords** (bootstrap and restricted
   runtime roles) for any environment where the historical value could still
   authenticate. Prefer destroying the disposable database instead of rotating
   it.
4. **Re-provision, do not patch, disposable targets.** Apply
   `scripts/setup-runtime-role.sql` with the new password supplied as a psql
   variable, as the file already requires.
5. **Remove the tracked environment file from the index** in a normal,
   reviewable change: keep the file ignored locally, keep
   `.env.financial-e2e.example` as the template, and ensure no value is
   committed. Do not force-add it again.
6. **Decide on history rewrite.** A history rewrite is a destructive,
   owner-authorized operation. It is not performed by this campaign. If the
   repository is private and the values remain disposable, an owner may accept
   documented non-rewrite with rotation; otherwise rewrite history with a
   reviewed tool and coordinated force-push.
7. **Verify rotation.** Attempt authentication with the old values against a
   disposable target and confirm failure; confirm the application starts with
   the new secret; confirm no tracked file contains the old or new value.

## Verification checklist

- [ ] `git grep` over the working tree finds no assigned signing secret, no
      password-bearing database URL, and no tracked `.env` with live values.
- [ ] Secret scan over all revisions is run by the owner with output retained
      outside the repository; only counts and commit ids are recorded.
- [ ] Old credentials fail authentication.
- [ ] New credentials are present only in the operator secret store.
- [ ] Documentation and evidence contain no credential values.
- [ ] The security assessment's history claim is corrected.

## Constraints

- No value may be written to this plan, a report, a log, a test fixture, or an
  evidence JSON file.
- Rotation must not be simulated with a production or shared target.
- The tracked working-tree neutralization already present must be preserved.

## Current status

| Step | Status |
|---|---|
| Working-tree neutralization of the ten files | Done (pre-existing campaign work) |
| Tracked `.env.financial-e2e-verify` removed from index | **Not done** |
| Signing secret rotated | **Not done** |
| Disposable DB passwords rotated or database destroyed | **Not done** |
| History rewrite decision | **Open — owner** |
| Security assessment history claim corrected | **Not done** |

## Release effect

Unrotated historical credentials and a credential-bearing tracked file remain a
V1 release blocker under production-security operations. The blocker is
procedural and does not require application code changes.
