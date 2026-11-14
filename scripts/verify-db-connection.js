const { Client } = require('pg');

const bootstrapUrl = process.env.TEST_DATABASE_URL;
const runtimeUrl = process.env.FINANCIAL_E2E_RUNTIME_DATABASE_URL;
// Credentials are never committed: supply them through the environment.
for (const [name, value] of [
  ["TEST_DATABASE_URL", bootstrapUrl],
  ["FINANCIAL_E2E_RUNTIME_DATABASE_URL", runtimeUrl],
]) {
  if (!value) throw new Error(`${name} is required (hardcoded credentials were retired).`);
}

async function testConnection(name, url) {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    const res = await client.query('SELECT current_user, current_database(), version()');
    console.log(`✅ ${name} connected:`);
    console.log(`   User: ${res.rows[0].current_user}`);
    console.log(`   Database: ${res.rows[0].current_database}`);
    console.log(`   Version: ${res.rows[0].version.split(' ')[0]} ${res.rows[0].version.split(' ')[1]}`);
    await client.end();
    return true;
  } catch (e) {
    console.error(`❌ ${name} failed:`, e.message);
    return false;
  }
}

async function main() {
  console.log('=== Database Connection Tests ===\n');
  const bootstrapOk = await testConnection('Bootstrap role (pharmnos_e2e)', bootstrapUrl);
  const runtimeOk = await testConnection('Runtime role (pharmnos_e2e_runtime)', runtimeUrl);
  
  if (bootstrapOk && runtimeOk) {
    console.log('\n✅ Both connections successful');
    process.exit(0);
  } else {
    console.log('\n❌ Connection failed');
    process.exit(1);
  }
}

main();