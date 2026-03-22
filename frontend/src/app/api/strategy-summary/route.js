import { promises as fs } from "node:fs";
import syncFs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MODEL = "gemini-3-flash-preview";

function resolveBackendDir() {
    const configuredDir = process.env.TAURUS_STRATEGY_BACKEND_DIR?.trim();
    if (configuredDir) {
        return configuredDir;
    }

    const rootCandidate = path.resolve(process.cwd(), "backend", "gemini_alpaca_agent");
    const frontendCandidate = path.resolve(process.cwd(), "..", "backend", "gemini_alpaca_agent");

    return syncFs.existsSync(path.join(rootCandidate, "gemini_backtest_agent.py"))
        ? rootCandidate
        : frontendCandidate;
}

function getOutputsDir() {
    return path.join(resolveBackendDir(), "outputs");
}

function sanitizeRunDirectory(runDirectory) {
    const trimmed = runDirectory?.trim();
    if (!trimmed || trimmed.includes("..") || path.isAbsolute(trimmed)) {
        return "";
    }

    return trimmed;
}

async function listRunDirectories() {
    const outputsDir = getOutputsDir();
    const entries = await fs.readdir(outputsDir, { withFileTypes: true }).catch(() => []);

    const directories = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        const fullPath = path.join(outputsDir, entry.name);
        const stats = await fs.stat(fullPath).catch(() => null);
        if (!stats?.isDirectory()) {
            continue;
        }

        directories.push({
            name: entry.name,
            mtimeMs: stats.mtimeMs,
        });
    }

    directories.sort((left, right) => right.mtimeMs - left.mtimeMs);
    return directories;
}

async function resolveRunDirectory(requestedRunDirectory) {
    const safeRunDirectory = sanitizeRunDirectory(requestedRunDirectory);
    if (safeRunDirectory) {
        return safeRunDirectory;
    }

    const directories = await listRunDirectories();
    return directories[0]?.name ?? "";
}

async function readJsonIfExists(filePath) {
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

async function loadLatestMatchingJson(runDirectory, suffix) {
    const runDirPath = path.join(getOutputsDir(), runDirectory);
    const entries = await fs.readdir(runDirPath, { withFileTypes: true }).catch(() => []);
    const candidates = [];

    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(suffix)) {
            continue;
        }

        const filePath = path.join(runDirPath, entry.name);
        const stats = await fs.stat(filePath).catch(() => null);
        if (!stats) {
            continue;
        }

        candidates.push({
            fileName: entry.name,
            filePath,
            mtimeMs: stats.mtimeMs,
        });
    }

    if (!candidates.length) {
        return null;
    }

    candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
    const selected = candidates[0];
    const payload = await readJsonIfExists(selected.filePath);
    if (!payload) {
        return null;
    }

    return {
        fileName: selected.fileName,
        payload,
        generatedAt: new Date(selected.mtimeMs).toISOString(),
    };
}

async function loadRunContext(runDirectory) {
    if (!runDirectory) {
        return null;
    }

    const runDirPath = path.join(getOutputsDir(), runDirectory);
    const runDirStats = await fs.stat(runDirPath).catch(() => null);
    if (!runDirStats?.isDirectory()) {
        return null;
    }

    const metadata = await readJsonIfExists(path.join(runDirPath, "run_metadata.json"));
    const pnlLog = await loadLatestMatchingJson(runDirectory, "_pnl_log.json");
    const summaryFile = await loadLatestMatchingJson(runDirectory, "_summary.json");
    const summary = pnlLog?.payload?.summary ?? summaryFile?.payload ?? {};

    return {
        runDirectory,
        metadata,
        summary,
        sourceFile: pnlLog?.fileName ?? summaryFile?.fileName ?? null,
        generatedAt:
            pnlLog?.payload?.generatedAt ??
            metadata?.generatedAt ??
            pnlLog?.generatedAt ??
            summaryFile?.generatedAt ??
            new Date(runDirStats.mtimeMs).toISOString(),
    };
}

async function readBackendEnvFile() {
    try {
        return await fs.readFile(path.join(resolveBackendDir(), ".env"), "utf-8");
    } catch {
        return "";
    }
}

function readEnvValue(rawEnv, key) {
    const pattern = new RegExp(`^\\s*${key}\\s*=\\s*(.*)\\s*$`, "m");
    const match = rawEnv.match(pattern);
    if (!match) {
        return "";
    }

    return (match[1] ?? "").trim().replace(/^['"]|['"]$/g, "");
}

async function getGeminiApiKey() {
    if (process.env.GEMINI_API_KEY?.trim()) {
        return process.env.GEMINI_API_KEY.trim();
    }

    if (process.env.GOOGLE_API_KEY?.trim()) {
        return process.env.GOOGLE_API_KEY.trim();
    }

    const rawEnv = await readBackendEnvFile();
    return readEnvValue(rawEnv, "GEMINI_API_KEY") || readEnvValue(rawEnv, "GOOGLE_API_KEY");
}

function formatCurrency(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "n/a";
    }

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
    }).format(value);
}

function formatPercent(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "n/a";
    }

    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
}

function formatNumber(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "n/a";
    }

    return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
    }).format(value);
}

function buildFallbackSummary(context) {
    const summary = context.summary ?? {};
    const strategyReturn = Number(summary.strategy_total_return_pct);
    const benchmarkReturn = Number(summary.buy_hold_return_pct);
    const relativeReturn = strategyReturn - benchmarkReturn;
    const trades = Number(summary.num_trades);
    const drawdown = Number(summary.strategy_max_drawdown_pct);
    const sharpe = Number(summary.strategy_sharpe);

    if (!Object.keys(summary).length) {
        return "The graph is available, but this run does not yet have enough backtest detail for a useful performance readout.";
    }

    const relativeTone = relativeReturn >= 0
        ? "The strategy held up well against the benchmark and showed some relative strength over the test window."
        : "The strategy struggled to keep pace with the benchmark and looked weaker than a passive hold over the same window.";
    const riskTone = drawdown <= -25
        ? "Risk was fairly elevated, with a deeper pullback than you would want from a steadier trend-following result."
        : "Risk looked fairly contained, with drawdowns staying at a more manageable level.";
    const activityTone = trades >= 100
        ? `Trading activity was fairly high at ${formatNumber(trades)} trades, which suggests a more reactive and potentially noisier profile.`
        : `Trading activity stayed relatively measured at ${formatNumber(trades)} trades, which kept the behavior from looking overly noisy.`;
    const qualityTone = sharpe >= 1
        ? "Overall, the return quality looked reasonably solid rather than purely luck-driven."
        : "Overall, the return quality looked mixed and may need refinement before the result feels dependable.";

    return `${relativeTone} ${riskTone} ${activityTone} ${qualityTone}`;
}

function buildGeminiPrompt(context) {
    const summary = context.summary ?? {};

    return [
        "You are writing a short dashboard overview for a trading strategy backtest.",
        "Write a brief analysis of the result, not a restatement of the user's prompt.",
        "Focus on performance quality, relative trend versus benchmark, trading aggressiveness, and risk.",
        "Write exactly 2 or 3 concise sentences.",
        "Do not quote or paraphrase the original prompt unless it is absolutely necessary.",
        "Do not list raw metrics one by one; interpret them.",
        "The metric cards below already show the numbers, so this text should feel like a quick analyst note.",
        "Do not use markdown, bullet points, or headings.",
        "Do not invent technical rules beyond what is in the prompt and metrics.",
        "If the metrics are weak or mixed, say so plainly.",
        "",
        `Run folder: ${context.runDirectory}`,
        `Prompt: ${context.metadata?.prompt ?? "Unavailable"}`,
        `Assistant answer: ${context.metadata?.answer ?? "Unavailable"}`,
        `Artifact: ${context.sourceFile ?? "Unavailable"}`,
        `Generated at: ${context.generatedAt}`,
        `Ending equity: ${summary.ending_equity ?? "Unavailable"}`,
        `Number of bars: ${summary.num_bars ?? "Unavailable"}`,
        `Number of trades: ${summary.num_trades ?? "Unavailable"}`,
        `Strategy total return %: ${summary.strategy_total_return_pct ?? "Unavailable"}`,
        `Buy and hold return %: ${summary.buy_hold_return_pct ?? "Unavailable"}`,
        `Strategy max drawdown %: ${summary.strategy_max_drawdown_pct ?? "Unavailable"}`,
        `Buy and hold max drawdown %: ${summary.buy_hold_max_drawdown_pct ?? "Unavailable"}`,
        `Strategy Sharpe: ${summary.strategy_sharpe ?? "Unavailable"}`,
        `Buy and hold Sharpe: ${summary.buy_hold_sharpe ?? "Unavailable"}`,
    ].join("\n");
}

async function generateGeminiSummary(context) {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
        return null;
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${apiKey}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            cache: "no-store",
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [{ text: buildGeminiPrompt(context) }],
                    },
                ],
                generationConfig: {
                    temperature: 0.35,
                    topK: 20,
                    topP: 0.85,
                    maxOutputTokens: 180,
                },
            }),
        },
    );

    if (!response.ok) {
        throw new Error(`Gemini returned ${response.status}.`);
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts
        ?.map((part) => part?.text ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

    if (!text || text.length < 90 || !/[.!?]$/.test(text)) {
        return null;
    }

    return text;
}

function buildMetricCards(summary) {
    return [
        {
            label: "Return",
            value: formatPercent(Number(summary.strategy_total_return_pct)),
        },
        {
            label: "Vs benchmark",
            value: formatPercent(
                Number(summary.strategy_total_return_pct) - Number(summary.buy_hold_return_pct),
            ),
        },
        {
            label: "Trades",
            value: formatNumber(Number(summary.num_trades)),
        },
        {
            label: "Drawdown",
            value: formatPercent(Number(summary.strategy_max_drawdown_pct)),
        },
    ];
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const runDirectory = await resolveRunDirectory(searchParams.get("runDirectory"));
        const context = await loadRunContext(runDirectory);

        if (!context) {
            return Response.json(
                { error: "No run data found for the requested strategy." },
                { status: 404 },
            );
        }

        let overview = "";
        let source = "fallback";

        try {
            overview = (await generateGeminiSummary(context)) ?? "";
            if (overview) {
                source = "gemini";
            }
        } catch {
            overview = "";
        }

        if (!overview) {
            overview = buildFallbackSummary(context);
        }

        return Response.json({
            runDirectory: context.runDirectory,
            generatedAt: context.generatedAt,
            overview,
            source,
            prompt: context.metadata?.prompt ?? "",
            metrics: buildMetricCards(context.summary),
        });
    } catch (error) {
        return Response.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unable to build the strategy summary.",
            },
            { status: 500 },
        );
    }
}
