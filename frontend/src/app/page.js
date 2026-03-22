"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowUp,
    LoaderCircle,
    Menu,
    MessageSquare,
    Plus,
    X,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

const suggestions = [
    "Generate me a strategy to buy \"Company Name\" stock when it is at a month's low, and sell only at all time high for a one year ago to Feb 2026.",
    "Generate me a strategy to buy \"Company Name\" stock on the 15th of every month, and sell on the first day of the next month from Jan 2024 to March 2026.",
    "Generate me a strategy to buy \"Company Name\" every time the market drops more than \"X\"% in a day, and sell after holding for 30 days from \"##\" months ago to March 2026.",
    "Generate me a strategy to sell \"Company Name\" stock if it increases more than \"X\"% in a day, only if you would gain a profit, from Aug 2023 to March 2026.",
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
    const [messages, setMessages] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    async function handleSubmit(event) {
        event?.preventDefault();

        const trimmedPrompt = prompt.trim();
        if (!trimmedPrompt || isSubmitting) {
            return;
        }

        const userMessage = {
            id: crypto.randomUUID(),
            role: "user",
            content: trimmedPrompt,
        };

        setMessages([userMessage]);
        setPrompt("");
        setError("");
        setIsSubmitting(true);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prompt: trimmedPrompt,
                    model: "gemini-3.1-pro-preview",
                }),
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload?.error || "Request failed.");
            }

            setMessages([
                userMessage,
                {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: payload.answer || "No response returned.",
                },
            ]);

            if (payload?.runDirectory) {
                router.push(`/strategy/${encodeURIComponent(payload.runDirectory)}`);
            }
        } catch (submissionError) {
            setMessages([]);
            setError(
                submissionError instanceof Error
                    ? submissionError.message
                    : "Something went wrong while sending the prompt."
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    function startNewChat() {
        setMessages([]);
        setPrompt("");
        setError("");
        setSidebarOpen(false);
    }

    return (
        <AppShell
            activePath="/"
            headerLeft={
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="glass-icon"
                    aria-label="Open sidebar"
                >
                    <Menu className="size-5" />
                </button>
            }
        >
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

                <button
                    onClick={startNewChat}
                    className="mb-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-blue-200/18 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_34%),linear-gradient(180deg,rgba(80,127,255,0.92),rgba(53,104,241,0.88))] text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_14px_28px_rgba(37,99,235,0.28)] transition hover:brightness-105"
                >
                    <Plus className="size-4" />
                    New chat
                </button>

                <div className="space-y-2">
                    {historyItems.map((item) => (
                        <button
                            key={item}
                            className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(88,133,255,0.14),transparent_30%),linear-gradient(180deg,rgba(30,43,73,0.76),rgba(18,24,39,0.7))] px-4 py-3 text-left text-sm text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-white/12 hover:text-white"
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

            <section className="flex flex-1 items-center justify-center px-4 pb-10 pt-4 sm:px-6">
                <div className="w-full max-w-3xl">
                    <div className="mb-10 text-center">
                        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200/16 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_36%),linear-gradient(180deg,rgba(40,56,95,0.76),rgba(20,28,47,0.72))] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.28em] text-blue-100/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl">
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

                    {messages.length > 0 && (
                        <div className="mb-6 space-y-4">
                            {messages.map((message) => (
                                <article
                                    key={message.id}
                                    className={`glass-panel p-4 sm:p-5 ${message.role === "user"
                                            ? "border-blue-200/16 !bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.2),transparent_34%),linear-gradient(180deg,rgba(36,58,110,0.92),rgba(21,32,55,0.92))]"
                                            : ""
                                        }`}
                                >
                                    <div className="mb-2 text-[11px] font-mono uppercase tracking-[0.28em] text-blue-100/60">
                                        {message.role === "user" ? "You" : "Taurus"}
                                    </div>
                                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-100 sm:text-base">
                                        {message.content}
                                    </p>
                                </article>
                            ))}

                            {isSubmitting && (
                                <div className="glass-panel flex items-center gap-3 p-4 text-sm text-slate-300 sm:p-5">
                                    <LoaderCircle className="size-4 animate-spin text-blue-200" />
                                    Taurus is thinking through that request...
                                </div>
                            )}
                        </div>
                    )}

                    <form
                        onSubmit={handleSubmit}
                        className="glass-panel mx-auto max-w-2xl p-3 sm:p-4"
                    >
                        <div className="flex items-end gap-3 rounded-[26px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(92,138,255,0.12),transparent_32%),linear-gradient(180deg,rgba(29,42,71,0.56),rgba(18,24,37,0.46))] px-4 py-4 backdrop-blur-2xl sm:px-5">
                            <textarea
                                rows={3}
                                value={prompt}
                                onChange={(event) => setPrompt(event.target.value)}
                                placeholder="Describe your strategy in plain English..."
                                className="min-h-24 flex-1 resize-none bg-transparent pt-2 text-base text-white outline-none placeholder:text-slate-400 sm:text-lg"
                                disabled={isSubmitting}
                                onKeyDown={(event) => {
                                    if (
                                        event.key === "Enter" &&
                                        !event.shiftKey &&
                                        !isSubmitting
                                    ) {
                                        event.preventDefault();
                                        handleSubmit(event);
                                    }
                                }}
                            />
                            <button
                                type="submit"
                                disabled={!prompt.trim() || isSubmitting}
                                className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-blue-200/20 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.26),transparent_35%),linear-gradient(180deg,#74a8ff_0%,#4f86ff_55%,#3d70ea_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.26),0_0_30px_rgba(96,165,250,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                                aria-label="Send prompt"
                            >
                                {isSubmitting ? (
                                    <LoaderCircle className="size-5 animate-spin" />
                                ) : (
                                    <ArrowUp className="size-5" />
                                )}
                            </button>
                        </div>
                        {error && (
                            <p className="px-2 pt-3 text-sm text-rose-300">
                                {error}
                            </p>
                        )}
                    </form>

                    <div className="mx-auto mt-6 grid max-w-3xl gap-3 sm:grid-cols-2">
                        {suggestions.map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => setPrompt(item)}
                                className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(92,138,255,0.14),transparent_30%),linear-gradient(180deg,rgba(31,44,74,0.82),rgba(18,24,39,0.78))] px-4 py-4 text-left text-sm leading-6 text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition hover:border-white/14 hover:text-white"
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                </div>
            </section>
        </AppShell>
    );
}
