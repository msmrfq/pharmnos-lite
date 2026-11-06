# Migration Execution Evidence

Sequential execution completed on the disposable target. Prisma applied all 20 migrations, including `0017`, `0018`, `0019`, and `0020`; `_prisma_migrations` read-back reported 20 finished migrations.

Two in-scope defects were found and corrected:

1. `0018` referenced `(suppliers.tenant_id, suppliers.id)` before a matching unique index existed. The composite unique index now occurs before the foreign key.
2. `0020` assumed the Supabase `authenticated` role existed. A no-login role bootstrap guard now keeps the RLS migration portable to the plain disposable PostgreSQL target without weakening the `TO authenticated` policy.

After recovery of the failed disposable migration records, the corrected chain completed successfully. The target was then disposed through the contract-bound cleanup path.
