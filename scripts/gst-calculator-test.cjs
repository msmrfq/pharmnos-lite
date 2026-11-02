#!/usr/bin/env node

const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const typescript = require("typescript");

const root = path.resolve(__dirname, "..");
const testFile = path.resolve(root, "tests", "gst-calculator.test.ts");
const originalResolve = Module._resolveFilename;

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
  jsx: "preserve",
});

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

Promise.resolve()
  .then(() => require(testFile))
  .then(() => {
    console.log("GST_CALCULATOR_RUNNER=PASS_TS_NODE_TOP_LEVEL_AWAIT");
  })
  .catch((error) => {
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  });
