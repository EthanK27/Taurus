import {
    loadLatestRunSnapshot,
    loadRunSnapshot,
} from "@/lib/strategy-runs";

const HOURS_OF_DATA = 24 * 420;

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

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const runDirectory = searchParams.get("runDirectory")?.trim();

    const requestedRun = await loadRunSnapshot(runDirectory);
    if (requestedRun?.userSeries?.length && requestedRun?.benchmarkSeries?.length) {
        return Response.json(requestedRun);
    }

    const latestRun = await loadLatestRunSnapshot();
    if (latestRun?.userSeries?.length && latestRun?.benchmarkSeries?.length) {
        return Response.json(latestRun);
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
