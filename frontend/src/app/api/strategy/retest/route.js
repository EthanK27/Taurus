import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import { getBackendAgentDir, getStrategiesDir, loadRunSnapshot } from "@/lib/strategy-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const RETEST_SCRIPT = `
import json
import sys
from alpaca_tools import run_backtest

payload = json.loads(sys.argv[1])
result = run_backtest(
    strategy_path=payload["strategy_path"],
    symbol=payload["symbol"],
    timeframe=payload["timeframe"],
    start=payload["start"],
    end=payload["end"],
    initial_cash=float(payload.get("initial_cash", 10000.0)),
    run_directory_name=payload["run_directory_name"],
)
print(json.dumps(result))
`.trim();

function resolveBackendPaths() {
    const backendDir = getBackendAgentDir();
    return {
        backendDir,
        backendRoot: path.resolve(backendDir, ".."),
    };
}

function buildRunnerCandidates() {
    const { backendRoot } = resolveBackendPaths();
    const configuredPython = process.env.TAURUS_STRATEGY_PYTHON?.trim();
    const candidates = [];

    if (configuredPython) {
        candidates.push({
            command: configuredPython,
            argsPrefix: [],
            label: configuredPython,
        });
    }

    const localPythonCandidates = process.platform === "win32"
        ? [
            path.join(backendRoot, ".venv", "Scripts", "python.exe"),
            path.join(backendRoot, "venv", "Scripts", "python.exe"),
        ]
        : [
            path.join(backendRoot, ".venv", "bin", "python"),
            path.join(backendRoot, "venv", "bin", "python"),
        ];

    for (const pythonPath of localPythonCandidates) {
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

function isSafeStrategyPath(strategyPath) {
    const strategiesDir = path.resolve(getStrategiesDir());
    const resolvedPath = path.resolve(strategyPath);
    return resolvedPath.startsWith(`${strategiesDir}${path.sep}`) || resolvedPath === strategiesDir;
}

function runBacktestProcess({ backendDir, runner, payload }) {
    return new Promise((resolve, reject) => {
        const child = spawn(
            runner.command,
            [...runner.argsPrefix, "-c", RETEST_SCRIPT, JSON.stringify(payload)],
            {
                cwd: backendDir,
                env: {
                    ...process.env,
                    PYTHONUNBUFFERED: "1",
                },
                stdio: ["ignore", "pipe", "pipe"],
            },
        );

        let stdout = "";
        let stderr = "";
        const timeout = setTimeout(() => {
            child.kill();
            reject({
                error: `Timed out after ${DEFAULT_TIMEOUT_MS}ms while waiting for the retest backend.`,
                stdout,
                stderr,
            });
        }, DEFAULT_TIMEOUT_MS);

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });

        child.on("error", (error) => {
            clearTimeout(timeout);
            reject({ error: `${runner.label}: ${error.message}`, stdout, stderr });
        });

        child.on("close", (code) => {
            clearTimeout(timeout);
            if (code === 0) {
                resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
                return;
            }

            reject({
                error: stderr.trim() || stdout.trim() || `${runner.label} exited with code ${code}.`,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
            });
        });
    });
}

async function rerunBacktest(snapshot) {
    const { backendDir } = resolveBackendPaths();
    const payload = {
        strategy_path: snapshot.strategyPath,
        symbol: snapshot.backtest.symbol,
        timeframe: snapshot.backtest.timeframe,
        start: snapshot.backtest.start,
        end: snapshot.backtest.end,
        initial_cash: snapshot.backtest.initialCash,
        run_directory_name: snapshot.runDirectory,
    };

    const failures = [];
    for (const runner of buildRunnerCandidates()) {
        try {
            return await runBacktestProcess({ backendDir, runner, payload });
        } catch (failure) {
            failures.push(failure);
        }
    }

    const lastFailure = failures.at(-1) ?? { error: "Retest failed." };
    throw {
        error: lastFailure.error || "Retest failed.",
        stdout: failures.map((failure) => failure.stdout).filter(Boolean).join("\n\n"),
        stderr: failures.map((failure) => failure.stderr || failure.error).filter(Boolean).join("\n\n"),
    };
}

export async function POST(request) {
    let snapshot = null;
    let originalCode = null;

    try {
        const { runDirectory, code } = await request.json();
        if (typeof runDirectory !== "string" || !runDirectory.trim()) {
            return Response.json({ error: "runDirectory is required." }, { status: 400 });
        }
        if (typeof code !== "string") {
            return Response.json({ error: "code must be a string." }, { status: 400 });
        }

        snapshot = await loadRunSnapshot(runDirectory.trim());
        if (!snapshot?.strategyPath || !snapshot?.backtest?.start || !snapshot?.backtest?.end) {
            return Response.json(
                { error: "Unable to resolve the saved strategy or backtest metadata for this run." },
                { status: 404 },
            );
        }

        if (!isSafeStrategyPath(snapshot.strategyPath)) {
            return Response.json(
                { error: "Resolved strategy path is outside the strategies directory." },
                { status: 400 },
            );
        }

        originalCode = await fs.readFile(snapshot.strategyPath, "utf-8");
        await fs.writeFile(snapshot.strategyPath, `${code.trimEnd()}\n`, "utf-8");

        await rerunBacktest(snapshot);
        const updatedSnapshot = await loadRunSnapshot(snapshot.runDirectory);

        return Response.json({
            ok: true,
            runDirectory: snapshot.runDirectory,
            generatedAt: updatedSnapshot?.generatedAt ?? new Date().toISOString(),
            summary: updatedSnapshot?.summary ?? null,
        });
    } catch (error) {
        if (snapshot?.strategyPath && typeof originalCode === "string") {
            try {
                await fs.writeFile(snapshot.strategyPath, originalCode, "utf-8");
            } catch {
                // Keep the original failure as the primary response.
            }
        }

        return Response.json(
            {
                error: error?.error || (error instanceof Error ? error.message : "Retest failed."),
                stdout: error?.stdout || "",
                stderr: error?.stderr || "",
            },
            { status: 500 },
        );
    }
}