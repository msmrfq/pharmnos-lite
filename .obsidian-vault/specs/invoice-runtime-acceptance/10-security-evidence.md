# Security Evidence

Current source contains tenant-scoped authorization, supplier-document RLS migration coverage, private storage adapter checks, restricted financial-E2E runtime-role requirements, and fail-closed target contracts. The disposable migration checkpoint verified `LOGIN=true`, `NOSUPERUSER=true`, and `NOBYPASSRLS=true` for the runtime role.

Target-bound runtime probes verified restricted-role attributes, private PDF and supplier-document read-back, and application-level cross-tenant denial for both artifact classes. The supplier-document replacement path preserved historical linkage and active-document guards.

Independent security review rejected acceptance and identified a residual HIGH concern: direct Supabase RLS authorization based on JWT tenant claims may outlive membership revocation unless session/token invalidation is proven.

The controlled probes used the authorized disposable target only. No secrets, production credentials, or shared database access were used. Session revocation/token freshness remains outside the verified evidence set.
