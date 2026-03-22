import fs from "fs";
import path from "path";
import { spawn } from "child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MODEL = "gemini-3.1-pro-preview";
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

function getOutputsDir() {
    return path.join(getBackendDir(), "outputs");
}

function listOutputDirectories(outputsDir) {
    if (!fs.existsSync(outputsDir)) {
        return [];
    }

    return fs
        .readdirSync(outputsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
            const directoryPath = path.join(outputsDir, entry.name);
            const stats = fs.statSync(directoryPath);

            return {
                name: entry.name,
                mtimeMs: stats.mtimeMs,
            };
        });
}

function detectRunDirectory(beforeEntries, afterEntries) {
    const beforeByName = new Map(beforeEntries.map((entry) => [entry.name, entry.mtimeMs]));
    const candidates = afterEntries.filter(
        (entry) => !beforeByName.has(entry.name) || entry.mtimeMs > (beforeByName.get(entry.name) ?? 0),
    );

    if (!candidates.length) {
        return null;
    }

    candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
    return candidates[0].name;
}

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
    const selectedDir = fs.existsSync(path.join(rootCandidate, "gemini_backtest_agent.py"))
        ? rootCandidate
        : frontendCandidate;

    return {
        backendDir: selectedDir,
        backendRoot: path.resolve(selectedDir, ".."),
    };
}

function getBackendDir() {
    return resolveBackendPaths().backendDir;
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
        if (fs.existsSync(pythonPath)) {
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
        { command: "py", argsPrefix: ["-3"], label: "py -3" }
    );

    return candidates;
}

function runLocalAgent({ prompt, model, backendDir, runner }) {
    return new Promise((resolve, reject) => {
        const child = spawn(
            runner.command,
            [...runner.argsPrefix, "gemini_backtest_agent.py", prompt, "--model", model],
            {
                cwd: backendDir,
                env: {
                    ...process.env,
                    PYTHONUNBUFFERED: "1",
                },
                stdio: ["ignore", "pipe", "pipe"],
            }
        );

        let stdout = "";
        let stderr = "";

        const timeout = setTimeout(() => {
            child.kill();
            reject(new Error(`Timed out after ${DEFAULT_TIMEOUT_MS}ms while waiting for the strategy backend.`));
        }, DEFAULT_TIMEOUT_MS);

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

            const trimmedStdout = stdout.trim();
            const trimmedStderr = stderr.trim();

            if (code === 0) {
                resolve(trimmedStdout || "No response returned from the strategy backend.");
                return;
            }

            reject(
                new Error(
                    trimmedStderr ||
                    trimmedStdout ||
                    `${runner.label} exited with code ${code}.`
                )
            );
        });
    });
}

async function callRemoteBackend({ prompt, model, url }) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, model }),
        cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error || `Remote backend request failed with status ${response.status}.`);
    }

    if (typeof payload?.answer !== "string" || !payload.answer.trim()) {
        throw new Error("Remote backend did not return an answer string.");
    }

    return payload.answer;
}

async function getStrategyAnswer(prompt, model) {
    const remoteUrl = process.env.TAURUS_STRATEGY_BACKEND_URL?.trim();
    if (remoteUrl) {
        const answer = await callRemoteBackend({ prompt, model, url: remoteUrl });
        return { answer, runDirectory: null };
    }

    const backendDir = getBackendDir();
    const scriptPath = path.join(backendDir, "gemini_backtest_agent.py");
    const outputsDir = getOutputsDir();

    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Strategy backend script not found at ${scriptPath}.`);
    }

    const beforeEntries = listOutputDirectories(outputsDir);
    const attempts = [];
    for (const runner of buildRunnerCandidates()) {
        try {
            const answer = await runLocalAgent({ prompt, model, backendDir, runner });
            const afterEntries = listOutputDirectories(outputsDir);
            return {
                answer,
                runDirectory: detectRunDirectory(beforeEntries, afterEntries),
            };
        } catch (error) {
            attempts.push(
                error instanceof Error ? error.message : String(error)
            );
        }
    }

    throw new Error(
        `Unable to run the local strategy backend. Attempts: ${attempts.join(" | ")}`
    );
}

export async function POST(request) {
    try {
        const { prompt, model } = await request.json();

        if (typeof prompt !== "string" || !prompt.trim()) {
            return Response.json(
                { error: "A non-empty prompt is required." },
                { status: 400 }
            );
        }

        const { answer, runDirectory } = await getStrategyAnswer(prompt.trim(), model || DEFAULT_MODEL);
        return Response.json({ answer, runDirectory });
    } catch (error) {
        return Response.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Something went wrong while sending the prompt.",
            },
            { status: 500 }
        );
    }
}
