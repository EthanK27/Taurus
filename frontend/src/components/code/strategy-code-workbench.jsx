"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { renderPythonTokens, tokenizePython } from "@/components/code/python-code-block";

function formatTimestamp(value) {
    if (!value) {
        return "";
    }

    try {
        return new Intl.DateTimeFormat("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(new Date(value));
    } catch {
        return value;
    }
}

export function StrategyCodeWorkbench({
    runDirectory,
    initialCode,
    filename,
    initialGeneratedAt,
}) {
    const router = useRouter();
    const textareaRef = useRef(null);
    const highlightRef = useRef(null);
    const [code, setCode] = useState(initialCode ?? "");
    const [lastSavedCode, setLastSavedCode] = useState(initialCode ?? "");
    const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt ?? "");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [stderr, setStderr] = useState("");

    useEffect(() => {
        setCode(initialCode ?? "");
        setLastSavedCode(initialCode ?? "");
        setGeneratedAt(initialGeneratedAt ?? "");
        setMessage("");
        setStderr("");
    }, [initialCode, initialGeneratedAt]);

    const deferredCode = useDeferredValue(code);
    const highlightedTokens = useMemo(
        () => tokenizePython(deferredCode),
        [deferredCode],
    );
    const isDirty = code !== lastSavedCode;
    const statusLabel = isSubmitting ? "Running retest..." : isDirty ? "Edited" : "Saved";

    function syncScrollPosition() {
        const textarea = textareaRef.current;
        const highlight = highlightRef.current;
        if (!textarea || !highlight) {
            return;
        }

        highlight.scrollTop = textarea.scrollTop;
        highlight.scrollLeft = textarea.scrollLeft;
    }

    function focusEditor() {
        textareaRef.current?.focus();
    }

    function handleChange(event) {
        setCode(event.target.value);
        setMessage("");
        setStderr("");
    }

    function handleKeyDown(event) {
        if (event.key !== "Tab") {
            return;
        }

        event.preventDefault();
        const textarea = event.currentTarget;
        const { selectionStart, selectionEnd } = textarea;
        const nextValue = `${code.slice(0, selectionStart)}    ${code.slice(selectionEnd)}`;
        setCode(nextValue);

        requestAnimationFrame(() => {
            textarea.selectionStart = selectionStart + 4;
            textarea.selectionEnd = selectionStart + 4;
        });
    }

    async function handleRetest() {
        if (!runDirectory || !code.trim() || isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        setMessage("");
        setStderr("");

        try {
            const response = await fetch("/api/strategy/retest", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ runDirectory, code }),
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                setMessage(payload?.error || "Retest failed.");
                setStderr(payload?.stderr || payload?.stdout || "");
                return;
            }

            setLastSavedCode(code);
            setGeneratedAt(payload?.generatedAt ?? new Date().toISOString());
            setMessage("Retest completed and chart data refreshed.");
            startTransition(() => {
                router.refresh();
            });
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Retest failed.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <section className="code-block">
            <div className="code-block__meta code-block__meta--interactive">
                <div className="code-block__meta-group">
                    <span className="code-block__meta-pill">Python</span>
                    <span className="code-block__meta-name">{filename}</span>
                    {generatedAt ? (
                        <span className="code-block__meta-pill">{formatTimestamp(generatedAt)}</span>
                    ) : null}
                </div>
                <div className="code-block__meta-group code-block__meta-group--actions">
                    <span className="code-block__status">{statusLabel}</span>
                    <Button onClick={handleRetest} disabled={isSubmitting || !runDirectory || !code.trim()}>
                        Retest
                    </Button>
                </div>
            </div>

            <div className="code-editor__surface" onClick={focusEditor}>
                <pre ref={highlightRef} className="code-block__pre code-editor__highlight" aria-hidden="true">
                    <code className="code-block__code">{renderPythonTokens(highlightedTokens)}</code>
                </pre>
                <textarea
                    ref={textareaRef}
                    className="code-editor__textarea"
                    value={code}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onScroll={syncScrollPosition}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    autoComplete="off"
                    aria-label="Editable strategy code"
                />
            </div>

            <div className="code-editor__footer">
                <p className="code-editor__hint">
                    Edit the generated strategy, then retest this run with the same symbol, timeframe, and date range.
                </p>
                {message ? <p className="code-editor__message">{message}</p> : null}
            </div>

            {stderr ? (
                <div className="code-editor__stderr">
                    <div className="code-editor__stderr-label">stderr</div>
                    <pre className="code-editor__stderr-pre">{stderr}</pre>
                </div>
            ) : null}
        </section>
    );
}