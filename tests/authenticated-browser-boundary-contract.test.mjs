import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const middleware = fs.readFileSync("src/middleware.ts", "utf8");
const dashboardLayout = fs.readFileSync("src/components/layout/dashboard-layout.tsx", "utf8");

test("protected browser routes fail closed through Supabase user verification", () => {
  assert.match(middleware, /createServerClient/);
  assert.match(middleware, /supabase\.auth\.getUser\(\)/);
  assert.match(middleware, /NextResponse\.redirect\(new URL\("\/auth\/sign-in"/);
  assert.match(middleware, /PUBLIC_PATHS/);
});

test("dashboard profile menu submits the existing server-side sign-out action", () => {
  assert.match(dashboardLayout, /signOutAction/);
  assert.equal((dashboardLayout.match(/<form action=\{submitSignOut\}>/g) ?? []).length, 2);
  assert.equal((dashboardLayout.match(/<button type="submit"[^>]*>Sign out<\/button>/g) ?? []).length, 2);
});
