---
title: Secret Leak Risk — Literal Passwords / ALTER USER PASSWORD Literals Pasted into Vault Docs / Source Code
date: 2026-09-30
status: Open
---

## Steps to Reproduce
1. During a debugging session where a Postgres role password was set via SQL Editor (ALTER USER prisma WITH PASSWORD '<raw literal>'), document the "commands to remember" section of the daily working note by copy-pasting the full ALTER USER statement including the literal password string.
2. Similarly, when writing verbose "Current State" recap paragraphs in CLAUDE.md, include example snippets that mention the password literal as part of a "these are the commands that were run" narrative.
3. Wait for 2 git commits, or wait until the daily note is migrated to a formal ADR/bug/spec via triage script, or wait until another developer clones the repo — the literal password ends up in plain-text copy-pasteable form somewhere in a committed file.
4. Search full git history with pattern `(SUPABASE_SERVICE_ROLE_KEY|ALTER USER.*PASSWORD|postgres://.*:.*@)` — any matches = secrets leaked.

## Expected Behaviour
All secrets (passwords, API keys, JWT service-role tokens, connection strings with embedded credentials, literal ALTER USER PASSWORD payloads) exist ONLY in:
- Gitignored `.env.local` / `.env.*.local` files (`.gitignore` correctly blocks `*.env`, `.env.*` — already done in project)
- User's password manager (1Password, browser keychain, etc.)
- Provider dashboards (Supabase dashboard → Database → Password / Roles UI)
- Formal documentation either refers to them by name only, or uses placeholder strings like `<YOUR-PASSWORD>` or `[SET VIA SQL EDITOR — STORE ONLY IN .env.local]`.

## Actual Behaviour
- At least 2 concrete leaks occurred today (both fixed before next commit, but the pattern existed long enough to file a rule):
  1. `daily/2026-09-29.md` "Commands / config / snippets" SQL code block contained full `ALTER USER prisma WITH PASSWORD '<literal password>';` line copy-pasteable into SQL Editor to re-run with same credentials.
  2. Earlier-draft recap section of canonical `.obsidian-vault/CLAUDE.md` Current State (written earlier in the session before secret hygiene rules were enforced) also contained the literal. User caught and manually deleted it from CLAUDE.md before this bug was filed.
- If either leak had been committed and pushed before the 2 rollback steps, the literal would be in remote GitHub history forever (even if overwritten later in a later commit — the secret remains visible in git reflog diffs).

## Root Cause
Copy-paste "commands to remember" default behavior is to literally reproduce SQL statements as executed — including secrets inside quotes. No project-level rule existed at the time. Human pattern is to paste the entire line that "just worked". The auto-sync + auto-commit + auto-push toggles that caused the earlier git incident amplify this leak risk because any uncommitted local leak left in a file could end up pushed without human review of the diff.

## Severity
High today (if pushed, permanent exposure). Medium going forward once rule + audit + redaction procedure are in place. Both leaks today were caught and redacted before any commit including them was pushed.

## Remediation Checklist
- [x] `daily/2026-09-29.md` ALTER USER line: literal password redacted → placeholder `'[SET VIA SUPABASE SQL EDITOR — STORE ONLY IN GITIGNORED .env.local]'`.
- [x] User manually deleted the literal from earlier CLAUDE.md draft. Rewrote the rule example to generic "earlier today a Postgres ALTER USER literal password was found…" without ever re-spelling the password.
- [x] Permanent rule added to CLAUDE.md Project-specific hard rules (Do Not section L148): never paste passwords/JWTs/keys/ALTER USER literals/connection strings with credentials into vault or committed source. Use placeholders; secrets only in gitignored env.local / password manager / dashboards.
- [x] End-to-end grep audit for password substrings across entire project tree after redacts → 0 matches. Cert clean.
- [x] `.gitignore` already blocks `.env`, `.env.*`, `.env.*.local` — no change needed.
- [ ] Add project pre-commit hook rule / CI check (or at minimum a checklist item for any future commit): run `rg -n -i '(password|secret|service_role_key|postgres://.*:.*@|eyJhbGci)' e:\PharmnosLite` BEFORE `git add .` and resolve any new matches that aren't inside `.env.local` placeholder template comment lines.
