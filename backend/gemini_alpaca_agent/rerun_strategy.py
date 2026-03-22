from __future__ import annotations

import argparse
import json
from pathlib import Path

from alpaca_tools import run_backtest
from config import settings


def main() -> None:
    parser = argparse.ArgumentParser(description="Re-run a backtest for an existing strategy file")
    parser.add_argument("--strategy-name", required=True, help="Strategy filename stem under strategies/")
    parser.add_argument("--symbol", required=True, help="Ticker symbol")
    parser.add_argument("--timeframe", required=True, help="Timeframe string such as 1Hour")
    parser.add_argument("--start", required=True, help="Backtest start date in ISO format")
    parser.add_argument("--end", required=True, help="Backtest end date in ISO format")
    parser.add_argument("--run-directory-name", default=None, help="Optional explicit run directory name")
    args = parser.parse_args()

    strategy_path = Path(settings.strategies_dir) / f"{args.strategy_name}.py"
    if not strategy_path.exists():
        raise FileNotFoundError(f"Strategy file not found: {strategy_path}")

    result = run_backtest(
        strategy_path=str(strategy_path),
        symbol=args.symbol,
        timeframe=args.timeframe,
        start=args.start,
        end=args.end,
        run_directory_name=args.run_directory_name,
    )

    print(
        json.dumps(
            {
                "runDirectory": result.get("run_directory"),
                "summary": result.get("summary", {}),
            }
        )
    )


if __name__ == "__main__":
    main()
