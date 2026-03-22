from __future__ import annotations

import importlib.util
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


@dataclass
class BacktestResult:
    summary: dict[str, Any]
    equity_curve: pd.DataFrame
    trades: list[dict[str, Any]]


def load_strategy_module(strategy_path: str | Path):
    strategy_path = Path(strategy_path)
    spec = importlib.util.spec_from_file_location(strategy_path.stem, strategy_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load strategy module from {strategy_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def max_drawdown(equity: pd.Series) -> float:
    running_max = equity.cummax()
    drawdown = equity / running_max - 1.0
    return float(drawdown.min()) if len(drawdown) else 0.0


def annualization_factor(index: pd.Index) -> float:
    if len(index) < 2:
        return 252.0
    inferred = pd.Series(index).diff().dropna().median()
    if pd.isna(inferred):
        return 252.0
    seconds = inferred.total_seconds()
    if seconds <= 60:
        return 252.0 * 6.5 * 60
    if seconds <= 5 * 60:
        return 252.0 * 6.5 * 12
    if seconds <= 15 * 60:
        return 252.0 * 6.5 * 4
    if seconds <= 60 * 60:
        return 252.0 * 6.5
    return 252.0


def _format_chart_timestamp(value: Any) -> str:
    timestamp = pd.Timestamp(value)
    if timestamp.tzinfo is None:
        timestamp = timestamp.tz_localize("UTC")
    else:
        timestamp = timestamp.tz_convert("UTC")
    return timestamp.strftime("%Y-%m-%d %H:%M")


def _build_pnl_performance_log(
    equity_curve: pd.DataFrame,
    buy_hold_curve: pd.DataFrame,
    summary: dict[str, Any],
) -> dict[str, Any]:
    user_series = [
        {
            "timestamp": _format_chart_timestamp(timestamp),
            "pnl": round(float(row["equity"]), 2),
        }
        for timestamp, row in equity_curve.iterrows()
    ]
    benchmark_series = [
        {
            "timestamp": _format_chart_timestamp(timestamp),
            "pnl": round(float(row["equity"]), 2),
        }
        for timestamp, row in buy_hold_curve.iterrows()
    ]

    return {
        "generatedAt": pd.Timestamp.utcnow().isoformat(),
        "summary": summary,
        "userSeries": user_series,
        "benchmarkSeries": benchmark_series,
    }


def compute_metrics(equity_curve: pd.DataFrame, buy_hold_curve: pd.DataFrame) -> dict[str, Any]:
    equity = equity_curve["equity"]
    returns = equity.pct_change().fillna(0.0)
    bh = buy_hold_curve["equity"]
    bh_returns = bh.pct_change().fillna(0.0)
    ann = annualization_factor(equity_curve.index)

    sharpe = 0.0
    if returns.std(ddof=0) > 0:
        sharpe = float((returns.mean() / returns.std(ddof=0)) * math.sqrt(ann))

    bh_sharpe = 0.0
    if bh_returns.std(ddof=0) > 0:
        bh_sharpe = float((bh_returns.mean() / bh_returns.std(ddof=0)) * math.sqrt(ann))

    return {
        "strategy_total_return_pct": round((equity.iloc[-1] / equity.iloc[0] - 1.0) * 100, 4),
        "buy_hold_return_pct": round((bh.iloc[-1] / bh.iloc[0] - 1.0) * 100, 4),
        "strategy_max_drawdown_pct": round(max_drawdown(equity) * 100, 4),
        "buy_hold_max_drawdown_pct": round(max_drawdown(bh) * 100, 4),
        "strategy_sharpe": round(sharpe, 4),
        "buy_hold_sharpe": round(bh_sharpe, 4),
    }


def run_long_flat_backtest(
    bars: pd.DataFrame,
    strategy_path: str | Path,
    initial_cash: float = 10_000.0,
    commission_per_trade: float = 0.0,
    slippage_bps: float = 0.0,
    params: dict[str, Any] | None = None,
) -> BacktestResult:
    if bars.empty:
        raise ValueError("No market data returned for the requested period.")

    module = load_strategy_module(strategy_path)
    if not hasattr(module, "generate_signals"):
        raise AttributeError("Strategy file must define generate_signals(df, params=None).")

    df = bars.copy().sort_index()
    signal_df = module.generate_signals(df.copy(), params=params)
    if "signal" not in signal_df.columns:
        raise ValueError("Strategy output must include a numeric 'signal' column.")

    signal_df = signal_df.copy()
    signal_df["signal"] = signal_df["signal"].fillna(0.0).clip(lower=0.0, upper=1.0)

    cash = float(initial_cash)
    shares = 0.0
    trades: list[dict[str, Any]] = []
    records: list[dict[str, Any]] = []

    slip_mult_buy = 1.0 + slippage_bps / 10_000.0
    slip_mult_sell = 1.0 - slippage_bps / 10_000.0

    for ts, row in signal_df.iterrows():
        close_px = float(row["close"])
        desired = 1 if row["signal"] >= 0.5 else 0
        current = 1 if shares > 0 else 0

        if desired == 1 and current == 0:
            exec_px = close_px * slip_mult_buy
            max_shares = max((cash - commission_per_trade) / exec_px, 0.0)
            shares = float(max_shares)
            cash -= shares * exec_px + commission_per_trade
            trades.append(
                {
                    "timestamp": ts.isoformat(),
                    "side": "buy",
                    "price": round(exec_px, 6),
                    "shares": round(shares, 8),
                    "cash_after": round(cash, 6),
                }
            )

        elif desired == 0 and current == 1:
            exec_px = close_px * slip_mult_sell
            cash += shares * exec_px - commission_per_trade
            trades.append(
                {
                    "timestamp": ts.isoformat(),
                    "side": "sell",
                    "price": round(exec_px, 6),
                    "shares": round(shares, 8),
                    "cash_after": round(cash, 6),
                }
            )
            shares = 0.0

        equity = cash + shares * close_px
        records.append(
            {
                "timestamp": ts,
                "close": close_px,
                "signal": float(row["signal"]),
                "shares": shares,
                "cash": cash,
                "equity": equity,
            }
        )

    if shares > 0:
        last_ts = signal_df.index[-1]
        last_close = float(signal_df.iloc[-1]["close"])
        exec_px = last_close * slip_mult_sell
        cash += shares * exec_px - commission_per_trade
        trades.append(
            {
                "timestamp": last_ts.isoformat(),
                "side": "sell_end",
                "price": round(exec_px, 6),
                "shares": round(shares, 8),
                "cash_after": round(cash, 6),
            }
        )
        shares = 0.0
        records[-1]["shares"] = 0.0
        records[-1]["cash"] = cash
        records[-1]["equity"] = cash

    equity_curve = pd.DataFrame(records).set_index("timestamp")

    first_close = float(df.iloc[0]["close"])
    bh_shares = initial_cash / first_close
    buy_hold_curve = pd.DataFrame(index=df.index)
    buy_hold_curve["equity"] = bh_shares * df["close"]

    metrics = compute_metrics(equity_curve, buy_hold_curve)
    summary = {
        "initial_cash": round(initial_cash, 6),
        "ending_equity": round(float(equity_curve["equity"].iloc[-1]), 6),
        "num_bars": int(len(df)),
        "num_trades": int(len(trades)),
        **metrics,
    }
    return BacktestResult(summary=summary, equity_curve=equity_curve, trades=trades)


def save_backtest_report(
    result: BacktestResult,
    output_dir: str | Path,
    prefix: str,
    run_directory_name: str,
) -> dict[str, str]:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    report_dir = output_dir / run_directory_name
    report_dir.mkdir(parents=True, exist_ok=True)

    summary_path = report_dir / f"{prefix}_summary.json"
    equity_path = report_dir / f"{prefix}_equity.csv"
    trades_path = report_dir / f"{prefix}_trades.json"
    pnl_log_path = report_dir / f"{prefix}_pnl_log.json"

    summary_path.write_text(json.dumps(result.summary, indent=2), encoding="utf-8")
    result.equity_curve.to_csv(equity_path)
    trades_path.write_text(json.dumps(result.trades, indent=2), encoding="utf-8")

    if len(result.equity_curve) > 0:
        first_close = float(result.equity_curve["close"].iloc[0])
        initial_cash = float(result.summary.get("initial_cash", 10_000.0))
        bh_shares = initial_cash / first_close if first_close else 0.0
        buy_hold_curve = pd.DataFrame(index=result.equity_curve.index)
        buy_hold_curve["equity"] = bh_shares * result.equity_curve["close"]
    else:
        buy_hold_curve = pd.DataFrame(columns=["equity"])

    pnl_log = _build_pnl_performance_log(result.equity_curve, buy_hold_curve, result.summary)
    pnl_log_path.write_text(json.dumps(pnl_log, indent=2), encoding="utf-8")

    return {
        "report_dir": str(report_dir),
        "summary_path": str(summary_path),
        "equity_curve_path": str(equity_path),
        "trades_path": str(trades_path),
        "pnl_log_path": str(pnl_log_path),
    }


def next_backtest_run_directory_name(output_dir: str | Path, symbol: str) -> str:
    output_dir = Path(output_dir)
    cleaned_symbol = re.sub(r"[^A-Za-z0-9]+", "", symbol).upper() or "RUN"
    pattern = re.compile(rf"^{re.escape(cleaned_symbol)}(\d+)$", re.IGNORECASE)
    highest_suffix = 0

    if output_dir.exists():
        for entry in output_dir.iterdir():
            if not entry.is_dir():
                continue

            match = pattern.match(entry.name)
            if match:
                highest_suffix = max(highest_suffix, int(match.group(1)))

    return f"{cleaned_symbol}{highest_suffix + 1}"
