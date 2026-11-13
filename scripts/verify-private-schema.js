const { Client } = require('pg');

const bootstrapUrl = 'postgresql://pharmnos_e2e:ZczIugoskl79BAvF6OtbXKxrNaME80R4@127.0.0.1:56221/pharmnos_verify_verify-20261113174144?application_name=pharmnos-financial-e2e';

async function checkPrivateSchema() {
  const client = new Client({ connectionString: bootstrapUrl });
  try {
    await client.connect();
    
    // Check signing secret
    const secretRes = await client.query(`
      SELECT key_name, signing_secret IS NOT NULL as has_secret
      FROM pharmnos_private.auth_context_keys
    `);
    console.log('Signing secret:', secretRes.rows);
    
    // Check verify_auth_context function
    const funcRes = await client.query(`
      SELECT proname, prosecdef, prokind
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'pharmnos_private'
      AND proname = 'verify_auth_context'
    `);
    console.log('verify_auth_context function:', funcRes.rows);
    
    // Check public wrapper functions
    const wrapperRes = await client.query(`
      SELECT proname, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
      AND proname LIKE 'financial_context_%'
    `);
    console.log('Public wrapper functions:', wrapperRes.rows);
    
    await client.end();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

checkPrivateSchema();