# Operational Guide — Universal Second Brain Vault

This file is the **one starting page for any new user** (human or AI agent) of this project template. Read it fully before writing any code or notes.

---

## 0. Before Anything Else — What This Project *Is*

This template ships a **portable Obsidian vault-as-code** (`.obsidian-vault/` folder) alongside your actual project code. Think of it as the project's second brain. The same Git repo versions **both** (code + vault) together.

One project = one vault. Always.

### The 3 Most Important Ground Rules (Non-Negotiable)

If you break any of these, you will silently lose work. Read the table before opening a file.

| # | Rule | Why |
|---|---|---|
| 🔒 1 | **You only ever edit files INSIDE `.obsidian-vault/`.** | Files OUTSIDE the vault that sound the same (project-root `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`) are **auto-generated disposable mirrors**. The sync script regenerates them from the canonical file every time. Any hand-edit to a mirror will be PERMANENTLY OVERWRITTEN on the next sync. (Mirror files literally start with a DO-NOT-EDIT warning header — read it if you're unsure.) |
| 🔒 2 | **There are TWO files named `CLAUDE.md`. Know the difference.** | ✅ `.obsidian-vault/CLAUDE.md` = **CANONICAL SOURCE OF TRUTH** — edit this one, and only this one. <br> ❌ `./CLAUDE.md` (project root, next to `.gitignore`) = MIRROR — never touch it. |
| 🔒 3 | **Every single edit to the canonical `.obsidian-vault/CLAUDE.md` MUST be followed by running `& .\sync-agent-briefings.ps1` at the project root, BEFORE you run `git commit`.** | Keeps all 6 agent mirrors byte-consistent. Skipping this step = the next AI agent (Claude Code / Cursor / Windsurf / Copilot) reads STALE context and redoes 1–4 hours of work. |

### Quick Map of the Vault

All 6 folders below live under `.obsidian-vault/`.

| Folder | What Goes In | Who Writes It | When |
|---|---|---|---|
| `daily/` | Session working notes. 1 file per coding session. | AI drafts (Session End prompt), you edit (3-minute human pass). | End of every coding session. |
| `bugs/` | Reproducible bug investigations — steps, stack traces, expected vs actual. | AI drafts (Triage prompt), you review. | After Triage if a daily note contained a real bug. |
| `specs/` | Pre-coding feature specs with at least 3 clear acceptance criteria. | AI drafts (Triage prompt), you review. | Before building a new defined feature. |
| `decisions/` | Architecture Decision Records (ADRs) — settled choices + their consequences. | AI drafts (Triage prompt), you review. | After a real architectural decision is made. |
| `retro/` | Milestone reflections — lessons learned → permanent rules. | You write (or you edit AI's auto-draft from Triage). | After a milestone ends (v0.1, sprint end, integration shipped, postmortem). |
| `templates/` | Templater plugin templates. DO NOT PUT THESE IN WORKING FOLDERS. | Project maintainer. | Project day 0. Obsidian's Templater plugin is configured with `templates_folder: "templates"`. |

And 3 top-level files inside the vault:

| File | Purpose |
|---|---|
| [00-inbox.md](00-inbox.md) | Capture zone — write anything here when you don't know where else. Triage prompt will pick it up eventually. |
| [Dashboard.md](Dashboard.md) | Obsidian home screen — Dataview queries for open bugs / open specs / recent decisions. Read this every morning. Don't hand-edit the Dataview blocks. |
| **[CLAUDE.md](CLAUDE.md)** | ⭐ **AI Briefing — The Most Important File in the Whole Project.** When a new AI agent starts, it reads this. Contains: What this is / Tech stack / Current state / Key decisions / File map / Do Not. If it's wrong, every AI answer is wrong. |

---

## 1. Project Day-0 Setup — Do This Once, Before Writing Any Code

**Estimated time: 10 minutes. Do not skip steps 6 and 7.**

### Step 1.0 — Copy the template

1. Copy this whole `Obsidian Project` folder (the one you're reading now) → rename to your project name, e.g. `InvoiceFlow`.
2. Move the copied folder to wherever you keep code (e.g. `C:\code\InvoiceFlow`).

### Step 1.1 — Open Obsidian on the VAULT ROOT (not project root)

THIS IS THE #1 MOST COMMON NEW-USER MISTAKE. Obsidian opens a FOLDER as the vault.

- ✅ **Correct:** In Obsidian, File → Open vault → Choose folder → pick **`.obsidian-vault/`** (e.g. `C:\code\InvoiceFlow\.obsidian-vault`).
- ❌ **Wrong:** Opening `C:\code\InvoiceFlow` (the project root) as the vault. This exposes `.gitignore`, `sync-agent-briefings.ps1`, and agent mirrors to Obsidian search and corrupts Dataview queries.

If Obsidian's file explorer shows 6 folders (decisions, specs, bugs, daily, retro, templates) at the top level, you got it right. If the top shows files like `.gitignore` and `.cursorrules`, close the vault and reopen on the correct path.

### Step 1.2 — Open the PROJECT ROOT in your code editor

- In VS Code / Cursor / Windsurf → File → Open Folder → pick the **project root** (e.g. `C:\code\InvoiceFlow`). The one containing `.gitignore`, `sync-agent-briefings.ps1`, and the `.obsidian-vault/` folder. This is where actual code goes.

### Step 1.3 — Install Obsidian community plugins (4 required)

Inside Obsidian:

1. Settings → Community plugins → Turn off "Restricted mode".
2. Browse → Install & **Enable** all 4:
   - **Templater** (templates use `<% ... %>` syntax; configured to read from `templates/`)
   - **Dataview** (powers Dashboard.md queries)
   - **Obsidian Git** (10-minute auto-save)
   - **Linter** (Markdown formatting consistency)
3. Settings → Templater → **Templates folder location**: `templates`
4. Settings → Obsidian Git → Verify:
   - `autoBackupAfterFileChange: true`
   - `autoSaveInterval: 10` minutes

### Step 1.4 — Fill in the canonical CLAUDE.md

Open **[.obsidian-vault/CLAUDE.md](CLAUDE.md)** in Obsidian or VS Code. Fill these fields once:

1. **`# [YOUR PROJECT NAME]`** → Replace with real project name.
2. **`## What this is`** → Write 1–2 sentences that would brief a new senior dev on this project. Delete the InvoiceFlow example text once you write yours.
3. **`## Tech stack`** table → Keep the 12-row skeleton but replace every placeholder with your real stack. Delete any inapplicable rows. Keep the "Note vault" row locked to Obsidian.
4. **`## Current state`** →
   - Set `**Last updated:** YYYY-MM-DD` to today.
   - Write 2–3 bullets for each subsection (`### Working`, `### Broken / Blocked`, `### Focus right now`). If a subsection is empty, write the word `None` explicitly so AI doesn't hallucinate content.
   - Delete the InvoiceFlow examples once you write yours.
5. **`## Key decisions made`** → If you already have settled decisions, list them in the required format: `**[Decision label]**: [summary]. ← ADR: decisions/NNN-slug.md`. Otherwise leave empty (this fills in over time).
6. **`## File map`** → Under the `.obsidian-vault/` block (which you leave untouched), edit the generic placeholder tree (`src/`, `tests/`, `scripts/`, etc.) to match your ACTUAL language/stack folder layout. Use the 4 language-alternative guides below the banner. Keep the `⬇️ EDIT BELOW ⬇️` banner in place.
7. **`## Do Not`** → Keep the 3 🔒 Permanent meta-rules exactly as written. In the 🛠️ Project-specific list, replace the InvoiceFlow example with any hard rules you already know, then delete the example comment. If none yet, leave the empty list in place.

**SAVE `.obsidian-vault/CLAUDE.md` once.**

### Step 1.5 — Run the sync script (mandatory after Step 1.4)

In VS Code → Terminal → New Terminal → PowerShell → **from the PROJECT ROOT** run:

```powershell
& .\sync-agent-briefings.ps1
```

You should see:
```
[OK] Synced -> CLAUDE.md
[OK] Synced -> .cursorrules
[OK] Synced -> .windsurfrules
[OK] Synced -> .github/copilot-instructions.md
[OK] Synced -> .obsidian-vault/AGENT.md
[OK] Synced -> .obsidian-vault/AI_BRIEFING.md
[DONE] Mirrors updated: 6 / Dirs created: 0 / Next step: commit code+vault+mirrors together
```

If you get a red "running scripts is disabled on this system" error, see **Troubleshooting → TS-01** at the bottom of this file.

### Step 1.6 — Initialize Git

Still in the PowerShell terminal at the project root:

```powershell
git init
git add -A
git commit -m "Initial commit: project template + filled CLAUDE.md"
```

(Optional but recommended) Then push to GitHub/GitLab:
```powershell
git branch -M main
git remote add origin git@github.com:yourname/your-repo.git
git push -u origin main
```

Day-0 setup is complete.

---

## 2. Every Coding Session Loop — Do This Every Single Day (8–12 minutes total)

Memorize this sequence. Repeat it daily until it is boringly automatic.

```
CODE → commit often → [1] Session End prompt → [2] 3-min human edit
       → [3] Triage prompt → [4] Review 🟡 flagged drafts → [5] sync script
       → [6] One git commit of code + vault together
```

### Step 2.1 — Code normally and commit often

Do NOT write daily notes manually. Just work. The AI generates the note at session end.

Rules while coding:
- Commit every 30–90 minutes: `git add -A ; git commit -m "feat: ..."` — good commit messages make the daily note better.
- If you hit a dead-end, LEAVE EVIDENCE:
  - Keep the failing terminal output open, or
  - Leave a `// TODO: Dead end — tried X and failed because Y at line 12` comment in the file at the exact failing line.
  - The Session End prompt's "Investigations & dead ends" section is the **single most valuable part of the whole second brain.** Future-you 3 weeks from now will re-investigate the exact same dead-end and waste 90 minutes unless today-you writes it down.
- If you make a real architectural decision, keep going — Triage will draft the ADR at session end.
- If you find a real reproducible bug, keep going — Triage will draft the bug report at session end.
- Random capture-before-you-forget stuff goes into [.obsidian-vault/00-inbox.md](00-inbox.md). Don't overthink placement.

### Step 2.2 — End of coding session. [1] Run Session End prompt. (~2 min)

When you're done for the day:

1. Make sure any pending terminal work is saved. Final commit:
   ```powershell
   git add -A ; git commit -m "WIP: end of session"
   ```
   (This is safe even if you rebase/amend later — the Session End prompt reads today's git history.)

2. Open Copilot Agent chat (or Cursor composer / Windsurf chat / Claude Code CLI) and **paste this EXACT one-liner, character-for-character — do not rephrase:**

   ```
   Read this file exactly: .obsidian-vault/daily/_PROMPT-session-end-generate-daily-note.md
   Then execute the prompt instructions it contains. Use today's actual date.
   ```

3. Wait ~30–60 seconds. Copilot reads git status, git diff, today's commits, the chat history, and creates:
   - [.obsidian-vault/daily/YYYY-MM-DD.md](daily/) with 5 sections (see the Session End prompt for the exact layout), plus
   - A confidence breakdown table in chat, a list of what it CANNOT know (you add this next), and suggested migrations.

### Step 2.3 — [2] The 3-minute human edit. (HARD LIMIT 3 minutes.)

Open the generated daily file (Obsidian → `daily/` → today's file).

Add ONLY what the AI cannot possibly know. Do NOT rewrite whole sections:

| Add this | In section |
|---|---|
| Why you chose approach B over approach A (your internal reasoning, not written in chat or code) | Investigations & dead ends |
| Any meeting / call / Slack / Zoom context not shared with Copilot | Any relevant section |
| Private notes about blockers, mood, things you'd only tell a trusted teammate | Where I stopped / TODOs |
| Browser research / docs-reading you did offline | Commands / config / snippets |
| Delete any AI hallucination (wrong file names, invented meetings) | Entire file |

Set a 3-minute kitchen timer. Stop when it rings. **Good enough today beats perfect never.**

SAVE the daily file.

### Step 2.4 — [3] Run the Daily Triage prompt. (~2 min)

This step is non-negotiable. It takes the raw daily note and pushes qualified items into the canonical CLAUDE.md + the 4 formal folders. Without this step, your vault accumulates raw daily notes and turns into a graveyard of forgotten context.

Paste this EXACT one-liner into Copilot Agent chat. Do not rephrase:

```
Read this file exactly: .obsidian-vault/daily/_PROMPT-triage-daily-note-migrate.md
Then execute the prompt instructions it contains. Use today's actual date.
```

The Triage prompt does 4 things automatically:

1. **Updates canonical `.obsidian-vault/CLAUDE.md → ## Current State`** (all 3 subsections + `Last updated:` date). It touches NO OTHER section of CLAUDE.md — `Key decisions` and `Do Not` require human manual action (see milestone retro section below).
2. **Auto-drafts formal files** into the 4 formal folders using the correct Templater templates, per its routing table:
   - Bug → `bugs/slug.md` (status: Open)
   - Decision → `decisions/NNN-slug.md` (status: Proposed)
   - Feature spec → `specs/slug.md` (status: Draft)
   - **Only on milestone-end days:** `retro/NNN-milestone-name.md` (95% of normal days, this one is NOT created — ignore it unless you actually ended a phase).
   Each draft has 🚧 status markers + a breadcrumb link back to today's daily note for provenance.
3. **Appends a `📦 Migrated from this note:` breadcrumb index at the TOP of your daily file**, so you can 1-click jump to every draft created today.
4. **Outputs a human-review report table with 3 sections:**
   - The changes table with 🟡 / 🟢 review flags.
   - Deliberately-not-migrated list (with reasons).
   - `Candidates for Do Not` — rules the AI detected but WILL NEVER auto-add. Permanent rules always require a human to actually write them.

### Step 2.5 — [4] 60-second human review of 🟡 flagged items.

Read the Triage report table. For EACH row marked 🟡 (needs human review):

1. Click the file path in the report (or open it in Obsidian/VS Code).
2. Do one of 3 things:
   - ✅ Keep it → do nothing (or quick-fix 1–2 typos).
   - ✏️ Edit it → rewrite the parts that are wrong (the AI synthesized, so about 20% of drafts need a quick rewrite).
   - 🗑️ DELETE it (most common outcome for AI's false-positive drafts). Do NOT feel obligated to keep every auto-drafted file. The prompt explicitly creates low-confidence drafts on purpose so nothing slips through. Delete aggressively.

On non-milestone days, if a `retro/NNN-*.md` was auto-drafted and today is NOT the end of a real milestone → **delete the retro draft immediately.** It is a false positive.

### Step 2.6 — [5] Run the sync script. (Always.)

You just edited files. Step 2.4.1 above edited canonical `.obsidian-vault/CLAUDE.md` Current State. Rule 🔒 3 says: after *any* CLAUDE.md canonical edit, always run sync before commit.

```powershell
& .\sync-agent-briefings.ps1
```

Wait for the `[DONE] Mirrors updated: 6` banner. This takes ~0.3 seconds.

### Step 2.7 — [6] One git commit of **code + vault notes together**.

Guide rule: vault and code live in the same repo, commit together, branch together. The second brain is not a separate artifact.

```powershell
git add -A
git commit -m "daily: 2026-09-28 session + triage migrations"
```

(Change the date to today's actual date.)

If working on a team, push:
```powershell
git push
```

Day done. Close laptop. Go outside.

---

## 3. Milestone Retro Loop — Do This Every 2–8 Weeks (when a phase ends)

A milestone is any meaningful project boundary:

- Shipped v0.1 / v0.2
- Ended a sprint
- Finished a big integration (e.g. Stripe billing, auth system rewrite)
- Had a production incident → postmortem needed
- Completed a big refactor

### Step 3.1 — Do the normal daily loop on the final day of the milestone.

Same 7 steps (Section 2 above). The Triage prompt will likely auto-draft a `retro/NNN-milestone-name.md` file on the milestone-final day (since the daily note will contain phrases matching "end of phase").

### Step 3.2 — Manually write / heavily-edit the retro note. (~30–60 min.)

Open the auto-drafted retro file (or create `retro/NNN-your-slug.md` manually if none was drafted).

YOU write the content. The AI is a draft creator here, not a decision-maker. Use this structure:

1. **Milestone goals vs. reality** — 3–8 bullets. What did you promise? What actually shipped? Quantify (time, bugs, scope-creep).
2. **What worked well** — 3–5 bullets. Be specific (e.g. "the bugs/ folder + Triage workflow caught 3 regressions before prod").
3. **What failed & root cause** — the most important section. For every failure, write what happened AND the real root cause (not the symptom).
4. **Action items / process changes (3–10 concrete bullet points)** — the whole point of the retro. Each item must have a specific owner or location:
   - A task to put somewhere (e.g. "Add Stripe CLI listener to dev setup README")
   - A candidate ADR to write in `decisions/NNN-*.md`
   - A candidate `Do Not` rule to add to canonical `.obsidian-vault/CLAUDE.md`
5. **Link map** — 1-click links back to the 5–10 most relevant daily notes, bugs, ADRs, commits, PRs. Retros without links are opinions; retros with links are audit trails.

SAVE the retro note.

### Step 3.3 — Manually promote earned rules to canonical `.obsidian-vault/CLAUDE.md`. (~5–10 min.)

The Triage prompt is deliberately *forbidden* from auto-editing permanent sections of `.obsidian-vault/CLAUDE.md`. It will always flag candidates in the report table and let you decide. YOU are the gatekeeper.

Open [.obsidian-vault/CLAUDE.md](CLAUDE.md) and perform ANY of these that EARNED their place:

| If your retro produced… | Write it into this `.obsidian-vault/CLAUDE.md` section | Format / Rules |
|---|---|---|
| A permanent architecture decision (no going back) | `## Key decisions made` | Mandatory format: `**[Decision label]**: [summary]. ← ADR: decisions/NNN-slug.md` |
| A real, expensive mistake you will never make again | `## Do Not → 🛠️ Project-specific hard rules` | Phrase it as a command, not a suggestion. Link to the retro note. 1 bullet = 1 rule. Do not add "try to…" or "consider…" — say "Do not …" |
| Milestone finished, status changed | `## Current state` + `Last updated` date stamp | Rewrite Working / Broken / Focus to reflect post-milestone reality |
| Folder layout changed during milestone | `## File map` → below the `⬇️ EDIT BELOW` banner | Update the tree to match the new layout |

**If a rule is not proven and expensive, do NOT add it.** The Do Not list must stay small and sharp. A Do Not list with 40 items is a Do Not list nobody reads. Earn every bullet.

SAVE `.obsidian-vault/CLAUDE.md` when done.

### Step 3.4 — Run the sync script. (Always.)

```powershell
& .\sync-agent-briefings.ps1
```

### Step 3.5 — Create the ADRs / spec drafts / bug drafts that came out of the retro's action items. (~5–15 min.)

For each non-Do-Not, non-Current-State action item in the retro note:

1. If it's a new bug → Copy the bug content. Create file `.obsidian-vault/bugs/descriptive-slug.md` by copying [templates/_template-bug.md](templates/_template-bug.md) as your starting point. Fill out frontmatter title / date / status = Open. Add a link on line 1 back to the retro note: `🔎 Root note: retro/NNN-your-milestone-slug.md`.
2. If it's a new architecture decision → Create `.obsidian-vault/decisions/NNN-short-slug.md` using [templates/_template-adr.md](templates/_template-adr.md). `NNN` = next number above the highest-numbered existing ADR.
3. If it's a new feature to spec → Create `.obsidian-vault/specs/feature-name.md` using [templates/_template-spec.md](templates/_template-spec.md).

Alternatively, you can run the Triage prompt one more time pointed at the retro note (not a daily note) — it will NOT auto-write permanent sections, but it WILL auto-draft the ADR / bug / spec files for you and save the copy-paste, then you review 🟡 flags and delete the bad ones. This is a convenience, not mandatory. Rule 🔒 1 and 🔒 2 still apply.

### Step 3.6 — One milestone git commit.

```powershell
git add -A
git commit -m "retro: milestone NNN — <milestone name> postmortem + lessons learned"
git push   # if team project
```

---

## 4. Project End (Optional) — Last Day of the Project

1. Write one final retro: `retro/999-project-postmortem.md`
2. Final canonical CLAUDE.md edit → `## Current state` → write something like:
   > Project shipped / archived / handed off to Team Name on YYYY-MM-DD.
   > Final state: v1.2.3 running on Vercel + Supabase.
   > Last stable commit: abc1234.
   > Handoff doc: <link>.
   Update `Last updated:` stamp.
3. Run sync script: `& .\sync-agent-briefings.ps1`
4. Final commit + push + archive the repo.

---

## 5. Troubleshooting — Common New-User Errors

If something breaks, read this table FIRST. Do not improvise until you try the prescribed fix.

| ID | Symptom you see | Root cause (99% of the time) | Exact fix |
|---|---|---|---|
| **TS-01** | PowerShell says red text: `sync-agent-briefings.ps1 : File ... cannot be loaded because running scripts is disabled on this system.` | Windows ships with PowerShell script execution disabled by default. | **Per-session safe (recommended first try):** In the same VS Code terminal, run once, then immediately re-run the sync script:<br>`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force`<br><br>**One-time permanent developer-safe fix:** Run once ever on your account. CWD does not matter (account-scope):<br>`Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force`<br>Close terminal + reopen. Re-run sync script. |
| **TS-02** | Sync script runs `[OK]` x6, but next time you open Cursor it still reads OLD CLAUDE.md text from a previous version. | You edited a **mirror** file directly (e.g. root `./CLAUDE.md` or `.cursorrules`) at some point in the past 24 hours. Then you ran sync, which overwrote the mirror. But Cursor's in-memory cache or its preference order prefers the out-of-date file. Or you skipped Rule 🔒 3 and forgot to run sync after the last legitimate canonical edit. | 1. Close all AI agents completely. Close VS Code / Cursor / Windsurf fully (Quit, not just window-close). Wait 10 seconds.<br>2. Open ONLY the canonical file: `.obsidian-vault/CLAUDE.md`. Confirm its contents look right.<br>3. From project root, run sync once more: `& .\sync-agent-briefings.ps1`<br>4. Reopen your editor. Now all agents read fresh context.<br>5. If it still happens, check: did you accidentally edit a mirror file? Use `git diff` to see. If yes, `git checkout -- CLAUDE.md .cursorrules .windsurfrules` to discard your mirror edits, fix the canonical, run sync again. |
| **TS-03** | Obsidian file browser shows `.gitignore`, `sync-agent-briefings.ps1`, `.cursorrules` at the top level. Dashboard shows zero bugs / zero specs. | You opened Obsidian on the **project root** folder instead of the `.obsidian-vault/` subfolder. This is the #1 most common new-user mistake. | 1. Obsidian → Settings → Vault → Close vault.<br>2. File → Open vault → Choose folder. Browse INTO your project folder. Click ONCE on the `.obsidian-vault/` folder. Click "Select Folder".<br>3. Confirm top level shows 6 folders: decisions, specs, bugs, daily, retro, templates. <br>4. Open Dashboard — Dataview queries now correctly show content from inside the vault. <br>5. **If the incorrect vault created files**, delete them from the project root (they were copied inadvertently). |
| **TS-04** | Copilot answers "No daily note found for today. Run the Session End prompt first." | You ran Triage BEFORE generating the daily note, or the Triage prompt's `Use today's actual date` value resolves to a date the file doesn't exist for (timezone edge case, UTC offset). | 1. Run the Session End prompt first. Wait for it to finish and confirm the file was created.<br>2. Then run the Triage prompt.<br>3. If still failing, verify the file path manually in Obsidian → `daily/` folder. Open it in VS Code. Copy the exact YYYY-MM-DD filename. In the Triage prompt invocation, replace the `Use today's actual date` sentence with `The daily note to process is located at: .obsidian-vault/daily/<EXACT-FILENAME>.md`. |
| **TS-05** | Triage prompt creates a `retro/NNN-*.md` file on a random Tuesday when no milestone ended. | Daily note happened to contain phrases like "milestone complete" or "sprint end" that trip the Step 2 routing table line 56. False positive. Expected occasionally. | Open the retro file. Read it. If it's not a real milestone: **DELETE THE FILE IMMEDIATELY.** Do not let false retros accumulate. They clutter your milestone history. |
| **TS-06** | Dashboard shows "Dataview: no results" for sections that have files. | Dataview plugin not enabled, OR status values are written in lowercase. The Dashboard filter queries use capitalized status strings: `status = "Open"`, `status = "Draft"`, `status != "Done"`. The templates all use uppercase for this exact reason. | 1. Obsidian → Settings → Community Plugins → Confirm Dataview is **Enabled**.<br>2. Settings → Dataview → Toggle `Enable JavaScript Queries = true`, `Enable Inline Queries = true`.<br>3. Open the offending bug/spec/ADR. Open YAML frontmatter. Confirm the `status:` line uses EXACTLY one of: `Open`, `Proposed`, `Draft`, `Done` (case-sensitive). Fix any lowercase. Save file. Return to Dashboard. Press `Ctrl+R` to refresh Dataview. |
| **TS-07** | Git says `warning: LF will be replaced by CRLF` on 200 files every commit. | Windows Git default converts line endings. The template's `.gitattributes` is missing or you don't have it. | Run once at project root, then one commit cleans it forever:<br>`git config --global core.autocrlf true`<br>`git add --renormalize .`<br>`git commit -m "chore: renormalize line endings"` |
| **TS-08** | Templater inserts nothing when you apply a template → frontmatter `title: <% tp.file.title %>` stays as the literal placeholder text. | Templater plugin not enabled, or `templates_folder` not set to `templates`. | 1. Obsidian → Settings → Templater → Set **Templates folder location** to exactly the word `templates` (no leading dot, no slash, no extra characters). <br>2. Confirm "Trigger Templater on new file creation" = on.<br>3. Reapply the template to the target file. |
| **TS-09** | You manually edited root `CLAUDE.md` (or `.cursorrules`, or `.windsurfrules`, or `.github/copilot-instructions.md`) and want to preserve your edits because they're good. | You broke Rule 🔒 1 and edited a mirror file. The mirror edits will die next sync. This is the exact scenario Rule 🔒 1 exists to prevent. But since the content is worth saving, here's how to rescue it: | 1. Copy ALL the good content you wrote in the mirror file.<br>2. Open the CANONICAL file: `.obsidian-vault/CLAUDE.md`. Paste / merge your good content into the correct section there. SAVE.<br>3. Discard the mirror's local changes so Git is clean (this deletes your duplicate copy from the mirror — it's now safely only in the canonical):<br>`git checkout -- CLAUDE.md .cursorrules .windsurfrules .github/copilot-instructions.md .obsidian-vault/AGENT.md .obsidian-vault/AI_BRIEFING.md`<br>4. Run sync: `& .\sync-agent-briefings.ps1`. The good content now propagates to all 6 mirrors properly.<br>5. Commit as normal. |

---

## 6. Quick Reference — The 4 Commandments (tape this to your monitor)

1. **Edit ONLY inside `.obsidian-vault/`. Never outside.**
2. **Only ONE CLAUDE.md matters: `.obsidian-vault/CLAUDE.md`.**
3. **After EVERY edit to that ONE file → `& .\sync-agent-briefings.ps1`.**
4. **Code + vault = one Git repo, one commit at end of day.**

If you do these 4 things and follow Section 2 daily, the second brain builds itself. Everything else is detail.
