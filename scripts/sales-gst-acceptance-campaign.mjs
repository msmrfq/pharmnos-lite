#!/usr/bin/env node
/**
 * Sales GST acceptance campaign orchestrator.
 *
 * Creates a uniquely identified disposable PostgreSQL target, runs the
 * Sales GST acceptance suite against it in FRESH_PROVISIONING mode, captures
 * evidence, and then disposes of the mission-created target at the database
 * level. Database-level disposal removes immutable financial history without
 * bypassing `prevent_financial_history_mutation()` or any other protection.
 *
 * The evidence-bearing 0419 target and every pre-existing container are
 * deliberately left untouched. This orchestrator only manages containers it
 * creates for the current campaign.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawnSync } from "node:child_process";

const COMPOSE_FILE = "docker-compose.financial-e2e.yml";
const COMPOSE_PROFILE = "financial-e2e";
const COMPOSE_SERVICE = "financial-e2e-postgres";
const ISOLATION_LABEL = "financial-e2e-isolated";
const BOOTSTRAP_ROLE = "pharmnos_e2e";
const RUNTIME_ROLE = "pharmnos_e2e_runtime";
const MARKER = "pharmnos-financial-e2e";
const ACCEPTANCE_SCRIPT = "scripts/sales-gst-application-acceptance.cjs";
const DEFAULT_BASE_ENV =
    "C:\\Users\\Masum Rafique\\.copilot\\session-state\\de6b39fc-5872-46e6-8130-58843b8116f4\\gst-runtime-0419.env";
const PORT_FLOOR = 55450;

function parseEnvFile(filePath) {
    const values = {};
    if (!filePath || !fs.existsSync(filePath)) return values;
    for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
        const line = raw.trim();
        const separator = line.indexOf("=");
        if (separator <= 0 || line.startsWith("#")) continue;
        values[line.slice(0, separator)] = line.slice(separator + 1).replace(/^(['"])(.*)\1$/, "$2");
    }
    return values;
}

async function findFreePort(start) {
    for (let port = start; port < start + 500; port += 1) {
        const available = await new Promise((resolve) => {
            const server = net.createServer();
            server.unref();
            server.once("error", () => resolve(false));
            server.listen(port, "127.0.0.1", () => {
                server.close(() => resolve(true));
            });
        });
        if (available) return port;
    }
    throw new Error("No free loopback port found for the disposable target.");
}

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        ...options,
    });
    return result;
}

function fail(message, logs = []) {
    console.error(`SALES-GST-CAMPAIGN=FAIL ${message}`);
    if (logs.length) console.error(logs.join(""));
    process.exitCode = 1;
    throw new Error(message);
}

async function main() {
    const baseEnvArg = process.argv.indexOf("--base-env");
    const baseEnvPath = baseEnvArg >= 0 ? process.argv[baseEnvArg + 1] : DEFAULT_BASE_ENV;
    const base = parseEnvFile(baseEnvPath);
    if (!base.DATABASE_URL) {
        throw new Error("The base environment must provide the ordinary DATABASE_URL reference.");
    }

    const suffix = `${Date.now().toString(36)}${crypto.randomBytes(4).toString("hex")}`;
    const port = await findFreePort(PORT_FLOOR);
    const databaseName = `pharmnos_financial_e2e_salesgst_${suffix}`;
    const composeProject = `pharmnoslite-financial-e2e-salesgst-${suffix}`;
    const bootstrapPassword = crypto.randomBytes(18).toString("base64url");
    const runtimePassword = crypto.randomBytes(18).toString("base64url");
    const runId = `sales_gst_campaign_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

    const environment = {
        ALLOW_FINANCIAL_E2E: "true",
        DATABASE_URL: base.DATABASE_URL,
        DIRECT_URL: base.DIRECT_URL ?? base.DATABASE_URL,
        TEST_DATABASE_URL: `postgresql://${BOOTSTRAP_ROLE}:${bootstrapPassword}@127.0.0.1:${port}/${databaseName}?application_name=${MARKER}`,
        TEST_DATABASE_NAME: databaseName,
        TEST_DATABASE_MARKER: MARKER,
        FINANCIAL_E2E_DB_PORT: String(port),
        FINANCIAL_E2E_DB_USER: BOOTSTRAP_ROLE,
        FINANCIAL_E2E_DB_PASSWORD: bootstrapPassword,
        FINANCIAL_E2E_DB_NAME: databaseName,
        FINANCIAL_E2E_RUNTIME_DB_USER: RUNTIME_ROLE,
        FINANCIAL_E2E_RUNTIME_DB_PASSWORD: runtimePassword,
        FINANCIAL_E2E_RUNTIME_DATABASE_URL: `postgresql://${RUNTIME_ROLE}:${runtimePassword}@127.0.0.1:${port}/${databaseName}?application_name=${MARKER}`,
        FINANCIAL_E2E_COMPOSE_PROJECT: composeProject,
        FINANCIAL_E2E_CLEANUP_MODE: "DISPOSABLE_TARGET_DISPOSAL",
    };

    const evidenceDir = process.env.FINANCIAL_E2E_EVIDENCE_DIR
        || path.join(os.homedir(), ".copilot", "session-state", "36655790-940b-43b8-a4bc-ed460b133e52", "files");
    fs.mkdirSync(evidenceDir, { recursive: true });
    const logPath = path.join(evidenceDir, `sales-gst-acceptance-${suffix}.log`);
    const summaryPath = path.join(evidenceDir, `sales-gst-acceptance-${suffix}.json`);
    const composeEnvPath = path.join(os.tmpdir(), `pharmnos-salesgst-${suffix}.env`);
    fs.writeFileSync(composeEnvPath, [
        `FINANCIAL_E2E_DB_USER=${BOOTSTRAP_ROLE}`,
        `FINANCIAL_E2E_DB_PASSWORD=${bootstrapPassword}`,
        `FINANCIAL_E2E_DB_NAME=${databaseName}`,
        `FINANCIAL_E2E_DB_PORT=${port}`,
        "",
    ].join("\n"), "utf8");

    const summary = {
        runId,
        suffix,
        port,
        databaseName,
        composeProject,
        baseEnvPath,
        logPath,
        startedAt: new Date().toISOString(),
        containerCreated: false,
        targetVerified: false,
        acceptanceExitCode: null,
        disposed: false,
        disposalVerified: false,
    };

    console.log(`SALES-GST-CAMPAIGN=START runId=${runId}`);
    console.log(`TARGET_DATABASE=${databaseName}`);
    console.log(`TARGET_PORT=${port}`);
    console.log(`TARGET_COMPOSE_PROJECT=${composeProject}`);

    const composeBase = ["--env-file", composeEnvPath, "-p", composeProject, "-f", COMPOSE_FILE];
    try {
        const up = run("docker", [
            "compose", ...composeBase, "--profile", COMPOSE_PROFILE, "up", "-d", "--wait",
        ]);
        if (up.status !== 0) {
            fail(`docker compose up failed:\n${up.stdout}\n${up.stderr}`);
        }
        summary.containerCreated = true;
        console.log("TARGET_CONTAINER=CREATED");

        const inspect = run("docker", [
            "ps", "--filter", `label=com.docker.compose.project=${composeProject}`,
            "--format", "{{.ID}}",
        ]);
        const containerIds = (inspect.stdout || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        if (containerIds.length !== 1) {
            fail(`Expected exactly one mission-created container, found ${containerIds.length}.`);
        }
        const containerId = containerIds[0];
        const labelsRaw = run("docker", ["inspect", containerId, "--format", "{{json .Config.Labels}}"]).stdout;
        const labels = JSON.parse(labelsRaw || "{}");
        const portsRaw = run("docker", ["inspect", containerId, "--format", "{{json .NetworkSettings.Ports}}"]).stdout;
        const ports = JSON.parse(portsRaw || "{}");
        if (labels["com.docker.compose.project"] !== composeProject ||
            labels["com.docker.compose.service"] !== COMPOSE_SERVICE ||
            labels["com.pharmnos.environment"] !== ISOLATION_LABEL) {
            fail(`Mission-created container identity mismatch: ${labelsRaw}`);
        }
        const hostPorts = Object.values(ports ?? {}).flat()
            .filter((binding) => binding && binding.HostIp === "127.0.0.1")
            .map((binding) => binding.HostPort);
        if (!hostPorts.includes(String(port))) {
            fail(`Mission-created container is not bound to 127.0.0.1:${port}.`);
        }
        summary.targetVerified = true;
        console.log("TARGET_IDENTITY=VERIFIED");
        console.log(`TARGET_CONTAINER_ID=${containerId}`);

        const acceptance = run(process.execPath, [ACCEPTANCE_SCRIPT], {
            cwd: process.cwd(),
            env: { ...process.env, ...environment },
        });
        summary.acceptanceExitCode = acceptance.status;
        fs.writeFileSync(logPath, `${acceptance.stdout ?? ""}\n${acceptance.stderr ?? ""}\n`, "utf8");
        console.log(`ACCEPTANCE_LOG=${logPath}`);
        if (acceptance.status === 0) {
            console.log("SALES-GST-ACCEPTANCE=PASS");
        } else {
            console.error("SALES-GST-ACCEPTANCE=FAIL");
            console.error(acceptance.stdout ?? "");
            console.error(acceptance.stderr ?? "");
        }
        summary.acceptancePassed = acceptance.status === 0;
    } catch (error) {
        summary.error = String(error?.message ?? error);
    } finally {
        if (summary.containerCreated) {
            const down = run("docker", [
                "compose", ...composeBase, "--profile", COMPOSE_PROFILE,
                "down", "--volumes", "--remove-orphans", "--timeout", "5",
            ]);
            if (down.status === 0) {
                summary.disposed = true;
                console.log("TARGET_DISPOSAL=REQUESTED");
            } else {
                console.error(`TARGET_DISPOSAL=FAILED\n${down.stdout}\n${down.stderr}`);
            }
            const remaining = run("docker", [
                "ps", "-a", "--filter", `label=com.docker.compose.project=${composeProject}`,
                "--format", "{{.ID}}",
            ]);
            summary.disposalVerified = (remaining.stdout || "").trim() === "";
            console.log(`TARGET_DISPOSAL=${summary.disposalVerified ? "VERIFIED" : "UNVERIFIED"}`);
        }
        try { fs.unlinkSync(composeEnvPath); } catch {}
        summary.completedAt = new Date().toISOString();
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
        console.log(`SALES-GST-CAMPAIGN-SUMMARY=${summaryPath}`);
    }

    if (!summary.acceptancePassed || !summary.disposed || !summary.disposalVerified) {
        console.error("SALES-GST-CAMPAIGN=INCOMPLETE");
        process.exitCode = 1;
        return;
    }
    console.log("SALES-GST-CAMPAIGN=COMPLETE");
}

main().catch((error) => {
    console.error(error?.stack ?? error);
    process.exitCode = 1;
});
