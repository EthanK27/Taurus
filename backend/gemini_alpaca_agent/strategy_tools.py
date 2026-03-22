from __future__ import annotations

import ast
import re
from pathlib import Path
from typing import Any

from google import genai

from config import settings


_STRATEGY_SYSTEM_PROMPT = """
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
""".strip()


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
    if not any(fn.name == "generate_signals" for fn in funcs):
        raise ValueError("Generated strategy did not define generate_signals(df, params=None).")


def generate_strategy_code(strategy_spec: str, strategy_name: str = "generated_strategy") -> dict[str, Any]:
    """Generate a Python strategy file from a natural-language strategy description.

    The saved file will define generate_signals(df, params=None) for the local backtester.

    Args:
        strategy_spec: Natural-language description of the strategy logic.
        strategy_name: File-friendly name for the generated strategy.
    """
    client = genai.Client(api_key=settings.gemini_api_key)
    prompt = f"{_STRATEGY_SYSTEM_PROMPT}\n\nStrategy spec:\n{strategy_spec}\n"
    response = client.models.generate_content(
        model=settings.default_model,
        contents=prompt,
    )
    code = _extract_python(response.text or "")
    _validate_strategy_source(code)

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


def list_strategies() -> dict[str, Any]:
    """List strategy files currently saved in the local strategies directory."""
    out_dir = Path(settings.strategies_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    files = sorted(str(p) for p in out_dir.glob("*.py"))
    return {"strategies": files}
