const { Client } = require('pg');

const bootstrapUrl = process.env.TEST_DATABASE_URL;
if (!bootstrapUrl) throw new Error("TEST_DATABASE_URL is required (hardcoded credentials were retired).");

async function seedRoles() {
  const client = new Client({ connectionString: bootstrapUrl });
  try {
    await client.connect();
    
    const now = new Date().toISOString();
    
    // Insert roles
    await client.query(`
      INSERT INTO roles (id, tenant_id, name, system_role, description, is_default, created_at, updated_at) VALUES
      ('role-admin', 'tenant-a', 'Admin', 'ADMIN', 'Full access', false, NOW(), NOW()),
      ('role-billing', 'tenant-a', 'Billing', 'BILLING', 'Billing operations', false, NOW(), NOW()),
      ('role-inventory', 'tenant-a', 'Inventory', 'INVENTORY', 'Inventory management', false, NOW(), NOW()),
      ('role-manager', 'tenant-a', 'Manager', 'MANAGER', 'Management access', false, NOW(), NOW()),
      ('role-admin-b', 'tenant-b', 'Admin', 'ADMIN', 'Full access', false, NOW(), NOW()),
      ('role-billing-b', 'tenant-b', 'Billing', 'BILLING', 'Billing operations', false, NOW(), NOW()),
      ('role-inventory-b', 'tenant-b', 'Inventory', 'INVENTORY', 'Inventory management', false, NOW(), NOW()),
      ('role-manager-b', 'tenant-b', 'Manager', 'MANAGER', 'Management access', false, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Verify
    const res = await client.query("SELECT id, name, system_role FROM roles");
    console.log('Roles:', res.rows);
    
    await client.end();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

seedRoles();