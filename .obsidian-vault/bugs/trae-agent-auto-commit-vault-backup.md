---
title: Trae Agent Auto-commit Vault Backup
date: 2026-09-30
status: Open
---

## Steps to Reproduce
1. Open Pharmnos Lite workspace in Trae IDE (path `E:\PharmnosLite`). Ensure Agent / Copilot tools are loaded.
2. Do any session that writes files inside `.obsidian-vault/` (e.g., daily note via Session End prompt; edit to ADR inside `decisions/`; update to `CLAUDE.md` canonical).
3. Wait for Trae Agent "vault backup" event / background task. No explicit user commit/push buttons pressed.
4. Inspect `git log --oneline -5` (local main) → `git ls-remote origin HEAD` (remote main).

## Expected Behaviour
- **NO commit created locally** unless user types the exact literal line `"commit this"` into chat (per project Git rules).
- **NO push to remote origin** unless user types the exact literal full push command as a standalone message.
- Vault note writes remain UNTRACKED / unstaged / uncommitted locally, pending explicit manual staging & commit later together with their relevant code changes.

## Actual Behaviour
- Two confirmed incidents (2026-09-29 and 2026-09-30) where Trae Agent silently:
  1. Staged `.obsidian-vault/` files
  2. Created local commit with message pattern `vault backup: <YYYY-MM-DD HH:MM:SS>` (example SHA `0ffecab`, message `vault backup: 2026-09-30 07:42:57`)
  3. **Auto-pushed** the commit to `origin/main` remote GitHub without any human message authorizing push.
- Incident #1 (2026-09-29): SHA auto-pushed unknown → human detected → rolled back to initial commit `9fdb352 Initial commit` via 2 soft resets.
- Incident #2 (2026-09-30): SHA `0ffecab` auto-pushed to origin → detected via `git ls-remote` when user ordered rollback to `3ff7036` → safe `git reset --soft 3ff7036` + explicit user authorization line `git push origin main --force-with-lease` → remote rewound; 46 uncommitted P3/MCP edits preserved via soft reset pattern (no data loss).

## Root Cause
**Primary cause (confirmed):** Trae Agent mode ships a default "Vault Backup auto-commit auto-push to remote" feature toggle that is ON by default for this workspace. Neither the 2026-09-29 session nor this session explicitly enabled it; inherited from workspace defaults / Trae global defaults. The setting observes `.obsidian-vault/` file writes → batches → commit → push → all automatic on idle or after note-writing session ends.

**Secondary cause (contributor):** No explicit `.vscode/settings.json` workspace-level lockout of this setting yet. Project standing Git rules (verbal 2026-09-29 + this daily note + ADR 0002 proposed today) prohibit auto-behaviour, but the IDE-level setting value itself has not yet been hard-set to `false` in a committed workspace file. New environments / new Trae installs thus inherit the dangerous default.

**Tertiary hypothesis (unconfirmed, low probability):** Some Trae releases also sync on the agent-briefings update path (after running `& .\sync-agent-briefings.ps1`) because that script writes 6 mirror files. We do not have evidence for this; it is listed only to rule out. If toggles #1/#2 below don't stop it, investigate this.

### Permanent fix candidates to try in order (pending human execution in Settings UI):
1. **Trae → Settings → Agent / Agent Mode → Auto-sync vault notes to Git**: Toggle = Off.
2. **Trae → Settings → Version Control / Git → Auto commit on vault write**: Toggle = Off. (any name similar, likely in Git subpanel).
3. **Trae → Settings → Git → Push on commit**: If any auto-push exists = Off.
4. **Project workspace lock**: Open `.vscode/settings.json` (commit this file later with "commit this" literal) and add explicit `false` for any auto-commit keys discovered (example placeholders: `"trae.agent.autoCommitVault": false, "trae.agent.autoPush": false` — exact keys TBD after user confirms real setting names).
5. If none of these after 1 session → ADR0002 Step 5 escalation: new `.git/hooks/pre-push` client hook that asks interactive confirmation before push.
