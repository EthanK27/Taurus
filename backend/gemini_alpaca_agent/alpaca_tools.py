from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
from alpaca.data.enums import Adjustment, DataFeed
from alpaca.data.historical.stock import StockHistoricalDataClient
from alpaca.data.requests import (
    StockBarsRequest,
)
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit

from backtester import run_long_flat_backtest, save_backtest_report
from config import settings


def _stock_client() -> StockHistoricalDataClient:
    return StockHistoricalDataClient(settings.alpaca_api_key, settings.alpaca_secret_key)


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _parse_feed(feed: str | None) -> DataFeed | None:
    if not feed:
        return getattr(DataFeed, settings.default_data_feed.upper(), None)
    return getattr(DataFeed, feed.upper(), None)


def _parse_adjustment(adjustment: str | None) -> Adjustment | None:
    if not adjustment:
        return None
    return getattr(Adjustment, adjustment.upper(), None)


def _parse_timeframe(timeframe: str) -> TimeFrame:
    tf = "".join(ch for ch in timeframe.strip().lower() if ch.isalnum())
    mapping = {
        "1min": TimeFrame(1, TimeFrameUnit.Minute),
        "1minute": TimeFrame(1, TimeFrameUnit.Minute),
        "minute": TimeFrame(1, TimeFrameUnit.Minute),
        "minutes": TimeFrame(1, TimeFrameUnit.Minute),
        "5min": TimeFrame(5, TimeFrameUnit.Minute),
        "5minute": TimeFrame(5, TimeFrameUnit.Minute),
        "15min": TimeFrame(15, TimeFrameUnit.Minute),
        "15minute": TimeFrame(15, TimeFrameUnit.Minute),
        "30min": TimeFrame(30, TimeFrameUnit.Minute),
        "30minute": TimeFrame(30, TimeFrameUnit.Minute),
        "1hour": TimeFrame(1, TimeFrameUnit.Hour),
        "hour": TimeFrame(1, TimeFrameUnit.Hour),
        "hourly": TimeFrame(1, TimeFrameUnit.Hour),
        "1day": TimeFrame(1, TimeFrameUnit.Day),
        "day": TimeFrame(1, TimeFrameUnit.Day),
        "daily": TimeFrame(1, TimeFrameUnit.Day),
        "dailybar": TimeFrame(1, TimeFrameUnit.Day),
        "dailybars": TimeFrame(1, TimeFrameUnit.Day),
    }
    if tf not in mapping:
        raise ValueError(f"Unsupported timeframe: {timeframe}")
    return mapping[tf]


def _bars_to_df(barset: Any, symbol: str) -> pd.DataFrame:
    raw = barset.df if hasattr(barset, "df") else pd.DataFrame()
    if raw.empty:
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume", "trade_count", "vwap"])

    df = raw.copy()
    if isinstance(df.index, pd.MultiIndex):
        try:
            df = df.xs(symbol, level=0)
        except KeyError:
            try:
                df = df.xs(symbol, level="symbol")
            except Exception:
                pass

    rename_map = {
        "open": "open",
        "high": "high",
        "low": "low",
        "close": "close",
        "volume": "volume",
        "trade_count": "trade_count",
        "vwap": "vwap",
    }
    cols = [c for c in rename_map if c in df.columns]
    df = df[cols].copy()
    return df.sort_index()


def _fetch_historical_bars_df(
    symbol: str,
    timeframe: str,
    start: str,
    end: str,
    feed: str | None = None,
    adjustment: str | None = None,
) -> pd.DataFrame:
    request = StockBarsRequest(
        symbol_or_symbols=symbol,
        timeframe=_parse_timeframe(timeframe),
        start=_parse_dt(start),
        end=_parse_dt(end),
        feed=_parse_feed(feed),
        adjustment=_parse_adjustment(adjustment),
    )
    barset = _stock_client().get_stock_bars(request)
    return _bars_to_df(barset, symbol)


def run_backtest(
    strategy_path: str,
    symbol: str,
    timeframe: str,
    start: str,
    end: str,
    initial_cash: float = 10_000.0,
    commission_per_trade: float = 0.0,
    slippage_bps: float = 0.0,
    feed: str = "iex",
    adjustment: str = "raw",
    params_json: str = "{}",
) -> dict[str, Any]:
    """Run a local backtest using Alpaca historical bars and a saved strategy file.

    The strategy file must define generate_signals(df, params=None) and return a DataFrame
    with a numeric signal column where 1 means long and 0 means flat.

    Args:
        strategy_path: Path to a Python strategy file.
        symbol: Ticker symbol like SPY.
        timeframe: One of 1Min, 5Min, 15Min, 30Min, 1Hour, 1Day.
        start: ISO datetime string.
        end: ISO datetime string.
        initial_cash: Starting cash.
        commission_per_trade: Flat commission applied to each entry and exit.
        slippage_bps: Slippage in basis points applied to fill prices.
        feed: Alpaca data feed, usually iex or sip.
        adjustment: Bar adjustment mode.
        params_json: JSON object string passed to the strategy as params.
    """
    params = json.loads(params_json or "{}")
    df = _fetch_historical_bars_df(symbol, timeframe, start, end, feed=feed, adjustment=adjustment)
    result = run_long_flat_backtest(
        bars=df,
        strategy_path=strategy_path,
        initial_cash=initial_cash,
        commission_per_trade=commission_per_trade,
        slippage_bps=slippage_bps,
        params=params,
    )

    prefix = f"{Path(strategy_path).stem}_{symbol}_{timeframe}_{start[:10]}_{end[:10]}"
    saved = save_backtest_report(result, settings.outputs_dir, prefix)

    return {
        "summary": result.summary,
        "artifacts": saved,
        "first_trade": result.trades[0] if result.trades else None,
        "last_trade": result.trades[-1] if result.trades else None,
    }
