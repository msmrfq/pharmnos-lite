const { Client } = require('pg');

const bootstrapUrl = 'postgresql://pharmnos_e2e:ZczIugoskl79BAvF6OtbXKxrNaME80R4@127.0.0.1:56221/pharmnos_verify_verify-20261113174144?application_name=pharmnos-financial-e2e';

async function checkRoles() {
  const client = new Client({ connectionString: 'postgresql://pharmnos_e2e:ZczIugoskl79BAvF6OtbXKxrNaME80R4@127.0.0.1:56221/pharmnos_verify_verify-20261113174144?application_name=pharmnos-financial-e2e' });
  try {
    await client.connect();
    const res = await client.query("SELECT id, name, system_role FROM roles");
    console.log('Roles:', res.rows);
    await client.end();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

checkRoles();