const { Client } = require('pg');

const bootstrapUrl = process.env.TEST_DATABASE_URL;
if (!bootstrapUrl) throw new Error("TEST_DATABASE_URL is required (hardcoded credentials were retired).");

async function checkRoles() {
  const client = new Client({ connectionString: bootstrapUrl });
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