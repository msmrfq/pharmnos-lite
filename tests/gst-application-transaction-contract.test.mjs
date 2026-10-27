import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sales = fs.readFileSync(new URL("../src/app/_actions/sales.actions.ts", import.meta.url), "utf8");
const purchases = fs.readFileSync(new URL("../src/app/_actions/purchases.actions.ts", import.meta.url), "utf8");

function transactionBody(source, actionName) {
    const start = source.indexOf(`export async function ${actionName}`);
    assert.notEqual(start, -1, `${actionName} must remain exported`);
    const transaction = source.indexOf("prisma.$transaction(async (tx)", start);
    assert.notEqual(transaction, -1, `${actionName} must use a Prisma transaction`);
    return source.slice(transaction, source.indexOf("\n  } catch", transaction));
}

test("sales finalization keeps stock, sequence, invoice, and ledger work inside one transaction", () => {
    const body = transactionBody(sales, "finalizeSalesInvoiceAction");
    assert.ok(body.includes("tx.product_batches.updateMany"));
    assert.ok(body.includes("tx.stock_movements.create"));
    assert.ok(body.includes("tx.business_profiles.update"));
    assert.ok(body.includes("tx.sales_invoices.update"));
    assert.ok(body.includes("tx.customer_ledgers.create"));
    assert.match(body, /Insufficient FEFO stock[\s\S]*throw new Error/);
});

test("purchase finalization keeps sequence allocation and posting work inside one transaction", () => {
    const body = transactionBody(purchases, "finalizePurchaseAction");
    assert.ok(body.includes("purchase_next_seq"));
    assert.ok(body.includes("tx.business_profiles.update"));
    assert.ok(body.includes("tx.purchase_invoices.update"));
    assert.ok(body.includes("tx.purchase_posting_operations.create"));
    assert.ok(body.includes("tx.supplier_ledgers.create"));
    assert.match(body, /Purchase GST finalization is blocked[\s\S]*throw new Error/);
});
