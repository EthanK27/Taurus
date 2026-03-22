from __future__ import annotations

import ast
import re
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from google import genai

from config import settings


_STRATEGY_RULES = """
You write Python trading strategy modules for a local backtester.
Return only raw Python code, with no markdown fences and no explanation.
Rules:
- Allowed imports: pandas as pd, numpy as np
- Must define exactly one function:
    def generate_signals(df: pd.DataFrame, params: dict | None = None) -> pd.DataFrame:
- Input df has columns: open, high, low, close, volume, and maybe trade_count, vwap
- Return a copy of df with a numeric signal column
- signal must be between 0 and 1, where 1 means long and 0 means flat
- No network calls, no file I/O, no randomness, no printing
- Handle NaNs safely
- Use vectorized pandas code where possible
- Use pandas Series operations for indicators and conditions
- Do not call .fillna or other pandas methods on a raw numpy.ndarray
- If you use np.where for an intermediate value, wrap it in pd.Series(..., index=df.index)
""".strip()

_EXAMPLE_STRATEGY_FILES = {
    "sample_sma_crossover.py": Path(__file__).resolve().parent / "strategies" / "sample_sma_crossover.py",
    "sample_weeklow_3dayhigh.py": Path(__file__).resolve().parent / "strategies" / "sample_weeklow_3dayhigh.py",
}


def _read_example_strategy(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


_STRATEGY_EXAMPLES = """
Example strategy file: sample_sma_crossover.py
This is a simple moving-average crossover strategy. It computes a fast SMA and a slow SMA on close, sets signal to 1.0 when fast > slow, and otherwise sets signal to 0.0.
{sample_sma_crossover}

Example strategy file: sample_weeklow_3dayhigh.py
This is a week-low / 3-day-high regime strategy. It tracks a rolling low and rolling high on close, goes long when price reaches the week low, goes flat when price reaches the three-day high, and forward-fills the signal between transitions.
{sample_weeklow_3dayhigh}
""".strip().format(
    sample_sma_crossover=_read_example_strategy(_EXAMPLE_STRATEGY_FILES["sample_sma_crossover.py"]),
    sample_weeklow_3dayhigh=_read_example_strategy(_EXAMPLE_STRATEGY_FILES["sample_weeklow_3dayhigh.py"]),
)


_STRATEGY_SYSTEM_PROMPT = f"""{_STRATEGY_RULES}

Use these static strategy examples as style and logic references when helpful:
{_STRATEGY_EXAMPLES}
""".strip()


_ALLOWED_IMPORTS = {("pandas", "pd"), ("numpy", "np")}


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()
    return slug or "strategy"


def _extract_python(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```python\s*", "", text)
        text = re.sub(r"^```\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _validate_strategy_source(source: str) -> None:
    tree = ast.parse(source)
    funcs = [node for node in tree.body if isinstance(node, ast.FunctionDef)]
    if len(funcs) != 1 or funcs[0].name != "generate_signals":
        raise ValueError("Generated strategy must define exactly one function named generate_signals(df, params=None).")

    for node in tree.body:
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
            continue
        if isinstance(node, ast.FunctionDef):
            continue
        if isinstance(node, ast.Import):
            for alias in node.names:
                if (alias.name, alias.asname) not in _ALLOWED_IMPORTS:
                    raise ValueError("Only 'import pandas as pd' and 'import numpy as np' are allowed.")
            continue
        if isinstance(node, ast.ImportFrom):
            raise ValueError("Generated strategy may not use 'from ... import ...' imports.")
        raise ValueError("Generated strategy contains unsupported top-level code.")


def _build_validation_frame(rows: int = 200) -> pd.DataFrame:
    index = pd.date_range("2020-01-01", periods=rows, freq="D", tz="UTC")
    base = pd.Series(np.linspace(100.0, 130.0, rows), index=index)
    wave = pd.Series(np.sin(np.linspace(0.0, 12.0, rows)) * 2.0, index=index)
    close = base + wave
    return pd.DataFrame(
        {
            "open": close * 0.995,
            "high": close * 1.01,
            "low": close * 0.99,
            "close": close,
            "volume": np.linspace(1_000_000, 1_500_000, rows),
            "trade_count": np.linspace(10_000, 15_000, rows),
            "vwap": close * 1.001,
        },
        index=index,
    )


def _smoke_test_strategy_source(source: str) -> None:
    namespace: dict[str, Any] = {}
    exec(compile(source, "<generated_strategy>", "exec"), namespace, namespace)
    fn = namespace.get("generate_signals")
    if not callable(fn):
        raise ValueError("Generated strategy did not define a callable generate_signals function.")

    sample = _build_validation_frame()
    result = fn(sample.copy(), params={})
    if not isinstance(result, pd.DataFrame):
        raise ValueError("Generated strategy must return a pandas DataFrame.")
    if "signal" not in result.columns:
        raise ValueError("Generated strategy output must include a signal column.")
    if len(result) != len(sample):
        raise ValueError("Generated strategy output must preserve the input row count.")

    signal = pd.to_numeric(result["signal"], errors="raise")
    if ((signal < 0.0) | (signal > 1.0)).any():
        raise ValueError("Generated strategy signal values must stay between 0 and 1.")


def describe_strategy_environment() -> dict[str, Any]:
    """Describe the strategy-building and backtesting contract used by the local backtester."""
    return {
        "allowed_imports": ["import pandas as pd", "import numpy as np"],
        "required_function": "generate_signals(df: pd.DataFrame, params: dict | None = None) -> pd.DataFrame",
        "input_columns": ["open", "high", "low", "close", "volume", "trade_count", "vwap"],
        "signal_rules": {
            "type": "numeric",
            "range": [0, 1],
            "long_threshold": 0.5,
            "long_meaning": "signal >= 0.5 means long",
            "flat_meaning": "signal < 0.5 means flat",
        },
        "backtester_rules": {
            "exposure_model": "long_or_flat_only",
            "position_sizing": "all-in on entry, fully exit on flat signal",
            "unsupported": ["shorting", "leverage", "network access", "file I/O", "external TA libraries"],
        },
        "recommended_vectorized_ops": ["rolling", "ewm", "shift", "diff", "pct_change", "clip", "fillna", "np.where"],
        "guide": STRATEGY_ENVIRONMENT_GUIDE,
    }


def generate_strategy_code(strategy_spec: str, strategy_name: str = "generated_strategy") -> dict[str, Any]:
    """Generate a Python strategy file from a natural-language strategy description.

    The saved file will define generate_signals(df, params=None) for the local backtester.

    Args:
        strategy_spec: Natural-language description of the strategy logic.
        strategy_name: File-friendly name for the generated strategy.
    """
    client = genai.Client(api_key=settings.gemini_api_key)
    base_prompt = (
        f"{_STRATEGY_SYSTEM_PROMPT}\n\n"
        f"Strategy environment:\n{STRATEGY_ENVIRONMENT_GUIDE}\n\n"
        f"Strategy spec:\n{strategy_spec}\n"
    )

    last_error = ""
    for attempt in range(3):
        prompt = base_prompt
        if last_error:
            prompt += (
                "\nPrevious attempt failed local validation. "
                "Return corrected Python only.\n"
                f"Validation error:\n{last_error}\n"
            )
        response = client.models.generate_content(
            model=settings.default_model,
            contents=prompt,
        )
        code = _extract_python(response.text or "")
        try:
            _validate_strategy_source(code)
            _smoke_test_strategy_source(code)
            break
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
            if attempt == 2:
                raise ValueError(f"Generated strategy failed local validation after 3 attempts: {last_error}") from exc
    else:
        raise ValueError("Generated strategy failed local validation.")

    out_dir = Path(settings.strategies_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    safe_name = _slugify(strategy_name)
    path = out_dir / f"{safe_name}.py"
    path.write_text(code + "\n", encoding="utf-8")

    return {
        "strategy_name": safe_name,
        "strategy_path": str(path),
        "preview": "\n".join(code.splitlines()[:20]),
    }
