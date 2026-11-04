#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  createLifecycleEvidence,
  loadAuthorizedTargetLifecycle,
  loadFinancialE2eEnvironment,
  validateComposeTargetSnapshot,
  writeLifecycleEvidence,
} from "./financial-e2e-target-lifecycle.mjs";

const COMPOSE_FILE = "docker-compose.financial-e2e.yml";

function commandResult(command, args, environment, runner = spawnSync) {
  const result = runner(command, args, {
    cwd: process.cwd(),
    env: environment,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const detail = String(result.stderr ?? result.stdout ?? "").replace(/\s+/g, " ").trim();
    throw new Error(`Docker Compose command failed${detail ? `: ${detail}` : "."}`);
  }
  return String(result.stdout ?? "");
}

export function buildComposeArgs({
  action,
  composeProject,
  composeFile = COMPOSE_FILE,
  profile = "financial-e2e",
} = {}) {
  if (!["up", "down", "ps"].includes(action)) throw new Error(`Unsupported Compose action: ${action}.`);
  const args = ["compose", "--project-name", composeProject, "--file", composeFile, "--profile", profile];
  if (action === "up") return [...args, "up", "--detach", "--no-build", "--wait"];
  if (action === "down") return [...args, "down", "--volumes"];
  return [...args, "ps", "--all", "--quiet"];
}

function parseContainerInspection(raw, lifecycle) {
  const inspected = JSON.parse(raw);
  const container = Array.isArray(inspected) ? inspected[0] : inspected;
  if (!container) throw new Error("The exact Compose target container was not found.");
  const labels = container.Config?.Labels ?? {};
  const bindings = container.HostConfig?.PortBindings?.["5432/tcp"] ?? [];
  const port = bindings[0]?.HostPort;
  const mounts = container.Mounts ?? [];
  const tmpfs = container.HostConfig?.Tmpfs ?? {};
  const hasTmpfs = Object.keys(tmpfs).length > 0 || mounts.some((mount) => mount.Type === "tmpfs");
  const hasNonTmpfs = mounts.some((mount) => mount.Type !== "tmpfs");
  const storage = hasTmpfs && !hasNonTmpfs
    ? "tmpfs"
    : mounts.length === 0 ? "missing" : "non-tmpfs";
  return {
    project: labels["com.docker.compose.project"],
    service: labels["com.docker.compose.service"],
    profile: lifecycle.contract.composeProfile,
    image: container.Config?.Image,
    host: bindings[0]?.HostIp,
    port,
    containerPort: 5432,
    restartPolicy: container.HostConfig?.RestartPolicy?.Name || "no",
    storage,
    isolationLabel: labels["com.pharmnos.environment"],
    containerCount: Array.isArray(inspected) ? inspected.length : 1,
    containerId: container.Id,
  };
}

export function validateComposeInspection(snapshot, contract) {
  return validateComposeTargetSnapshot(snapshot, contract);
}

function inspectExactTarget(environment, lifecycle, runner) {
  const ids = commandResult(
    "docker",
    buildComposeArgs({
      action: "ps",
      composeProject: lifecycle.contract.composeProject,
      profile: lifecycle.contract.composeProfile,
    }),
    environment,
    runner,
  ).split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  if (ids.length !== 1) {
    throw new Error(`Expected exactly one exact-target Compose container; found ${ids.length}.`);
  }
  const raw = commandResult("docker", ["inspect", ids[0]], environment, runner);
  const snapshot = parseContainerInspection(raw, lifecycle);
  const validation = validateComposeInspection(snapshot, lifecycle.contract);
  if (!validation.ok) throw new Error(`Compose target gate failed: ${validation.errors.join(" ")}`);
  return snapshot;
}

function readInfrastructureEvidence(environment) {
  const filePath = environment.FINANCIAL_E2E_INFRASTRUCTURE_EVIDENCE_FILE;
  if (!filePath) throw new Error("Infrastructure evidence is required before cleanup.");
  let evidence;
  try {
    evidence = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
  } catch {
    throw new Error("Infrastructure evidence is unreadable.");
  }
  const containerId = evidence?.details?.containerId;
  if (!containerId || evidence.status !== "PASS") {
    throw new Error("Infrastructure evidence does not record an owned exact-target container.");
  }
  return containerId;
}

export function runFinancialE2eCompose({
  action = process.argv[2],
  env = process.env,
  runner = spawnSync,
} = {}) {
  if (!["up", "down"].includes(action)) throw new Error("Use `up` or `down` for the contract-bound Compose lifecycle.");
  const environment = loadFinancialE2eEnvironment(env);
  const phase = action === "up" ? "INFRASTRUCTURE_CREATION" : "CLEANUP_AUTHORIZATION";
  if (action === "down" && environment.FINANCIAL_E2E_CLEANUP_MODE !== "DISPOSABLE_TARGET_DISPOSAL") {
    throw new Error("Compose disposal requires FINANCIAL_E2E_CLEANUP_MODE=DISPOSABLE_TARGET_DISPOSAL.");
  }
  const lifecycle = loadAuthorizedTargetLifecycle({ env: environment, phase });
  const composeFile = path.resolve(environment.FINANCIAL_E2E_COMPOSE_FILE || COMPOSE_FILE);
  if (!fs.existsSync(composeFile)) throw new Error(`Compose file does not exist: ${composeFile}`);
  const composeArgs = buildComposeArgs({
    action,
    composeProject: lifecycle.contract.composeProject,
    composeFile,
    profile: lifecycle.contract.composeProfile,
  });
  const existing = commandResult(
    "docker",
    buildComposeArgs({
      action: "ps",
      composeProject: lifecycle.contract.composeProject,
      profile: lifecycle.contract.composeProfile,
      composeFile,
    }),
    environment,
    runner,
  ).split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  if (action === "up" && existing.length > 0) {
    throw new Error("The authorized Compose project already has a container; refusing to adopt pre-existing infrastructure.");
  }
  if (action === "down") {
    const snapshot = inspectExactTarget(environment, lifecycle, runner);
    const recordedContainerId = readInfrastructureEvidence(environment);
    if (snapshot.containerId !== recordedContainerId ||
        (environment.FINANCIAL_E2E_CREATED_CONTAINER_ID &&
          environment.FINANCIAL_E2E_CREATED_CONTAINER_ID !== snapshot.containerId)) {
      throw new Error("Cleanup is not authorized for the exact recorded Compose container.");
    }
  }
  commandResult("docker", composeArgs, environment, runner);
  let details = { composeProject: lifecycle.contract.composeProject, action };
  if (action === "up") {
    details = {
      ...details,
      ...inspectExactTarget(environment, lifecycle, runner),
    };
  } else {
    const remaining = commandResult(
      "docker",
      buildComposeArgs({
        action: "ps",
        composeProject: lifecycle.contract.composeProject,
        profile: lifecycle.contract.composeProfile,
        composeFile,
      }),
      environment,
      runner,
    ).split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (remaining.length !== 0) throw new Error("Compose cleanup left an exact-target container behind.");
    details.verifiedAbsent = true;
  }
  const evidence = createLifecycleEvidence({ phase, lifecycle, details });
  const output = writeLifecycleEvidence({
    filePath: environment[phase === "INFRASTRUCTURE_CREATION"
      ? "FINANCIAL_E2E_INFRASTRUCTURE_EVIDENCE_FILE"
      : "FINANCIAL_E2E_CLEANUP_EVIDENCE_FILE"],
    evidence,
  });
  console.log(`FINANCIAL_E2E_COMPOSE=${action.toUpperCase()}_PASS`);
  console.log(`FINANCIAL_E2E_COMPOSE_EVIDENCE=${output}`);
  return { lifecycle, evidence, output };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runFinancialE2eCompose();
  } catch (error) {
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  }
}
