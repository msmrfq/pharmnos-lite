---
title: Prompt — Session End — Generate Daily Note
tags: prompt
type: prompt
---

# 🤖 Prompt: Session End — Generate Daily Note

## ❓ What this is
A reusable Copilot prompt. Run this at the END of every coding session. Copilot will inspect all code changes, chat history, and git status from today — then auto-generate your daily working note so you don't have to write it from scratch.

## ▶️ How to invoke (copy this line into Copilot Agent chat)
```
Read this file exactly: .obsidian-vault/daily/_PROMPT-session-end-generate-daily-note.md
Then execute the prompt instructions it contains. Use today's actual date.
```

---

## 📋 Prompt Instructions (Copilot — execute everything below this line)

### ⚠️ NON-NEGOTIABLE GROUND RULES — READ FIRST BEFORE DOING ANYTHING

The project has TWO files named `CLAUDE.md`. You MUST understand this distinction.

| File | What it is | Write to it? |
|---|---|---|
| `.obsidian-vault/CLAUDE.md` | ✅ **CANONICAL SOURCE OF TRUTH** — the only file humans and agents may edit. | ✅ YES (but this prompt session you are generating the daily note only, not editing CLAUDE.md — that happens in the Triage prompt later) |
| `./CLAUDE.md` (at project root, next to `.gitignore`) | 🔁 **AUTOMATICALLY GENERATED MIRROR** for Claude Code CLI. The human runs `& .\sync-agent-briefings.ps1` to regenerate it from the canonical file. | ❌ **NEVER write to the root `./CLAUDE.md` mirror under ANY circumstances.** |

Same rule for all mirror files outside the vault: `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md` are all auto-generated mirrors. You only ever read or write to paths INSIDE `.obsidian-vault/`.

All file paths you reference in the daily note body must use the FULL explicit vault-relative path. Never write a bare unqualified path like "CLAUDE.md". Always write `.obsidian-vault/CLAUDE.md`.

---

You have full access to this session's chat history, all code changes, git diff, and uncommitted changes for this project.

### Task 1: Generate the daily working note

Create the file at `.obsidian-vault/daily/YYYY-MM-DD.md` using today's actual date.

Structure the file EXACTLY like this:

```markdown
# YYYY-MM-DD — [short descriptive headline of the session's main focus, max 10 words]

## What I (we) did today
(List 3-8 bullet points of concrete completed work.
 Reference specific file paths with line numbers when relevant.
 Include scaffolded files, implemented features, refactors, deployed changes.
 Never be vague.)

## Investigations & dead ends
(For every approach that was tried and rejected, write:
 - What was tried
 - Why it was rejected (if stated anywhere in chat or code comments)
 - Approximate time wasted
 This is the MOST IMPORTANT section. Do not skip it even if nothing
 was rejected — in that case write "No rejected approaches logged this session".)

## Commands / config / snippets to remember
(Any CLI commands, environment variable settings, database queries,
 API endpoints, or code fragments I might need to copy-paste later.
 Format in code blocks with language tags.)

## Where I stopped / open TODOs
(Exact file paths + line numbers of mid-work TODO, FIXME, HACK comments.
 Any partially-completed functions with status:
 - What's working currently
 - What the exact next step is
 Mark status with 🚧 for in-progress, 🟡 for planned, ✅ for done.)

## AI interactions that were unusual / notable
(Did you refuse a suggestion that turned out correct?
 Did I waste time by asking the wrong framing of question?
 Were there prompt patterns that worked unusually well or badly?
 Did you suggest something I ignored that might matter later?)
```

### Rules for Task 1
- Be specific. Write `Created src/api/stripe/checkout/route.ts lines 1-78` — never "worked on Stripe".
- Do NOT invent my thoughts or intentions. Stick to observable evidence in chat and code.
- If you have zero information for a section, write "Nothing logged this session" — do not omit the section.
- Always flag environment variables present in .env.local but missing from .env.example.
- Include test results: passing/failing test suites from anything observed in terminal outputs.

### Task 2: Post-generation report

After creating the daily file, output to me in this chat:

1. **Confidence breakdown table:**
   | Section | Confidence | Reason for low confidence |
   |---|---|---|
   | What I did today | High/Medium/Low | ... |
   | Investigations | High/Medium/Low | ... |
   | Commands remembered | High/Medium/Low | ... |
   | Where I stopped | High/Medium/Low | ... |
   | AI interactions | High/Medium/Low | ... |

2. **Information I know I'm missing (human must add):**
   - Bulleted list of things I CANNOT know because they happened outside Copilot chat / the code (phone calls, browser research not shared, conversations, half-formed intentions, mood/energy levels)

3. **Suggested migrations to formal vault locations:**
   For each item, say WHERE it should go and WHY. The options are:
   - `.obsidian-vault/CLAUDE.md (canonical) → Current State (Working / Broken / Focus)`
   - `.obsidian-vault/CLAUDE.md (canonical) → DO NOT section (as a new rule, requires Triage prompt with human approval)`
   - `bugs/ → new bug investigation using _template-bug.md`
   - `decisions/ → new ADR using _template-adr.md`
   - `specs/ → new feature spec using _template-spec.md`
   - `retro/ → note for next milestone retro`

4. **Remind me:**
   > "Open the generated daily file, add any missing human context (3-minute edit), then run the Triage prompt if you want automatic migration. REMEMBER: after ANY edit to `.obsidian-vault/CLAUDE.md` (canonical), run `& .\sync-agent-briefings.ps1` in the terminal to push the changes to all agent mirrors."
