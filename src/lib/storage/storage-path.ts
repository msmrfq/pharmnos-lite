import type { TenantContext } from "@/lib/db/tenant-context";

function normalizeSegment(value: string, label: string): string {
    const normalized = value.normalize("NFKC").trim();
    if (!normalized || normalized === "." || normalized === ".." || normalized.includes("..")) {
        throw new Error(`${label} contains an invalid path segment.`);
    }
    if (normalized.includes("/") || normalized.includes("\\") || /[\u0000-\u001f\u007f]/.test(normalized)) {
        throw new Error(`${label} contains an invalid path separator or control character.`);
    }
    const safe = normalized.replace(/[^A-Za-z0-9._-]+/g, "_");
    if (!safe || safe === "." || safe === "..") {
        throw new Error(`${label} contains no usable path characters.`);
    }
    return safe;
}

export function buildTenantStoragePath(
    context: Pick<TenantContext, "tenantId">,
    documentType: string,
    objectId: string,
    filename: string,
): string {
    const tenantId = normalizeSegment(context?.tenantId ?? "", "Tenant ID");
    const type = normalizeSegment(documentType, "Document type");
    const resourceId = normalizeSegment(objectId, "Object ID");
    const safeFilename = normalizeSegment(filename, "Filename");
    return `${tenantId}/${type}/${resourceId}/${safeFilename}`;
}
