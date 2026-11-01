import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("src/adapters/auth/supabase-auth.adapter.ts", "utf8");

test("uses Supabase server-side user verification before accepting session identity", () => {
    const getSessionIndex = source.indexOf("await sb.auth.getSession()");
    const getUserIndex = source.indexOf("await sb.auth.getUser()");
    assert.ok(getSessionIndex >= 0);
    assert.ok(getUserIndex >= 0);
    assert.ok(getUserIndex > getSessionIndex);
    assert.match(source, /verifiedUser\.id !== session\.user\.id/);
});

test("does not expose database or service-role credentials through public environment names", () => {
    assert.doesNotMatch(source, /NEXT_PUBLIC_(?:DATABASE_URL|DIRECT_URL|SUPABASE_SERVICE_ROLE_KEY)/);
    assert.doesNotMatch(source, /process\.env\.NEXT_PUBLIC_(?:DATABASE_URL|DIRECT_URL|SUPABASE_SERVICE_ROLE_KEY)/);
});
