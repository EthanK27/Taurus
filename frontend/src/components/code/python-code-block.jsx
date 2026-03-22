const PYTHON_KEYWORDS = new Set([
    "False",
    "None",
    "True",
    "and",
    "as",
    "assert",
    "async",
    "await",
    "break",
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
]);

const PYTHON_TOKEN_REGEX =
    /(\"\"\"[\s\S]*?\"\"\"|'''[\s\S]*?'''|\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'|#[^\n]*|@[A-Za-z_]\w*|\b(?:False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b|\b\d+(?:\.\d+)?\b)/g;

const TOKEN_STYLES = {
    comment: { color: "#7c8aa5", fontStyle: "italic" },
    decorator: { color: "#c4b5fd" },
    string: { color: "#86efac" },
    number: { color: "#f9a8d4" },
    keyword: { color: "#7dd3fc", fontWeight: 600 },
};

function getTokenType(token) {
    if (token.startsWith("#")) {
        return "comment";
    }

    if (token.startsWith("@")) {
        return "decorator";
    }

    if (
        token.startsWith('"""') ||
        token.startsWith("'''") ||
        token.startsWith('"') ||
        token.startsWith("'")
    ) {
        return "string";
    }

    if (/^\d/.test(token)) {
        return "number";
    }

    if (PYTHON_KEYWORDS.has(token)) {
        return "keyword";
    }

    return "plain";
}

export function tokenizePython(code) {
    const source = typeof code === "string" ? code : "";
    const tokens = [];
    let lastIndex = 0;

    for (const match of source.matchAll(PYTHON_TOKEN_REGEX)) {
        const token = match[0];
        const index = match.index ?? 0;

        if (index > lastIndex) {
            tokens.push({
                type: "plain",
                value: source.slice(lastIndex, index),
            });
        }

        tokens.push({
            type: getTokenType(token),
            value: token,
        });
        lastIndex = index + token.length;
    }

    if (lastIndex < source.length) {
        tokens.push({
            type: "plain",
            value: source.slice(lastIndex),
        });
    }

    if (!tokens.length) {
        tokens.push({ type: "plain", value: "" });
    }

    return tokens;
}

export function renderPythonTokens(tokens) {
    return tokens.map((token, index) => {
        if (token.type === "plain") {
            return token.value;
        }

        return (
            <span key={`${token.type}-${index}`} style={TOKEN_STYLES[token.type]}>
                {token.value}
            </span>
        );
    });
}

export function PythonCodeBlock({ code, filename }) {
    const source = typeof code === "string" ? code : "";
    const tokens = tokenizePython(source);

    return (
        <div className="code-block">
            <div className="code-block__meta">
                <span className="code-block__meta-pill">Python</span>
                {filename ? <span className="code-block__meta-name">{filename}</span> : null}
            </div>
            <pre className="code-block__pre">
                <code className="code-block__code">{renderPythonTokens(tokens)}</code>
            </pre>
        </div>
    );
}