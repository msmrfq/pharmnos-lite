import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const actionSource = await readFile(
  new URL("../src/app/_actions/purchases.actions.ts", import.meta.url),
  "utf8",
);
const schemaSource = await readFile(
  new URL("../src/lib/validation/purchases.schemas.ts", import.meta.url),
  "utf8",
);
const dialogSource = await readFile(
  new URL("../src/app/inventory/_stock-adjustment-dialog.tsx", import.meta.url),
  "utf8",
);

function actionBody(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, end === -1 ? source.length : end);
}

test("stock adjustment authorizes before opening its transaction", () => {
  const body = actionBody(actionSource, "createStockAdjustmentAction");
  const contextIndex = body.indexOf("const ctx = await requireServerTenantContext();");
  const permissionIndex = body.indexOf('requirePermission(ctx, "adjust_stock" as PermissionAction);');
  const transactionIndex = body.indexOf("prisma.$transaction");

  assert.ok(contextIndex >= 0);
  assert.ok(permissionIndex > contextIndex);
  assert.ok(transactionIndex > permissionIndex);
});

test("negative stock adjustments use a guarded update and idempotent replay", () => {
  const body = actionBody(actionSource, "createStockAdjustmentAction");

  assert.match(body, /pg_advisory_xact_lock/);
  assert.match(body, /reference_id: data\.idempotency_key/);
  assert.match(
    body,
    /reference_type: "stock_adjustment",\s+reference_id: data\.idempotency_key/s,
  );
  assert.match(
    body,
    /available_qty: \{ gte: Math\.abs\(delta\) \}/s,
  );
  assert.match(body, /if \(updated\.count !== 1\)/);
  assert.match(body, /This idempotency key was already used with a different stock adjustment/);
});

test("the adjustment form supplies a stable retry key and the schema requires it", () => {
  assert.match(schemaSource, /idempotency_key:\s*z[\s\S]*?\.regex\(\/\^\[A-Za-z0-9\]/);
  assert.match(dialogSource, /name="idempotency_key"/);
  assert.match(dialogSource, /stock-adjustment:\$\{crypto\.randomUUID\(\)\}/);
});
