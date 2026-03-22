import { StrategyCodeWorkbench } from "@/components/code/strategy-code-workbench";
import { PnlPerformanceChart } from "@/components/graphs/pnl-performance-chart";
import { AppShell } from "@/components/layout/app-shell";
import { loadRunSnapshot } from "@/lib/strategy-runs";

function formatCurrency(value) {
    if (!Number.isFinite(value)) {
        return "--";
    }

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
    }).format(value);
}

function formatPercent(value) {
    if (!Number.isFinite(value)) {
        return "--";
    }

    return `${value.toFixed(2)}%`;
}

function formatTimestamp(value) {
    if (!value) {
        return "Unavailable";
    }

    try {
        return new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "UTC",
        }).format(new Date(value));
    } catch {
        return "Unavailable";
    }
}

export default async function StrategyRunPage({ params }) {
    const { runDirectory } = await params;
    const snapshot = await loadRunSnapshot(runDirectory);
    const summary = snapshot?.summary ?? {};
    const strategyName = snapshot?.strategyName ?? "strategy";
    const strategyCode =
        snapshot?.strategyCode ??
        "# Strategy source could not be resolved for this run.\n# Generate or rerun the backtest to save a matching strategy file.";
    const alpha = Number(summary?.strategy_total_return_pct) - Number(summary?.buy_hold_return_pct);

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

                        <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                            Edit the saved strategy, rerun the same backtest, and inspect the refreshed graph and metrics.
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

                        <section className="glass-panel p-6 sm:p-8">
                            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-blue-100/60">
                                Summary
                            </p>
                            <h2 className="mt-3 text-2xl font-semibold text-white">
                                Strategy notes
                            </h2>

                            <div className="mt-6 space-y-4">
                                <div className="rounded-[24px] border border-white/8 bg-white/3 p-4">
                                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                                        Overview
                                    </p>
                                    <p className="mt-3 text-sm leading-7 text-slate-300">
                                        {strategyName}.py linked to {runDirectory}. Last generated {formatTimestamp(snapshot?.generatedAt)}.
                                    </p>
                                </div>

                                <div className="rounded-[24px] border border-white/8 bg-white/3 p-4">
                                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                                        Metrics
                                    </p>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-2xl border border-white/8 bg-slate-950/25 px-4 py-3">
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                                strategy return
                                            </p>
                                            <p className="mt-2 text-2xl font-semibold text-white">
                                                {formatPercent(Number(summary?.strategy_total_return_pct))}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-white/8 bg-slate-950/25 px-4 py-3">
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                                alpha vs S&amp;P
                                            </p>
                                            <p className="mt-2 text-2xl font-semibold text-white">
                                                {formatPercent(alpha)}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-white/8 bg-slate-950/25 px-4 py-3">
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                                ending equity
                                            </p>
                                            <p className="mt-2 text-2xl font-semibold text-white">
                                                {formatCurrency(Number(summary?.ending_equity))}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-white/8 bg-slate-950/25 px-4 py-3">
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                                trades
                                            </p>
                                            <p className="mt-2 text-2xl font-semibold text-white">
                                                {Number.isFinite(Number(summary?.num_trades))
                                                    ? Number(summary.num_trades)
                                                    : "--"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    <section className="glass-panel overflow-hidden">
                        <div className="flex items-center justify-between border-b border-white/8 bg-white/4 px-6 py-4">
                            <div>
                                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-blue-100/60">
                                    Code
                                </p>
                                <h2 className="mt-2 text-xl font-semibold text-white">
                                    {strategyName}.py
                                </h2>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                                Editable
                            </span>
                        </div>

                        <StrategyCodeWorkbench
                            runDirectory={runDirectory}
                            initialCode={strategyCode}
                            filename={`${strategyName}.py`}
                            initialGeneratedAt={snapshot?.generatedAt ?? ""}
                        />
                    </section>
                </div>
            </section>
        </AppShell>
    );
}