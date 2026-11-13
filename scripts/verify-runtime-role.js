const { Client } = require('pg');

const runtimeUrl = 'postgresql://pharmnos_e2e_runtime:5a7D8NJ9obQGHwZ1fdzVqyl3Ytn0CErh@127.0.0.1:56221/pharmnos_verify_verify-20261113174144?application_name=pharmnos-financial-e2e';

async function checkRuntimeRole() {
  const client = new Client({ connectionString: runtimeUrl });
  try {
    await client.connect();
    
    // Check role attributes
    const roleRes = await client.query(`
      SELECT rolname, rolsuper, rolbypassrls, rolcanlogin 
      FROM pg_roles 
      WHERE rolname = 'pharmnos_e2e_runtime'
    `);
    console.log('Runtime role attributes:', roleRes.rows[0]);
    
    // Check RLS status on key tables
    const rlsRes = await client.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
      AND relname IN (
        'tenants', 'users', 'customers', 'suppliers', 'products', 'product_batches',
        'sales_invoices', 'sales_invoice_items', 'purchase_invoices', 'purchase_invoice_items',
        'payments', 'payment_allocations', 'allocation_reversals', 'payment_refunds', 'payment_reversals',
        'stock_movements', 'customer_ledgers', 'supplier_ledgers', 'audit_logs',
        'hsn_sac_catalog', 'hsn_sac_catalog_history', 'gst_rate_rules', 'gst_rate_rule_history'
      )
      ORDER BY relname
    `);
    console.log('\nRLS Status on tenant tables:');
    rlsRes.rows.forEach(r => {
      console.log(`  ${r.relname}: RLS=${r.relrowsecurity}, FORCE=${r.relforcerowsecurity}`);
    });
    
    // Check policies on a few key tables
    const policyRes = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename IN ('tenants', 'customers', 'sales_invoices', 'payments')
      ORDER BY tablename, policyname
    `);
    console.log('\nPolicies on key tables:');
    policyRes.rows.forEach(p => {
      console.log(`  ${p.tablename}: ${p.policyname} (${p.cmd}) USING: ${p.qual?.substring(0,80)}...`);
    });
    
    // Check signing secret
    const secretRes = await client.query(`
      SELECT key_name, signing_secret IS NOT NULL as has_secret
      FROM pharmnos_private.auth_context_keys
    `);
    console.log('\nSigning secret:', secretRes.rows);
    
    await client.end();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

checkRuntimeRole();