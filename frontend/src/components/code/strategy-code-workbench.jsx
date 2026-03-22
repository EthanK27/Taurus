"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { renderPythonTokens, tokenizePython } from "@/components/code/python-code-block";
import { Button } from "@/components/ui/button";

function normalizeCode(value) {
    return typeof value === "string" ? value : "";
}

export function StrategyCodeWorkbench({
    runDirectory,
    initialCode,
    filename,
    initialGeneratedAt,
}) {
    const router = useRouter();
    const [code, setCode] = useState(normalizeCode(initialCode));
    const [isRetesting, setIsRetesting] = useState(false);
    const [stderrOutput, setStderrOutput] = useState("");
    const [statusMessage, setStatusMessage] = useState("");
    const textareaRef = useRef(null);
    const highlightRef = useRef(null);
    const tokens = useMemo(() => tokenizePython(code), [code]);
    const dirty = code !== normalizeCode(initialCode);

    useEffect(() => {
        setCode(normalizeCode(initialCode));
        setStatusMessage("");
        setStderrOutput("");
    }, [initialCode, initialGeneratedAt]);

    const syncScroll = () => {
        if (!textareaRef.current || !highlightRef.current) {
            return;
        }

        highlightRef.current.scrollTop = textareaRef.current.scrollTop;
        highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    };

    const focusEditor = () => {
        textareaRef.current?.focus();
    };

    const handleKeyDown = (event) => {
        if (event.key !== "Tab") {
            return;
        }

        event.preventDefault();
        const target = event.currentTarget;
        const start = target.selectionStart ?? 0;
        const end = target.selectionEnd ?? 0;
        const updated = `${code.slice(0, start)}    ${code.slice(end)}`;

        setCode(updated);
        requestAnimationFrame(() => {
            if (!textareaRef.current) {
                return;
            }

            textareaRef.current.selectionStart = start + 4;
            textareaRef.current.selectionEnd = start + 4;
        });
    };

    const handleRetest = async () => {
        setIsRetesting(true);
        setStatusMessage("");
        setStderrOutput("");

        try {
            const response = await fetch("/api/strategy/retest", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    runDirectory,
                    code,
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                setStderrOutput(payload?.stderr || payload?.stdout || payload?.error || "Retest failed.");
                setStatusMessage(payload?.error || "Retest failed.");
                return;
            }

            setStatusMessage("Retest completed. Refreshing results...");
            router.refresh();
        } catch (error) {
            setStatusMessage("Retest failed.");
            setStderrOutput(error instanceof Error ? error.message : "Retest failed.");
        } finally {
            setIsRetesting(false);
        }
    };

    return (
        <div className="code-block">
            <div className="code-block__meta code-block__meta--interactive">
                <div className="code-block__meta-group">
                    <span className="code-block__meta-pill">Python</span>
                    {filename ? <span className="code-block__meta-name">{filename}</span> : null}
                </div>
                <div className="code-block__meta-group code-block__meta-group--actions">
                    <span className="code-block__status">
                        {isRetesting ? "Running retest..." : dirty ? "Edited" : "Saved"}
                    </span>
                    <Button onClick={handleRetest} disabled={isRetesting}>
                        {isRetesting ? "Retesting..." : "Retest"}
                    </Button>
                </div>
            </div>

            <div className="code-editor__surface" onClick={focusEditor}>
                <pre ref={highlightRef} className="code-block__pre code-editor__highlight" aria-hidden="true">
                    <code className="code-block__code">{renderPythonTokens(tokens)}</code>
                </pre>
                <textarea
                    ref={textareaRef}
                    className="code-editor__textarea"
                    spellCheck={false}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    onKeyDown={handleKeyDown}
                    onScroll={syncScroll}
                    aria-label="Editable strategy code"
                    wrap="off"
                />
            </div>

            <div className="code-editor__footer">
                <div className="code-editor__hint">
                    Edit the generated strategy, then retest this run with the same symbol, timeframe, and date range.
                </div>
                {statusMessage ? <div className="code-editor__message">{statusMessage}</div> : null}
            </div>

            {stderrOutput ? (
                <div className="code-editor__stderr">
                    <div className="code-editor__stderr-label">stderr</div>
                    <pre className="code-editor__stderr-pre">{stderrOutput}</pre>
                </div>
            ) : null}
        </div>
    );
}