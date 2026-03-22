import { promises as fs } from "node:fs";
import syncFs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 10 * 60 * 1000;
const SUMMARY_SUFFIX = "_summary.json";

function resolveBackendPaths() {
    const configuredDir = process.env.TAURUS_STRATEGY_BACKEND_DIR?.trim();
    if (configuredDir) {
        return {
            backendDir: configuredDir,
            backendRoot: path.resolve(configuredDir, ".."),
        };
    }

    const rootCandidate = path.resolve(process.cwd(), "backend", "gemini_alpaca_agent");
    const frontendCandidate = path.resolve(process.cwd(), "..", "backend", "gemini_alpaca_agent");
    const selectedDir = syncFs.existsSync(path.join(rootCandidate, "gemini_backtest_agent.py"))
        ? rootCandidate
        : frontendCandidate;

    return {
        backendDir: selectedDir,
        backendRoot: path.resolve(selectedDir, ".."),
    };
}

function sanitizeRunDirectory(runDirectory) {
    const trimmed = runDirectory?.trim();
    if (!trimmed || trimmed.includes("..") || path.isAbsolute(trimmed)) {
        return "";
    }

    return trimmed;
}

function getRunDirPath(runDirectory) {
    const backendDir = resolveBackendPaths().backendDir;
    return path.join(backendDir, "outputs", runDirectory);
}

async function findLatestSummaryFile(runDirectory) {
    const runDirPath = getRunDirPath(runDirectory);
    const entries = await fs.readdir(runDirPath, { withFileTypes: true }).catch(() => []);

    const candidates = [];
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(SUMMARY_SUFFIX)) {
            continue;
        }

        const fullPath = path.join(runDirPath, entry.name);
        const stats = await fs.stat(fullPath).catch(() => null);
        if (!stats?.isFile()) {
            continue;
        }

        candidates.push({ fileName: entry.name, mtimeMs: stats.mtimeMs });
    }

    if (!candidates.length) {
        return null;
    }

    candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
    return candidates[0].fileName;
}

function parseSummaryFileName(fileName) {
    if (!fileName?.endsWith(SUMMARY_SUFFIX)) {
        return null;
    }

    const stem = fileName.slice(0, -SUMMARY_SUFFIX.length);
    const parts = stem.split("_");
    if (parts.length < 5) {
        return null;
    }

    const end = parts.at(-1);
    const start = parts.at(-2);
    const timeframe = parts.at(-3);
    const symbol = parts.at(-4);
    const strategyName = parts.slice(0, -4).join("_");

    if (!strategyName || !symbol || !timeframe || !start || !end) {
        return null;
    }

    return { strategyName, symbol, timeframe, start, end };
}

function getStrategyFilePath(strategyName) {
    return path.join(resolveBackendPaths().backendDir, "strategies", `${strategyName}.py`);
}

function buildRunnerCandidates() {
    const { backendRoot } = resolveBackendPaths();
    const configuredPython = process.env.TAURUS_STRATEGY_PYTHON?.trim();
    const candidates = [];

    if (configuredPython) {
        candidates.push({ command: configuredPython, argsPrefix: [], label: configuredPython });
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
        if (syncFs.existsSync(pythonPath)) {
            candidates.push({ command: pythonPath, argsPrefix: [], label: pythonPath });
        }
    }

    candidates.push(
        { command: "python3", argsPrefix: [], label: "python3" },
        { command: "python", argsPrefix: [], label: "python" },
        { command: "py", argsPrefix: ["-3"], label: "py -3" },
    );

    return candidates;
}

async function runRerunScript(details) {
    const backendDir = resolveBackendPaths().backendDir;
    const attempts = [];

    for (const runner of buildRunnerCandidates()) {
        try {
            const payload = await new Promise((resolve, reject) => {
                const args = [
                    ...runner.argsPrefix,
                    "rerun_strategy.py",
                    "--strategy-name",
                    details.strategyName,
                    "--symbol",
                    details.symbol,
                    "--timeframe",
                    details.timeframe,
                    "--start",
                    details.start,
                    "--end",
                    details.end,
                ];

                const child = spawn(runner.command, args, {
                    cwd: backendDir,
                    env: {
                        ...process.env,
                        PYTHONUNBUFFERED: "1",
                    },
                    stdio: ["ignore", "pipe", "pipe"],
                });

                let stdout = "";
                let stderr = "";

                const timeout = setTimeout(() => {
                    child.kill();
                    reject(new Error(`Timed out after ${TIMEOUT_MS}ms while waiting for rerun to complete.`));
                }, TIMEOUT_MS);

                child.stdout.on("data", (chunk) => {
                    stdout += chunk.toString();
                });

                child.stderr.on("data", (chunk) => {
                    stderr += chunk.toString();
                });

                child.on("error", (error) => {
                    clearTimeout(timeout);
                    reject(new Error(`${runner.label}: ${error.message}`));
                });

                child.on("close", (code) => {
                    clearTimeout(timeout);

                    if (code !== 0) {
                        reject(new Error(stderr.trim() || stdout.trim() || `${runner.label} exited with code ${code}.`));
                        return;
                    }

                    const lines = stdout
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean);
                    const candidate = [...lines].reverse().find((line) => line.startsWith("{") && line.endsWith("}"));

                    if (!candidate) {
                        reject(new Error("Rerun completed but did not return JSON output."));
                        return;
                    }

                    let parsed;
                    try {
                        parsed = JSON.parse(candidate);
                    } catch {
                        reject(new Error("Failed to parse rerun output."));
                        return;
                    }

                    resolve(parsed);
                });
            });

            return payload;
        } catch (error) {
            attempts.push(error instanceof Error ? error.message : String(error));
        }
    }

    throw new Error(`Unable to rerun strategy. Attempts: ${attempts.join(" | ")}`);
}

async function resolveRunDetails(runDirectory) {
    const summaryFileName = await findLatestSummaryFile(runDirectory);
    if (!summaryFileName) {
        return null;
    }

    const parsed = parseSummaryFileName(summaryFileName);
    if (!parsed) {
        return null;
    }

    return {
        ...parsed,
        summaryFileName,
    };
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const runDirectory = sanitizeRunDirectory(searchParams.get("runDirectory"));

    if (!runDirectory) {
        return Response.json({ error: "runDirectory query param is required." }, { status: 400 });
    }

    const details = await resolveRunDetails(runDirectory);
    if (!details) {
        return Response.json(
            { error: `Could not determine strategy details for run directory ${runDirectory}.` },
            { status: 404 },
        );
    }

    const strategyFilePath = getStrategyFilePath(details.strategyName);
    const code = await fs.readFile(strategyFilePath, "utf-8").catch(() => null);

    if (code === null) {
        return Response.json(
            { error: `Strategy file not found for ${details.strategyName}.` },
            { status: 404 },
        );
    }

    return Response.json({
        runDirectory,
        strategyName: details.strategyName,
        strategyFileName: `${details.strategyName}.py`,
        strategyFilePath,
        symbol: details.symbol,
        timeframe: details.timeframe,
        start: details.start,
        end: details.end,
        code,
    });
}

export async function POST(request) {
    try {
        const body = await request.json();
        const runDirectory = sanitizeRunDirectory(body?.runDirectory);
        const code = typeof body?.code === "string" ? body.code : "";
        const rerun = body?.rerun !== false;

        if (!runDirectory) {
            return Response.json({ error: "runDirectory is required." }, { status: 400 });
        }

        if (!code.trim()) {
            return Response.json({ error: "Code cannot be empty." }, { status: 400 });
        }

        const details = await resolveRunDetails(runDirectory);
        if (!details) {
            return Response.json(
                { error: `Could not determine strategy details for run directory ${runDirectory}.` },
                { status: 404 },
            );
        }

        const strategyFilePath = getStrategyFilePath(details.strategyName);
        await fs.writeFile(strategyFilePath, code.endsWith("\n") ? code : `${code}\n`, "utf-8");

        if (!rerun) {
            return Response.json({
                ok: true,
                saved: true,
                strategyName: details.strategyName,
                strategyFileName: `${details.strategyName}.py`,
                runDirectory,
            });
        }

        const rerunResult = await runRerunScript(details);
        const nextRunDirectory = typeof rerunResult?.runDirectory === "string" ? rerunResult.runDirectory : "";

        if (!nextRunDirectory) {
            return Response.json(
                { error: "Code was synced, but rerun did not return a run directory." },
                { status: 500 },
            );
        }

        return Response.json({
            ok: true,
            saved: true,
            rerun: true,
            strategyName: details.strategyName,
            strategyFileName: `${details.strategyName}.py`,
            runDirectory,
            nextRunDirectory,
            summary: rerunResult?.summary ?? null,
        });
    } catch (error) {
        return Response.json(
            {
                error: error instanceof Error ? error.message : "Failed to sync and rerun strategy.",
            },
            { status: 500 },
        );
    }
}
