import { AppShell } from "@/components/layout/app-shell";

const placeholderBars = [
    "Strategy A",
    "Strategy B",
    "Strategy C",
    "Strategy D",
    "Strategy E",
];

export default function GraphsPage() {
    return (
        <AppShell activePath="/graphs">
            <section className="flex-1 px-4 pb-10 pt-2 sm:px-6 lg:px-8">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                    <section className="glass-panel p-6 sm:p-8">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="mt-3 text-3xl font-semibold text-white">
                                    Alpha Graph Visualization
                                </h2>
                                <p className="mt-3 text-base text-slate-300">
                                    Click on a strategy to view its performance graph compared to the S&amp;P 500
                                </p>
                            </div>

                            <span className="inline-flex rounded-full border border-white/8 bg-white/4 px-4 py-2 text-sm text-slate-400">
                                No data yet
                            </span>
                        </div>

                        <div className="mt-8 rounded-[30px] border border-white/6 bg-[linear-gradient(180deg,rgba(13,24,45,0.85),rgba(10,18,32,0.95))] p-5 sm:p-6">
                            <div className="relative flex min-h-[430px] items-end gap-3 overflow-x-auto rounded-[24px] pb-14 pt-10 sm:gap-4">
                                <div className="pointer-events-none absolute inset-x-0 bottom-[42%] border-t border-dashed border-white/12" />
                                <div className="pointer-events-none absolute right-0 bottom-[calc(42%+10px)] font-mono text-[11px] uppercase tracking-[0.28em] text-blue-100/45">
                                    S&amp;P 500 Baseline
                                </div>

                                {placeholderBars.map((label) => (
                                    <div
                                        key={label}
                                        className="flex min-w-[110px] flex-1 flex-col items-center justify-end gap-4 px-2 py-2"
                                    >
                                        <div className="h-[12%] w-full rounded-[20px_20px_12px_12px] border border-dashed border-blue-300/14 bg-blue-300/[0.05]" />
                                        <span className="text-center text-xs uppercase tracking-[0.14em] text-blue-100/45">
                                            {label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>
            </section>
        </AppShell>
    );
}
