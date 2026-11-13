const { Client } = require('pg');

const bootstrapUrl = 'postgresql://pharmnos_e2e:ZczIugoskl79BAvF6OtbXKxrNaME80R4@127.0.0.1:56221/pharmnos_verify_verify-20261113174144?application_name=pharmnos-financial-e2e';
const runtimeUrl = 'postgresql://pharmnos_e2e_runtime:5a7D8NJ9obQGHwZ1fdzVqyl3Ytn0CErh@127.0.0.1:56221/pharmnos_verify_verify-20261113174144?application_name=pharmnos-financial-e2e';

const SIGNING_SECRET = 'zDOuIQVy9U65b8LmsFWaBqeSHdjTJ3khY2RxloEMgAwtGPKir1vZnCpcXN470f';
const CRYPTO = require('crypto');

function createContext(subjectId, tenantId) {
  const expiresAt = Math.floor(Date.now() / 1000) + 60;
  const nonce = CRYPTO.randomBytes(16).toString('hex');
  const payload = `v1|${subjectId}|${tenantId}|${expiresAt}|${nonce}`;
  const signature = CRYPTO.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

async function runWithContext(client, context, testFn) {
  await client.query('BEGIN');
  try {
    await client.query(`SELECT set_config('pharmnos.auth_context', $1, true)`, [context]);
    const result = await testFn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

async function runWithoutContext(client, testFn) {
  await client.query('BEGIN');
  try {
    const result = await testFn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

async function main() {
  const bootstrapClient = new Client({ connectionString: bootstrapUrl });
  const runtimeClient = new Client({ connectionString: runtimeUrl });
  
  try {
    await bootstrapClient.connect();
    await runtimeClient.connect();
    console.log('=== Debug Context Isolation ===\n');
    
    // Clean up
    console.log('Cleaning up...');
    await runWithoutContext(bootstrapClient, async (c) => {
      await c.query("DELETE FROM customers WHERE id = 'tx-cust'");
    });
    
    // Insert test data with bootstrap
    console.log('\nStep 1: Insert test data with bootstrap role...');
    await runWithoutContext(bootstrapClient, async (c) => {
      await c.query("DELETE FROM customers WHERE id = 'tx-cust'");
      await c.query("INSERT INTO customers (id, tenant_id, business_name, created_at, updated_at) VALUES ('tx-cust', 'tenant-a', 'Transaction Test', NOW(), NOW())");
    });
    console.log('Inserted tx-cust with bootstrap role');
    
    // Check with bootstrap
    await runWithoutContext(bootstrapClient, async (c) => {
      const bootstrapCheck = await c.query("SELECT id, tenant_id FROM customers WHERE id = 'tx-cust'");
      console.log(`Bootstrap check: ${bootstrapCheck.rows.length} rows`);
      bootstrapCheck.rows.forEach(r => console.log(`  ${r.id} - tenant: ${r.tenant_id}`));
    });
    
    // Check with runtime + context (same connection, same transaction)
    console.log('\nChecking with runtime role + context (same tx)...');
    const testContext = createContext('ext-user-a', 'tenant-a');
    console.log(`  Generated context: ${testContext}`);
    const visible = await runWithContext(runtimeClient, testContext, async (c) => {
      const res = await c.query("SELECT id, tenant_id FROM customers WHERE id = 'tx-cust'");
      console.log(`  Rows found: ${res.rows.length}`);
      res.rows.forEach(r => console.log(`  ${r.id} - tenant: ${r.tenant_id}`));
      return res.rows.length === 1;
    });
    console.log(`  ${visible ? '✅ PASS' : '❌ FAIL'} - Data visible with runtime role + context`);
    
    // Check what financial_context_tenant_id returns
    const ctxCheck = await runtimeClient.query(`SELECT public.financial_context_tenant_id() as tenant_id`);
    console.log(`  financial_context_tenant_id() without context: ${ctxCheck.rows[0]?.tenant_id || 'NULL'}`);
    
    // Also check with runtime + context using financial_context_tenant_id
    console.log('\nChecking financial_context_tenant_id() WITH context...');
    const ctxWithContext = await runWithContext(runtimeClient, testContext, async (c) => {
      const res = await c.query(`SELECT public.financial_context_tenant_id() as tenant_id`);
      console.log(`  financial_context_tenant_id(): ${res.rows[0]?.tenant_id || 'NULL'}`);
      return res.rows[0]?.tenant_id;
    });
    
    // Also check with bootstrap to confirm data exists
    await runWithoutContext(bootstrapClient, async (c) => {
      const bootstrapVerify = await c.query("SELECT id, tenant_id FROM customers WHERE id = 'tx-cust'");
      console.log(`\nBootstrap verification: ${bootstrapVerify.rows.length} rows`);
      bootstrapVerify.rows.forEach(r => console.log(`  ${r.id} - tenant: ${r.tenant_id}`));
    });
    
    await runtimeClient.end();
    await bootstrapClient.end();
    
    return visible && ctxWithContext === 'tenant-a';
  } catch (e) {
    console.error('Test error:', e);
    return false;
  }
}

main().then(success => {
  console.log(`\n${success ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  process.exit(success ? 0 : 1);
}).catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});