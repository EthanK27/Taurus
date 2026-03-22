from __future__ import annotations

import numpy as np
import pandas as pd


def generate_signals(df: pd.DataFrame, params: dict | None = None) -> pd.DataFrame:
    params = params or {}
    week = int(params.get("week", 7))
    three = int(params.get("three", 3))

    out = df.copy()
    out["week_low"] = out["close"].rolling(week, min_periods=week).min()
    out["three_high"] = out["close"].rolling(three, min_periods=three).max()

    out["signal"] = np.nan
    out.loc[out["close"] <= out["week_low"], "signal"] = 1.0
    out.loc[out["close"] >= out["three_high"], "signal"] = 0.0

    out["signal"] = out["signal"].ffill().fillna(0.0)
    return out
