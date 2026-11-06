import test from "node:test";
import assert from "node:assert/strict";

const service = await import("../src/domain/services/invoice-modernization.service.ts");

test("stable invoice references are deterministic and identifier-bound", () => {
  const first = service.stableInvoiceReferences("sale-1", "INV-00001");
  const second = service.stableInvoiceReferences("sale-1", "INV-00001");
  assert.deepEqual(first, second);
  assert.equal(first.barcodeValue, "INV-00001");
  assert.match(first.qrPayload, /^pharmnos:\/\/invoice\/sale-1\?ref=/);
});

test("tax summary includes only persisted non-zero components", () => {
  assert.deepEqual(
    service.summarizeInvoiceTax([
      { cgst: 1.25, sgst: 1.25, igst: 0, cess: 0 },
      { cgst: 0, sgst: 0, igst: 4.5, cess: 0.25 },
    ]),
    { cgst: 1.25, sgst: 1.25, igst: 4.5, cess: 0.25 },
  );
});

test("immutable snapshot hash changes when finalized facts change", () => {
  const first = service.createImmutableInvoiceSnapshot({ invoiceNo: "INV-1", total: "10.00" });
  const second = service.createImmutableInvoiceSnapshot({ invoiceNo: "INV-1", total: "11.00" });
  assert.notEqual(first.hash, second.hash);
  assert.deepEqual(first.snapshot, { invoiceNo: "INV-1", total: "10.00" });
});

test("amount in words uses Indian groups and exact paise", () => {
  assert.equal(service.amountInWords(0), "Indian Rupees zero only");
  assert.equal(
    service.amountInWords(1234567.89),
    "Indian Rupees twelve lakh thirty four thousand five hundred sixty seven and eighty nine paise only",
  );
  assert.equal(service.amountInWords(10000000), "Indian Rupees one crore only");
  assert.equal(service.amountInWords(1.005), "Indian Rupees one and one paise only");
});
