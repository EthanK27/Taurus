const PYTHON_KEYWORDS = [
    "False",
    "None",
    "True",
    "and",
    "as",
    "assert",
    "async",
    "await",
    "break",
    "case",
    "class",
    "continue",
    "def",
    "del",
    "elif",
    "else",
    "except",
    "finally",
    "for",
    "from",
    "global",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "match",
    "nonlocal",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "try",
    "while",
    "with",
    "yield",
];

const TOKEN_PATTERN = new RegExp(
    [
        "#[^\\n]*",
        "(?:'''[\\s\\S]*?'''|\"\"\"[\\s\\S]*?\"\"\")",
        "'(?:\\\\.|[^'\\\\\\n])*'",
        '\"(?:\\\\.|[^\"\\\\\\n])*\"',
        "@[A-Za-z_][A-Za-z0-9_]*",
        "\\b\\d+(?:_\\d+)*(?:\\.\\d+(?:_\\d+)*)?\\b",
        `\\b(?:${PYTHON_KEYWORDS.join("|")})\\b`,
    ].join("|"),
    "gu",
);

const TOKEN_STYLES = {
    plain: { color: "#d6deeb" },
    keyword: { color: "#93c5fd", fontWeight: 600 },
    string: { color: "#9ae6b4" },
    comment: { color: "#7c8aa5", fontStyle: "italic" },
    decorator: { color: "#f0abfc" },
    number: { color: "#f9a8d4" },
};

function classifyToken(value) {
    if (value.startsWith("#")) {
        return "comment";
    }

    if (value.startsWith("@")) {
        return "decorator";
    }

    if (
        value.startsWith("\"\"\"") ||
        value.startsWith("'''") ||
        value.startsWith("\"") ||
        value.startsWith("'")
    ) {
        return "string";
    }

    if (/^\d/u.test(value)) {
        return "number";
    }

    return PYTHON_KEYWORDS.includes(value) ? "keyword" : "plain";
}

export function tokenizePython(code = "") {
    const source = typeof code === "string" ? code : "";
    const tokens = [];
    let lastIndex = 0;

    for (const match of source.matchAll(TOKEN_PATTERN)) {
        const value = match[0] ?? "";
        const start = match.index ?? 0;

        if (start > lastIndex) {
            tokens.push({ type: "plain", value: source.slice(lastIndex, start) });
        }

        tokens.push({ type: classifyToken(value), value });
        lastIndex = start + value.length;
    }

    if (lastIndex < source.length) {
        tokens.push({ type: "plain", value: source.slice(lastIndex) });
    }

    return tokens;
}

export function renderPythonTokens(tokens) {
    return tokens.map((token, index) => (
        <span key={`${token.type}-${index}`} style={TOKEN_STYLES[token.type] ?? TOKEN_STYLES.plain}>
            {token.value}
        </span>
    ));
}

export function PythonCodeBlock({ code, filename = "strategy.py", status = "Read only" }) {
    const tokens = tokenizePython(code);

    return (
        <section className="code-block">
            <div className="code-block__meta">
                <div className="code-block__meta-group">
                    <span className="code-block__meta-pill">Python</span>
                    <span className="code-block__meta-name">{filename}</span>
                </div>
                <div className="code-block__meta-group">
                    <span className="code-block__status">{status}</span>
                </div>
            </div>
            <pre className="code-block__pre">
                <code className="code-block__code">{renderPythonTokens(tokens)}</code>
            </pre>
        </section>
    );
}