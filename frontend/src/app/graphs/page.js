import { AppShell } from "@/components/layout/app-shell";
import { AlphaBarChart } from "@/components/graphs/alpha-bar-chart";

export default function GraphsPage() {
    return (
        <AppShell activePath="/graphs">
            <section className="flex-1 px-4 pb-10 pt-2 sm:px-6 lg:px-8">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                    <section className="glass-panel p-6 sm:p-8">
                        <div>
                            <div>
                                <h2 className="mt-3 text-3xl font-semibold text-white">
                                    Performance Visualization Graph
                                </h2>
                                <p className="mt-3 text-base text-slate-300">
                                    Click on a strategy to view its performance graph compared to the S&amp;P 500
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 rounded-[30px] border border-white/6 bg-[linear-gradient(180deg,rgba(13,24,45,0.85),rgba(10,18,32,0.95))] p-5 sm:p-6">
                            <AlphaBarChart />
                        </div>
                    </section>
                </div>
            </section>
        </AppShell>
    );
}
