#!/usr/bin/env node
// scripts/storage-smoke.mjs  (Plain Node ESM, no new packages, no ts-node)
// Pharmnos Lite P7 T3 Storage smoke test: ensure→upload→list→signedUrl→delete→list-empty
// Manual env parse to avoid installing dotenv.

import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENV_LOCAL = path.join(ROOT, ".env.local");
const ENV_EXAMPLE = path.join(ROOT, ".env.example");

function loadEnv(envFile) {
  const out = {};
  if (!existsSync(envFile)) return out;
  const txt = readFileSync(envFile, "utf8");
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = { ...loadEnv(ENV_EXAMPLE), ...loadEnv(ENV_LOCAL), ...process.env };
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = env.SUPABASE_STORAGE_BUCKET || env.SUPABASE_BUCKET || "pharmnos-documents";
const DEMO_TENANT_ID = "tn_maharashtra_pharma_0000000000001";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("FAIL: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const rand6 = randomBytes(3).toString("hex");
const KEY = `${DEMO_TENANT_ID}/smoketest/p7-${today}-${rand6}.txt`;
const CONTENT = `Pharmnos Lite P7 storage smoke. Date: ${new Date().toISOString()}\nRand: ${rand6}\n`;
const SIGNED_EXPIRES_SEC = 60;

function assert(cond, msg) {
  if (!cond) {
    console.error(`  ✗ ASSERT FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${msg}`);
}

async function main() {
  console.log(`[P7 Storage Smoke] bucket=${BUCKET} url=${SUPABASE_URL} key=${KEY}`);
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

  // Step 0: list buckets → ensure bucket exists
  {
    const { data: buckets, error } = await sb.storage.listBuckets();
    if (error) {
      if (String(error.message || "").includes("42501") || String(error).includes("permission")) {
        console.error("Storage 42501: run MCP execute_sql grants on storage schema then retry.");
      }
      throw error;
    }
    const names = (buckets || []).map((b) => b.name);
    console.log(`  - existing buckets: ${names.join(", ") || "(none)"}`);
    if (!names.includes(BUCKET)) {
      const { error: createErr } = await sb.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: 52428800,
        allowedMimeTypes: [
          "application/pdf",
          "text/csv",
          "image/png",
          "image/jpeg",
          "application/json",
          "text/plain",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
      });
      if (createErr) throw createErr;
      console.log(`  ✓ created bucket ${BUCKET}`);
    } else {
      console.log(`  ✓ bucket ${BUCKET} already exists`);
    }
  }

  // Step 1: upload short buffer text/plain
  {
    const { data, error } = await sb.storage
      .from(BUCKET)
      .upload(KEY, Buffer.from(CONTENT, "utf8"), { contentType: "text/plain", upsert: true });
    if (error) throw error;
    assert(!!data, `uploaded ${KEY} (${CONTENT.length} B)`);
  }

  // Step 2: list prefix smoketest/ assert 1 file size>0
  {
    const { data, error } = await sb.storage.from(BUCKET).list(`${DEMO_TENANT_ID}/smoketest/`, { limit: 100 });
    if (error) throw error;
    const items = (data || []).filter((f) => f.name && f.name.endsWith(`${rand6}.txt`));
    assert(items.length === 1, `list prefix smoketest/ => ${items.length} file(s), first size>0 => ${(items[0]?.metadata?.size ?? 0) > 0 ? "yes" : "no"} (${items[0]?.metadata?.size ?? 0} B)`);
    assert(items[0]?.metadata?.size > 0, "uploaded file size>0");
  }

  // Step 3: getSignedUrl 60s assert https prefix
  {
    const { data, error } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(KEY, SIGNED_EXPIRES_SEC);
    if (error) throw error;
    const url = data?.signedUrl || "";
    assert(url.startsWith("https://") || url.startsWith("http://"), `signedUrl prefix ok (${url.slice(0, 24)}...)`);
  }

  // Step 4: delete smoke file
  {
    const { error } = await sb.storage.from(BUCKET).remove([KEY]);
    if (error) throw error;
    assert(true, `removed ${KEY}`);
  }

  // Step 5: list empty assert
  {
    const { data, error } = await sb.storage.from(BUCKET).list(`${DEMO_TENANT_ID}/smoketest/`, { limit: 100 });
    if (error) throw error;
    const remain = (data || []).filter((f) => f.name && f.name.endsWith(`${rand6}.txt`));
    assert(remain.length === 0, `smoketest/ empty after delete (remaining=${remain.length})`);
  }

  console.log("P7 Storage Smoke: PASS");
}

main().catch((err) => {
  console.error("P7 Storage Smoke: FAIL");
  console.error(err.stack || String(err));
  process.exit(1);
});
