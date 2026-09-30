---
title: PowerShell 5.1 JSON Quote Stripping on ts-node --compiler-options Inline JSON
date: 2026-09-30
status: Open
---

## Steps to Reproduce
1. On a Windows 10/11 development machine with default PowerShell 5.1 installed (`$PSVersionTable.PSVersion` = 5.1.something).
2. Node, pnpm, ts-node installed at global or project level; tsconfig.json uses module ESNext (project default for Next.js 14).
3. In `package.json scripts`, define a seed command embedding escaped CommonJS JSON compiler options inline:
   ```json
   "db:seed": "ts-node --compiler-options {\\\"module\\\":\\\"CommonJS\\\"} prisma/seed.ts"
   ```
4. Run `pnpm db:seed` in the default Windows PowerShell terminal.

## Expected Behaviour
ts-node receives the parsed JSON `{"module":"CommonJS"}` as its compiler-options override, transpiles prisma/seed.ts with `module: CommonJS` as required for Prisma Client ESM/CJS interop at seed time, seed executes successfully.

## Actual Behaviour
SyntaxError printed to stderr on ts-node invocation:
```
SyntaxError: Expected property name or '}' in JSON at position 1
```
No ts-node transpilation runs. No Prisma seed logic executes even if prerequisites (env vars, DB online) would pass. The same script on Linux/macOS bash or on PowerShell 7+ works.

## Root Cause
Windows PowerShell 5.1 (the version pre-installed on Windows, default terminal profile in most IDEs) strips double-quote characters from argument strings when tokenizing a child-process command line before passing arguments. The escaped inline `{\"module\":\"CommonJS\"}` JSON embedded inside the package.json string is mangled by the time it reaches ts-node's argv parser; position 1 of the resulting string will be either an unquoted identifier or stray whitespace that cannot begin JSON. JSON parser fails before any ts-node code runs.

Note there was also a secondary PowerShell 5.1 incompatibility discovered during diagnosis: ternary conditional operator syntax `$a ? $b : $c` was not added until PowerShell 7+. Any scripts written internally using that syntax will throw `Unexpected token '?' in expression or statement` on default Windows.

## Severity
Low. Fixed one-time by adopting external tsconfig pattern; no recurrence anticipated if project rule is followed. Cost today: ~5 minutes diagnostic + tsconfig creation.

## Remediation Checklist
- [x] `tsconfig.seed.json` created at project root. Extends base `tsconfig.json`, explicitly overrides `compilerOptions.module = CommonJS`, adds `ts-node.transpileOnly = true`, `include: ["prisma/**/*.ts"]`.
- [x] `package.json scripts.db:seed` rewritten to `ts-node --project tsconfig.seed.json prisma/seed.ts`. No inline JSON compiler options. Confirmed Parse OK 0 errors on Windows default 5.1.
- [x] Any internal ad-hoc diagnostic helper scripts authored for Windows must be PS5.1-only compatible (no ternaries). If PS7 features needed, mandate pwsh 7+ in the script header with a version guard throw.
- [ ] Project rule: all ts-node utility script entries in package.json scripts use an external `tsconfig.<script>.json` file extending base tsconfig, never `--compiler-options '{json}'` inline. Add to package.json schema lint list.
