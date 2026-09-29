---
title: Prompt — Triage Daily Note — Migrate to Formal Folders
tags: prompt
type: prompt
---

# 🤖 Prompt: Triage Daily Note — Migrate to Formal Folders

## ❓ What this is
A reusable Copilot prompt. Run this AFTER the Session End prompt AND after you have done your 3-minute human edit on the generated daily note. Copilot will read today's daily note, extract the important info, and automatically write it to the correct formal vault folders (the CANONICAL `.obsidian-vault/CLAUDE.md`, `bugs/`, `decisions/`, `specs/`) so nothing gets lost.

## ▶️ How to invoke (copy this line into Copilot Agent chat)
```
Read this file exactly: .obsidian-vault/daily/_PROMPT-triage-daily-note-migrate.md
Then execute the prompt instructions it contains. Use today's actual date.
```

---

## 📋 Prompt Instructions (Copilot — execute everything below this line)

### ⚠️ NON-NEGOTIABLE GROUND RULES — READ FIRST BEFORE DOING ANYTHING

The project has TWO files named `CLAUDE.md`. You MUST understand this distinction or you will break the workflow.

| File | What it is | Write to it? |
|---|---|---|
| `.obsidian-vault/CLAUDE.md` | ✅ **CANONICAL SOURCE OF TRUTH** — this is the master file the human edits inside Obsidian GUI | ✅ **YES — this is the ONLY CLAUDE.md you may ever edit** |
| `./CLAUDE.md` (at project root, next to `.gitignore`) | 🔁 **AUTOMATICALLY GENERATED MIRROR** for Claude Code CLI. The human runs `& .\sync-agent-briefings.ps1` to regenerate it from the canonical file. | ❌ **NEVER write to the root `./CLAUDE.md` mirror under ANY circumstances. If you edit it, the human's next sync script run will OVERWRITE your changes and they will be PERMANENTLY LOST.** |

Same rule applies to all mirror files in the project: **you only ever write to files INSIDE `.obsidian-vault/` folder** (the vault). Files outside the vault at project root (`.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`) are auto-generated mirrors and are off-limits.

When you finish editing `.obsidian-vault/CLAUDE.md` in Step 1 below, your FINAL output must remind the human to run the sync script.

### Step 0: Read today's daily note
Read `.obsidian-vault/daily/YYYY-MM-DD.md` (today's actual date).
If the file does not exist, stop and say "No daily note found for today. Run the Session End prompt first."

### Step 1: Update .obsidian-vault/CLAUDE.md (CANONICAL) Current State section
Read `.obsidian-vault/CLAUDE.md`. Rewrite ONLY the `## Current State` section (and its 3 subsections: `### Working`, `### Broken / Blocked`, `### Focus right now`) to accurately reflect reality from today's daily note.

Rules for `.obsidian-vault/CLAUDE.md` edits:
- Keep it TIGHT: maximum 5 bullets per subsection. Prefer 2-3.
- Always update the `**Last updated:** YYYY-MM-DD` date stamp to today.
- Do NOT touch any other sections of `.obsidian-vault/CLAUDE.md`.
- If something in the daily note belongs in the `## Do Not` section, flag it separately in the report (Step 4) — do NOT add to Do Not without a confirmation flag first.

### Step 2: Migrate eligible content to formal folders

For each finding in the daily note that qualifies, CREATE the corresponding file using the correct template. Use the file-naming patterns below. If a similar file already exists, UPDATE it instead of duplicating.

| If the daily note contains... | Create file at... | Using template... | Default status |
|---|---|---|---|
| A specific reproducible bug with steps to reproduce and expected/actual behavior | `bugs/short-descriptive-slug.md` | `templates/_template-bug.md` | Open |
| A settled, final architectural decision with consequences | `decisions/NNN-short-slug.md` where NNN = next number | `templates/_template-adr.md` | Proposed |
| A planned feature or UI surface with a defined goal and at least 3 clear acceptance criteria ideas | `specs/short-feature-name.md` | `templates/_template-spec.md` | Draft |
| A milestone's end with what-went-well / went-poorly / changes for next time | `retro/NNN-milestone-name.md` where NNN = next number | (no template, use human discretion with 3 sections) | Final |

Rules for Step 2:
- Always populate frontmatter `title` with a human-readable version of the slug.
- Always populate frontmatter `date` with today's date using `YYYY-MM-DD` format.
- For the body sections, synthesize intelligently from the daily note. Don't just copy-paste raw paragraphs.
- Do NOT create formal files for throwaway one-off ideas. Only create a formal file if the content is:
  - Something future-us will need for a decision, or
  - Something that blocks or enables work, or
  - Something that was expensive/time-consuming to learn
- If you are UNCERTAIN whether to create a formal file, DO create a draft file and mark it in the report as "Low confidence — review and delete if not needed."

### Step 3: Leave breadcrumbs
After migrating content, ADD a line at the TOP of today's daily note (under the H1 title) with an index of what was migrated:

```markdown
> 📦 Migrated from this note:
> • .obsidian-vault/CLAUDE.md (canonical) Current State — updated
> • `bugs/stripe-decimal-qty.md` — created (bug report)
> • `decisions/003-pdf-library.md` — proposed (ADR)
```

If nothing was migrated, write:
```markdown
> 📦 No migrations from this note — all content is session-scoped.
```

### Step 4: Final report table

Output in this chat:

**Summary of changes made:**

| Location | Action | Confidence | Needs human review? 🟡/🟢 |
|---|---|---|---|
| .obsidian-vault/CLAUDE.md (canonical) Current State | Updated 3 subsections + date stamp | High/Medium/Low | 🟡 / 🟢 |
| bugs/filename.md | Created new bug report | High/Medium/Low | 🟡 / 🟢 |
| decisions/NNN-slug.md | Proposed new ADR draft | High/Medium/Low | 🟡 / 🟢 |
| specs/filename.md | Created new spec draft | High/Medium/Low | 🟡 / 🟢 |
| retro/NNN-slug.md | Created new retro draft | High/Medium/Low | 🟡 / 🟢 |
| daily/YYYY-MM-DD.md | Added migration breadcrumbs at top | High | 🟢 |

**Deliberately NOT migrated (with why):**
- Bulleted list of items in today's note that you considered but decided NOT to promote, each with a 1-sentence reason.

**Candidates for .obsidian-vault/CLAUDE.md (canonical) DO NOT section (you decide, I will not auto-add):**
- Bulleted list of any candidate rules you observed. Each should be phrased as: `Do not [X] — because [reason from daily note]`

**Final reminder to user:**
> "Review any 🟡 items above. If all looks good, run the briefing sync script in a VS Code terminal with:
> ```powershell
> & .\sync-agent-briefings.ps1
> ```
> This pushes the updated canonical `.obsidian-vault/CLAUDE.md` to all agent mirrors (root CLAUDE.md, .cursorrules, .windsurfrules, .github/copilot-instructions.md, AGENT.md, AI_BRIEFING.md).
> Then commit code + vault notes together."
