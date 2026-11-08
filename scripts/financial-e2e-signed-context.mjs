import crypto from "node:crypto";

export function createSignedFinancialContext(subjectId, tenantId = "", secret = process.env.DATABASE_AUTH_CONTEXT_SIGNING_SECRET) {
    if (!secret || secret.length < 32) throw new Error("DATABASE_AUTH_CONTEXT_SIGNING_SECRET is required.");
    if (!subjectId || /[|.]/.test(subjectId) || /[|.]/.test(tenantId)) {
        throw new Error("Financial authentication context contains invalid identity data.");
    }
    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    const nonce = crypto.randomBytes(16).toString("hex");
    const payload = `v1|${subjectId}|${tenantId}|${expiresAt}|${nonce}`;
    return `${payload}.${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
}
