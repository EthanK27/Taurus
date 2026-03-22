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
    StockLatestBarRequest,
    StockLatestQuoteRequest,
    StockLatestTradeRequest,
    StockSnapshotRequest,
)
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
from alpaca.trading.client import TradingClient
from alpaca.trading.enums import OrderSide, QueryOrderStatus, TimeInForce
from alpaca.trading.requests import (
    GetOrdersRequest,
    LimitOrderRequest,
    MarketOrderRequest,
    StopLimitOrderRequest,
    StopOrderRequest,
)

from backtester import run_long_flat_backtest, save_backtest_report
from config import settings


def _stock_client() -> StockHistoricalDataClient:
    return StockHistoricalDataClient(settings.alpaca_api_key, settings.alpaca_secret_key)


def _trading_client() -> TradingClient:
    return TradingClient(settings.alpaca_api_key, settings.alpaca_secret_key, paper=settings.alpaca_paper)


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
    tf = timeframe.strip().lower()
    mapping = {
        "1min": TimeFrame(1, TimeFrameUnit.Minute),
        "5min": TimeFrame(5, TimeFrameUnit.Minute),
        "15min": TimeFrame(15, TimeFrameUnit.Minute),
        "30min": TimeFrame(30, TimeFrameUnit.Minute),
        "1hour": TimeFrame(1, TimeFrameUnit.Hour),
        "1day": TimeFrame(1, TimeFrameUnit.Day),
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


def _safe_serialize(value: Any) -> Any:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, dict):
        return {str(k): _safe_serialize(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_safe_serialize(v) for v in value]
    if hasattr(value, "model_dump"):
        return _safe_serialize(value.model_dump())
    if hasattr(value, "dict"):
        return _safe_serialize(value.dict())
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            pass
    return str(value)


def get_historical_bars(
    symbol: str,
    timeframe: str,
    start: str,
    end: str,
    feed: str = "iex",
    adjustment: str = "raw",
    preview_rows: int = 5,
) -> dict[str, Any]:
    """Fetch historical OHLCV bars from Alpaca for one stock symbol.

    Args:
        symbol: Ticker symbol like SPY or AAPL.
        timeframe: One of 1Min, 5Min, 15Min, 30Min, 1Hour, 1Day.
        start: ISO datetime, for example 2024-01-01T00:00:00Z.
        end: ISO datetime, for example 2025-01-01T00:00:00Z.
        feed: Data feed, usually iex for free plans or sip when available.
        adjustment: Corporate action adjustment mode, usually raw, split, or all.
        preview_rows: Number of rows to include in the preview.
    """
    df = _fetch_historical_bars_df(symbol, timeframe, start, end, feed=feed, adjustment=adjustment)
    preview = df.head(preview_rows).reset_index()
    if not preview.empty:
        preview.iloc[:, 0] = preview.iloc[:, 0].astype(str)

    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "rows": int(len(df)),
        "first_timestamp": str(df.index[0]) if len(df) else None,
        "last_timestamp": str(df.index[-1]) if len(df) else None,
        "last_close": float(df["close"].iloc[-1]) if len(df) else None,
        "preview": preview.to_dict(orient="records"),
    }


def get_latest_market_data(symbol: str, data_type: str = "snapshot", feed: str = "iex") -> dict[str, Any]:
    """Fetch latest quote, trade, bar, or snapshot from Alpaca for one stock symbol.

    Args:
        symbol: Ticker symbol like SPY or AAPL.
        data_type: One of quote, trade, bar, or snapshot.
        feed: Data feed, usually iex for free plans or sip when available.
    """
    client = _stock_client()
    feed_enum = _parse_feed(feed)
    data_type = data_type.strip().lower()

    if data_type == "quote":
        req = StockLatestQuoteRequest(symbol_or_symbols=symbol, feed=feed_enum)
        data = client.get_stock_latest_quote(req)
        return _safe_serialize(data)
    if data_type == "trade":
        req = StockLatestTradeRequest(symbol_or_symbols=symbol, feed=feed_enum)
        data = client.get_stock_latest_trade(req)
        return _safe_serialize(data)
    if data_type == "bar":
        req = StockLatestBarRequest(symbol_or_symbols=symbol, feed=feed_enum)
        data = client.get_stock_latest_bar(req)
        return _safe_serialize(data)

    req = StockSnapshotRequest(symbol_or_symbols=symbol, feed=feed_enum)
    data = client.get_stock_snapshot(req)
    return _safe_serialize(data)


def get_account_state() -> dict[str, Any]:
    """Fetch core Alpaca account information useful before paper or live trading."""
    account = _trading_client().get_account()
    data = _safe_serialize(account)
    keep = [
        "account_number",
        "status",
        "currency",
        "buying_power",
        "cash",
        "portfolio_value",
        "equity",
        "last_equity",
        "multiplier",
        "shorting_enabled",
        "pattern_day_trader",
        "trading_blocked",
        "transfers_blocked",
        "account_blocked",
    ]
    return {k: data.get(k) for k in keep if k in data}


def submit_order(
    symbol: str,
    side: str,
    qty: float,
    order_type: str = "market",
    time_in_force: str = "day",
    limit_price: float | None = None,
    stop_price: float | None = None,
    extended_hours: bool = False,
) -> dict[str, Any]:
    """Submit a stock order to Alpaca.

    Args:
        symbol: Ticker symbol to trade.
        side: buy or sell.
        qty: Share quantity.
        order_type: market, limit, stop, or stop_limit.
        time_in_force: day, gtc, ioc, or fok.
        limit_price: Limit price for limit or stop_limit orders.
        stop_price: Stop price for stop or stop_limit orders.
        extended_hours: Whether the order may execute outside regular hours.
    """
    side_enum = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
    tif_enum = getattr(TimeInForce, time_in_force.upper())
    kind = order_type.lower()

    if kind == "market":
        req = MarketOrderRequest(
            symbol=symbol,
            qty=qty,
            side=side_enum,
            time_in_force=tif_enum,
            extended_hours=extended_hours,
        )
    elif kind == "limit":
        if limit_price is None:
            raise ValueError("limit_price is required for limit orders")
        req = LimitOrderRequest(
            symbol=symbol,
            qty=qty,
            side=side_enum,
            time_in_force=tif_enum,
            limit_price=limit_price,
            extended_hours=extended_hours,
        )
    elif kind == "stop":
        if stop_price is None:
            raise ValueError("stop_price is required for stop orders")
        req = StopOrderRequest(
            symbol=symbol,
            qty=qty,
            side=side_enum,
            time_in_force=tif_enum,
            stop_price=stop_price,
            extended_hours=extended_hours,
        )
    elif kind == "stop_limit":
        if stop_price is None or limit_price is None:
            raise ValueError("stop_price and limit_price are required for stop_limit orders")
        req = StopLimitOrderRequest(
            symbol=symbol,
            qty=qty,
            side=side_enum,
            time_in_force=tif_enum,
            stop_price=stop_price,
            limit_price=limit_price,
            extended_hours=extended_hours,
        )
    else:
        raise ValueError(f"Unsupported order type: {order_type}")

    order = _trading_client().submit_order(order_data=req)
    return _safe_serialize(order)


def get_positions_and_orders(order_status: str = "open", order_limit: int = 20) -> dict[str, Any]:
    """Fetch current positions and recent orders from Alpaca.

    Args:
        order_status: open, closed, or all.
        order_limit: Max number of orders to return.
    """
    client = _trading_client()
    positions = client.get_all_positions()
    status_enum = getattr(QueryOrderStatus, order_status.upper())
    orders = client.get_orders(
        filter=GetOrdersRequest(status=status_enum, limit=order_limit)
    )
    return {
        "positions": _safe_serialize(positions),
        "orders": _safe_serialize(orders),
    }


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
