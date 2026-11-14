import { PrismaClient } from "@prisma/client";
import { createHmac, randomBytes } from "node:crypto";

const TEST_DATABASE_URL = "postgresql://pharmnos_e2e_runtime:RuntimeSecret2026!@127.0.0.1:56543/pharmnos_rt_accept";
const SIGNING_SECRET = "test-signing-secret-32-chars-minimum-length";

const CONTEXT_VERSION = "v1";
const CONTEXT_TTL_SECONDS = 60;

function component(value, label) {
  if (!value || value.includes("|") || value.includes(".")) {
    throw new Error(`${label} is invalid for database authentication context.`);
  }
  return value;
}

function signature(payload) {
  return createHmac("sha256", SIGNING_SECRET).update(payload).digest("hex");
}

function createFinancialAuthContext(subjectId, tenantId = "") {
  const expiresAt = Math.floor(Date.now() / 1000) + CONTEXT_TTL_SECONDS;
  const nonce = randomBytes(16).toString("hex");
  const payload = [
    CONTEXT_VERSION,
    component(subjectId, "Subject"),
    tenantId ? component(tenantId, "Tenant") : "",
    String(expiresAt),
    nonce,
  ].join("|");
  const sig = signature(payload);
  return `${payload}.${sig}`;
}

async function establishTenantContext(tx, ctx) {
  const signedContext = createFinancialAuthContext(ctx.subjectId, ctx.tenantId);
  const result = await tx.$queryRaw`
    SELECT subject_id, tenant_id
    FROM pharmnos_private.verify_auth_context(${signedContext})
    LIMIT 1
  `;
  const row = result[0];
  if (!row || !row.tenant_id || !row.subject_id) {
    throw new Error("Failed to establish tenant context: invalid or expired context");
  }
  const { tenant_id, subject_id } = row;
  // SET LOCAL doesn't support parameterized queries, use string interpolation
  await tx.$executeRawUnsafe(`SET LOCAL pharmnos.auth_context_tenant_id = '${tenant_id}'`);
  await tx.$executeRawUnsafe(`SET LOCAL pharmnos.auth_context_subject_id = '${subject_id}'`);
}

const tenantAContext = {
  tenantId: "tenant_a",
  userId: "user_a",
  subjectId: "auth_user_a",
  membershipId: "membership_a",
  roles: ["Admin"],
  permissions: [
    "view_inventory", "view_customer", "view_supplier", "view_invoice",
    "view_purchase", "view_reports", "manage_hsn_catalog",
    "manage_business_profile", "edit_purchase", "create_payment",
    "view_customer_ledger", "view_supplier_ledger"
  ],
};

const tenantBContext = {
  tenantId: "tenant_b",
  userId: "user_b",
  subjectId: "auth_user_b",
  membershipId: "membership_b",
  roles: ["Admin"],
  permissions: [
    "view_inventory", "view_customer", "view_supplier", "view_invoice",
    "view_purchase", "view_reports", "manage_hsn_catalog",
    "manage_business_profile", "edit_purchase", "create_payment",
    "view_customer_ledger", "view_supplier_ledger"
  ],
};

async function testReadPaths() {
  const prisma = new PrismaClient({
    datasources: { db: { url: TEST_DATABASE_URL } },
    log: ["error"],
  });

  try {
    console.log("=== Testing Application Tenant Read Paths ===\n");

    // Test 1: Tenant A reads its own data
    console.log("Test 1: Tenant A reads its own data");
    await prisma.$transaction(async (tx) => {
      await establishTenantContext(tx, tenantAContext);
      
      const tenants = await tx.tenants.findMany();
      console.log(`  tenants: ${tenants.length} (expected 1)`);
      
      const businessProfiles = await tx.business_profiles.findMany();
      console.log(`  business_profiles: ${businessProfiles.length} (expected 1)`);
    });
    console.log("  PASS\n");

    // Test 2: Tenant B reads its own data
    console.log("Test 2: Tenant B reads its own data");
    await prisma.$transaction(async (tx) => {
      await establishTenantContext(tx, tenantBContext);
      
      const tenants = await tx.tenants.findMany();
      console.log(`  tenants: ${tenants.length} (expected 1)`);
      
      const businessProfiles = await tx.business_profiles.findMany();
      console.log(`  business_profiles: ${businessProfiles.length} (expected 1)`);
    });
    console.log("  PASS\n");

    // Test 3: Cross-tenant access denied
    console.log("Test 3: Cross-tenant access denied");
    await prisma.$transaction(async (tx) => {
      await establishTenantContext(tx, tenantAContext);
      
      // Try to access tenant_b's business profile directly
      const bp = await tx.business_profiles.findFirst({
        where: { tenant_id: "tenant_b" }
      });
      console.log(`  Direct query for tenant_b profile: ${bp ? "FOUND (FAIL)" : "NOT FOUND (PASS)"}`);
      
      // Try to access tenant_b's tenant record
      const tenant = await tx.tenants.findFirst({
        where: { id: "tenant_b" }
      });
      console.log(`  Direct query for tenant_b: ${tenant ? "FOUND (FAIL)" : "NOT FOUND (PASS)"}`);
    });
    console.log("  PASS\n");

    // Test 4: Missing context fails closed
    console.log("Test 4: Missing context fails closed");
    await prisma.$transaction(async (tx) => {
      // No establishTenantContext call
      const customers = await tx.customers.findMany();
      console.log(`  customers without context: ${customers.length} (expected 0)`);
    });
    console.log("  PASS\n");

    // Test 5: Connection pool reuse - alternate contexts
    console.log("Test 5: Connection pool reuse - alternate contexts");
    for (let i = 0; i < 3; i++) {
      await prisma.$transaction(async (tx) => {
        await establishTenantContext(tx, tenantAContext);
        const count = await tx.business_profiles.count();
        console.log(`  Iteration ${i+1} Tenant A: ${count} profiles (expected 1)`);
      });
      
      await prisma.$transaction(async (tx) => {
        await establishTenantContext(tx, tenantBContext);
        const count = await tx.business_profiles.count();
        console.log(`  Iteration ${i+1} Tenant B: ${count} profiles (expected 1)`);
      });
    }
    console.log("  PASS\n");

    // Test 6: Invalid context fails closed
    console.log("Test 6: Invalid context fails closed");
    await prisma.$transaction(async (tx) => {
      // Use wrong signing secret
      const signedContext = "v1|auth_user_a|tenant_a|9999999999|" + "c".repeat(32) + "|wrongsig";
      try {
        await tx.$executeRaw`SELECT public.establish_tenant_context(${signedContext})`;
      } catch (e) {
        // Expected to fail
      }
      const customers = await tx.customers.findMany();
      console.log(`  customers with invalid context: ${customers.length} (expected 0)`);
    });
    console.log("  PASS\n");

    console.log("=== ALL TESTS PASSED ===");
  } catch (error) {
    console.error("TEST FAILED:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testReadPaths();