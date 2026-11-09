import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("customer list does not present unavailable aging as current", async () => {
  const source = await readFile(new URL("../src/app/customers/page.tsx", import.meta.url), "utf8");
  assert.match(source, /perCustomerAging\.set\(c\.id, null\)/);
  assert.match(source, /Aging unavailable/);
  assert.doesNotMatch(source, /recv > 0 \? 7 : 0/);
});
