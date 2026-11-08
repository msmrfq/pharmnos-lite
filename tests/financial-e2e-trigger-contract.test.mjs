import assert from "node:assert/strict";
import test from "node:test";
import {
  FINALIZED_PURCHASE_TRIGGER_CONTRACT,
  verifyFinalizedPurchaseTriggerContract,
} from "../scripts/financial-e2e-trigger-contract.mjs";

function rows(overrides = {}) {
  return FINALIZED_PURCHASE_TRIGGER_CONTRACT.map((expected) => ({
    trigger_name: expected.name,
    table_name: expected.table,
    enabled: "O",
    function_schema: "public",
    function_name: expected.function,
    function_args: "",
    is_before: true,
    has_insert: false,
    has_delete: expected.events.includes("DELETE"),
    has_update: expected.events.includes("UPDATE"),
    has_truncate: false,
    is_row: true,
    trigger_definition: `CREATE TRIGGER "${expected.name}" BEFORE ${expected.events[0]} ON public."${expected.table}" FOR EACH ROW EXECUTE FUNCTION public.${expected.function}();`,
    ...overrides[expected.name],
  }));
}

function client(result) {
  return { query: async () => ({ rows: result }) };
}

test("accepts the canonical named finalized-purchase trigger contract", async () => {
  const evidence = await verifyFinalizedPurchaseTriggerContract(client(rows()));
  assert.equal(evidence.observed.length, 4);
});

test("rejects a missing named trigger", async () => {
  await assert.rejects(
    verifyFinalizedPurchaseTriggerContract(client(rows().slice(1))),
    /missing or duplicate named guards/,
  );
});

test("rejects duplicate named trigger rows", async () => {
  const value = rows();
  value.push({ ...value[0] });
  await assert.rejects(
    verifyFinalizedPurchaseTriggerContract(client(value)),
    /missing or duplicate named guards/,
  );
});

test("rejects an unexpected trigger on a governed table", async () => {
  const value = rows();
  value.push({
    ...value[0],
    trigger_name: "unexpected_purchase_guard",
  });
  await assert.rejects(
    verifyFinalizedPurchaseTriggerContract(client(value)),
    /missing or duplicate named guards/,
  );
});

test("rejects incorrect trigger attachment and definition", async () => {
  const value = rows({
    reject_finalized_purchase_item_delete: {
      table_name: "purchase_invoices",
      trigger_definition: 'CREATE TRIGGER "reject_finalized_purchase_item_delete" BEFORE UPDATE ON public."purchase_invoices"',
    },
  });
  await assert.rejects(
    verifyFinalizedPurchaseTriggerContract(client(value)),
    /attached to the wrong table/,
  );
});

test("rejects disabled triggers and wrong guard functions", async () => {
  const disabled = rows({
    prevent_finalized_purchase_mutation: { enabled: "D" },
  });
  await assert.rejects(
    verifyFinalizedPurchaseTriggerContract(client(disabled)),
    /not enabled/,
  );

  const wrongFunction = rows({
    reject_finalized_purchase_invoice_delete: { function_name: "unexpected_guard" },
  });
  await assert.rejects(
    verifyFinalizedPurchaseTriggerContract(client(wrongFunction)),
    /calls the wrong function/,
  );

  const wrongSchema = rows({
    reject_finalized_purchase_invoice_delete: { function_schema: "other_schema" },
  });
  await assert.rejects(
    verifyFinalizedPurchaseTriggerContract(client(wrongSchema)),
    /non-public function/,
  );
});

test("rejects non-before and multi-event guards", async () => {
  const afterTrigger = rows({
    prevent_finalized_purchase_mutation: { is_before: false },
  });
  await assert.rejects(
    verifyFinalizedPurchaseTriggerContract(client(afterTrigger)),
    /wrong timing/,
  );

  const multiEvent = rows({
    prevent_finalized_purchase_mutation: { has_delete: true },
  });
  await assert.rejects(
    verifyFinalizedPurchaseTriggerContract(client(multiEvent)),
    /unexpected DELETE event/,
  );
});
