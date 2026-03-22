"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function StrategyCodeEditorPanel({ runDirectory }) {
    const router = useRouter();

    const [code, setCode] = useState("");
    const [savedCode, setSavedCode] = useState("");
    const [strategyFileName, setStrategyFileName] = useState("");
    const [metadata, setMetadata] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [rerunning, setRerunning] = useState(false);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");

    const hasChanges = useMemo(() => code !== savedCode, [code, savedCode]);

    useEffect(() => {
        let cancelled = false;

        async function loadStrategyCode() {
            try {
                setLoading(true);
                setError("");
                setStatus("");

                const searchParams = new URLSearchParams({ runDirectory });
                const response = await fetch(`/api/strategy-code?${searchParams.toString()}`, {
                    cache: "no-store",
                });
                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(payload?.error || "Failed to load strategy code.");
                }

                if (!cancelled) {
                    setCode(payload.code ?? "");
                    setSavedCode(payload.code ?? "");
                    setStrategyFileName(payload.strategyFileName ?? "");
                    setMetadata({
                        symbol: payload.symbol,
                        timeframe: payload.timeframe,
                        start: payload.start,
                        end: payload.end,
                    });
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(
                        loadError instanceof Error ? loadError.message : "Failed to load strategy code.",
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadStrategyCode();

        return () => {
            cancelled = true;
        };
    }, [runDirectory]);

    async function handleSync({ rerun }) {
        const trimmed = code.trim();
        if (!trimmed) {
            setError("Strategy code cannot be empty.");
            return;
        }

        setError("");
        setStatus("");
        if (rerun) {
            setRerunning(true);
        } else {
            setSyncing(true);
        }

        try {
            const response = await fetch("/api/strategy-code", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    runDirectory,
                    code,
                    rerun,
                }),
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.error || "Failed to sync strategy code.");
            }

            setSavedCode(code.endsWith("\n") ? code : `${code}\n`);

            if (rerun && payload?.nextRunDirectory) {
                setStatus("Backtest completed. Opening the new run...");
                router.push(`/strategy/${payload.nextRunDirectory}`);
                router.refresh();
                return;
            }

            setStatus("Strategy code synced to backend file.");
        } catch (syncError) {
            setError(syncError instanceof Error ? syncError.message : "Failed to sync strategy code.");
        } finally {
            setSyncing(false);
            setRerunning(false);
        }
    }

    return (
        <section className="glass-panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 bg-white/4 px-6 py-4">
                <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-blue-100/60">
                        Code
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                        Strategy Editor
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                        {strategyFileName || "Resolving strategy file..."}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
                        disabled={loading || syncing || rerunning || !hasChanges}
                        onClick={() => handleSync({ rerun: false })}
                    >
                        {syncing ? "Syncing..." : "Sync to file"}
                    </Button>

                    <Button
                        type="button"
                        className="bg-blue-500 text-blue-950 hover:bg-blue-400"
                        disabled={loading || syncing || rerunning}
                        onClick={() => handleSync({ rerun: true })}
                    >
                        {rerunning ? "Running backtest..." : "Sync + Re-run"}
                    </Button>
                </div>
            </div>

            <div className="border-b border-white/8 bg-slate-950/35 px-6 py-3 text-xs text-slate-300">
                {metadata ? (
                    <p>
                        {metadata.symbol} • {metadata.timeframe} • {metadata.start} to {metadata.end}
                    </p>
                ) : (
                    <p>Loading run metadata...</p>
                )}
            </div>

            <div className="bg-slate-950/45 px-6 py-6">
                <Textarea
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    spellCheck={false}
                    disabled={loading || rerunning}
                    className="min-h-[26rem] resize-y border-white/10 bg-slate-950/70 font-mono text-sm leading-7 text-slate-100 focus-visible:border-blue-300/60"
                />

                {error ? (
                    <p className="mt-4 text-sm text-rose-300">{error}</p>
                ) : null}

                {status ? (
                    <p className="mt-4 text-sm text-emerald-300">{status}</p>
                ) : null}
            </div>
        </section>
    );
}
