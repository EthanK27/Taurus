import { promises as fs } from "node:fs";
import path from "node:path";

const HOURS_OF_DATA = 24 * 420;
const OUTPUTS_DIR = path.join(
    process.cwd(),
    "..",
    "backend",
    "gemini_alpaca_agent",
    "outputs",
);

function formatTimestamp(date) {
    return date.toISOString().slice(0, 16).replace("T", " ");
}

function buildSeries(seed, drift, volatility) {
    const data = [];
    const now = new Date();
    const start = new Date(now.getTime() - (HOURS_OF_DATA - 1) * 60 * 60 * 1000);

    let value = seed;
    for (let index = 0; index < HOURS_OF_DATA; index += 1) {
        const timestamp = new Date(start.getTime() + index * 60 * 60 * 1000);
        const cycle = Math.sin(index / 22) * volatility;
        const mediumCycle = Math.cos(index / 180) * (volatility * 0.6);
        const trend = drift * index;
        value = Math.max(1200, seed + trend + cycle + mediumCycle);

        data.push({
            timestamp: formatTimestamp(timestamp),
            pnl: Number(value.toFixed(2)),
        });
    }

    return data;
}

function normalizeSeries(series) {
    if (!Array.isArray(series)) return [];

    return series
        .filter(
            (entry) =>
                entry && typeof entry.timestamp === "string" && typeof entry.pnl === "number",
        )
        .map((entry) => ({
            timestamp: entry.timestamp,
            pnl: Number(entry.pnl.toFixed(2)),
        }))
        .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

async function loadLatestBacktestLog() {
    try {
        const entries = await fs.readdir(OUTPUTS_DIR, { withFileTypes: true });
        const candidates = [];

        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith("_pnl_log.json")) {
                continue;
            }

            const filePath = path.join(OUTPUTS_DIR, entry.name);
            const stats = await fs.stat(filePath);
            candidates.push({ filePath, mtimeMs: stats.mtimeMs });
        }

        if (!candidates.length) {
            return null;
        }

        candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
        const raw = await fs.readFile(candidates[0].filePath, "utf-8");
        const payload = JSON.parse(raw);

        return {
            userSeries: normalizeSeries(payload.userSeries),
            benchmarkSeries: normalizeSeries(payload.benchmarkSeries),
            generatedAt: payload.generatedAt ?? new Date(candidates[0].mtimeMs).toISOString(),
            source: "backtest-log",
        };
    } catch {
        return null;
    }
}

async function loadBacktestLogForRunDirectory(runDirectory) {
    if (!runDirectory) {
        return null;
    }

    try {
        const targetDir = path.join(OUTPUTS_DIR, runDirectory);
        const stats = await fs.stat(targetDir);
        if (!stats.isDirectory()) {
            return null;
        }

        const entries = await fs.readdir(targetDir, { withFileTypes: true });
        const candidates = [];

        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith("_pnl_log.json")) {
                continue;
            }

            const filePath = path.join(targetDir, entry.name);
            const fileStats = await fs.stat(filePath);
            candidates.push({ filePath, mtimeMs: fileStats.mtimeMs });
        }

        if (!candidates.length) {
            return null;
        }

        candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
        const raw = await fs.readFile(candidates[0].filePath, "utf-8");
        const payload = JSON.parse(raw);

        return {
            userSeries: normalizeSeries(payload.userSeries),
            benchmarkSeries: normalizeSeries(payload.benchmarkSeries),
            generatedAt: payload.generatedAt ?? new Date(candidates[0].mtimeMs).toISOString(),
            source: "backtest-log",
            runDirectory,
        };
    } catch {
        return null;
    }
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const runDirectory = searchParams.get("runDirectory")?.trim();

    const requestedLog = await loadBacktestLogForRunDirectory(runDirectory);
    if (requestedLog?.userSeries?.length && requestedLog?.benchmarkSeries?.length) {
        return Response.json(requestedLog);
    }

    const latestLog = await loadLatestBacktestLog();
    if (latestLog?.userSeries?.length && latestLog?.benchmarkSeries?.length) {
        return Response.json(latestLog);
    }

    const userSeries = buildSeries(10000, 0.11, 170);
    const benchmarkSeries = buildSeries(9800, 0.08, 120);

    return Response.json({
        userSeries,
        benchmarkSeries,
        generatedAt: new Date().toISOString(),
        source: "synthetic",
    });
}
