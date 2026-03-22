"use client";

import { useEffect, useMemo, useState } from "react";

function TypewriterText({ text, isLoading }) {
    const [visibleLength, setVisibleLength] = useState(0);

    useEffect(() => {
        if (!text) {
            return undefined;
        }

        let frameId;
        let timeoutId;

        const step = () => {
            setVisibleLength((current) => {
                if (current >= text.length) {
                    return current;
                }

                const nextLength = Math.min(current + 2, text.length);
                if (nextLength < text.length) {
                    timeoutId = window.setTimeout(() => {
                        frameId = window.requestAnimationFrame(step);
                    }, 16);
                }

                return nextLength;
            });
        };

        timeoutId = window.setTimeout(() => {
            frameId = window.requestAnimationFrame(step);
        }, 100);

        return () => {
            window.clearTimeout(timeoutId);
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }
        };
    }, [text]);

    if (isLoading) {
        return (
            <div className="space-y-2" aria-hidden="true">
                <div className="h-4 w-full rounded-full bg-white/8" />
                <div className="h-4 w-[90%] rounded-full bg-white/8" />
                <div className="h-4 w-[76%] rounded-full bg-white/8" />
            </div>
        );
    }

    return (
        <p className="mt-3 min-h-[7rem] whitespace-pre-wrap text-sm leading-7 text-slate-300">
            {text.slice(0, visibleLength)}
            {visibleLength < text.length ? (
                <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-blue-200 align-middle" />
            ) : null}
        </p>
    );
}

export function StrategySummaryPanel({ runDirectory }) {
    const [payload, setPayload] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        async function loadSummary() {
            try {
                setLoading(true);
                setError("");

                const searchParams = new URLSearchParams();
                if (runDirectory) {
                    searchParams.set("runDirectory", runDirectory);
                }

                const response = await fetch(
                    `/api/strategy-summary?${searchParams.toString()}`,
                    { cache: "no-store" },
                );
                const nextPayload = await response.json();

                if (!response.ok) {
                    throw new Error(nextPayload?.error || "Unable to load strategy summary.");
                }

                if (!cancelled) {
                    setPayload(nextPayload);
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(
                        loadError instanceof Error
                            ? loadError.message
                            : "Unable to load strategy summary.",
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadSummary();

        return () => {
            cancelled = true;
        };
    }, [runDirectory]);

    const metrics = useMemo(() => payload?.metrics ?? [], [payload]);

    return (
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
                    {error ? (
                        <p className="mt-3 text-sm leading-7 text-rose-300">
                            {error}
                        </p>
                    ) : (
                        <TypewriterText
                            key={payload?.overview ?? ""}
                            text={payload?.overview ?? ""}
                            isLoading={loading}
                        />
                    )}
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/3 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                        Metrics
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        {metrics.length ? metrics.map((metric) => (
                            <div
                                key={metric.label}
                                className="rounded-2xl border border-white/8 bg-slate-950/25 px-4 py-3"
                            >
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                    {metric.label}
                                </p>
                                <p className="mt-2 text-2xl font-semibold text-white">
                                    {metric.value}
                                </p>
                            </div>
                        )) : (
                            <div className="rounded-2xl border border-white/8 bg-slate-950/25 px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                    Status
                                </p>
                                <p className="mt-2 text-2xl font-semibold text-white">
                                    {loading ? "Loading" : error ? "Issue" : "Waiting"}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
