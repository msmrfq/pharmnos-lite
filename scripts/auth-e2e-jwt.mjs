import crypto from "node:crypto";

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

export function createHs256Jwt({ secret, role, subject = "auth-e2e-service", expiresInSeconds = 86400 }) {
  if (!secret || !role) throw new Error("JWT secret and role are required.");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    aud: "authenticated",
    exp: now + expiresInSeconds,
    iat: now,
    iss: "supabase",
    role,
    sub: subject,
  }));
  const input = `${header}.${payload}`;
  const signature = crypto.createHmac("sha256", secret).update(input).digest("base64url");
  return `${input}.${signature}`;
}

export function createAuthKeys(secret) {
  return {
    anon: createHs256Jwt({ secret, role: "anon" }),
    serviceRole: createHs256Jwt({ secret, role: "service_role" }),
  };
}
