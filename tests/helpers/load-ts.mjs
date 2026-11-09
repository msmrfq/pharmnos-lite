import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const nodeRequire = createRequire(import.meta.url);

function resolveSource(specifier, fromFile) {
  const base = specifier.startsWith("@/")
    ? path.join(root, "src", specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(candidate) && /\.(ts|tsx)$/.test(candidate)) return candidate;
  }
  return null;
}

/**
 * Evaluates production TypeScript sources in the current realm. `mocks` replaces
 * bare or aliased specifiers (for example "@/lib/db/prisma"); every other "@/" or
 * relative import is transpiled from src.
 */
export function createTsLoader(mocks = {}, options = {}) {
  const cache = new Map();
  const stub = () => new Proxy({ __esModule: true, default: () => null }, {
    get: (target, key) => (key in target ? target[key] : () => null),
  });

  function load(file) {
    const absolute = path.isAbsolute(file) ? file : path.join(root, file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} };
    cache.set(absolute, module);
    const js = ts.transpileModule(readFileSync(absolute, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      fileName: absolute,
    }).outputText;
    const require = (specifier) => {
      if (Object.prototype.hasOwnProperty.call(mocks, specifier)) return mocks[specifier];
      // With `realOnly`, only matching specifiers are evaluated; everything else is an inert stub (UI components, icons).
      if (options.realOnly && !options.realOnly(specifier)) return stub();
      const source = specifier.startsWith("@/") || specifier.startsWith(".") ? resolveSource(specifier, absolute) : null;
      if (source) return load(source);
      return nodeRequire(specifier);
    };
    vm.runInThisContext(`(function (exports, require, module) {${js}\n})`)(module.exports, require, module);
    return module.exports;
  }

  return { load, root };
}
