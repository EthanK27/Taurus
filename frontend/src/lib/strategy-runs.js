import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";

function resolveBackendAgentDir() {
    const configuredDir = process.env.TAURUS_STRATEGY_BACKEND_DIR?.trim();
    if (configuredDir) {
        return configuredDir;
    }

    const candidates = [
        path.resolve(process.cwd(), "backend", "gemini_alpaca_agent"),
        path.resolve(process.cwd(), "..", "backend", "gemini_alpaca_agent"),
    ];

    return (
        candidates.find((candidate) =>
            fs.existsSync(path.join(candidate, "gemini_backtest_agent.py")),
        ) ?? candidates[0]
    );
}

const BACKEND_AGENT_DIR = resolveBackendAgentDir();
const OUTPUTS_DIR = path.join(BACKEND_AGENT_DIR, "outputs");
const STRATEGIES_DIR = path.join(BACKEND_AGENT_DIR, "strategies");
const ARTIFACT_NAME_PATTERN = /^(.*)_([A-Za-z0-9.-]+)_([A-Za-z0-9]+)_((?:19|20)\d{2}-\d{2}-\d{2})_((?:19|20)\d{2}-\d{2}-\d{2})$/u;

export function getBackendAgentDir() {
    return BACKEND_AGENT_DIR;
}

export function getStrategiesDir() {
    return STRATEGIES_DIR;
}

export function normalizeSeries(series) {
    if (!Array.isArray(series)) return [];

    return series
        .filter(
            (entry) =>
                entry &&
                typeof entry.timestamp === "string" &&
                typeof entry.pnl === "number",
        )
        .map((entry) => ({
            timestamp: entry.timestamp,
            pnl: Number(entry.pnl.toFixed(2)),
        }))
        .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function normalizeRunDirectory(runDirectory) {
    if (typeof runDirectory !== "string") {
        return null;
    }

    const trimmed = runDirectory.trim();
    if (!trimmed || trimmed.includes("/") || trimmed.includes("\\")) {
        return null;
    }

    return trimmed;
}

function toIsoTimestamp(value, endOfDay = false) {
    if (typeof value !== "string" || !value.trim()) {
        return null;
    }

    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/u.test(trimmed)) {
        return `${trimmed.replace(" ", "T")}:00Z`;
    }

    if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) {
        return endOfDay
            ? `${trimmed}T23:59:59Z`
            : `${trimmed}T00:00:00Z`;
    }

    return trimmed;
}

function parseArtifactMetadata(artifactName, userSeries) {
    if (!artifactName) {
        return null;
    }

    const withoutSuffix = artifactName
        .replace(/_summary\.json$/u, "")
        .replace(/_pnl_log\.json$/u, "");
    const match = withoutSuffix.match(ARTIFACT_NAME_PATTERN);

    if (!match) {
        return null;
    }

    const [, strategyName, symbol, timeframe, startDate, endDate] = match;
    const firstTimestamp = userSeries[0]?.timestamp ?? startDate;
    const lastTimestamp = userSeries.at(-1)?.timestamp ?? endDate;

    return {
        artifactPrefix: withoutSuffix,
        strategyName,
        symbol,
        timeframe,
        startDate,
        endDate,
        start: toIsoTimestamp(firstTimestamp, false),
        end: toIsoTimestamp(lastTimestamp, true),
    };
}

async function listRunDirectories() {
    try {
        const entries = await fsp.readdir(OUTPUTS_DIR, { withFileTypes: true });
        const runDirectories = await Promise.all(
            entries
                .filter((entry) => entry.isDirectory())
                .map(async (entry) => {
                    const directoryPath = path.join(OUTPUTS_DIR, entry.name);
                    const stats = await fsp.stat(directoryPath);
                    return {
                        runDirectory: entry.name,
                        mtimeMs: stats.mtimeMs,
                    };
                }),
        );

        return runDirectories.sort((left, right) => right.mtimeMs - left.mtimeMs);
    } catch {
        return [];
    }
}

async function getLatestArtifact(directoryPath, suffix) {
    try {
        const entries = await fsp.readdir(directoryPath, { withFileTypes: true });
        const matches = await Promise.all(
            entries
                .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
                .map(async (entry) => {
                    const filePath = path.join(directoryPath, entry.name);
                    const stats = await fsp.stat(filePath);
                    return {
                        filePath,
                        name: entry.name,
                        mtimeMs: stats.mtimeMs,
                    };
                }),
        );

        if (!matches.length) {
            return null;
        }

        matches.sort((left, right) => right.mtimeMs - left.mtimeMs);
        return matches[0];
    } catch {
        return null;
    }
}

async function readJsonFile(filePath) {
    try {
        const raw = await fsp.readFile(filePath, "utf-8");
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function getStrategyStemFromArtifactName(artifactName) {
    return parseArtifactMetadata(artifactName, [])?.strategyName ?? null;
}

async function readStrategySource(strategyStem) {
    if (!strategyStem) {
        return null;
    }

    const strategyPath = path.join(STRATEGIES_DIR, `${strategyStem}.py`);

    try {
        const strategyCode = await fsp.readFile(strategyPath, "utf-8");
        return {
            strategyName: strategyStem,
            strategyPath,
            strategyCode: strategyCode.trimEnd(),
        };
    } catch {
        return {
            strategyName: strategyStem,
            strategyPath,
            strategyCode: null,
        };
    }
}

export async function loadRunSnapshot(runDirectory) {
    const safeRunDirectory = normalizeRunDirectory(runDirectory);
    if (!safeRunDirectory) {
        return null;
    }

    const runDirectoryPath = path.join(OUTPUTS_DIR, safeRunDirectory);
    let runDirectoryStats;

    try {
        runDirectoryStats = await fsp.stat(runDirectoryPath);
        if (!runDirectoryStats.isDirectory()) {
            return null;
        }
    } catch {
        return null;
    }

    const [summaryArtifact, pnlLogArtifact] = await Promise.all([
        getLatestArtifact(runDirectoryPath, "_summary.json"),
        getLatestArtifact(runDirectoryPath, "_pnl_log.json"),
    ]);

    const [summaryPayload, pnlLogPayload] = await Promise.all([
        summaryArtifact ? readJsonFile(summaryArtifact.filePath) : null,
        pnlLogArtifact ? readJsonFile(pnlLogArtifact.filePath) : null,
    ]);

    const userSeries = normalizeSeries(pnlLogPayload?.userSeries);
    const benchmarkSeries = normalizeSeries(pnlLogPayload?.benchmarkSeries);
    const artifactMetadata = parseArtifactMetadata(
        summaryArtifact?.name ?? pnlLogArtifact?.name ?? null,
        userSeries,
    );
    const strategyStem = artifactMetadata?.strategyName ?? getStrategyStemFromArtifactName(
        summaryArtifact?.name ?? pnlLogArtifact?.name ?? null,
    );
    const strategy = await readStrategySource(strategyStem);

    return {
        runDirectory: safeRunDirectory,
        generatedAt:
            pnlLogPayload?.generatedAt ??
            new Date(
                Math.max(
                    summaryArtifact?.mtimeMs ?? 0,
                    pnlLogArtifact?.mtimeMs ?? 0,
                    runDirectoryStats.mtimeMs,
                ),
            ).toISOString(),
        source: pnlLogPayload ? "backtest-log" : "run-directory",
        summary: summaryPayload ?? pnlLogPayload?.summary ?? null,
        userSeries,
        benchmarkSeries,
        strategyName: strategy?.strategyName ?? null,
        strategyPath: strategy?.strategyPath ?? null,
        strategyCode: strategy?.strategyCode ?? null,
        artifactPrefix: artifactMetadata?.artifactPrefix ?? null,
        backtest: artifactMetadata
            ? {
                symbol: artifactMetadata.symbol,
                timeframe: artifactMetadata.timeframe,
                startDate: artifactMetadata.startDate,
                endDate: artifactMetadata.endDate,
                start: artifactMetadata.start,
                end: artifactMetadata.end,
                initialCash: Number(
                    summaryPayload?.initial_cash ??
                    pnlLogPayload?.summary?.initial_cash ??
                    10000,
                ),
            }
            : null,
    };
}

export async function loadLatestRunSnapshot() {
    const runDirectories = await listRunDirectories();
    let fallbackSnapshot = null;

    for (const entry of runDirectories) {
        const snapshot = await loadRunSnapshot(entry.runDirectory);
        if (!fallbackSnapshot && snapshot) {
            fallbackSnapshot = snapshot;
        }

        if (snapshot?.userSeries?.length && snapshot?.benchmarkSeries?.length) {
            return snapshot;
        }
    }

    return fallbackSnapshot;
}