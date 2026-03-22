from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any, Callable

from google import genai
from google.genai import types

from alpaca_tools import (
    get_account_state,
    get_historical_bars,
    get_latest_market_data,
    get_positions_and_orders,
    run_backtest,
    submit_order,
)
from config import settings
from strategy_tools import (
    describe_strategy_environment,
    generate_and_backtest_strategy,
    generate_strategy_code,
    list_strategies,
)


SYSTEM_PROMPT = """
You are a trading strategy coding and backtesting assistant.
You have tools for:
1. describing the local strategy-building contract,
2. generating strategy code as a local .py file,
3. generating a strategy and backtesting it in one step,
4. inspecting Alpaca market data,
5. running local backtests,
6. inspecting Alpaca account and positions,
7. placing paper or live orders only when explicitly asked.

Workflow rules:
- For any request to create a new strategy and test it, prefer generate_and_backtest_strategy.
- Use describe_strategy_environment whenever you need the exact strategy/backtester contract.
- Use generate_strategy_code only when the user wants strategy code without an immediate backtest.
- Use long/flat strategies for this local backtester.
- Mention the saved strategy path and backtest artifact paths.
- Do not claim live performance from backtests.
- If a tool error occurs, explain it briefly and continue where possible.
""".strip()


TOOL_MAP: dict[str, Callable[..., Any]] = {
    "describe_strategy_environment": describe_strategy_environment,
    "get_historical_bars": get_historical_bars,
    "get_latest_market_data": get_latest_market_data,
    "generate_strategy_code": generate_strategy_code,
    "generate_and_backtest_strategy": generate_and_backtest_strategy,
    "list_strategies": list_strategies,
    "run_backtest": run_backtest,
    "get_account_state": get_account_state,
    "get_positions_and_orders": get_positions_and_orders,
    "submit_order": submit_order,
}


def build_client() -> genai.Client:
    if not settings.gemini_api_key:
        raise RuntimeError("Missing GEMINI_API_KEY in environment.")
    return genai.Client(api_key=settings.gemini_api_key)


def _tool_declarations() -> list[types.Tool]:
    functions = [
        types.FunctionDeclaration(
            name="describe_strategy_environment",
            description="Describe the exact strategy module contract, allowed imports, signal semantics, and backtester rules for building strategies that this project can execute.",
            parameters_json_schema={
                "type": "object",
                "properties": {},
            },
        ),
        types.FunctionDeclaration(
            name="get_historical_bars",
            description="Fetch historical OHLCV bars from Alpaca for one stock symbol.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string", "description": "Ticker symbol like SPY or AAPL."},
                    "timeframe": {"type": "string", "description": "Timeframe like 1Min, 5Min, 15Min, 30Min, 1Hour, 1Day, daily, or hourly."},
                    "start": {"type": "string", "description": "ISO datetime like 2024-01-01T00:00:00Z."},
                    "end": {"type": "string", "description": "ISO datetime like 2025-01-01T00:00:00Z."},
                    "feed": {"type": "string", "description": "Usually iex or sip.", "default": "iex"},
                    "adjustment": {"type": "string", "description": "Usually raw, split, or all.", "default": "raw"},
                    "preview_rows": {"type": "integer", "description": "Rows to preview.", "default": 5},
                },
                "required": ["symbol", "timeframe", "start", "end"],
            },
        ),
        types.FunctionDeclaration(
            name="get_latest_market_data",
            description="Fetch latest quote, trade, bar, or snapshot from Alpaca for one stock symbol.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string", "description": "Ticker symbol like SPY or AAPL."},
                    "data_type": {"type": "string", "description": "quote, trade, bar, or snapshot.", "default": "snapshot"},
                    "feed": {"type": "string", "description": "Usually iex or sip.", "default": "iex"},
                },
                "required": ["symbol"],
            },
        ),
        types.FunctionDeclaration(
            name="generate_strategy_code",
            description="Generate a Python strategy file from a natural-language trading strategy description when the user wants code saved locally without immediately backtesting it.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "strategy_spec": {"type": "string", "description": "Natural-language description of the strategy logic."},
                    "strategy_name": {"type": "string", "description": "File-friendly name for the strategy.", "default": "generated_strategy"},
                },
                "required": ["strategy_spec"],
            },
        ),
        types.FunctionDeclaration(
            name="generate_and_backtest_strategy",
            description="Generate a Python strategy file from a natural-language strategy description and immediately run a local backtest with it. Prefer this when the user wants a new strategy created and tested from one prompt.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "strategy_spec": {"type": "string", "description": "Natural-language description of the strategy logic."},
                    "strategy_name": {"type": "string", "description": "File-friendly name for the strategy.", "default": "generated_strategy"},
                    "symbol": {"type": "string", "description": "Ticker symbol like SPY."},
                    "timeframe": {"type": "string", "description": "Timeframe like 1Min, 5Min, 15Min, 30Min, 1Hour, 1Day, daily, or hourly."},
                    "start": {"type": "string", "description": "ISO datetime string."},
                    "end": {"type": "string", "description": "ISO datetime string."},
                    "initial_cash": {"type": "number", "description": "Starting cash.", "default": 10000.0},
                    "commission_per_trade": {"type": "number", "description": "Flat commission per entry/exit.", "default": 0.0},
                    "slippage_bps": {"type": "number", "description": "Slippage in basis points.", "default": 0.0},
                    "feed": {"type": "string", "description": "Usually iex or sip.", "default": "iex"},
                    "adjustment": {"type": "string", "description": "Bar adjustment mode.", "default": "raw"},
                    "params_json": {"type": "string", "description": "JSON object string passed to the strategy as params.", "default": "{}"},
                },
                "required": ["strategy_spec", "symbol", "timeframe", "start", "end"],
            },
        ),
        types.FunctionDeclaration(
            name="list_strategies",
            description="List strategy files currently saved in the local strategies directory.",
            parameters_json_schema={
                "type": "object",
                "properties": {},
            },
        ),
        types.FunctionDeclaration(
            name="run_backtest",
            description="Run a local backtest using Alpaca historical bars and a saved strategy file.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "strategy_path": {"type": "string", "description": "Path to the Python strategy file."},
                    "symbol": {"type": "string", "description": "Ticker symbol like SPY."},
                    "timeframe": {"type": "string", "description": "Timeframe like 1Min, 5Min, 15Min, 30Min, 1Hour, 1Day, daily, or hourly."},
                    "start": {"type": "string", "description": "ISO datetime string."},
                    "end": {"type": "string", "description": "ISO datetime string."},
                    "initial_cash": {"type": "number", "description": "Starting cash.", "default": 10000.0},
                    "commission_per_trade": {"type": "number", "description": "Flat commission per entry/exit.", "default": 0.0},
                    "slippage_bps": {"type": "number", "description": "Slippage in basis points.", "default": 0.0},
                    "feed": {"type": "string", "description": "Usually iex or sip.", "default": "iex"},
                    "adjustment": {"type": "string", "description": "Bar adjustment mode.", "default": "raw"},
                    "params_json": {"type": "string", "description": "JSON object string passed to the strategy as params.", "default": "{}"},
                },
                "required": ["strategy_path", "symbol", "timeframe", "start", "end"],
            },
        ),
        types.FunctionDeclaration(
            name="get_account_state",
            description="Fetch core Alpaca account information useful before paper or live trading.",
            parameters_json_schema={
                "type": "object",
                "properties": {},
            },
        ),
        types.FunctionDeclaration(
            name="get_positions_and_orders",
            description="Fetch current positions and recent orders from Alpaca.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "order_status": {"type": "string", "description": "open, closed, or all.", "default": "open"},
                    "order_limit": {"type": "integer", "description": "Max number of orders to return.", "default": 20},
                },
            },
        ),
        types.FunctionDeclaration(
            name="submit_order",
            description="Submit a stock order to Alpaca.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "symbol": {"type": "string", "description": "Ticker symbol to trade."},
                    "side": {"type": "string", "description": "buy or sell."},
                    "qty": {"type": "number", "description": "Share quantity."},
                    "order_type": {"type": "string", "description": "market, limit, stop, or stop_limit.", "default": "market"},
                    "time_in_force": {"type": "string", "description": "day, gtc, ioc, or fok.", "default": "day"},
                    "limit_price": {"type": "number", "description": "Required for limit or stop_limit orders."},
                    "stop_price": {"type": "number", "description": "Required for stop or stop_limit orders."},
                    "extended_hours": {"type": "boolean", "description": "Whether the order may execute outside regular hours.", "default": False},
                },
                "required": ["symbol", "side", "qty"],
            },
        ),
    ]
    return [types.Tool(function_declarations=functions)]


def _extract_call_name(call: Any) -> str:
    if hasattr(call, "name") and getattr(call, "name"):
        return getattr(call, "name")
    if hasattr(call, "function_call") and getattr(call.function_call, "name", None):
        return getattr(call.function_call, "name")
    raise RuntimeError(f"Could not determine tool call name from: {call!r}")


def _extract_call_args(call: Any) -> dict[str, Any]:
    if hasattr(call, "args") and isinstance(getattr(call, "args"), dict):
        return dict(getattr(call, "args"))
    if hasattr(call, "function_call") and isinstance(getattr(call.function_call, "args", None), dict):
        return dict(getattr(call.function_call, "args"))
    return {}


def _dispatch_tool(name: str, args: dict[str, Any]) -> dict[str, Any]:
    tool_fn = TOOL_MAP[name]
    try:
        result = tool_fn(**args)
        return {"result": result}
    except Exception as exc:
        return {"error": str(exc)}


def run_agent(user_prompt: str, model: str | None = None) -> str:
    client = build_client()
    tools = _tool_declarations()
    contents: list[Any] = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=f"{SYSTEM_PROMPT}\n\nUser request:\n{user_prompt}")],
        )
    ]

    for _ in range(8):
        response = client.models.generate_content(
            model=model or settings.default_model,
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=0.2,
                tools=tools,
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            ),
        )

        function_calls = response.function_calls or []
        if not function_calls:
            return response.text or ""

        model_content = response.candidates[0].content
        tool_parts = []
        for call in function_calls:
            name = _extract_call_name(call)
            args = _extract_call_args(call)
            payload = _dispatch_tool(name, args)
            tool_parts.append(types.Part.from_function_response(name=name, response=payload))

        contents.extend([
            model_content,
            types.Content(role="tool", parts=tool_parts),
        ])

    return "The agent exceeded the maximum number of tool-call turns."


def main() -> None:
    parser = argparse.ArgumentParser(description="Gemini + Alpaca strategy/backtest agent")
    parser.add_argument("prompt", help="Natural-language request for strategy generation, backtesting, or Alpaca actions")
    parser.add_argument("--model", default=settings.default_model, help="Gemini model name")
    args = parser.parse_args()

    Path(settings.strategies_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.outputs_dir).mkdir(parents=True, exist_ok=True)

    result = run_agent(args.prompt, model=args.model)
    print(result)


if __name__ == "__main__":
    main()
