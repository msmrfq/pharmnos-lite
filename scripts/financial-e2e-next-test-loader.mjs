import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stubs = {
  "next/cache": pathToFileURL(path.join(root, "scripts", "financial-e2e-next-test-stubs.mjs")).href,
  "next/navigation": pathToFileURL(path.join(root, "scripts", "financial-e2e-next-test-stubs.mjs")).href,
  "next/headers": pathToFileURL(path.join(root, "scripts", "financial-e2e-next-test-stubs.mjs")).href,
  "next/link": pathToFileURL(path.join(root, "scripts", "financial-e2e-next-test-stubs.mjs")).href,
};

async function findFile(url) {
  const base = fileURLToPath(url);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.js"),
    path.join(base, "index.mjs"),
  ]) {
    try {
      if ((await fs.stat(candidate)).isFile()) return pathToFileURL(candidate).href;
    } catch {}
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (stubs[specifier]) return { url: stubs[specifier], shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const found = await findFile(pathToFileURL(path.join(root, "src", specifier.slice(2))).href);
    if (found) return { url: found, shortCircuit: true };
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parent = context.parentURL ? path.dirname(fileURLToPath(context.parentURL)) : root;
    const found = await findFile(pathToFileURL(path.resolve(parent, specifier)).href);
    if (found) return { url: found, shortCircuit: true };
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.endsWith(".js") && !specifier.endsWith(".mjs")) {
      return nextResolve(`${specifier}.js`, context);
    }
    throw error;
  }
}
