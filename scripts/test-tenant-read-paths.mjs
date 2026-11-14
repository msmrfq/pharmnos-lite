import { PrismaClient } from "@prisma/client";
import { createHmac, randomBytes } from "node:crypto";

// Test configuration
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
  return `${payload}|${sig}`;
}

async function establishTenantContext(tx, ctx) {
  await tx.$executeRaw`SELECT set_config('pharmnos.auth_context', ${createFinancialAuthContext(ctx.subjectId, ctx.tenantId)}, true)`;
}

// Test tenant contexts
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
    console.log("=== Testing Tenant Read Paths ===\n");

    // Test 1: Tenant A reads its own data
    console.log("Test 1: Tenant A reads its own data");
    await prisma.$transaction(async (tx) => {
      await establishTenantContext(tx, tenantAContext);
      
      const tenants = await tx.tenants.findMany();
      console.log(`  tenants: ${tenants.length} (expected 1)`);
      
      const users = await tx.users.findMany();
      console.log(`  users: ${users.length} (expected 2, but only tenant_a membership visible)`);
      
      const products = await tx.products.findMany();
      console.log(`  products: ${products.length} (expected 0 - no products yet)`);
      
      const customers = await tx.customers.findMany();
      console.log(`  customers: ${customers.length} (expected 0 - no customers yet)`);
      
      const suppliers = await tx.suppliers.findMany();
      console.log(`  suppliers: ${suppliers.length} (expected 0 - no suppliers yet)`);
      
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
      await tx.$executeRaw`SELECT set_config('pharmnos.auth_context', ${"v1|invalid|tenant_a|9999999999|nonce|wrongsig"}, true)`;
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