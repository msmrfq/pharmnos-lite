const { Client } = require('pg');

const bootstrapUrl = 'postgresql://pharmnos_e2e:ZczIugoskl79BAvF6OtbXKxrNaME80R4@127.0.0.1:56221/pharmnos_verify_verify-20261113174144?application_name=pharmnos-financial-e2e';

async function seedRoles() {
  const client = new Client({ connectionString: 'postgresql://pharmnos_e2e:ZczIugoskl79BAvF6OtbXKxrNaME80R4@127.0.0.1:56221/pharmnos_verify_verify-20261113174144?application_name=pharmnos-financial-e2e' });
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