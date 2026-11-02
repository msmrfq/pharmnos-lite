# Pharmnos Lite

<!--
  ╔═══════════════════════════════════════════════════════════════════════════╗
  ║  🛑  CANONICAL SOURCE OF TRUTH — EDIT ONLY THIS FILE.                    ║
  ║                                                                           ║
  ║  This file is the ONE master AI briefing. All other "AI rules" files     ║
  ║  in the project are AUTOMATICALLY GENERATED MIRRORS of this file.        ║
  ║  NEVER edit any mirror directly.                                         ║
  ║                                                                           ║
  ║  1. Make your edit here (in Obsidian GUI, VS Code — doesn't matter).     ║
  ║  2. Run:  ./sync-agent-briefings.ps1                                     ║
  ║     (Or open PowerShell in the project root and paste:                   ║
  ║      & .\sync-agent-briefings.ps1 )                                      ║
  ║  3. Commit everything together. Done.                                    ║
  ╚═══════════════════════════════════════════════════════════════════════════╝

  Mirrors maintained by the sync script:
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │ PROJECT ROOT (agent-native conventions, loaded automatically):            │
  │   • CLAUDE.md                    → Claude Code CLI (Anthropic) native      │
  │   • .cursorrules                 → Cursor IDE (Anysphere) native           │
  │   • .windsurfrules              → Windsurf IDE (Codeium) native           │
  │   • .github/copilot-instructions.md → GitHub Copilot Agent native         │
  │   • .vscode/settings.json       → Copilot contextFiles boost (not a copy) │
  │                                                                             │
  │ OBSIDIAN VAULT (generic aliases for semantic search ranking):              │
  │   • .obsidian-vault/AGENT.md     → Generic "agent" keyword alias           │
  │   • .obsidian-vault/AI_BRIEFING.md → Generic "briefing" keyword alias      │
  └─────────────────────────────────────────────────────────────────────────────┘
-->

## What this is

Pharmnos Lite is a free-first, multi-tenant pharmacy wholesale web app for India. It is meant to replace the daily essentials of heavy ERP tools with a simpler browser-based system for billing, batch-wise inventory, expiry control, purchases, ledgers, and business visibility on desktop and mobile.

---

## Tech stack

| Layer | Actual tool(s) for THIS project |
| :--- | :--- |
| **Language / Runtime** | TypeScript, Node.js, React runtime via Next.js |
| **Primary framework** | Next.js App Router |
| **Package / dep manager** | pnpm (planned standard when the app scaffold is created) |
| **Database / storage** | Supabase Postgres + Supabase Storage for MVP, PostgreSQL-compatible by design |
| **Frontend UI layer** | Tailwind CSS + shadcn/ui + custom design system from `DESIGN.md` |
| **Deployment target** | Vercel Hobby for MVP / validation, with later migration options to Cloudflare / Render / Fly.io / VPS |
| **CI / testing** | GitHub Actions (planned), automated test stack not scaffolded yet |
| **Auth / identity** | Supabase Auth adapter for MVP, provider-independent auth boundary |
| **Payments / billing** | none |
| **Note vault (FIXED — do not change)** | **Obsidian (local plain Markdown in `.obsidian-vault/`)** |
| **Editor / AI tooling** | Obsidian + VS Code + Claude Code CLI + Cursor + Windsurf + GitHub Copilot mirrors |

Additional layers:
- **Architecture style**: Provider-independent core with service layer, repository layer, auth adapter, and storage adapter.
- **Product design system**: White canvas, black primary CTAs, light-gray cards, real product fragments in cards, and dark footer per `DESIGN.md`.
---
## Developer's Guidelines to AI Agents

<!--
Description: Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, reviewing, or refactoring code to avoid overcomplication, make surgical changes, surface assumptions, and define verifiable success criteria.
-->

Behavioral guidelines to reduce common LLM coding mistakes, derived from observations on LLM coding pitfalls.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding -- You have owner's full authorization for the in-scope engineering work.

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Engineering Directive — Eliminate Configuration and Environment Drift

Treat recurring configuration mismatches and environment inconsistencies as architectural defects, not isolated incidents.

Establish authoritative, consistent configuration contracts across all system components and workflows.

- Ensure provisioning, initialization, runtime, deployment and cleanup use compatible, verifiable configuration.
- Eliminate competing defaults, hidden overrides and ambiguous environment selection.
- Enforce preflight validation and fail closed on conflicting, stale, missing or unauthorized configuration.
- Prevent unintended access to unrelated, shared or production resources.
- Add regression tests covering configuration drift, environment isolation and lifecycle consistency.
- Verify complete workflows in appropriately isolated environments.
- Preserve existing data, Git state, running processes and infrastructure unless explicitly authorized to modify them.
- Document architectural decisions and retain verifiable implementation and runtime evidence.
Investigate root causes, implement durable corrections and verify that the original failure class cannot recur through the same pathway.
Do not settle for symptom-level fixes or declare completion based solely on static checks or an isolated successful run.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```text
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

### 5. Maintain Obsidian Vault
- AI agents must remind the user and give the user two `YES` or `No` clickable options to run the exact daily note prompt at `.obsidian-vault/daily/_PROMPT-session-end-generate-daily-note.md` to generate daily session-end `.md` logs in `.obsidian-vault/daily/`. Ai Agent can recommend whether to generate a daily log or not but agent should follow the users's decision.
- Any specs, retros, bugs, or decision records must be recorded in their designated folders inside `.obsidian-vault/` (`specs/`, `retro/`, `bugs/`, and `decisions/`).
- When creating subfolder files under `.obsidian-vault/` (`specs/`, `retro/`, `bugs/`, `decisions/`), agents must use their respective `.md` template files located in `.obsidian-vault/templates/`

### 5. Comprehensive Blocker & Failure Analysis
- When blockers, task non-completions, or failures occur, do not just list them.
- Comprehensively analyze underlying causes (technical dead-ends, scope creep, missing acceptance criteria, architectural bottlenecks, environment discrepancies, or incorrect assumptions).
- Provide actionable workarounds and detailed root-cause reports.
- Suggest relevant engineering and architectural philosophy changes to prevent recurrence

---
## Current state

> **Update this section EVERY SESSION before you stop working. Thirty seconds here saves five minutes of re-orientation next time.**

**Last updated:** `Date: 2026-11-02  Time: 21-11-19 (IST)`

### Verified working
- **P1–P7 are complete;** the current working stage is GST Modernization within POST-P7 — PRE-PRODUCTION VALIDATION.
- **Sales GST acceptance is CLOSED** on a fresh mission-created disposable target (`pharmnos_financial_e2e_salesgst_mvxvql2g9dacd0c0`, `127.0.0.1:55450`, Compose project `pharmnoslite-financial-e2e-salesgst-mvxvql2g9dacd0c0`), campaign run `sales_gst_campaign_1793540554806_5441f9`. All seven application-path scenarios passed with database evidence (GST-014, GST-015, SALES-SUCCESS, PURCHASE-SUCCESS, PURCHASE-GST-REVIEW-GUARD, PAYMENT, GST-016), under restricted runtime role `pharmnos_e2e_runtime` (`LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`, `DELETE` privileges 0), with RLS 33 tables / 84 policies / 16 triggers and immutable-history preserved. The failed-run 0419 target and all pre-existing containers were left untouched; the mission target was disposed at the database level after evidence capture. Corrections: fixture ownership via memberships, single ts-node CJS auth-adapter instance, `gst_treatment` + approved HSN/SAC catalog/rule + accepted line snapshots in fixtures, `DISPOSABLE_TARGET_DISPOSAL` cleanup mode, and new `scripts/sales-gst-acceptance-campaign.mjs` orchestrator. Full JS test suite 231/231, focused 31/31, typecheck, Prisma validate, changed-file ESLint, and `git diff --check` passed. Evidence: `.obsidian-vault/specs/sales-gst-application-evidence-sales_gst_campaign_1793540554806_5441f9.json` (SHA-256 `DAD92EBC006A7008A407DDED4934AF56CFA3C527D1B8AF88425BEF74E4023836`), log SHA-256 `02773131F94B61707B6C689934135C87D335DE868CA6A356D1AD3CCBDB93DDA0`. Independent audit corrected one fabricated `acceptedRunId` field in the evidence JSON (the wrapper-internal contract run ID was never captured) and clarified the GST-015 assertion scope.
- GST calculation and treatment acceptance remains **NOT ACCEPTED** as a complete campaign: 22/25 evidence-supported criteria are verified (16 current-campaign and 6 historical), DGM-T13 and DGM-T19 have `CURRENT RELEASE SCOPE APPROVED — VERSION 2 DEFERRED` decisions but remain `NOT VERIFIED` as independent acceptance criteria, DGM-T25 is `BLOCKED — POLICY`, and no criterion is a verified failure. T25-12 credit/debit-note scope is approved for current-release supplier issuance and recipient-side processing, but no note workflow or implementation is claimed. The authorized 0419 restricted-runtime gap-resolution campaign passed inter-state purchase IGST, POS-negative, Sales retry/conflict/rollback, stale-revision/single-effect posting, tenant isolation, legacy-draft hold, and snapshot assertions; the stale-operation evidence does not prove DGM-T19. Evidence: `.obsidian-vault/specs/gst-calculation-treatment-acceptance-2026-11-01.md` and `.obsidian-vault/specs/gst-calculation-treatment-acceptance-evidence-2026-11-01.json`.
- DGM-T25 engineering implementation is complete for the demonstrated calculator, purchase reconciliation/posting, and ledger arithmetic paths using shared coefficient/scale decimal operations. Focused calculator evidence is 291/291, GST contract regression is 37/37, full JavaScript regression is 231/231, typecheck and changed-file ESLint pass, and T25 database/runtime tests were not run.
- Purchase accepted-value posting integrity is verified on the disposable application path, including 15/15 purchase scenarios, concurrency, rollback, retry, persisted totals, ledger amount, audit metadata, and payload-hash reconciliation.
- SEC-DEC-03 restricted-role database validation, HSN/SAC application governance (12/12), Q15 migration/recovery validation, Prisma validation, typecheck, and the targeted 57-test financial safety/initialization suite passed.
- A fresh authorized loopback target on `127.0.0.1:55435` authenticates with both bootstrap and restricted runtime identities; the runtime role is `LOGIN`, `NOSUPERUSER`, and `NOBYPASSRLS`.
- Restricted-runtime purchase application evidence passed 15/15 scenarios, and Q10 application evidence passed commit/replay, conflict, concurrency, rollback, retry, and persisted single-effect assertions.
- Provisioning now applies tenant-scoped read-only RLS and SELECT grants for `hsn_sac_catalog` and `gst_rate_rules`; provisioning static contracts and GST governance contracts pass.
- The authenticated purchase harness now loads ordinary `DATABASE_URL` configuration and forwards the approved initialization contract. The authorized 0419 disposable target on `127.0.0.1:55435` now authenticates with both bootstrap and restricted runtime credentials.
- Fresh authenticated tenant-context purchase acceptance subsequently passed 15/15 under restricted role `pharmnos_e2e_runtime` (`LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`) on run `purchase_gst_1793518743403_f9d09c`; session subject, active membership, transaction-local claims, cross-tenant rejection, accepted GST posting, idempotency, concurrency, rollback, and retry were verified. Evidence: `.obsidian-vault/specs/purchase-gst-application-evidence-purchase_gst_1793518743403_f9d09c.json`, SHA-256 `C86A89A9EBA9B35A2B02DC5CB63986EBF2132FD546116AE7B5468FA7766655B1`. GST Stage 1 remains open.
- The production-shaped identity mapping is corrected in disposable RLS provisioning: subject-scoped membership, role, and permission policies resolve `request.jwt.claim.sub` through `users.external_id` to internal `users.id`, with active-membership guards and ordinary schema-qualified joins; the earlier SECURITY DEFINER helper was removed.
- Fresh run `purchase_gst_1793519228586_c4e0ac` passed 16/16 scenarios with distinct internal/external IDs, inactive-membership denial, cross-tenant rejection, accepted GST posting, idempotency, concurrency, rollback, retry, and independent transaction-local claim isolation. Restricted runtime was `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`; cleanup verified database absence. Evidence: `.obsidian-vault/specs/purchase-gst-application-evidence-purchase_gst_1793519228586_c4e0ac.json`, SHA-256 `719DE9EEF68ED30CE5263A1A783165674552D9721861DB2616CDC0543492B1D9`.
- Independent security audit confirmed the runtime role can set the request claim GUCs, so forged-claim resistance is not established when arbitrary SQL executes as the runtime role. The architecture decision record adopts a server-only boundary for the intended web threat model while retaining this as an explicit residual risk and security-acceptance gate.
- The corrected trust-boundary audit now uses the restricted runtime URL rather than the bootstrap URL. Runtime evidence confirms `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`, no public schema `CREATE`, no SECURITY DEFINER helper, and reproducible forged-GUC behavior.
- Fresh security regression run `purchase_gst_1793519733253_d9cf5c` passed 16/16 under `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`; cleanup was independently verified. Evidence: `.obsidian-vault/specs/purchase-gst-application-evidence-purchase_gst_1793519733253_d9cf5c.json`, SHA-256 `D494EC8553F4D9A92DB7193BFE12EE2DE9F2DCCC373F4181A8ACB6BDAF80B8AA`.
- Option A verification passed the scoped server-only checks: the fixed-token database health route exposes only `SELECT 1`, no unsafe raw SQL helpers or arbitrary SQL API route were found, and focused trust-boundary/RLS contracts passed 41/41. The financial E2E auth-context adapter now rejects ambiguous active memberships. Typecheck and `git diff --check` passed.
- Purchase finalization now uses the persisted accepted GST snapshot for every accepted source (`SUPPLIER_DECLARED`, `APPLICATION_CALCULATED`, and `EXPLICIT_DECISION`) rather than selecting accepted totals only for explicit decisions. Fresh restricted-runtime run `purchase_gst_1793523621669_dcaf26` passed 16/16 with persisted amount, ledger, audit, payload-hash, concurrency, rollback, retry, and tenant assertions. Evidence SHA-256: `31DB225B62CAB258823F3A69C5B53A8D13AE47CD8AEF9918C450A19D01B49869`.
- The disposable run's pre-mutation schema baseline was captured and verified from the approved local container; backup SHA-256: `B2147A72CD426A2DBAB139B45775C323BE2D0010AD2ABA8B4685E69A598D55CE`. Focused contracts passed 63/63, TypeScript typecheck, Prisma validation, changed-file ESLint, and `git diff --check` passed.
- Independent Purchase GST acceptance found and corrected stale finalized canonical line values: `purchase_invoice_items.line_total` and `gst_amount` now synchronize from the validated accepted snapshot, and accepted posting payload line amounts match those persisted values. Fresh restricted-runtime run `purchase_gst_1793524087997_be4146` passed 16/16 with zero failures; canonical line total `218.34`, canonical GST `27.26`, invoice net `218.34`, supplier ledger credit `218.34`, audit net `218.34`, and payload-hash equality were verified. Evidence SHA-256: `AABF59F913DAF9BA4F748F98CD0BF8FE46E6E6E34A19AF04E35908A94361CFA7`.
- Fresh target-contract Purchase GST run `purchase_gst_1793531037977_0975f5` passed 16/16 with zero failures after repairing the isolated 0419 runtime role from the authorized credential source. Restricted role attributes, schema identity, tenant isolation, rollback/retry behavior, and cleanup absence were verified. Evidence SHA-256: `D56D72072C790FFC1EE40D13C934201BE982C5633C0D16E37419AFA33D6E8D7E`.

### Broken / Blocked
- Direct security-behavior and rollback-recovery scripts remain gated because the checked-in reviewed expectations are explicitly `REVIEW_ONLY_PENDING_OWNER_APPROVAL`; removing the gate would bypass project safeguards.
- Forged `request.jwt.claim.sub` and `request.jwt.claim.tenant_id` resistance remains unverified against arbitrary SQL under the runtime role; do not treat GUC population as JWT authenticity.
- Trusted authentication-to-database boundary decision is recorded in `.obsidian-vault/decisions/authenticated-database-trust-boundary-ADR-2026-11-01.md`; Option A is accepted only for the scoped server-only web threat model. Stronger signed/per-request identity mechanisms remain gated if arbitrary SQL is in scope.
- Restricted-role evidence is recorded in `.obsidian-vault/specs/authenticated-database-trust-boundary-evidence-1793519941211.json` with SHA-256 `FE25C097F16E1A95C4C615E4077339A4FD35075CB61ECA5512FD16724B2262C6`; GST Stage 1 remains open.
- Option A remains limited to the scoped server-only web threat model; the HIGH forged-GUC residual risk is eligible for independent security review but is not closed or claimed as cryptographically fixed.
- Trust-boundary remediation partially hardened Supabase session identity with server-side `getUser()` verification and corrected the review-only RLS alias; live session expiry/tampering evidence remains unverified and the HIGH forged-GUC finding remains open.
- HSN/SAC approval authority requires the owner to choose independent `approve_hsn_catalog` authority or combined `manage_hsn_catalog` plus approval authority.
- Cess, inclusive GST, freight, discount allocation, rounding precedence, discrepancy tolerance, and accepted-GST inventory valuation remain accounting/GST policy blockers or explicit deferrals.
- The disposable container remains operator-owned; do not restart, recreate, or remove it implicitly. Future campaigns must continue using an explicitly authorized target contract.
- Direct security-behavior and rollback-recovery scripts remain separately owner-gated; this authenticated purchase campaign does not close SEC-DEC-03, Q15, or GST Stage 1.
- The same-UT POS fallback defect was corrected in the centralized resolver and purchase supply-fact path; UTGST remains unsupported and no rate/component behavior was added. GST calculation/treatment acceptance remains NOT ACCEPTED while DGM-T25 policy/professional gates and remaining independent/runtime evidence remain open; T25-12 scope approval is recorded separately from note implementation/acceptance.
- Purchase GST financial integrity remains **PARTIALLY ACCEPTED**, not fully closed: the target-bound restricted-runtime application path is verified, while the separate accounting-policy blockers, production rollout/recovery gates, and HIGH forged-GUC residual risk remain open. The repository-supported `pnpm test:gst:calculator` runner now passes 291/291 assertions using installed TypeScript and `ts-node`; no dependency was added.
- Full Purchase GST Financial Integrity acceptance remains blocked by missing ITC eligibility/apportionment lifecycle, freight and discount allocation workflow, and exact statutory rounding precedence. GST Stage 1 remains IN PROGRESS; Production/Live Supabase remains NO-GO.
- Owner-approved GST accounting policy decisions are recorded in `.obsidian-vault/decisions/0003-inventory-gst-valuation-policy.md` through `0008-purchase-gst-discrepancy-tolerance-policy.md`, approved by `Masum Rafique - Owner` at `2026-11-01T14:55:50+05:30`. Non-zero cess and inclusive pricing now fail closed; inventory valuation, freight/allocation, and statutory rounding implementation remain explicitly incomplete.
- Purchase GST completion audit added additive pending valuation fields and fail-closed inventory reporting. Without governed ITC eligibility, recoverability and acquisition cost remain null with status `PENDING`; procurement `purchase_rate` is no longer treated as approved inventory cost. Focused policy/valuation contracts passed 9/9. Evidence: `.obsidian-vault/specs/purchase-gst-financial-integrity-completion-evidence-2026-11-01.json`, SHA-256 `BD56525132F853AE843FECF8853A344220DFD9AC3DB56810C95B064F54944530`.
- The current-release GST credit/debit-note engineering contract is finalized in `.obsidian-vault/specs/gst-credit-debit-note-engineering-contract.md`. It covers supplier issuance, recipient processing, commercial-only adjustments, physical-return separation, data-model requirements, 17 independent state machines, permissions, scenarios A-J, and CDN-01-CDN-27. Contract coverage is 100/100; implementation, runtime verification, independent acceptance, and production authorization remain unverified. DGM-T25 and its 25-row denominator are unchanged.
- Finance Act 2026 Sections 153-155 and the current consolidated CBIC Section 15 page are not synchronized: Notification 03/2026-Central Tax appoints 2026-11-01, while the consolidated page retains a “yet to be notified” footnote. The note contract records this as an effective-dated legal-rule and qualified-review gate; do not enable a post-supply-discount rule from an assumed date.

### Focus right now
- Obtain connected-initialization evidence needed for the direct security/rollback scripts, without changing shared or production credentials.
- Keep the restricted-runtime purchase and Q10 evidence bound to their disposable targets, preserve the fail-closed tenant-context behavior, and do not delete the retained 0419 immutable history without explicit authorization.
- Preserve fail-closed behavior and do not claim restricted-role application evidence from bootstrap or superuser runs.
- Preserve the approved DGM-T13 length-only and DGM-T19 Version 2 deferrals; do not claim their deferred features or independent acceptance. Resolve DGM-T25 precision/rounding precedence before enabling or claiming those workflows.
- Keep credit/debit-note scope limited to the documented supplier-issuance and recipient-processing design; resolve legal source, accounting, schema, reporting/IRP, implementation, restricted-runtime, and independent-acceptance gates before enabling it.
- Keep the Finance Act 2026/CBIC Section 15 source conflict explicit and fail closed until the effective ruleset, transition behavior, and portal synchronization are qualified and approved.
- Keep Regular calculation evidence distinct from blocked Composition, Unregistered, Consumer, UTGST, inclusive, and unresolved precision/rounding work; do not mark GST Stage 1 complete from the 22/25 result.
- Keep production migration, Live Supabase access, deployment, and GST Stage 1 closure at NO-GO pending evidence and approvals.
- Run `& .\sync-agent-briefings.ps1` after this canonical briefing update so generated briefing mirrors reflect the current evidence.
---

## Key decisions made

These are **SETTLED**. Do not reopen them unless there is a very strong, concrete new reason (performance regression, end-of-life announcement, security advisory, etc.).

Record NEW decisions here ONLY after they are finalised AND have an ADR written to `decisions/NNN-slug.md`. Then link the ADR. Format:

- **[Decision label / title]**: [1-sentence summary of what was chosen]. ← ADR: `decisions/NNN-slug.md`
- **Supabase provisioning workflow**: First-time Supabase Free cloud provisioning (schema, RLS, indexes, GRANTs, seed, verify) uses Supabase SQL Editor HTTPS paste of 4 idempotent SQL files (01/04/02/03) instead of Prisma CLI over Supavisor pooler pg-wire path, to avoid opaque P1001 rate-limit diagnosis loops. Prisma CLI retained unchanged for local dev + runtime writes; workaround applied provisioning-only. ← ADR: `decisions/0001-supabase-sql-editor-paste-workaround.md` (Accepted 2026-09-30, implemented end-to-end on project lizyjqkckysgvffwcqvb 2026-09-29)

---

## GST/IGST Capability Findings (Read-Only Audit & Validation)

The following findings are historical observations from the completed read-only GST/IGST capability audit (`.obsidian-vault/specs/gst-igst-capability-audit.md`) and its subsequent validation (`.obsidian-vault/specs/gst-audit-validation-and-plan.md`). They distinguish the original audit findings from later local fixes; the consolidated matrix is the current status source.

1. **The original audit found aggregate-only GST facts** (`gst_amount`) on sales and purchase lines. Current local sales remediation adds nullable CGST, SGST, IGST, cess, and taxable fields; purchase lines remain aggregate-only and database rollout is unverified.
2. **Purchase-side intra-state/inter-state tax handling requires remediation** — current purchase actions compute only aggregate GST with no place-of-supply logic, unlike sales which uses the GST calculator.
3. **The original audit identified state name/code normalization as required.** Current local normalization accepts supported names and codes, while the current sales path still uses the customer billing-state proxy; the accepted policy requires captured supply facts, qualified GST review, implementation approval, and database verification.
4. **Finalized invoices need a stable, recorded place of supply and immutable tax values.** Current local sales remediation adds `place_of_supply_code`, tax components, and snapshots, while legacy records use explicit fallback disclosure and database-backed historical immutability remains unverified.
5. **Draft, finalization, reporting and printing must use consistent tax calculations and rounding** — draft creation uses aggregate line-level rounding while finalization uses the GST calculator's component-level rounding, creating a mismatch masked by a 0.02 tolerance.
6. **Invoice rendering must not recalculate historical tax from mutable current state.** Complete local records prefer persisted tax and snapshot facts; legacy records use current values only as an explicitly disclosed fallback. Historical immutability remains unverified against a database.
7. **GSTIN format validation exists for customer/supplier records** (15-character alphanumeric regex), but **checksum verification is absent**; current business-profile state validation normalizes supported names/codes, while database enforcement remains unverified.
8. **Complete GSTR-1/GSTR-3B filing, e-invoice, e-way bill, RCM, ITC reconciliation, multi-GSTIN, composition and export/SEZ capabilities are not part of the immediate core GST remediation scope** — these remain in the advanced statutory automation backlog. GST credit/debit notes are separately approved current-release scope for supplier issuance and recipient-side processing, but their legal, accounting, schema, reporting/IRP, implementation, runtime, independent-acceptance, and production gates remain open.

> **Note:** The audit's 65/100 score is a subjective assessment, not an objective compliance measurement. Do not present it as such.

---

## File map

`UPDATE THE CORRECT REPO ORDER EVERYTIME THIS FILE IS UPDATED BY TRIAGE PROMPT`

The `.obsidian-vault/` section is FIXED and should not be changed (it's the second brain). Code source folders are examples — edit them to match your project's actual language and layout.


```
project/
├── CLAUDE.md                         # 🔁 MIRROR: Claude Code CLI (Anthropic) auto-load
├── .cursorrules                      # 🔁 MIRROR: Cursor IDE native
├── .windsurfrules                   # 🔁 MIRROR: Windsurf IDE native
├── .github/
│   └── copilot-instructions.md       # 🔁 MIRROR: GitHub Copilot Agent native
├── sync-agent-briefings.ps1          # 🛠️ RUN AFTER editing canonical CLAUDE.md or vault PHASE_TRACKER.md
├── Obsidian Project.code-workspace   # VS Code workspace tuned for the repo / vault
│
├── .obsidian-vault/                  # 🧠 OBSIDIAN VAULT — open this folder in Obsidian (CANONICAL for ALL formal reference/planning docs)
│   ├── CLAUDE.md                     # ✅ CANONICAL AI AGENT BRIEFING SOURCE OF TRUTH (you are here)
│   ├── PHASE_TRACKER.md              # 🎯 CANONICAL CENTRAL PHASE TRACKER: working phases P1…P7 (read first before planning). Current phase: POST-P7 PRE-PRODUCTION VALIDATION
│   ├── prd-technical-architecture.md # 📚 CANONICAL Reference architecture + product planning draft (PRD)
│   ├── ui-screen-concept.md          # 🎨 CANONICAL Reference screen-by-screen UI concept draft
│   ├── OPERATIONAL_GUIDE.md          # 🛠️ CANONICAL Operational how-to / SOPs for vault + CI + deployment
│   ├── DESIGN.md                     # 🎨 CANONICAL Approved visual design system and UI language
│   ├── AGENT.md                      # 🔁 MIRROR: generic "agent" keyword alias
│   ├── AI_BRIEFING.md                # 🔁 MIRROR: generic "briefing" keyword alias
│   ├── 00-inbox.md                   # Capture zone / quick notes / unsorted thoughts
│   ├── daily/                        # Daily working notes
│   ├── specs/                        # Feature specs BEFORE coding (use templates/_template-spec.md)
│   ├── decisions/                    # Architecture Decision Records (ADRs)
│   ├── bugs/                         # Bug reports + investigation notes
│   ├── retro/                        # Milestone retrospectives / lessons learned
│   └── templates/                    # Templater plugin templates (ADR, spec, bug)
│
├── DESIGN.md                         # ⬇️ Convenience project-root MIRROR/shortcut of vault DESIGN.md (edit vault version only; keep root copy in sync manually OR via sync script)
└── .gitignore                        # Git ignore rules for the repo and vault
```

**IMPORTANT — Working Phase Numbering Locked (day-to-day use P1…P7 ONLY. After P7 mention by PRE-PRODUCTION VALIDATION with respective stages.**  
- We use **7 working phases P1 through P7** and after  P7 mention by "PRE-PRODUCTION VALIDATION" with respective stages for all planning, status updates, commit messages, and day-to-day conversation. (Defined fully in `.obsidian-vault/PHASE_TRACKER.md`.)
- The 6 phases (Phase 0…Phase 5) in `.obsidian-vault/prd-technical-architecture.md §29 Suggested Development Phases` are for **historical-reference / PRD coverage mapping only** — they are NOT our day-to-day working numbering. The crosswalk in PHASE_TRACKER.md maps them 1:1 so nobody gets confused.
- Historical context only: `PHASE 4 — PURCHASES + INVENTORY TRANSACTIONS` was an earlier implementation/tracking phase. The active project state is **POST-P7 — PRE-PRODUCTION VALIDATION**, with GST specification review and approval as the current gate.
- ALWAYS USE INDIAN STANDARD TIMING, EVERY WHERE IT IS NEEDED. FOR THE DATE USE `YYYY-MM-DD` AND TIME USE `HH-MM-SS` FORMAT. AND IF ANY FILE NAMING EXPLICITELY NEEDED BOTH DATE AND TIME THEN USE `YYYY-MM-DDTHH-MM-SS` THIS FORMAT.

**IMPORTANT**: Next.js App Router + Prisma application code scaffold is complete (P1 + P2 + P3 shipped). Reference docs live only inside vault `.obsidian-vault/` (project root `reference docs/` folder no longer exists — see Do Not section below).

---

## Do Not

**Stop. Read the linked decision record before suggesting any change in these areas.**

The rules below are the MOST IMPORTANT part of this briefing. They prevent the AI from "helpfully" undoing choices you made deliberately for reasons not obvious from the code alone.

Add rules BELOW the two permanent meta-rules as you lock in decisions. Format each rule: `Do not [X]. [1 sentence WHY]. ← ADR: decisions/NNN-slug.md` (link the ADR if one exists; if not yet written, omit the ADR link but still write the WHY).

**🔒 Permanent meta-rules (always enforced for this second-brain system — do not delete):**
- Do not install Obsidian plugins that store data in a proprietary, non-Markdown format. All notes MUST remain portable plain Markdown so they work in any editor.
- Do not generate any formal documentation, reports, adr, logs in the root folder. Always save them in the respective folders in `.obsidian-vault/`. If you cannot find a matching folder for your unique generated document then create a folder inside `.obsidian-vault/`
- Do not refactor a file "just because it looks like it could be cleaner." Only touch code that is directly related to the specific task being worked on right now.
- Do not edit ANY mirror AI briefing file outside `.obsidian-vault/` (root CLAUDE.md, .cursorrules, .windsurfrules, .github/copilot-instructions.md, AGENT.md, AI_BRIEFING.md). Edit ONLY `.obsidian-vault/CLAUDE.md` then prompt the user to run `& .\sync-agent-briefings.ps1`.
- While pointing to a specific file or folder use relative address. like do not use `E:\PharmnosLite\.obsidian-vault\specs` instead use `.obsidian-vault\specs`

**🛠️ Project-specific hard rules (fill these in as decisions solidify):**
- Do not build the MVP on paid-only infrastructure. The project must stay free-first for initial build, testing, and validation.
- Do not couple core business logic directly to Supabase or Vercel APIs. Keep domain services, repositories, auth, and storage behind provider-independent boundaries so migration later does not require a rewrite.
- Do not drift from `DESIGN.md` into dark, glossy, 3D-heavy, or generic AI-SaaS UI patterns. The approved direction is white canvas, black CTAs, light-gray cards, and real product fragments shown inside cards.
- Do not paste passwords, API keys (SUPABASE_SERVICE_ROLE_KEY, anon JWTs with secret payloads, Stripe sk_live, SendGrid tokens, SMTP passwords), Postgres DATABASE_URL / DIRECT_URL values, `ALTER USER … WITH PASSWORD '…'` literals, or ANY other secret private value from `.env.local` / `.env` / `.env.*.local` files into canonical vault documentation (`.obsidian-vault/**` daily notes, ADRs, bug reports, specs, retros, or this CLAUDE.md) OR into any committed source file. Secrets exist ONLY in gitignored `.env*.local` files, user's password manager, and Supabase dashboard. Use placeholders like `[SET VIA SQL EDITOR — STORE ONLY IN .env.local]` or `<YOUR-PASSWORD>` in docs instead. If ANY secret is found in formal vault docs or committed code, delete it immediately. Example: earlier today a Postgres ALTER USER literal password was found in the daily note and this CLAUDE.md; both were redacted to placeholders. All code paths MUST read secrets via `process.env.*` (already done in `src/adapters/auth/supabase-auth.adapter.ts` + `src/adapters/storage/supabase-storage.adapter.ts` — zero hard-coded values). If you are about to type a value that starts with `postgres://`, `eyJhbGciOi`, or ends with a known key suffix, STOP and use a placeholder.
- Do not create, move, or edit any formal reference/planning documents (PRD architecture, UI concept draft, phase tracker, operational SOPs, design system docs, decision records, bug reports, feature specs, milestone retros, or daily notes) anywhere EXCEPT inside the canonical `.obsidian-vault/` folder. Root project folder (sibling to `src/` / `prisma/`) is ONLY for code, CI, tooling config, and automatic mirrors synced via `& .\sync-agent-briefings.ps1`. Project-root `reference docs/` folder was permanently deleted 2026-09-30; all 2 prior reference files (`prd-technical-architecture.md`, `ui-screen-concept.md`) now live in vault and must be edited there only. This keeps ALL formal docs inside Obsidian GUI search, second-brain graph, and vault git history alongside daily notes/triage prompts.
- Do not create, copy, or edit a `PHASE_TRACKER.md` file at the project root (next to package.json / .gitignore). The ONE canonical working-phase tracker lives at `.obsidian-vault/PHASE_TRACKER.md` and was moved there permanently 2026-09-30 so it lives inside the Obsidian vault graph + triage prompt search index together with bugs/ADRs/specs/retros. Any root `PHASE_TRACKER.md` discovered in future MUST be treated as a stale mirror and deleted, then the vault version referenced. If a convenient shortcut at root is desired for IDE file-openers, use a 1-line Markdown redirect note at root that ONLY links `→ See .obsidian-vault/PHASE_TRACKER.md` — never edit content there. ← ADR: `decisions/0002-trae-agent-git-boundary-rules.md`
- Do not rely on Next.js dev server HMR incremental compile cache to propagate low-level `HTMLAttributes<>` type changes correctly. After any shadcn/ui or base component HTMLAttributes base-type interface change (div→span, label→button, etc.), ALWAYS run full dev cache reset: kill the port-3000 server → delete recursively the entire `.next/` folder with `Remove-Item -Recurse -Force .next` → cold start `pnpm dev`. The Badge div→span HTMLAttributes change 2026-09-30 broke UI twice in same session: first produced unstyled browser-default nav (CSS emit pipeline staleness) and second caused print route HTTP 500 "Cannot find module './vendor-chunks/tailwind-merge@2.6.1.js'" in webpack-runtime.js vendor chunk resolution — wasting 40+ minutes of fake "is this a code bug?" diagnosis. `pnpm build` production compile will pass correctly but dev server must be purged.
- Do not hand-write HTTP smoke route test lists from memory. ALWAYS derive the route list from the filesystem first by globbing `src/app/**/page.tsx` (Next.js App Router convention) so you get the real param slugs `/billing/[invoiceId]/print`, `/customers/[customerId]/statement/print` etc., then substitute demo tenant actual IDs manually. First 35-URL handwritten crawl 2026-09-30 returned 8× 404 wrong paths (`/inventory/products` → actual `/inventory`; `/audit-log` → actual `/audit`; `/reports/customers-dues` → actual `/reports/customer-dues`). Glob-derived 37-URL list 2nd run ALL HTTP 200 zero failures.
- Do not auto-promote ANY operational finding directly to a decisions/ ADR without human review first. TLS proxy workarounds, `.next` cache purge SOPs, phase-count ceiling conventions, HTTP crawl derivation rules — these are local process rules or agent-behavior conventions NOT settled architectural commitments. Promote them to ADR ONLY when: (a) they are expensive/time-consuming enough to warrant a permanent cross-session record AND (b) human says yes explicitly in chat. Otherwise add to THIS Do Not section HERE in `.obsidian-vault/CLAUDE.md` (as we are doing now) so all future agents read them on load — 90% of agent-discipline rules belong here, not in standalone ADR files.
- Do not execute production database migration or historical-data backfill without prior review and explicit approval.
- Never guess historical place of supply where the available evidence is insufficient.
- Do not claim financial runtime verification without actually executing the tests against an isolated database.
- Do not claim complete GST filing compliance merely because core tax calculation and invoice persistence are corrected.
- Do not deploy or commit/push as part of GST remediation without the applicable explicit authorization.
- Do not remove connected-initialization safety gates without fresh target-bound authorization and evidence.
- Do not treat bootstrap or superuser application tests as restricted-role RLS evidence.
---
