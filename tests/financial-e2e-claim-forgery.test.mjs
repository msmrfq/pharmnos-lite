import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const provisioning = fs.readFileSync("scripts/financial-e2e-provision-local.mjs", "utf8");
const q14 = fs.readFileSync("prisma/financial-e2e-q14-security-controls.sql", "utf8");
const supabaseRls = fs.readFileSync("prisma/05-rls-tenant-policies.sql", "utf8");
const audit = fs.readFileSync("scripts/financial-e2e-trust-boundary-audit.mjs", "utf8");

test("current financial RLS authorization never reads caller-settable request JWT claims", () => {
    assert.doesNotMatch(provisioning, /request\.jwt\.claim\.(sub|tenant_id)/);
    assert.doesNotMatch(q14, /request\.jwt\.claim\.(sub|tenant_id)/);
    assert.match(provisioning, /public\.financial_context_subject\(\)/);
    assert.match(provisioning, /public\.financial_context_tenant_id\(\)/);
    assert.match(q14, /public\.financial_context_tenant_id\(\)/);
});

test("legacy Supabase RLS is isolated to the verified authenticated gateway role", () => {
    assert.match(supabaseRls, /Boundary: this artifact is exclusively for Supabase's authenticated Data API/);
    assert.match(supabaseRls, /auth\.jwt\(\)/);
    assert.doesNotMatch(supabaseRls, /pharmnos_e2e_runtime/);
    assert.doesNotMatch(supabaseRls, /request\.jwt\.claim\.(sub|tenant_id)/);
});

test("forged raw claims are explicitly probed against signed authorization helpers", () => {
    assert.match(audit, /set_config\('request\.jwt\.claim\.sub'/);
    assert.match(audit, /public\.financial_context_subject\(\)/);
    assert.match(audit, /public\.financial_context_tenant_id\(\)/);
    assert.match(audit, /public\.financial_context_is_admin\(\)/);
    assert.match(audit, /authorizationBypass/);
    assert.match(audit, /RAW_CLAIM_FORGERY_REJECTED/);
});
