import { spawn } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

import {
    getBackendAgentDir,
    getStrategiesDir,
    loadRunSnapshot,
} from "@/lib/strategy-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const RETEST_SCRIPT = `
import json
import os

from alpaca_tools import run_backtest

payload = json.loads(os.environ["TAURUS_RETEST_PAYLOAD"])
result = run_backtest(
    strategy_path=payload["strategy_path"],
    symbol=payload["symbol"],
    timeframe=payload["timeframe"],
    start=payload["start"],
    end=payload["end"],
    initial_cash=float(payload.get("initial_cash", 10000.0)),
    commission_per_trade=float(payload.get("commission_per_trade", 0.0)),
    slippage_bps=float(payload.get("slippage_bps", 0.0)),
    feed=payload.get("feed", "iex"),
    adjustment=payload.get("adjustment", "raw"),
    params_json=payload.get("params_json", "{}"),
    run_directory_name=payload.get("run_directory_name"),
)
print(json.dumps({
    "run_directory": result.get("run_directory"),
    "summary": result.get("summary"),
    "artifacts": result.get("artifacts"),
}, default=str))
`.trim();

function resolveBackendRoot() {
    return path.resolve(getBackendAgentDir(), "..");
}

function isPathInside(parentPath, childPath) {
    const relativePath = path.relative(parentPath, childPath);
    return Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function buildRunnerCandidates() {
    const backendRoot = resolveBackendRoot();
    const configuredPython = process.env.TAURUS_STRATEGY_PYTHON?.trim();
    const candidates = [];

    if (configuredPython) {
        candidates.push({
            command: configuredPython,
            argsPrefix: [],
            label: configuredPython,
        });
    }

    const localCandidates = process.platform === "win32"
        ? [
            path.join(backendRoot, ".venv", "Scripts", "python.exe"),
            path.join(backendRoot, "venv", "Scripts", "python.exe"),
        ]
        : [
            path.join(backendRoot, ".venv", "bin", "python"),
            path.join(backendRoot, "venv", "bin", "python"),
        ];

    for (const pythonPath of localCandidates) {
        if (existsSync(pythonPath)) {
            candidates.push({
                command: pythonPath,
                argsPrefix: [],
                label: pythonPath,
            });
        }
    }

    candidates.push(
        { command: "python3", argsPrefix: [], label: "python3" },
        { command: "python", argsPrefix: [], label: "python" },
        { command: "py", argsPrefix: ["-3"], label: "py -3" },
    );

    return candidates;
}

function extractJsonLine(stdout) {
    const lines = stdout
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean);

    for (let index = lines.length - 1; index >= 0; index -= 1) {
        const line = lines[index];
        if (!line.startsWith("{") || !line.endsWith("}")) {
            continue;
        }

        try {
            return JSON.parse(line);
        } catch {
            continue;
        }
    }

    return null;
}

function runRetestWithRunner({ runner, payload }) {
    const backendDir = getBackendAgentDir();

    return new Promise((resolve, reject) => {
        const child = spawn(
            runner.command,
            [...runner.argsPrefix, "-c", RETEST_SCRIPT],
            {
                cwd: backendDir,
                env: {
                    ...process.env,
                    PYTHONUNBUFFERED: "1",
                    TAURUS_RETEST_PAYLOAD: JSON.stringify(payload),
                },
                stdio: ["ignore", "pipe", "pipe"],
            },
        );

        let stdout = "";
        let stderr = "";
        const timeout = setTimeout(() => {
            child.kill();
            reject(new Error(`Timed out after ${DEFAULT_TIMEOUT_MS}ms while waiting for the retest backend.`));
        }, DEFAULT_TIMEOUT_MS);

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });

        child.on("error", (error) => {
            clearTimeout(timeout);
            reject({
                error: `${runner.label}: ${error.message}`,
                stdout,
                stderr,
            });
        });

        child.on("close", (code) => {
            clearTimeout(timeout);
            if (code === 0) {
                resolve({ stdout, stderr, result: extractJsonLine(stdout) });
                return;
            }

            reject({
                error: stderr.trim() || stdout.trim() || `${runner.label} exited with code ${code}.`,
                stdout,
                stderr,
            });
        });
    });
}

async function writeRunMetadata(runDirectory, metadata) {
    const metadataPath = path.join(getBackendAgentDir(), "outputs", runDirectory, "run_metadata.json");
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
}

export async function POST(request) {
    let strategyPath = "";
    let originalCode = "";

    try {
        const { runDirectory, code } = await request.json();
        if (typeof runDirectory !== "string" || !runDirectory.trim()) {
            return Response.json({ error: "runDirectory is required." }, { status: 400 });
        }

        if (typeof code !== "string" || !code.trim()) {
            return Response.json({ error: "Edited strategy code is required." }, { status: 400 });
        }

        const snapshot = await loadRunSnapshot(runDirectory.trim());
        if (!snapshot) {
            return Response.json({ error: "Run snapshot not found." }, { status: 404 });
        }

        if (!snapshot.strategyPath || !snapshot.backtest) {
            return Response.json(
                { error: "This run does not have enough strategy metadata to retest." },
                { status: 400 },
            );
        }

        strategyPath = path.resolve(snapshot.strategyPath);
        const strategiesDir = path.resolve(getStrategiesDir());
        if (!isPathInside(strategiesDir, strategyPath)) {
            return Response.json({ error: "Resolved strategy path is outside the strategies directory." }, { status: 400 });
        }

        originalCode = await fs.readFile(strategyPath, "utf-8");
        await fs.writeFile(strategyPath, code.replace(/\r\n/gu, "\n"), "utf-8");

        const payload = {
            strategy_path: strategyPath,
            symbol: snapshot.backtest.symbol,
            timeframe: snapshot.backtest.timeframe,
            start: snapshot.backtest.start,
            end: snapshot.backtest.end,
            initial_cash: snapshot.backtest.initialCash,
            feed: snapshot.metadata?.feed ?? "iex",
            adjustment: snapshot.metadata?.adjustment ?? "raw",
            commission_per_trade: snapshot.metadata?.commission_per_trade ?? 0,
            slippage_bps: snapshot.metadata?.slippage_bps ?? 0,
            params_json: snapshot.metadata?.params_json ?? "{}",
            run_directory_name: snapshot.runDirectory,
        };

        const attempts = [];
        let lastFailure = null;

        for (const runner of buildRunnerCandidates()) {
            try {
                await runRetestWithRunner({ runner, payload });
                const generatedAt = new Date().toISOString();
                await writeRunMetadata(snapshot.runDirectory, {
                    ...(snapshot.metadata ?? {}),
                    generatedAt,
                    retestedAt: generatedAt,
                });

                const refreshedSnapshot = await loadRunSnapshot(snapshot.runDirectory);
                return Response.json({
                    ok: true,
                    runDirectory: snapshot.runDirectory,
                    generatedAt: refreshedSnapshot?.generatedAt ?? generatedAt,
                    summary: refreshedSnapshot?.summary ?? {},
                });
            } catch (error) {
                const failure = {
                    error: error?.error ?? (error instanceof Error ? error.message : "Retest failed."),
                    stdout: error?.stdout ?? "",
                    stderr: error?.stderr ?? "",
                };
                attempts.push(failure.error);
                lastFailure = failure;
            }
        }

        await fs.writeFile(strategyPath, originalCode, "utf-8");
        return Response.json(
            {
                error: lastFailure?.error || `Unable to run the local strategy backend. Attempts: ${attempts.join(" | ")}`,
                stdout: lastFailure?.stdout ?? "",
                stderr: lastFailure?.stderr ?? "",
            },
            { status: 500 },
        );
    } catch (error) {
        if (strategyPath && originalCode) {
            await fs.writeFile(strategyPath, originalCode, "utf-8").catch(() => undefined);
        }

        return Response.json(
            {
                error: error instanceof Error ? error.message : "Unable to retest strategy.",
            },
            { status: 500 },
        );
    }
}