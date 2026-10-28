import assert from "node:assert/strict";
import test from "node:test";
import {
    getGstContract,
    validateGstContract,
} from "../scripts/gst-disposable-contract.mjs";
import {
    evaluateGstExecutionReadiness,
    runGstContract,
} from "../scripts/gst-disposable-runner.mjs";

test("registers retained GST scenarios from the canonical plan", () => {
    const contract = getGstContract();
    assert.equal(contract.length, 18);
    assert.deepEqual(contract.map((entry) => entry.id), Array.from(
        { length: 20 },
        (_, index) => `GST-${String(index + 1).padStart(3, "0")}`,
    ).filter((id) => !["GST-017", "GST-018"].includes(id)));
    assert.deepEqual(validateGstContract(contract), { ok: true, errors: [] });
    for (const id of ["GST-014", "GST-015", "GST-016"]) {
        assert.equal(
            contract.find((entry) => entry.id === id)?.executionStatus,
            "EXECUTABLE_DB_PREFLIGHT",
        );
    }
    assert.match(contract.find((entry) => entry.id === "GST-014").sourceStatus, /finalizeSalesInvoiceAction rollback/i);
    assert.match(contract.find((entry) => entry.id === "GST-015").sourceStatus, /finalizePurchaseAction rollback/i);
    assert.match(contract.find((entry) => entry.id === "GST-016").sourceStatus, /authenticated print data path/i);
    assert.equal(contract.find((entry) => entry.id === "GST-014")?.evidenceLevel, "APPLICATION_PATH_DATABASE_E2E");
    assert.equal(contract.find((entry) => entry.id === "GST-015")?.evidenceLevel, "APPLICATION_PATH_DATABASE_E2E");
    assert.equal(contract.find((entry) => entry.id === "GST-016")?.evidenceLevel, "APPLICATION_PATH_DATABASE_E2E");
});

test("does not claim database execution before the connected runner is invoked", () => {
    const result = runGstContract({
        executionAuthorized: true,
        targetVerified: true,
        runtimeRoleVerified: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.counts.passed, 0);
    assert.equal(result.counts.blocked, 18);
    assert.equal(result.counts.notRun, 18);
});

test("requires every independent execution gate", () => {
    const result = evaluateGstExecutionReadiness();
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /execution authorization/i);
    assert.match(result.errors.join(" "), /disposable target/i);
    assert.match(result.errors.join(" "), /runtime role/i);
});
