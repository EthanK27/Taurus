import { promises as fs } from "node:fs";
import path from "node:path";

const OUTPUTS_DIR = path.join(
    process.cwd(),
    "..",
    "backend",
    "gemini_alpaca_agent",
    "outputs",
);

async function loadAlphaEntries() {
    const entries = await fs.readdir(OUTPUTS_DIR, { withFileTypes: true });
    const runDirectories = entries.filter((entry) => entry.isDirectory());
    const alphaEntries = [];

    for (const entry of runDirectories) {
        const runDirectory = entry.name;
        const directoryPath = path.join(OUTPUTS_DIR, runDirectory);
        const directoryStats = await fs.stat(directoryPath);
        const files = await fs.readdir(directoryPath, { withFileTypes: true });
        const summaryCandidates = [];

        for (const file of files) {
            if (!file.isFile() || !file.name.endsWith("_summary.json")) {
                continue;
            }

            const filePath = path.join(directoryPath, file.name);
            const stats = await fs.stat(filePath);
            summaryCandidates.push({ filePath, mtimeMs: stats.mtimeMs });
        }

        if (!summaryCandidates.length) {
            continue;
        }

        summaryCandidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
        const latestSummaryPath = summaryCandidates[0].filePath;
        const raw = await fs.readFile(latestSummaryPath, "utf-8");
        const summary = JSON.parse(raw);
        const strategyTotalReturnPct = Number(summary?.strategy_total_return_pct);
        const buyHoldReturnPct = Number(summary?.buy_hold_return_pct);

        if (!Number.isFinite(strategyTotalReturnPct) || !Number.isFinite(buyHoldReturnPct)) {
            continue;
        }

        alphaEntries.push({
            name: runDirectory,
            runDirectory,
            alpha: Number((strategyTotalReturnPct - buyHoldReturnPct).toFixed(2)),
            strategyTotalReturnPct,
            buyHoldReturnPct,
            promptedAt: new Date(directoryStats.mtimeMs).toISOString(),
            sortTimestamp: directoryStats.mtimeMs,
        });
    }

    alphaEntries.sort((left, right) => right.sortTimestamp - left.sortTimestamp);
    return alphaEntries;
}

export async function GET() {
    try {
        const entries = await loadAlphaEntries();
        return Response.json({ entries });
    } catch {
        return Response.json({ entries: [] });
    }
}
