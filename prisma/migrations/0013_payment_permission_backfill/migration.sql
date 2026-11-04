INSERT INTO "role_permissions" ("id", "role_id", "permission")
SELECT
  'payment-write-' || r."id",
  r."id",
  'create_payment'::"PermissionAction"
FROM "roles" AS r
WHERE r."system_role" IN ('ADMIN'::"SystemRole", 'BILLING'::"SystemRole")
ON CONFLICT ("role_id", "permission") DO NOTHING;
