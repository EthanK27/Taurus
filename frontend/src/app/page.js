"use client";

import Image from "next/image";
import { useState } from "react";
import {
    ArrowUp,
    Menu,
    MessageSquare,
    Plus,
    X,
} from "lucide-react";

const suggestions = [
    "Strategy 1",
    "Strategy 2",
    "Strategy 3",
    "Strategy 4",
];

const historyItems = [
    "History 1",
    "History 2",
    "History 3",
    "History 4",
];

export default function Home() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [prompt, setPrompt] = useState("");

    return (
        <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(68,112,255,0.16),transparent_28%),linear-gradient(180deg,#08111f_0%,#0a1424_45%,#0a1220_100%)] text-white">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[72px_72px] opacity-20" />

            <aside
                className={`fixed inset-y-0 left-0 z-40 w-75 transform border-r border-white/10 bg-[#0b1423]/88 p-5 backdrop-blur-2xl transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <span className="text-2xl font-semibold tracking-tight text-white">
                            Taurus
                        </span>
                        <div className="mt-1 text-sm text-slate-400">Strategy history</div>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="glass-icon"
                        aria-label="Close sidebar"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <button className="mb-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-blue-300/15 bg-blue-400/10 text-sm font-medium text-blue-100 transition hover:bg-blue-400/14">
                    <Plus className="size-4" />
                    New chat
                </button>

                <div className="space-y-2">
                    {historyItems.map((item) => (
                        <button
                            key={item}
                            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
                        >
                            <MessageSquare className="size-4 text-slate-500" />
                            <span className="truncate">{item}</span>
                        </button>
                    ))}
                </div>
            </aside>

            {sidebarOpen && (
                <button
                    className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Close sidebar overlay"
                />
            )}

            <div className="relative z-10 flex min-h-screen flex-col">
                <header className="flex items-center justify-between px-5 py-5 sm:px-8">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="glass-icon"
                            aria-label="Open sidebar"
                        >
                            <Menu className="size-5" />
                        </button>
                        <div className="flex items-center gap-2.5">
                            <Image
                                src="/TaurusLogo.png"
                                alt="Taurus logo"
                                width={34}
                                height={34}
                                priority
                                className="h-8 w-8 object-contain sm:h-8.5 sm:w-8.5"
                            />
                            <span className="text-[1.4rem] font-semibold tracking-tight text-white sm:text-2xl">
                                Taurus
                            </span>
                        </div>
                    </div>

                </header>

                <section className="flex flex-1 items-center justify-center px-4 pb-10 pt-4 sm:px-6">
                    <div className="w-full max-w-3xl">
                        <div className="mb-10 text-center">
                            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-300/12 bg-blue-300/8 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-blue-100/70 backdrop-blur-xl">
                                <span className="size-2 rounded-full bg-blue-300 shadow-[0_0_14px_rgba(96,165,250,0.8)]" />
                                AI Trading Strategy Builder
                            </p>


                            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
                                Use plain English to build trading strategies
                            </h1>


                            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                                Describe the idea. Taurus turns it into a backtest, compares it
                                against the market, and returns results you can actually inspect.
                            </p>

                        </div>

                        <div className="glass-panel mx-auto max-w-2xl p-3 sm:p-4">
                            <div className="flex items-end gap-3 rounded-[26px] border border-white/6 bg-white/3 px-4 py-4 backdrop-blur-2xl sm:px-5">
                                <textarea
                                    rows={3}
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Describe your strategy in plain English..."
                                    className="min-h-24 flex-1 resize-none bg-transparent pt-2 text-base text-white outline-none placeholder:text-slate-400 sm:text-lg"
                                />
                                <button className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-400 text-slate-950 shadow-[0_0_30px_rgba(96,165,250,0.35)] transition hover:bg-blue-300">
                                    <ArrowUp className="size-5" />
                                </button>
                            </div>
                        </div>

                        <div className="mx-auto mt-6 grid max-w-3xl gap-3 sm:grid-cols-2">
                            {suggestions.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setPrompt(item)}
                                    className="rounded-2xl border border-white/8 bg-white/4 px-4 py-4 text-left text-sm leading-6 text-slate-300 backdrop-blur-xl transition hover:bg-white/7 hover:text-white"
                                >
                                    {item}
                                </button>

                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
