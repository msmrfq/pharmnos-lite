import assert from "node:assert/strict";

export const FINALIZED_PURCHASE_TRIGGER_CONTRACT = Object.freeze([
  Object.freeze({
    name: "prevent_finalized_purchase_mutation",
    table: "purchase_invoices",
    timing: "BEFORE",
    events: ["UPDATE"],
    function: "prevent_finalized_purchase_mutation",
  }),
  Object.freeze({
    name: "prevent_finalized_purchase_item_mutation",
    table: "purchase_invoice_items",
    timing: "BEFORE",
    events: ["UPDATE"],
    function: "prevent_finalized_purchase_mutation",
  }),
  Object.freeze({
    name: "reject_finalized_purchase_invoice_delete",
    table: "purchase_invoices",
    timing: "BEFORE",
    events: ["DELETE"],
    function: "reject_finalized_purchase_delete",
  }),
  Object.freeze({
    name: "reject_finalized_purchase_item_delete",
    table: "purchase_invoice_items",
    timing: "BEFORE",
    events: ["DELETE"],
    function: "reject_finalized_purchase_delete",
  }),
]);

export async function verifyFinalizedPurchaseTriggerContract(client) {
  const rows = (await client.query(`
    SELECT
      t.tgname AS trigger_name,
      c.relname AS table_name,
      t.tgenabled AS enabled,
      pn.nspname AS function_schema,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS function_args,
      (t.tgtype & 2) <> 0 AS is_before,
      (t.tgtype & 4) <> 0 AS has_insert,
      (t.tgtype & 8) <> 0 AS has_delete,
      (t.tgtype & 16) <> 0 AS has_update,
      (t.tgtype & 32) <> 0 AS has_truncate,
      (t.tgtype & 1) <> 0 AS is_row,
      pg_get_triggerdef(t.oid) AS trigger_definition
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY($1::text[])
      AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname
  `, [["purchase_invoices", "purchase_invoice_items"]])).rows;

  assert.equal(
    rows.length,
    FINALIZED_PURCHASE_TRIGGER_CONTRACT.length,
    "Finalized purchase trigger contract has missing or duplicate named guards.",
  );

  const observed = [];
  for (const expected of FINALIZED_PURCHASE_TRIGGER_CONTRACT) {
    const matches = rows.filter((row) => row.trigger_name === expected.name);
    assert.equal(matches.length, 1, `Expected exactly one ${expected.name} trigger.`);
    const row = matches[0];
    assert.equal(row.table_name, expected.table, `${expected.name} is attached to the wrong table.`);
    assert.equal(row.enabled, "O", `${expected.name} is not enabled.`);
    assert.equal(row.function_schema, "public", `${expected.name} calls a non-public function.`);
    assert.equal(row.function_name, expected.function, `${expected.name} calls the wrong function.`);
    assert.equal(row.function_args, "", `${expected.name} has the wrong function signature.`);
    assert.equal(row.is_before, true, `${expected.name} has the wrong timing.`);
    assert.equal(row.is_row, true, `${expected.name} must be a row trigger.`);
    assert.equal(row.has_insert, expected.events.includes("INSERT"), `${expected.name} has an unexpected INSERT event.`);
    assert.equal(row.has_delete, expected.events.includes("DELETE"), `${expected.name} has an unexpected DELETE event.`);
    assert.equal(row.has_update, expected.events.includes("UPDATE"), `${expected.name} has an unexpected UPDATE event.`);
    assert.equal(row.has_truncate, expected.events.includes("TRUNCATE"), `${expected.name} has an unexpected TRUNCATE event.`);
    observed.push({
      name: row.trigger_name,
      table: row.table_name,
      timing: expected.timing,
      events: expected.events,
      enabled: row.enabled,
      functionSchema: row.function_schema,
      function: row.function_name,
      functionArgs: row.function_args,
      definition: row.trigger_definition,
    });
  }
  return {
    expected: FINALIZED_PURCHASE_TRIGGER_CONTRACT,
    observed,
  };
}
