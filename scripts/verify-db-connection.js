const { Client } = require('pg');

const bootstrapUrl = 'postgresql://pharmnos_e2e:ZczIugoskl79BAvF6OtbXKxrNaME80R4@127.0.0.1:56221/pharmnos_verify_verify-20261113174144?application_name=pharmnos-financial-e2e';
const runtimeUrl = 'postgresql://pharmnos_e2e_runtime:5a7D8NJ9obQGHwZ1fdzVqyl3Ytn0CErh@127.0.0.1:56221/pharmnos_verify_verify-20261113174144?application_name=pharmnos-financial-e2e';

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