---
title: Trae Agent Git Boundary Rules
date: 2026-09-30
status: Accepted
accepted: 2026-09-30
---

## Context
Trae Agent's Agent Mode / integrated AI defaults include auto-commit + auto-push of vault backup snapshots (`.obsidian-vault/` note file writes) to the project remote branch silently, without user approval. This project explicitly requires manual control over all commit messages, commit ordering, contents of commits pushed to origin, and rollout cadence. The auto-behaviour caused two confirmed incidents on 2026-09-29 and 2026-09-30, each requiring a manual forced rollback to a pre-agreed SHA (`9fdb352` first, then `3ff7036`) via soft reset + `--force-with-lease` push. Repeated incidents create risk of permanent working tree data loss if rollback uses `--hard` by mistake, pollutes remote history with unplanned vault commits, and violates the single-source-of-truth contract that vault changes must be committed together with relevant code changes, not asynchronously snapshotted.

## Decision
Adopt a strict Git boundary protocol between this AI agent and the Pharmnos Lite repository, enforced as project standing orders:

1. **WRITE gate**: The AI SHALL NEVER create a commit (`git commit`, `git commit --amend`, `git stash`, `git merge --no-ff commit`) UNLESS the immediately preceding human message in the chat conversation is the literal standalone line: `"commit this"` (exact string, no addendum). Non-literal phrases like "commit it", "save this", "go ahead", or "commit this plus" do NOT constitute permission.
2. **PUSH gate**: The AI SHALL NEVER push to any remote (`git push`, `git push --force`, `git push --force-with-lease`, `git push --tags`, `git push origin <branch>`) UNLESS the immediately preceding human message in the chat conversation is the **exact full literal command line** the AI is expected to run, verbatim copy-paste into RunCommand. Example of a valid push authorization line: `git push origin main --force-with-lease`. Any variation (extra commentary, other commands on same line) invalidates authorization; the exact command text MUST be the only content on its message.
3. **Auto-commit feature toggles (IDE-level)**: The human MUST find and disable (toggle=OFF) all Trae Agent auto-push / auto-commit / "vault backup snapshot" / "auto-sync notes to git" settings inside the Trae IDE settings panel, permanently for this project workspace. If any future version adds a new toggle that writes commits/pushes, default it to OFF before any further coding session.
4. **Rollback recovery SOP (standard operating procedure)**: On every detection of an unauthorized commit, the standard recovery sequence SHALL be:
   - (a) `git status` + `git log --oneline -20` confirm the unauthorized SHA and the target authorized SHA.
   - (b) Report status to human, NEVER auto-run reset/push.
   - (c) Local action: `git reset --soft <target-SHA>` ONLY (NEVER `--hard`, NEVER `--mixed` with uncommitted edits at risk).
   - (d) Request push authorization literal `git push origin <branch> --force-with-lease`.
   - (e) Verify `git rev-parse HEAD` == `git ls-remote origin <branch>`.
5. **Commit contents**: All commits SHALL be manually staged by human (or AI after explicit "commit this" text) so vault note changes and their companion code changes ship together. The AI SHALL NOT split vault note changes into their own separate commits unless the literal "commit this" message explicitly requests so.

## Consequences
- **Benefits**: No more surprise commits. Remote history remains human-authorized 100% of the time. Rollback recovery uses pre-defined safe soft-reset pattern; working tree edits never lost. Commit messages are written by the `git-commit-message.md` project rules via caveman-commit skill (or manual author) instead of auto-generated "vault backup" lines.
- **Costs**: Extra explicit gate step ("commit this", then push literal line) adds 2 short messages per commit. If human forgets to send them, nothing pushes — safe by design.
- **Risks**: If any new Trae release silently adds a new auto-commit path (setting not yet known to us), we will get a repeat incident and will update this ADR with the new toggle name + Step 3 list. Repeat 3rd incident triggers mandatory bug report with evidence + workspace .vscode/settings.json explicit `"autoCommit": false` lock.
- **Compliance**: All future sessions SHALL reference this ADR. For audit, any commit in the Git log authored "via Trae auto-commit" whose SHA does NOT follow an explicit chat "commit this" line is treated as a breach of this decision, requiring immediate rollback + investigation of the new toggle that caused it.
