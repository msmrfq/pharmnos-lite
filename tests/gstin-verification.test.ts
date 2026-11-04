#!/usr/bin/env ts-node

import { businessProfileSchema, onboardingBusinessSchema } from "../src/lib/validation/tenant.schemas";
import { customerEditSchema, supplierEditSchema } from "../src/lib/validation/masters.schemas";

type Scenario = {
  name: string;
  status: "PASS" | "FAIL";
};

let passed = 0;
let failed = 0;
const scenarios: Scenario[] = [];

function record(name: string, status: Scenario["status"]) {
  scenarios.push({ name, status });
}

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`PASS: ${name}`);
    passed++;
    record(name, "PASS");
  } else {
    console.log(`FAIL: ${name}`);
    failed++;
    record(name, "FAIL");
  }
}

const lengthOnlyGstinBase = {
  businessName: "Pharmnos Lite",
  state: "MH",
  invoicePrefix: "INV",
  purchasePrefix: "PUR",
  nearExpiryDays: "60",
};

assert(
  businessProfileSchema.safeParse({
    ...lengthOnlyGstinBase,
    gstin: "27AACXX0000B1ZP",
  }).success,
  "DGM-T13: exactly 15 GSTIN characters are accepted",
);
assert(
  businessProfileSchema.safeParse({
    ...lengthOnlyGstinBase,
    gstin: "96AACXX0000B1ZP",
  }).success,
  "DGM-T13: unsupported GSTIN prefixes are not used as a current-release length failure",
);
assert(
  !businessProfileSchema.safeParse({
    ...lengthOnlyGstinBase,
    gstin: "27AACXX0000B1Z",
  }).success,
  "DGM-T13: GSTIN shorter than 15 characters is rejected",
);
assert(
  !businessProfileSchema.safeParse({
    ...lengthOnlyGstinBase,
    gstin: "27AACXX0000B1ZP0",
  }).success,
  "DGM-T13: GSTIN longer than 15 characters is rejected",
);
assert(
  businessProfileSchema.safeParse({
    ...lengthOnlyGstinBase,
    gstin: "",
  }).success,
  "DGM-T13: optional blank GSTIN remains allowed",
);
assert(
  businessProfileSchema.safeParse({
    ...lengthOnlyGstinBase,
    gstin: " 27AACXX0000B1ZP ",
  }).success === false &&
    customerEditSchema.safeParse({
      business_name: "Customer",
      gstin: " 27AACXX0000B1ZP ",
    }).success === false &&
    supplierEditSchema.safeParse({
      business_name: "Supplier",
      gstin: " 27AACXX0000B1ZP ",
    }).success === false,
  "DGM-T13: surrounding whitespace is rejected rather than silently trimmed",
);
assert(
  businessProfileSchema.safeParse({
    ...lengthOnlyGstinBase,
    gstin: 27,
  }).success === false &&
    onboardingBusinessSchema.safeParse({
      businessName: "Pharmnos Lite",
      slug: "pharmnos-lite",
      gstin: 27,
    }).success === false &&
    customerEditSchema.safeParse({
      business_name: "Customer",
      gstin: 27,
    }).success === false &&
    supplierEditSchema.safeParse({
      business_name: "Supplier",
      gstin: 27,
    }).success === false,
  "DGM-T13: non-string GSTIN values are rejected across approved surfaces",
);

assert(
  onboardingBusinessSchema.safeParse({
    businessName: "Pharmnos Lite",
    slug: "pharmnos-lite",
    gstin: "27AACXX0000B1ZP",
  }).success,
  "DGM-T13: onboarding accepts an exactly 15-character GSTIN",
);
assert(
  businessProfileSchema.safeParse(lengthOnlyGstinBase).success &&
    onboardingBusinessSchema.safeParse({
      businessName: "Pharmnos Lite",
      slug: "pharmnos-lite",
    }).success &&
    customerEditSchema.safeParse({ business_name: "Customer" }).success &&
    supplierEditSchema.safeParse({ business_name: "Supplier" }).success,
  "DGM-T13: omitted optional GSTIN remains allowed across approved surfaces",
);

assert(
  customerEditSchema.safeParse({
    business_name: "Customer",
    gstin: "27aacxx0000b1zp",
  }).data?.gstin === "27AACXX0000B1ZP",
  "DGM-T13: customer GSTIN keeps the existing uppercase normalization",
);

assert(
  supplierEditSchema.safeParse({
    business_name: "Supplier",
    gstin: "27aacxx0000b1zp",
  }).data?.gstin === "27AACXX0000B1ZP",
  "DGM-T13: supplier GSTIN keeps the existing uppercase normalization",
);

assert(
  !customerEditSchema.safeParse({
    business_name: "Customer",
    gstin: "27AACXX0000B1Z",
  }).success &&
    !supplierEditSchema.safeParse({
      business_name: "Supplier",
      gstin: "27AACXX0000B1ZP0",
    }).success,
  "DGM-T13: master-record GSTIN lengths remain bounded at 15 characters",
);

const result = { passed, failed, total: passed + failed, scenarios };
(globalThis as typeof globalThis & {
  __OFFLINE_SUITE_RESULT__?: typeof result;
}).__OFFLINE_SUITE_RESULT__ = result;

console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
  throw new Error("T13 GSTIN verification suite failed.");
}
