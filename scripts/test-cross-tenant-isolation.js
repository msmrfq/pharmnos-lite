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
  try {
    await client.query(`SELECT set_config('pharmnos.auth_context', $1, true)`, [context]);
    const result = await testFn(client);
    await client.query(`SELECT set_config('pharmnos.auth_context', '', true)`);
    return result;
  } catch (e) {
    try {
      await client.query(`SELECT set_config('pharmnos.auth_context', '', true)`);
    } catch (_) {}
    throw e;
  }
}

async function testCrossTenantIsolation() {
  const client = new Client({ connectionString: runtimeUrl });
  try {
    await client.connect();
    console.log('=== Cross-Tenant Isolation Tests ===\n');
    
    // First, create two tenants with data using bootstrap role
    const bootstrapClient = new Client({ connectionString: bootstrapUrl });
    await bootstrapClient.connect();
    
    const now = new Date().toISOString();
    
    // Create two tenants
    await bootstrapClient.query(`DELETE FROM tenants WHERE id IN ('tenant-a', 'tenant-b')`);
    await bootstrapClient.query(`
      INSERT INTO tenants (id, slug, business_name, created_at, updated_at) VALUES 
      ('tenant-a', 'tenant-a', 'Tenant A', '${now}', '${now}'),
      ('tenant-b', 'tenant-b', 'Tenant B', '${now}', '${now}')
    `);
    
    // Create users for each tenant
    await bootstrapClient.query(`DELETE FROM users WHERE id IN ('user-a', 'user-b')`);
    await bootstrapClient.query(`
      INSERT INTO users (id, external_id, email, created_at, updated_at) VALUES 
      ('user-a', 'ext-user-a', 'usera@test.com', '${now}', '${now}'),
      ('user-b', 'ext-user-b', 'userb@test.com', '${now}', '${now}')
    `);
    
    // Create memberships
    await bootstrapClient.query(`DELETE FROM memberships WHERE id IN ('mem-a', 'mem-b')`);
    await bootstrapClient.query(`
      INSERT INTO memberships (id, tenant_id, user_id, role_id, status, created_at, updated_at) VALUES
      ('mem-a', 'tenant-a', 'user-a', (SELECT id FROM roles WHERE system_role = 'ADMIN' AND tenant_id = 'tenant-a' LIMIT 1), 'active', '${now}', '${now}'),
      ('mem-b', 'tenant-b', 'user-b', (SELECT id FROM roles WHERE system_role = 'ADMIN' AND tenant_id = 'tenant-b' LIMIT 1), 'active', '${now}', '${now}')
    `);
    
    // Insert test data for tenant-a
    await bootstrapClient.query(`
      INSERT INTO customers (id, tenant_id, business_name, receivable_balance, created_at, updated_at) VALUES
      ('cust-a1', 'tenant-a', 'Customer A1', 1000, '${now}', '${now}'),
      ('cust-a2', 'tenant-a', 'Customer A2', 2000, '${now}', '${now}')
    `);
    
    // Insert test data for tenant-b
    await bootstrapClient.query(`
      INSERT INTO customers (id, tenant_id, business_name, receivable_balance, created_at, updated_at) VALUES
      ('cust-b1', 'tenant-b', 'Customer B1', 3000, '${now}', '${now}')
    `);
    
    await bootstrapClient.end();
    
    console.log('✅ Test fixtures created for tenant-a and tenant-b\n');
    
    // Now test with runtime role
    const tests = [];
    
    // Test 1: Tenant A can read its own customers
    const ctxA = createContext('ext-user-a', 'tenant-a');
    const test1 = await runWithContext(client, ctxA, async (c) => {
      const res = await c.query('SELECT id, business_name FROM customers ORDER BY id');
      console.log('Test 1 - Tenant A reads own customers:');
      console.log('  Context: Tenant A (ext-user-a)');
      console.log('  Result:', res.rows.map(r => `${r.id}: ${r.business_name}`).join(', '));
      const ok = res.rows.every(r => r.id.startsWith('cust-a'));
      console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'} - Only tenant-a customers visible`);
      return ok;
    });
    tests.push({ name: 'Tenant A reads own customers', pass: test1 });
    
    // Test 2: Tenant B reads its own customers
    const ctxB = createContext('ext-user-b', 'tenant-b');
    const test2 = await runWithContext(client, ctxB, async (c) => {
      const res = await c.query('SELECT id, business_name FROM customers ORDER BY id');
      console.log('\nTest 2 - Tenant B reads own customers:');
      console.log('  Context: Tenant B (ext-user-b)');
      console.log('  Result:', res.rows.map(r => `${r.id}: ${r.business_name}`).join(', '));
      const ok = res.rows.every(r => r.id.startsWith('cust-b'));
      console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'} - Only tenant-b customers visible`);
      return ok;
    });
    tests.push({ name: 'Tenant B reads own customers', pass: test2 });
    
    // Test 3: Tenant A cannot see Tenant B's customers
    const test3 = await runWithContext(client, ctxA, async (c) => {
      const res = await c.query("SELECT id FROM customers WHERE id = 'cust-b1'");
      console.log('\nTest 3 - Tenant A tries to read Tenant B customer:');
      console.log('  Context: Tenant A (ext-user-a)');
      console.log('  Query: SELECT id FROM customers WHERE id = \'cust-b1\'');
      console.log(`  Result: ${res.rows.length} rows returned`);
      const ok = res.rows.length === 0;
      console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'} - Tenant B data not visible to Tenant A`);
      return ok;
    });
    tests.push({ name: 'Tenant A cannot see Tenant B data', pass: test3 });
    
    // Test 4: Tenant B cannot see Tenant A's customers
    const test4 = await runWithContext(client, ctxB, async (c) => {
      const res = await c.query("SELECT id FROM customers WHERE id = 'cust-a1'");
      console.log('\nTest 4 - Tenant B tries to read Tenant A customer:');
      console.log('  Context: Tenant B (ext-user-b)');
      console.log('  Query: SELECT id FROM customers WHERE id = \'cust-a1\'');
      console.log(`  Result: ${res.rows.length} rows returned`);
      const ok = res.rows.length === 0;
      console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'} - Tenant A data not visible to Tenant B`);
      return ok;
    });
    tests.push({ name: 'Tenant B cannot see Tenant A data', pass: test4 });
    
    // Test 5: Tenant A cannot insert into Tenant B
    const test5 = await runWithContext(client, ctxA, async (c) => {
      try {
        await c.query(`
          INSERT INTO customers (id, tenant_id, business_name, created_at, updated_at) 
          VALUES ('cust-a3', 'tenant-b', 'Should Fail', NOW(), NOW())
        `);
        console.log('\nTest 5 - Tenant A tries to insert into Tenant B:');
        console.log('  ❌ FAIL - Should have been rejected');
        return false;
      } catch (e) {
        console.log('\nTest 5 - Tenant A tries to insert into Tenant B:');
        console.log(`  Error: ${e.message}`);
        const ok = e.message.includes('violates row-level security policy') || e.code === '42501';
        console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'} - Correctly rejected`);
        return ok;
      }
    });
    tests.push({ name: 'Tenant A cannot insert into Tenant B', pass: test5 });
    
    // Test 6: Missing context denies access (SELECT returns 0 rows)
    const test6 = await runWithContext(client, '', async (c) => {
      try {
        const res = await c.query('SELECT * FROM customers');
        console.log('\nTest 6 - Missing context (SELECT):');
        console.log(`  Rows returned: ${res.rows.length}`);
        const ok = res.rows.length === 0;
        console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'} - Correctly returns 0 rows`);
        return ok;
      } catch (e) {
        console.log('\nTest 6 - Missing context:');
        console.log(`  Error: ${e.message}`);
        const ok = e.message.includes('authentication context') || e.code === '42501';
        console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'} - Correctly rejected`);
        return ok;
      }
    });
    tests.push({ name: 'Missing context denies access', pass: test6 });
    
    // Test 7: Expired context denies access
    function createExpiredContext(subjectId, tenantId) {
      const expiresAt = Math.floor(Date.now() / 1000) - 100; // expired 100 seconds ago
      const nonce = CRYPTO.randomBytes(16).toString('hex');
      const payload = `v1|${subjectId}|${tenantId}|${expiresAt}|${nonce}`;
      const signature = CRYPTO.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');
      return `${payload}.${signature}`;
    }
    
    const expiredCtx = createExpiredContext('ext-user-a', 'tenant-a');
    const test7 = await runWithContext(client, expiredCtx, async (c) => {
      try {
        const res = await c.query('SELECT * FROM customers');
        console.log('\nTest 7 - Expired context (SELECT):');
        console.log(`  Rows returned: ${res.rows.length}`);
        const ok = res.rows.length === 0;
        console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'} - Correctly returns 0 rows`);
        return ok;
      } catch (e) {
        console.log('\nTest 7 - Expired context:');
        console.log(`  Error: ${e.message}`);
        const ok = e.message.includes('expired') || e.code === '42501';
        console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'} - Correctly rejected`);
        return ok;
      }
    });
    tests.push({ name: 'Expired context denies access', pass: test7 });
    
    // Test 8: Invalid signature denies access
    function createInvalidContext(subjectId, tenantId) {
      const expiresAt = Math.floor(Date.now() / 1000) + 60;
      const nonce = CRYPTO.randomBytes(16).toString('hex');
      const payload = `v1|${subjectId}|${tenantId}|${expiresAt}|${nonce}`;
      const signature = CRYPTO.createHmac('sha256', 'wrong-secret').update(payload).digest('hex');
      return `${payload}.${signature}`;
    }
    
    const invalidCtx = createInvalidContext('ext-user-a', 'tenant-a');
    const test8 = await runWithContext(client, invalidCtx, async (c) => {
      try {
        const res = await c.query('SELECT * FROM customers');
        console.log('\nTest 8 - Invalid signature (SELECT):');
        console.log(`  Rows returned: ${res.rows.length}`);
        const ok = res.rows.length === 0;
        console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'} - Correctly returns 0 rows`);
        return ok;
      } catch (e) {
        console.log('\nTest 8 - Invalid signature:');
        console.log(`  Error: ${e.message}`);
        const ok = e.message.includes('signature') || e.code === '42501';
        console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'} - Correctly rejected`);
        return ok;
      }
    });
    tests.push({ name: 'Invalid signature denies access', pass: test8 });
    
    // Test 9: Context isolation across transactions
    const test9 = await runWithContext(client, ctxA, async (c) => {
      await c.query('BEGIN');
      await c.query(`SELECT set_config('pharmnos.auth_context', $1, true)`, [ctxA]);
      await c.query("INSERT INTO customers (id, tenant_id, business_name, created_at, updated_at) VALUES ('tx-cust', 'tenant-a', 'Transaction Test', NOW(), NOW())");
      const res1 = await c.query("SELECT id FROM customers WHERE id = 'tx-cust'");
      await c.query('COMMIT');
      
      // New connection/transaction should see committed data
      const ctxA2 = createContext('ext-user-a', 'tenant-a');
      const client2 = new Client({ 
        connectionString: 'postgresql://pharmnos_e2e_runtime:5a7D8NJ9obQGHwZ1fdzVqyl3Ytn0CErh@127.0.0.1:56221/pharmnos_verify_verify-20261113174144?application_name=pharmnos-financial-e2e' 
      });
      await client2.connect();
      let ok = false;
      try {
        ok = await runWithContext(client2, ctxA2, async (c2) => {
          const res2 = await c2.query("SELECT id FROM customers WHERE id = 'tx-cust'");
          const ok = res2.rows.length === 1; // Should see committed data
          console.log('\nTest 9 - Context isolation (committed data visible):');
          console.log(`  ${ok ? '✅ PASS' : '❌ FAIL'} - Committed data visible in new transaction`);
          return ok;
        });
      } finally {
        await client2.end();
      }
      return ok;
    });
    tests.push({ name: 'Context isolation - committed data visible', pass: test9 });
    
    // Summary
    console.log('\n=== SUMMARY ===');
    const passed = tests.filter(t => t.pass).length;
    const failed = tests.filter(t => !t.pass).length;
    console.log(`Passed: ${passed}/${tests.length}`);
    console.log(`Failed: ${failed}/${tests.length}`);
    
    if (failed > 0) {
      console.log('\nFailed tests:');
      tests.filter(t => !t.pass).forEach(t => console.log(`  - ${t.name}`));
    }
    
    await client.end();
    
    return failed === 0;
  } catch (e) {
    console.error('Test error:', e);
    await client.end();
    return false;
  }
}

testCrossTenantIsolation().then(success => {
  process.exit(success ? 0 : 1);
}).catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});