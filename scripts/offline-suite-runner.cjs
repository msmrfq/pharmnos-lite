#!/usr/bin/env node

const fs = require("node:fs");
const crypto = require("node:crypto");
const Module = require("node:module");
const path = require("node:path");
const typescript = require("typescript");

const root = path.resolve(__dirname, "..");

function safeRunId(value, suite) {
  const runId = String(value || `${suite}_${Date.now()}`);
  if (!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(runId)) {
    throw new Error("Offline suite run ID must use lowercase letters, digits, underscores, or hyphens.");
  }
  return runId;
}

function sanitizeError(error) {
  return String(error?.message ?? error ?? "offline suite failed")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-connection-string]")
    .slice(0, 500);
}

function installTypeScriptLoader(testFile) {
  process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
    module: "commonjs",
    moduleResolution: "node",
    jsx: "preserve",
  });

  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
    if (request.startsWith("@/")) {
      return originalResolve.call(this, path.join(root, "src", request.slice(2)), parent, isMain, options);
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };

  require("ts-node/register/transpile-only");
  const tsNodeLoader = require.extensions[".ts"];
  require.extensions[".ts"] = function loadTypeScript(module, filename) {
    if (path.resolve(filename) !== testFile) {
      return tsNodeLoader(module, filename);
    }

    const source = fs.readFileSync(filename, "utf8").replace(/^#!.*(?:\r?\n|$)/, "");
    const transpiled = typescript.transpileModule(source, {
      compilerOptions: {
        target: typescript.ScriptTarget.ES2022,
        module: typescript.ModuleKind.CommonJS,
        moduleResolution: typescript.ModuleResolutionKind.Node10,
        esModuleInterop: true,
        jsx: typescript.JsxEmit.Preserve,
        sourceMap: false,
      },
      fileName: filename,
    }).outputText;

    module._compile(`module.exports = (async () => {\n${transpiled}\n})();`, filename);
  };
}

function writeOfflineSuiteEvidence({ filePath, evidence }) {
  const outputPath = path.resolve(filePath);
  const serialized = JSON.stringify(evidence);
  if (/postgres(?:ql)?:\/\//i.test(serialized)) {
    throw new Error("Offline suite evidence cannot contain database connection strings.");
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
  return outputPath;
}

function sourceHashes(sourceFiles) {
  return Object.fromEntries(sourceFiles.map((file) => {
    const resolvedFile = path.resolve(root, file);
    if (!fs.existsSync(resolvedFile)) {
      throw new Error(`Offline suite source file does not exist: ${file}`);
    }
    return [
      file,
      crypto.createHash("sha256").update(fs.readFileSync(resolvedFile)).digest("hex"),
    ];
  }));
}

function normalizeSuiteResult(result) {
  if (!result || typeof result !== "object") {
    throw new Error("Offline suite did not publish its assertion result.");
  }
  const passed = Number(result.passed);
  const failed = Number(result.failed);
  const total = Number(result.total);
  if (![passed, failed, total].every(Number.isInteger) || passed < 0 || failed < 0 || total !== passed + failed) {
    throw new Error("Offline suite published an invalid assertion result.");
  }
  return {
    passed,
    failed,
    total,
    scenarios: Array.isArray(result.scenarios) ? result.scenarios : [],
  };
}

function runOfflineSuite({
  functionId,
  suite,
  testFile,
  sourceFiles = [testFile],
  evidenceEnvironmentVariable,
  runIdEnvironmentVariable,
  defaultEvidenceSlug,
  command,
  evidenceMarker,
  resultsMarker,
  failuresMarker,
}) {
  const resolvedTestFile = path.resolve(root, testFile);
  if (!fs.existsSync(resolvedTestFile)) {
    throw new Error(`Offline suite test file does not exist: ${testFile}`);
  }

  const runId = safeRunId(
    process.env[runIdEnvironmentVariable] || process.env.FINANCIAL_E2E_SUITE_RUN_ID,
    defaultEvidenceSlug.replace(/-/g, "_"),
  );
  const recordedAt = new Date().toISOString();
  const evidenceFile = path.resolve(
    process.env[evidenceEnvironmentVariable] ||
      path.join(root, ".obsidian-vault", "specs", `${defaultEvidenceSlug}-evidence-${runId}.json`),
  );
  const hashes = sourceHashes(sourceFiles);
  const exactCommand = process.env.npm_lifecycle_event
    ? `pnpm ${process.env.npm_lifecycle_event}`
    : command;

  let suiteResult = null;
  let status = "PASS";
  let error;

  Promise.resolve()
    .then(() => {
      installTypeScriptLoader(resolvedTestFile);
      return require(resolvedTestFile);
    })
    .then(() => {
      suiteResult = normalizeSuiteResult(globalThis.__OFFLINE_SUITE_RESULT__);
    })
    .catch((failure) => {
      status = "FAIL";
      error = sanitizeError(failure);
      try {
        suiteResult = normalizeSuiteResult(globalThis.__OFFLINE_SUITE_RESULT__);
      } catch {
        suiteResult = { passed: 0, failed: 1, total: 1, scenarios: [] };
      }
    })
    .then(() => {
      const evidence = {
        evidenceVersion: 1,
        function: functionId,
        suite,
        runId,
        recordedAt,
        command: exactCommand,
        sourceIdentity: {
          algorithm: "SHA-256",
          files: hashes,
        },
        offline: true,
        databaseAccessed: false,
        targetBound: false,
        status: status === "PASS" && suiteResult.failed === 0 ? "PASS" : "FAIL",
        passed: suiteResult.passed,
        failed: suiteResult.failed,
        total: suiteResult.total,
        scenarios: suiteResult.scenarios,
        evidenceRecordingSucceeded: true,
        ...(error ? { error } : {}),
      };
      try {
        const outputPath = writeOfflineSuiteEvidence({ filePath: evidenceFile, evidence });
        console.log(`${evidenceMarker}=${outputPath}`);
        console.log(`${resultsMarker}=${evidence.total}`);
        console.log(`${failuresMarker}=${evidence.failed}`);
        if (evidence.status !== "PASS") process.exitCode = 1;
      } catch (writeError) {
        console.error(sanitizeError(writeError));
        process.exitCode = 1;
      }
    });
}

module.exports = {
  runOfflineSuite,
  writeOfflineSuiteEvidence,
};
