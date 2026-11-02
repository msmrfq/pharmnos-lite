# Sales GST Independent Acceptance Audit — 2026-11-01 (Corrected)

**Decision: B — SALES GST ACCEPTED — DOCUMENTATION CORRECTED, LIMITED EVIDENCE CAVEATS**

Audit timestamp: `2026-11-01T19:28:54+05:30` · Final evidence-review timestamp: `2026-11-01T19:38:13+05:30`
Audited campaign: `sales_gst_campaign_1793540554806_5441f9`

A follow-up owner review identified four documentation/provenance issues. This
revision corrects them without changing any scenario result, code, schema, or
runtime evidence.

## Four-issue resolution table

| # | Issue | Finding | Correction |
|---|---|---|---|
| A | Misleading Git-state reporting | The prior report said "Git state altered: NO", which is only true for Git *operations* performed by the review. Working-tree files were modified during the audit, and the index staging state changed externally during the review window. | Git-state section now distinguishes working-tree changes, external index/staging changes, commits, and preservation of pre-existing work. |
| B | Original campaign artifacts missing from the evidence package | The original log and summary JSON existed only in the session-state directory and were referenced by path; the summary JSON hash was never recorded. | Both original files were copied verbatim into `.obsidian-vault/specs/`; SHA-256 recorded for both; hashes match the originals. |
| C | Ambiguous disposal sequence | The report mixed the child runner's `FIXTURE-DISPOSAL=DATABASE_LEVEL_DEFERRED` line with the parent orchestrator's actual disposal. | Disposal section now separates requested / deferred / executed / verified, with the exact owner and evidence for each stage. |
| D | Sales vs Purchase scope | Purchase-related scenario PASSes could be misread as full Purchase GST acceptance. | A scope section now states the primary objective, the exact integration/guard meaning of the purchase scenarios, and what they do NOT establish. |

## Evidence package

| Artifact | Path | SHA-256 | Verified |
|---|---|---|---|
| Campaign log (original) | `C:\Users\Masum Rafique\.copilot\session-state\36655790-940b-43b8-a4bc-ed460b133e52\files\sales-gst-acceptance-mvxvql2g9dacd0c0.log` | `02773131F94B61707B6C689934135C87D335DE868CA6A356D1AD3CCBDB93DDA0` | matches |
| Campaign log (package copy) | `.obsidian-vault/specs/sales-gst-acceptance-mvxvql2g9dacd0c0.log` | `02773131F94B61707B6C689934135C87D335DE868CA6A356D1AD3CCBDB93DDA0` | byte-identical |
| Campaign summary (original) | `C:\Users\Masum Rafique\.copilot\session-state\36655790-940b-43b8-a4bc-ed460b133e52\files\sales-gst-acceptance-mvxvql2g9dacd0c0.json` | `141AE506B053722E9EB3FCC89F347A9B0B235B0ED73F91570F3C03DB62ADF2AD` | matches |
| Campaign summary (package copy) | `.obsidian-vault/specs/sales-gst-acceptance-mvxvql2g9dacd0c0.json` | `141AE506B053722E9EB3FCC89F347A9B0B235B0ED73F91570F3C03DB62ADF2AD` | byte-identical |
| Acceptance evidence JSON | `.obsidian-vault/specs/sales-gst-application-evidence-sales_gst_campaign_1793540554806_5441f9.json` | `DAD92EBC006A7008A407DDED4934AF56CFA3C527D1B8AF88425BEF74E4023836` | recorded in CLAUDE.md |
| Acceptance evidence Markdown | `.obsidian-vault/specs/sales-gst-acceptance-evidence-2026-11-01.md` | `154165B4F289D42E263888CDD59216C05A5965F0CC8B5615BAB3FC462C7B7CE0` | — |
| Audit evidence JSON (corrected) | `.obsidian-vault/specs/sales-gst-acceptance-audit-evidence-2026-11-01.json` | `6C20F9F83550BAE90D711355A9B876F6DAA7DFF194E6C7F417FFB87DAE780FDC` | computed after final correction |

## Git state (Issue A — corrected)

Four distinct facts, each verified against the saved before-audit snapshot and
the current repository status:

1. **Git operations by this review (staging, unstage, commits, reset, checkout,
   stash): NONE.** No `git add`, `git commit`, `git reset`, `git checkout`, or
   `git stash` was performed. `HEAD` remained `f2ead14` on branch `main`.
   **However, the index staging state changed during the review window by an
   external actor:** at review start the two evidence files, the campaign
   script, and the audit files were untracked/unstaged; by review end several
   of them were observed staged (`A`/`AM`). This review reports that state
   as-is and changed nothing in the index.
2. **Working-tree files changed during the audit: YES — three files, all
   evidence documentation:** the acceptance evidence JSON (removed the
   fabricated `acceptedRunId`, clarified GST-015), the acceptance evidence
   Markdown (same corrections), and `.obsidian-vault/CLAUDE.md` (updated
   evidence hash and audit note; briefing mirrors re-synced). This final
   review adds the audit report corrections and the two package copies.
3. **Pre-existing user work: PRESERVED.** The before-audit snapshot listed
   the pre-existing modified and untracked files (six briefing mirrors,
   three scripts, two tests, two vault evidence files, the campaign
   orchestrator). None of them were overwritten, deleted, staged, or
   reverted; the same set is present after the audit, plus the
   audit-created documentation.
4. **A clean working tree never existed** at any point in this review; the
   baseline was never clean. The earlier statement "Git state altered: NO"
   was accurate only for Git operations and was misleading as a description
   of the working tree. It is hereby replaced by the distinctions above.

## Disposal sequence (Issue C — corrected)

Four distinct stages with their owners and evidence:

1. **Disposal requested:** the child acceptance runner did not request
   deletion; it emitted `FIXTURE-DISPOSAL=DATABASE_LEVEL_DEFERRED` and
   `IMMUTABLE-HISTORY=PRESERVED_NOT_DELETED`, meaning its own row-level
   fixture cleanup was deliberately skipped in favor of database-level
   disposal owned by the parent.
2. **Disposal deferred:** therefore the *runner* deferred row-level cleanup
   to the *parent orchestrator*; the orchestrator did not defer anything —
   it is the owner of disposal.
3. **Disposal executed:** the orchestrator (`scripts/sales-gst-acceptance-campaign.mjs`)
   ran `docker compose --env-file <campaign-env> -p <unique-project> -f
   docker-compose.financial-e2e.yml --profile financial-e2e down --volumes
   --remove-orphans --timeout 5` after capturing evidence, and recorded
   `disposed: true` only when that command exited 0.
4. **Disposal verified:** the orchestrator then checked
   `docker ps -a --filter label=com.docker.compose.project=<unique-project>`
   returned no containers and recorded `disposalVerified: true` in the
   campaign summary JSON at disposal time. The current absence of any
   `salesgst` container in `docker ps -a` is corroborating evidence only,
   not the sole basis.
5. **Pre-existing resources protected:** the orchestrator's Compose commands
   were scoped to its unique project name and env file only; current
   `docker ps -a` still shows the pre-existing 0417/0418/**0419**/sales-170245/
   sales-170345/55432 containers unchanged.
6. **Limitation:** the orchestrator's console lines
   (`TARGET_DISPOSAL=VERIFIED`, `SALES-GST-CAMPAIGN=COMPLETE`) exist only in
   the session tool transcript, not in the archived log file. The persisted
   machine-readable evidence is the summary JSON's `disposed: true` and
   `disposalVerified: true` fields, hash-verified above.

## Campaign scope (Issue D — clarified)

- **Primary acceptance objective:** Sales GST application acceptance —
  scenarios GST-014, SALES-SUCCESS, GST-016, and the sales side of PAYMENT.
- **Purchase-related scenarios included:** PURCHASE-SUCCESS,
  PURCHASE-GST-REVIEW-GUARD, and GST-015 are integration and regression-guard
  coverage exercised in the same campaign. Their PASS results apply only to
  the exact behaviors and assertions exercised (posting, ledger, rollback,
  review-guard fail-closed).
- **Not established by these scenarios:** full Purchase GST modernization,
  ITC eligibility/apportionment lifecycle, freight/discount allocation,
  statutory rounding precedence, or any other broader Purchase GST
  requirement. These remain open workstreams.
- The campaign is therefore accurately described as "Sales GST application
  acceptance with purchase integration/guard coverage", not as Sales-only
  execution and not as Purchase GST acceptance.

## Scenario results (unchanged)

All seven scenario groups remain `VERIFIED PASS`, each traceable to its
`PASS_APPLICATION_PATH_DATABASE_E2E` line in the hash-verified campaign log:
GST-014, GST-015, SALES-SUCCESS, PURCHASE-SUCCESS, PURCHASE-GST-REVIEW-GUARD,
PAYMENT, GST-016. No scenario result was changed by this review.

## Test claims (unchanged, independently re-run in the prior audit)

Focused 31/31 · Full JS suite 231/231 (32 files) · `tsc --noEmit` exit 0 ·
`prisma validate` exit 0 · changed-file ESLint exit 0 ·
`git diff --check` exit 0.

## Remaining limitations (explicit, not hidden)

- The acceptance wrapper's internal target-contract run ID was never captured
  by any artifact (`NOT_CAPTURED`); only the campaign run ID is known.
- `tests/gst-calculator.test.ts` cannot run via `node --test` (extensionless
  `.ts` import; `tsx` not installed). Not counted as passing.
- Orchestrator console disposal lines exist only in the session transcript;
  the persisted disposal evidence is the summary JSON fields.

## Not marked complete by this audit

Overall GST Stage 1, Purchase GST modernization, ITC lifecycle, invoice
modernization, Live Supabase rollout, and production readiness remain out of
scope and unverified.

## Final artifact hashes (post-correction)

- Audit evidence JSON: `6C20F9F83550BAE90D711355A9B876F6DAA7DFF194E6C7F417FFB87DAE780FDC`
- Campaign log (original and package copy): `02773131F94B61707B6C689934135C87D335DE868CA6A356D1AD3CCBDB93DDA0`
- Campaign summary (original and package copy): `141AE506B053722E9EB3FCC89F347A9B0B235B0ED73F91570F3C03DB62ADF2AD`
- Acceptance evidence JSON: `DAD92EBC006A7008A407DDED4934AF56CFA3C527D1B8AF88425BEF74E4023836`
- Acceptance evidence Markdown: `154165B4F289D42E263888CDD59216C05A5965F0CC8B5615BAB3FC462C7B7CE0`

**Production readiness: NOT IMPLIED.**

