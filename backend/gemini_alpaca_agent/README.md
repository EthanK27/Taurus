# Gemini + Alpaca Strategy Agent

Minimal local project that lets Gemini:
- generate Python strategy code,
- fetch Alpaca data,
- run a local long/flat backtest,
- inspect Alpaca account state,
- submit Alpaca orders.

## Files

- `gemini_backtest_agent.py` - main CLI entrypoint
- `alpaca_tools.py` - Alpaca data/trading/backtest tools exposed to Gemini
- `strategy_tools.py` - strategy code generation and local file save
- `backtester.py` - local long/flat backtest engine
- `config.py` - environment loading
- `strategies/sma_crossover.py` - sample strategy

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Fill in your API keys in `.env`.

## Example prompts

Backtest an existing sample strategy:

```bash
python gemini_backtest_agent.py "Run a backtest of strategies/sma_crossover.py on SPY from 2023-01-01T00:00:00Z to 2025-01-01T00:00:00Z using 1Day bars, initial cash 10000, and compare it to buy and hold."
```

Generate a new strategy and backtest it:

```bash
python gemini_backtest_agent.py "Create a mean reversion strategy named spy_mean_reversion using RSI and Bollinger Bands, then backtest it on SPY from 2023-01-01T00:00:00Z to 2025-01-01T00:00:00Z with daily bars and 10 bps slippage."
```

Inspect account state:

```bash
python gemini_backtest_agent.py "Show my Alpaca account state and open positions."
```

Submit a paper trade:

```bash
python gemini_backtest_agent.py "Submit a paper market buy order for 1 share of SPY."
```

## Notes

- The backtester is intentionally simple: it supports long or flat exposure only.
- Alpaca provides the market data and trading APIs; the backtest simulation runs locally in `backtester.py`.
- Free Alpaca stock data commonly uses the `iex` feed. SIP access depends on your plan.
- Backtests are hypothetical and not live performance.
