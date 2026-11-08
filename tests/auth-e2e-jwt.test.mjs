import assert from "node:assert/strict";
import test from "node:test";
import { createAuthKeys, createHs256Jwt } from "../scripts/auth-e2e-jwt.mjs";

test("creates separate anon and service-role JWTs without exposing secrets", () => {
  const keys = createAuthKeys("campaign-secret");
  assert.notEqual(keys.anon, keys.serviceRole);
  assert.equal(keys.anon.split(".").length, 3);
  assert.equal(keys.serviceRole.split(".").length, 3);
  assert.doesNotMatch(JSON.stringify(keys), /campaign-secret/);
});

test("rejects incomplete JWT inputs", () => {
  assert.throws(() => createHs256Jwt({ secret: "", role: "anon" }), /required/);
  assert.throws(() => createHs256Jwt({ secret: "secret", role: "" }), /required/);
});
