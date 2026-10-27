import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_RELATIVE_PATH = /^(?![\\/])(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/;
const CHECKED_IN_MANIFEST_PATH = "prisma/financial-e2e-artifact-manifest.json";

function validateManifestPath(value, label) {
    if (typeof value !== "string" || !SAFE_RELATIVE_PATH.test(value) ||
        value.split("/").includes("..")) {
        return `${label} must be a safe repository-relative path.`;
    }
    return null;
}

export function sha256(content) {
    return crypto.createHash("sha256").update(content).digest("hex");
}

export function createArtifactManifest({
    packageVersion,
    sourceSchema,
    artifacts,
    verificationSteps,
    approved = false,
} = {}) {
    const errors = [];
    if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(String(packageVersion ?? ""))) {
        errors.push("A semantic package version is required.");
    }
    if (!sourceSchema || typeof sourceSchema !== "object" ||
        validateManifestPath(sourceSchema.path, "Source schema path") ||
        !sourceSchema.generation ||
        !SHA256_PATTERN.test(sourceSchema.sha256 ?? "")) {
        errors.push("A hashed source schema is required.");
    }
    if (!Array.isArray(artifacts) || artifacts.length === 0) {
        errors.push("At least one artifact is required.");
    }
    if (!Array.isArray(verificationSteps) || verificationSteps.length === 0) {
        errors.push("Post-install verification steps are required.");
    }
    const names = new Set();
    for (const [index, artifact] of (artifacts ?? []).entries()) {
        if (!artifact?.path || names.has(artifact.path) ||
            validateManifestPath(artifact.path, "Artifact path")) {
            errors.push("Artifact paths must be present, unique, and repository-relative.");
        }
        names.add(artifact?.path);
        if (artifact?.order !== index + 1) errors.push(`Artifact order must be explicit and contiguous: ${artifact?.path ?? "unknown"}.`);
        if (!SHA256_PATTERN.test(artifact?.sha256 ?? "")) errors.push(`Artifact hash is invalid: ${artifact?.path ?? "unknown"}.`);
        if (!["review-only", "executable"].includes(artifact?.classification)) {
            errors.push(`Artifact classification is invalid: ${artifact?.path ?? "unknown"}.`);
        }
    }
    if (approved === true && (artifacts ?? []).some((artifact) => artifact?.classification !== "executable")) {
        errors.push("Review-only artifacts cannot be approved for execution.");
    }
    return {
        ok: errors.length === 0,
        errors,
        manifest: errors.length === 0 ? Object.freeze({
            manifestVersion: 1,
            packageVersion,
            approved: approved === true,
            sourceSchema: { ...sourceSchema },
            artifacts: artifacts.map((artifact) => ({ ...artifact })),
            verificationSteps: [...verificationSteps],
        }) : null,
    };
}

export function verifyArtifactManifest(manifest, {
    files = {},
    sources = {},
    expectedPaths = [],
    requireApprovedExecutable = false,
} = {}) {
    const errors = [];
    if (!manifest || manifest.manifestVersion !== 1) errors.push("Unsupported artifact manifest.");
    if (manifest?.sourceSchema) {
        const sourcePathError = validateManifestPath(manifest.sourceSchema.path, "Source schema path");
        if (sourcePathError) errors.push(sourcePathError);
        if (!manifest.sourceSchema.generation) errors.push("Source generation provenance is required.");
    }
    if (requireApprovedExecutable && manifest?.approved !== true) {
        errors.push("An explicitly approved executable artifact package is required.");
    }
    if (requireApprovedExecutable && manifest?.artifacts?.some((artifact) => artifact.classification !== "executable")) {
        errors.push("Approved packages cannot contain review-only artifacts.");
    }
    const actualPaths = Object.keys(files).sort();
    const sourceArtifacts = manifest?.artifacts ?? [];
    for (const [index, artifact] of sourceArtifacts.entries()) {
        if (artifact?.order !== index + 1) {
            errors.push(`Manifest artifact array order does not match declared order: ${artifact?.path ?? "unknown"}.`);
        }
    }
    const declaredArtifacts = [...sourceArtifacts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const declaredPaths = declaredArtifacts.map((artifact) => artifact.path).sort();
    if (expectedPaths.length > 0 && JSON.stringify(actualPaths) !== JSON.stringify([...expectedPaths].sort())) {
        errors.push("Artifact set does not match the expected package contents.");
    }
    if (JSON.stringify(actualPaths) !== JSON.stringify(declaredPaths)) {
        errors.push("Artifact set does not match the manifest.");
    }
    if (manifest?.sourceSchema) {
        const source = sources[manifest.sourceSchema.path];
        if (source === undefined) {
            errors.push(`Manifest source schema is missing: ${manifest.sourceSchema.path}.`);
        } else if (sha256(source) !== manifest.sourceSchema.sha256) {
            errors.push(`Manifest source schema hash mismatch: ${manifest.sourceSchema.path}.`);
        }
    }
    for (const [index, artifact] of declaredArtifacts.entries()) {
        if (artifact.order !== index + 1) errors.push(`Artifact order must be explicit and contiguous: ${artifact.path ?? "unknown"}.`);
        const pathError = validateManifestPath(artifact.path, "Artifact path");
        if (pathError) errors.push(pathError);
        const content = files[artifact.path];
        if (content === undefined) {
            errors.push(`Manifest artifact is missing: ${artifact.path}.`);
        } else if (sha256(content) !== artifact.sha256) {
            errors.push(`Manifest artifact hash mismatch: ${artifact.path}.`);
        }
    }
    return { ok: errors.length === 0, errors };
}

export function verifyArtifactFiles(manifest, rootDirectory) {
    const root = path.resolve(rootDirectory);
    const read = (relativePath, label) => {
        const pathError = validateManifestPath(relativePath, label);
        if (pathError) throw new Error(pathError);
        const resolved = path.resolve(root, relativePath);
        const relative = path.relative(root, resolved);
        if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
            throw new Error(`${label} must resolve within the repository root.`);
        }
        return fs.readFileSync(resolved, "utf8");
    };
    const files = Object.fromEntries((manifest?.artifacts ?? []).map((artifact) => [artifact.path, read(artifact.path, "Artifact path")]));
    const sources = manifest?.sourceSchema?.path
        ? { [manifest.sourceSchema.path]: read(manifest.sourceSchema.path, "Source schema path") }
        : {};
    return verifyArtifactManifest(manifest, { files, sources });
}

export function verifyCheckedInArtifactManifest(rootDirectory) {
    const root = path.resolve(rootDirectory);
    const manifest = JSON.parse(fs.readFileSync(path.resolve(root, CHECKED_IN_MANIFEST_PATH), "utf8"));
    const result = verifyArtifactFiles(manifest, root);
    if (manifest.approved !== true ||
        manifest.artifacts.some((artifact) => artifact.classification !== "executable")) {
        result.ok = false;
        result.errors.push("The checked-in artifact manifest is not an approved executable package.");
    }
    return { manifest, ...result };
}

export { CHECKED_IN_MANIFEST_PATH, SHA256_PATTERN };
