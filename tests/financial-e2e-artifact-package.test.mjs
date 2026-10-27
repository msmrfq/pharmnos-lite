import assert from "node:assert/strict";
import test from "node:test";
import {
    createArtifactManifest,
    sha256,
    verifyArtifactFiles,
    verifyArtifactManifest,
} from "../scripts/financial-e2e-artifact-package.mjs";

const files = {
    "schema.sql": "CREATE TABLE safe (id text);",
    "security.sql": "REVOKE ALL ON SCHEMA public FROM PUBLIC;",
};
const sources = { "schema.prisma": "model Safe { id String @id }" };

function manifestFor(overrides = {}) {
    return createArtifactManifest({
        packageVersion: "0.1.0",
        sourceSchema: { path: "schema.prisma", generation: "test-generator", sha256: sha256(sources["schema.prisma"]) },
        artifacts: Object.entries(files).map(([path, content]) => ({
            path,
            order: Object.keys(files).indexOf(path) + 1,
            sha256: sha256(content),
            classification: "review-only",
        })),
        verificationSteps: ["catalog", "rls", "runtime"],
        ...overrides,
    }).manifest;
}

test("verifies an unchanged review artifact set without approving execution", () => {
    const manifest = manifestFor();
    assert.equal(manifest.approved, false);
    assert.deepEqual(verifyArtifactManifest(manifest, { files, sources }), { ok: true, errors: [] });
});

test("rejects altered and unexpected artifacts", () => {
    const manifest = manifestFor();
    const result = verifyArtifactManifest(manifest, {
        files: { ...files, "unexpected.sql": "DROP SCHEMA public;" },
        sources,
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /does not match the manifest/);
});

test("rejects approval of a package containing review-only artifacts", () => {
    const result = createArtifactManifest({
        packageVersion: "0.1.0",
        sourceSchema: { path: "schema.prisma", generation: "test-generator", sha256: sha256(sources["schema.prisma"]) },
        artifacts: [{ path: "review.sql", order: 1, sha256: "a".repeat(64), classification: "review-only" }],
        verificationSteps: ["catalog"],
        approved: true,
    });
    assert.match(result.errors.join(" "), /Review-only artifacts cannot be approved/);
    assert.equal(verifyArtifactManifest(result.manifest, {
        files: { "review.sql": "x" },
        sources,
    }).ok, false);
});

test("rejects unsafe, duplicate, missing-order, and source-provenance paths", () => {
    const result = createArtifactManifest({
        packageVersion: "0.1.0",
        sourceSchema: { path: "../schema.prisma", generation: "", sha256: "a".repeat(64) },
        artifacts: [
            { path: "../escape.sql", order: 1, sha256: "a".repeat(64), classification: "review-only" },
            { path: "../escape.sql", order: 1, sha256: "a".repeat(64), classification: "review-only" },
        ],
        verificationSteps: ["catalog"],
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /repository-relative|generation|unique|contiguous/);
});

test("rejects a reordered or altered manifest artifact set", () => {
    const manifest = manifestFor();
    const reordered = { ...manifest, artifacts: manifest.artifacts.map((artifact, index) => ({
        ...artifact,
        order: manifest.artifacts.length - index,
    })) };
    assert.equal(verifyArtifactManifest(reordered, { files, sources }).ok, false);
    assert.equal(verifyArtifactManifest(manifest, {
        files: { ...files, "schema.sql": "ALTERED" },
        sources,
    }).ok, false);
});

test("rejects repository path traversal during file verification", () => {
    const manifest = {
        manifestVersion: 1,
        sourceSchema: { path: "../schema.prisma", generation: "test-generator", sha256: "a".repeat(64) },
        artifacts: [],
    };
    assert.throws(
        () => verifyArtifactFiles(manifest, process.cwd()),
        /safe repository-relative path/i,
    );
});
