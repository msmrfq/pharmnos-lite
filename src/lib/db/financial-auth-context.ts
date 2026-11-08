import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const CONTEXT_VERSION = "v1";
const CONTEXT_TTL_SECONDS = 60;

function secret(): string {
  const value = process.env.DATABASE_AUTH_CONTEXT_SIGNING_SECRET;
  if (!value || value.length < 32) {
    throw new Error("Database authentication context signing secret is not configured.");
  }
  return value;
}

function component(value: string, label: string): string {
  if (!value || value.includes("|") || value.includes(".")) {
    throw new Error(`${label} is invalid for database authentication context.`);
  }
  return value;
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createFinancialAuthContext(subjectId: string, tenantId = ""): string {
  const expiresAt = Math.floor(Date.now() / 1000) + CONTEXT_TTL_SECONDS;
  const nonce = randomBytes(16).toString("hex");
  const payload = [
    CONTEXT_VERSION,
    component(subjectId, "Subject"),
    tenantId ? component(tenantId, "Tenant") : "",
    String(expiresAt),
    nonce,
  ].join("|");
  return `${payload}.${signature(payload)}`;
}

export function verifyFinancialAuthContext(context: string): {
  subjectId: string;
  tenantId: string;
  expiresAt: number;
} {
  const [payload, providedSignature] = context.split(".", 2);
  const [version, subjectId, tenantId, expiresAtText, nonce] = (payload ?? "").split("|", 5);
  if (!version || !subjectId || !expiresAtText || !nonce || !providedSignature || version !== CONTEXT_VERSION) {
    throw new Error("Database authentication context is malformed.");
  }
  if (!/^[0-9a-f]{32}$/.test(nonce)) {
    throw new Error("Database authentication context nonce is invalid.");
  }
  const signedPayload = [version, subjectId, tenantId ?? "", expiresAtText, nonce].join("|");
  const expected = signature(signedPayload);
  const provided = Buffer.from(providedSignature, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  if (provided.length !== expectedBytes.length || !timingSafeEqual(provided, expectedBytes)) {
    throw new Error("Database authentication context signature is invalid.");
  }
  const expiresAt = Number(expiresAtText);
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new Error("Database authentication context is expired.");
  }
  return { subjectId, tenantId: tenantId ?? "", expiresAt };
}
