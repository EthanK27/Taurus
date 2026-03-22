import { AppShell } from "@/components/layout/app-shell";
import { StrategyCodeWorkbench } from "@/components/code/strategy-code-workbench";
import { PnlPerformanceChart } from "@/components/graphs/pnl-performance-chart";
import { StrategySummaryPanel } from "@/components/strategy/strategy-summary-panel";
import { loadRunSnapshot } from "@/lib/strategy-runs";

function buildFallbackCode(runDirectory) {
    return `# Strategy source could not be resolved for ${runDirectory}.
# Add or restore the matching file under backend/gemini_alpaca_agent/strategies
# before using the retest action on this run.`;
}

function getFilename(snapshot) {
    if (snapshot?.strategyPath) {
        return snapshot.strategyPath.split(/[/\\]/u).at(-1);
    }

    if (snapshot?.strategyName) {
        return `${snapshot.strategyName}.py`;
    }

    return "strategy.py";
}

export default async function StrategyRunPage({ params }) {
    const { runDirectory } = await params;
    const snapshot = await loadRunSnapshot(runDirectory);
    const strategyCode = snapshot?.strategyCode ?? buildFallbackCode(runDirectory);
    const promptText = snapshot?.metadata?.prompt?.trim() || "Viewing the backtest generated for this run folder.";

    return (
        <AppShell activePath="/strategy">
            <section className="flex-1 px-4 pb-10 pt-2 sm:px-6 lg:px-8">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                    <div className="max-w-3xl">
                        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-300/12 bg-blue-300/8 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-blue-100/70 backdrop-blur-xl">
                            <span className="size-2 rounded-full bg-blue-300 shadow-[0_0_14px_rgba(96,165,250,0.8)]" />
                            Graph Workspace
                        </p>

                        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                            {runDirectory}
                        </h1>

                        <p className="mt-4 max-w-3xl whitespace-pre-wrap text-base leading-8 text-slate-300 sm:text-lg">
                            {promptText}
                        </p>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[1.65fr_0.95fr]">
                        <section className="glass-panel p-6 sm:p-8">
                            <div className="mb-6 flex items-center justify-between gap-4">
                                <div>
                                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-blue-100/60">
                                        Graph
                                    </p>
                                    <h2 className="mt-3 text-2xl font-semibold text-white">
                                        Performance chart
                                    </h2>
                                </div>
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                                    {runDirectory}
                                </span>
                            </div>

                            <div className="rounded-[28px] border border-white/6 bg-[linear-gradient(180deg,rgba(10,21,38,0.86),rgba(8,16,30,0.95))] p-5 sm:p-6">
                                <PnlPerformanceChart
                                    runDirectory={runDirectory}
                                    refreshToken={snapshot?.generatedAt ?? ""}
                                />
                            </div>
                        </section>

                        <StrategySummaryPanel key={`${runDirectory}-${snapshot?.generatedAt ?? "pending"}`} runDirectory={runDirectory} />
                    </div>

                    <StrategyCodeWorkbench
                        runDirectory={runDirectory}
                        initialCode={strategyCode}
                        filename={getFilename(snapshot)}
                        initialGeneratedAt={snapshot?.generatedAt ?? ""}
                    />
                </div>
            </section>
        </AppShell>
    );
}
