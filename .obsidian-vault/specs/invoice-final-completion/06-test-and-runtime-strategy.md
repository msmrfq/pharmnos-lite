# Test and Runtime Strategy

Focused contracts cover invoice lifecycle, snapshots, print output, provisioning, and target binding. The full JavaScript regression suite passed 286/286. TypeScript, Prisma validation with loopback placeholders, changed-file lint, production build, and whitespace checks passed.

Runtime verification used only a newly created contract-bound disposable PostgreSQL target. Browser and storage tests require an isolated authenticated application environment; production/shared credentials are prohibited and were not substituted.
