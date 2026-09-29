-- =====================================================================
-- Pharmnos Lite — Step 3/3: Post-seed verification (paste after 02-seed succeeds)
-- Paste into Supabase Dashboard SQL Editor → Run.
-- Returns 3 result grids. Copy-paste them back (or screenshot them all).
-- Expected values are derived from prisma/seed.ts source (the canonical ROLE_PERMISSION_SETS).
-- =====================================================================

-- Grid A — 5 global count assertions
SELECT 'tenants'     AS "table", COUNT(*)::INTEGER                            AS "actual", 1 AS "expected" FROM public.tenants
UNION ALL SELECT 'roles',            COUNT(*)::INTEGER                            AS "actual", 4 FROM public.roles
UNION ALL SELECT 'role_permissions', COUNT(*)::INTEGER                            AS "actual", 59 FROM public.role_permissions
UNION ALL SELECT 'users',            COUNT(*)::INTEGER                            AS "actual", 1 FROM public.users
UNION ALL SELECT 'memberships',      COUNT(*)::INTEGER                            AS "actual", 1 FROM public.memberships
ORDER BY 1;

-- Grid B — per-role permission matrix actual vs seed.ts ROLE_PERMISSION_SETS
SELECT
  r.name AS "role",
  COUNT(rp.id)::INTEGER AS "actual_permissions",
  CASE r.name
    WHEN 'ADMIN'     THEN 28
    WHEN 'BILLING'   THEN 9
    WHEN 'INVENTORY' THEN 12
    WHEN 'MANAGER'   THEN 10
  END AS "expected_permissions",
  COUNT(rp.id)::INTEGER = CASE r.name
    WHEN 'ADMIN'     THEN 28
    WHEN 'BILLING'   THEN 9
    WHEN 'INVENTORY' THEN 12
    WHEN 'MANAGER'   THEN 10
  END AS "matches_expected"
FROM public.roles r
LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
WHERE r.tenant_id = (SELECT id FROM public.tenants WHERE slug = 'maharashtra-pharma-distributors')
GROUP BY r.name
ORDER BY (
  CASE r.name
    WHEN 'ADMIN'     THEN 1
    WHEN 'BILLING'   THEN 2
    WHEN 'INVENTORY' THEN 3
    WHEN 'MANAGER'   THEN 4
    ELSE 99
  END
);

-- Grid C — drill-down: tenant + admin user + admin membership
SELECT 'tenant' AS "drilldown", business_name, slug, id, NULL::TEXT AS "email", NULL::TEXT AS "role_name", NULL::TEXT AS "status"
FROM public.tenants WHERE slug = 'maharashtra-pharma-distributors'
UNION ALL
SELECT 'admin_user', full_name AS "business_name", external_id AS "slug", id, email, NULL, NULL
FROM public.users WHERE email = 'owner@maharashtrapharma.in'
UNION ALL
SELECT 'admin_membership', NULL, NULL, m.id, u.email, r.name, m.status
FROM public.memberships m
JOIN public.users u      ON u.id = m.user_id
JOIN public.roles r      ON r.id = m.role_id
JOIN public.tenants t    ON t.id = m.tenant_id
WHERE t.slug = 'maharashtra-pharma-distributors'
  AND u.email = 'owner@maharashtrapharma.in';
