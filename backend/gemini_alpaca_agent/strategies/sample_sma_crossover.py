from __future__ import annotations

import numpy as np
import pandas as pd


def generate_signals(df: pd.DataFrame, params: dict | None = None) -> pd.DataFrame:
    params = params or {}
    fast = int(params.get("fast", 20))
    slow = int(params.get("slow", 50))

    out = df.copy()
    out["sma_fast"] = out["close"].rolling(fast, min_periods=fast).mean()
    out["sma_slow"] = out["close"].rolling(slow, min_periods=slow).mean()
    out["signal"] = np.where(out["sma_fast"] > out["sma_slow"], 1.0, 0.0)
    out["signal"] = out["signal"].fillna(0.0)
    return out
