import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const actions = await readFile(new URL("../src/app/_actions/masters.actions.ts", import.meta.url), "utf8");
const auditConstants = await readFile(new URL("../src/lib/constants/audit.ts", import.meta.url), "utf8");

test("customer and supplier deactivation events are distinct immutable enum values", () => {
    assert.match(schema, /CUSTOMER_DEACTIVATED/);
    assert.match(schema, /SUPPLIER_DEACTIVATED/);
    assert.match(actions, /event_type: "CUSTOMER_DEACTIVATED"/);
    assert.match(actions, /event_type: "SUPPLIER_DEACTIVATED"/);
    assert.doesNotMatch(actions, /deleteCustomerAction[\s\S]*?event_type: "PRODUCT_UPDATED"/);
    assert.doesNotMatch(actions, /deleteSupplierAction[\s\S]*?event_type: "PRODUCT_UPDATED"/);
    assert.match(auditConstants, /CUSTOMER_DEACTIVATED: "Customer deactivated"/);
    assert.match(auditConstants, /SUPPLIER_DEACTIVATED: "Supplier deactivated"/);
});

test("deactivation actions retain transaction and dependency guards", () => {
    assert.match(actions, /deleteCustomerAction[\s\S]*?prisma\.\$transaction/);
    assert.match(actions, /deleteSupplierAction[\s\S]*?prisma\.\$transaction/);
    assert.match(actions, /tx\.payments\.findFirst/);
    assert.match(actions, /tx\.product_batches\.findFirst/);
});
