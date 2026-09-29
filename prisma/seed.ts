import { PrismaClient, SystemRole, PermissionAction } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";

const localEnvPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(localEnvPath)) {
  const raw = fs.readFileSync(localEnvPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

function assertPostgresConfigured(context: string): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error(`${context}: DATABASE_URL is unset.`);
  const u = url.toLowerCase();
  if (u.includes("localhost") || u.includes("127.0.0.1") || u.includes("postgres:postgres@")) {
    throw new Error(
      `${context}: DATABASE_URL in .env.local still points to a default local stack. ` +
        `Paste the real Supabase Free Postgres connection strings (URI) into .env.local before seeding. ` +
        `See Supabase Dashboard → Project Settings → Database → Connection string.`,
    );
  }
}

assertPostgresConfigured("prisma/seed.ts");

const prisma = new PrismaClient();

const ALL_PERMISSIONS = Object.values(PermissionAction);

const ROLE_PERMISSION_SETS: Record<SystemRole, PermissionAction[]> = {
  [SystemRole.ADMIN]: ALL_PERMISSIONS,
  [SystemRole.BILLING]: [
    PermissionAction.view_product,
    PermissionAction.view_customer,
    PermissionAction.view_supplier,
    PermissionAction.create_invoice,
    PermissionAction.edit_invoice,
    PermissionAction.view_invoice,
    PermissionAction.finalize_invoice,
    PermissionAction.view_customer_ledger,
    PermissionAction.view_inventory,
  ],
  [SystemRole.INVENTORY]: [
    PermissionAction.view_product,
    PermissionAction.create_product,
    PermissionAction.edit_product,
    PermissionAction.view_customer,
    PermissionAction.view_supplier,
    PermissionAction.create_purchase,
    PermissionAction.edit_purchase,
    PermissionAction.view_purchase,
    PermissionAction.finalize_purchase,
    PermissionAction.view_inventory,
    PermissionAction.adjust_stock,
    PermissionAction.manage_batches,
  ],
  [SystemRole.MANAGER]: [
    PermissionAction.view_product,
    PermissionAction.view_customer,
    PermissionAction.view_supplier,
    PermissionAction.view_purchase,
    PermissionAction.view_invoice,
    PermissionAction.view_inventory,
    PermissionAction.view_customer_ledger,
    PermissionAction.view_supplier_ledger,
    PermissionAction.view_reports,
    PermissionAction.view_audit_log,
  ],
};

async function ensureRolePermissionsForTenant(tenantId: string) {
  for (const role of Object.values(SystemRole)) {
    const roleRow = await prisma.roles.upsert({
      where: { tenant_id_name: { tenant_id: tenantId, name: role } },
      update: {},
      create: {
        tenant_id: tenantId,
        name: role,
        system_role: role,
        is_default: role === SystemRole.ADMIN,
      },
    });

    const permissions = ROLE_PERMISSION_SETS[role];
    for (const action of permissions) {
      await prisma.role_permissions.upsert({
        where: {
          role_id_permission: { role_id: roleRow.id, permission: action },
        },
        update: {},
        create: {
          role_id: roleRow.id,
          permission: action,
        },
      });
    }
  }
}

async function seedDemoTenant() {
  const existing = await prisma.tenants.findUnique({
    where: { slug: "maharashtra-pharma-distributors" },
  });
  if (existing) {
    console.log(`Demo tenant exists (${existing.id}), skipping creation.`);
    await ensureRolePermissionsForTenant(existing.id);
    return existing;
  }

  const tenant = await prisma.tenants.create({
    data: {
      business_name: "Maharashtra Pharma Distributors",
      slug: "maharashtra-pharma-distributors",
      business_profile: {
        create: {
          address_line_1: "Shop 12, Central Market",
          address_line_2: "Near Shivaji Chowk",
          city: "Pune",
          state: "Maharashtra",
          pincode: "411001",
          country: "India",
          gstin: "27AACXX0000B1ZP",
          pan: "AACXX0000B",
          drug_license_no_1: "MH/2008/PH-001234",
          drug_license_no_2: "MH/2008/PH-005678",
          contact_phone: "+91 98 8888 0012",
          contact_email: "accounts@maharashtrapharma.in",
          invoice_prefix: "INV",
          invoice_next_seq: 1,
          purchase_prefix: "PUR",
          purchase_next_seq: 1,
          near_expiry_days: 60,
        },
      },
    },
  });

  console.log(`Created demo tenant: ${tenant.business_name} (${tenant.id})`);
  await ensureRolePermissionsForTenant(tenant.id);

  const demoUser = await prisma.users.upsert({
    where: { email: "owner@maharashtrapharma.in" },
    update: {},
    create: {
      external_id: "demo-rajesh-0001",
      full_name: "Rajesh Kumar",
      email: "owner@maharashtrapharma.in",
      phone: "+91 98 8888 0012",
    },
  });

  const adminRole = await prisma.roles.findUniqueOrThrow({
    where: { tenant_id_name: { tenant_id: tenant.id, name: SystemRole.ADMIN } },
  });

  await prisma.memberships.upsert({
    where: {
      tenant_id_user_id: { tenant_id: tenant.id, user_id: demoUser.id },
    },
    update: { role_id: adminRole.id, status: "active" },
    create: {
      tenant_id: tenant.id,
      user_id: demoUser.id,
      role_id: adminRole.id,
      status: "active",
      invited_by: demoUser.id,
      joined_at: new Date(),
    },
  });

  console.log(`Granted Admin membership to ${demoUser.full_name}.`);
  return tenant;
}

async function main() {
  console.log("Seeding Pharmnos Lite demo tenant & system roles...");
  await seedDemoTenant();
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
