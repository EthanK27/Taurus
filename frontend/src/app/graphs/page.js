import { AppShell } from "@/components/layout/app-shell";

const codePlaceholder = `// Strategy code will appear here
if (ethan smith) {
  return gay;
}`;

export default function GraphsPage() {
    return (
        <AppShell activePath="/graphs">
            <section className="flex-1 px-4 pb-10 pt-2 sm:px-6 lg:px-8">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                    <div className="max-w-3xl">
                        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-300/12 bg-blue-300/8 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-blue-100/70 backdrop-blur-xl">
                            <span className="size-2 rounded-full bg-blue-300 shadow-[0_0_14px_rgba(96,165,250,0.8)]" />
                            Graph Workspace
                        </p>

                        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                            Graph
                        </h1>

                        <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                            Placeholder box
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
                                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-300">
                                    Placeholder
                                </span>
                            </div>

                            <div className="flex min-h-[360px] items-center justify-center rounded-[28px] border border-dashed border-white/12 bg-slate-950/25 p-6 text-center text-sm text-slate-400">
                                Graph here
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
                                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                                        Overview
                                    </p>
                                    <p className="mt-3 text-sm leading-7 text-slate-300">
                                        placeholder
                                    </p>
                                </div>

                                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                                        Metrics
                                    </p>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                                        <div className="rounded-2xl border border-white/8 bg-slate-950/25 px-4 py-3">
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                                tbd
                                            </p>
                                            <p className="mt-2 text-2xl font-semibold text-white">
                                                --
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-white/8 bg-slate-950/25 px-4 py-3">
                                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                                tbd
                                            </p>
                                            <p className="mt-2 text-2xl font-semibold text-white">
                                                --
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    <section className="glass-panel overflow-hidden">
                        <div className="flex items-center justify-between border-b border-white/8 bg-white/[0.04] px-6 py-4">
                            <div>
                                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-blue-100/60">
                                    Code
                                </p>
                                <h2 className="mt-2 text-xl font-semibold text-white">
                                    Strategy
                                </h2>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-300">
                                Can edit
                            </span>
                        </div>

                        <pre className="overflow-x-auto bg-slate-950/45 px-6 py-6 font-mono text-sm leading-7 text-slate-300">
                            <code>{codePlaceholder}</code>
                        </pre>
                    </section>
                </div>
            </section>
        </AppShell>
    );
}
