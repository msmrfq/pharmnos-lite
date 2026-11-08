import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { createAuthE2eTargetContract, targetContractBinding, targetContractFingerprint, validateAuthE2eEnvironment } from "../scripts/auth-e2e-target-contract.mjs";
import { createAuthKeys } from "../scripts/auth-e2e-jwt.mjs";

function environment(overrides = {}) {
  const secret = "campaign-secret-with-at-least-32-characters";
  const keys = createAuthKeys(secret);
  const contract = createAuthE2eTargetContract({
    runId: "authinfra_contract",
    authPort: 59990,
    authDatabaseName: "auth_authinfra_contract",
    composeProject: "pharmnoslite-authinfra_contract",
    financialTargetBinding: "financial-binding",
    financialTargetFingerprint: crypto.createHash("sha256").update("financial").digest("hex"),
    authorizedAt: Date.now() - 1000,
    expiresAt: Date.now() + 60_000,
  });
  return {
    FINANCIAL_E2E_RUN_ID: contract.runId,
    AUTH_PORT: String(contract.authPort),
    AUTH_DB_NAME: contract.authDatabaseName,
    AUTH_COMPOSE_PROJECT: contract.composeProject,
    AUTH_E2E_TARGET_CONTRACT: JSON.stringify(contract),
    AUTH_E2E_AUTHORIZED_TARGET_BINDING: targetContractBinding(contract),
    AUTH_E2E_AUTHORIZED_TARGET_FINGERPRINT: targetContractFingerprint(contract),
    AUTH_JWT_SECRET: secret,
    AUTH_SERVICE_ROLE_KEY: keys.serviceRole,
    ...overrides,
  };
}

test("accepts a matching financial-bound Auth target", () => {
  assert.doesNotThrow(() => validateAuthE2eEnvironment(environment()));
});

for (const [name, override] of [
  ["port", { AUTH_PORT: "59991" }],
  ["database", { AUTH_DB_NAME: "auth_other" }],
  ["run identity", { FINANCIAL_E2E_RUN_ID: "other_run" }],
  ["financial binding", { AUTH_E2E_AUTHORIZED_TARGET_BINDING: "wrong" }],
  ["credential", { AUTH_SERVICE_ROLE_KEY: "not-a-matching-key" }],
]) {
  test(`rejects a mismatched ${name} before execution`, () => {
    assert.throws(() => validateAuthE2eEnvironment(environment(override)), /Auth E2E target gate failed/);
  });
}
