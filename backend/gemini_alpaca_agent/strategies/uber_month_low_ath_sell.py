import numpy as np
import pandas as pd


def generate_signals(df: pd.DataFrame, params: dict | None = None) -> pd.DataFrame:
    params = params or {}
    
    # Default period for 1-month low (e.g., 21 trading days or bars)
    month_period = int(params.get("month_period", 21)) 

    out = df.copy()

    # Calculate the 1-month low using a rolling minimum on 'close' prices
    # min_periods ensures that the rolling window has enough data before calculating the low
    out["month_low"] = out["close"].rolling(month_period, min_periods=month_period).min()

    # Calculate the all-time high using an expanding maximum on 'close' prices
    # The expanding window starts from the first available data point
    out["all_time_high"] = out["close"].expanding(min_periods=1).max()

    # Initialize the signal column with NaN. This allows for clear transitions.
    out["signal"] = np.nan

    # Set the buy signal: go long (1.0) when the current close price is at or below the 1-month low
    buy_condition = out["close"] <= out["month_low"]
    out.loc[buy_condition, "signal"] = 1.0

    # Set the sell signal: go flat (0.0) when the current close price is at or above the all-time high
    sell_condition = out["close"] >= out["all_time_high"]
    out.loc[sell_condition, "signal"] = 0.0

    # Forward-fill the signal to maintain the last known state (long or flat)
    # Any leading NaNs (before the first explicit signal) are filled with 0.0, meaning the strategy starts flat.
    out["signal"] = out["signal"].ffill().fillna(0.0)
    
    # Drop intermediate columns that are not part of the final strategy output
    out = out.drop(columns=["month_low", "all_time_high"])

    return out
