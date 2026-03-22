from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any, Callable

from google import genai
from google.genai import types

from alpaca_tools import (
    run_backtest,
)
from config import settings
from strategy_tools import generate_strategy_code


SYSTEM_PROMPT = """
You are a trading strategy coding and backtesting assistant.
Use the provided tools to:
1. generate strategy code,
2. run local backtests,
3. report missing information when the user request is underspecified.

Default behavior:
- Always call given tools.
- If the user request is missing required details, call report_missing_information and then respond with the tool's request_message, asking for the exact missing inputs instead of guessing.
- Generate a strategy file and then run a backtest with the generated file.
- Even when a backtest is not requested, run the local backtest for the generated strategy file and report the backtest results, so the user can iteratively refine the strategy based on the backtest performance.
- Be very verbose and specific about the strategy spec in the generating the strategy file.
- Use long/flat strategies for this local backtester.
- If a tool error occurs, explain it briefly and continue where possible.
""".strip()


def build_client() -> genai.Client:
    if not settings.gemini_api_key:
        raise RuntimeError("Missing GEMINI_API_KEY in environment.")
    return genai.Client(api_key=settings.gemini_api_key)


def _tool_declarations() -> list[types.Tool]:
    functions = [
        types.FunctionDeclaration(
            name="report_missing_information",
            description="Report that the user request is missing required details and request the exact information needed.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "missing_information": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Specific pieces of information that are missing.",
                    },
                    "request_message": {
                        "type": "string",
                        "description": "Short response asking the user for the missing details.",
                    },
                },
                "required": ["missing_information", "request_message"],
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
            name="run_backtest",
            description="Run a local backtest using Alpaca historical bars and a saved strategy file.",
            parameters_json_schema={
                "type": "object",
                "properties": {
                    "strategy_path": {"type": "string", "description": "Path to the Python strategy file."},
                    "symbol": {"type": "string", "description": "Ticker symbol like SPY. When given a company name, pick their most common ticker"},
                    "timeframe": {"type": "string", "description": "One of 1Min, 5Min, 15Min, 30Min, 1Hour, 1Day. When not provided by the user, choose 1Hour"},
                    "start": {"type": "string", "description": "ISO datetime string. Calculate the start date based on the strategy description and the end date when not provided."},
                    "end": {"type": "string", "description": "ISO datetime string. When not provided, it should be March 15th, 2026."},
                    "initial_cash": {"type": "number", "description": "Starting cash.", "default": 10000.0},
                    "commission_per_trade": {"type": "number", "description": "Flat commission per entry/exit.", "default": 0.0},
                    "slippage_bps": {"type": "number", "description": "Slippage in basis points.", "default": 0.0},
                    "feed": {"type": "string", "description": "Usually iex or sip.", "default": "iex"},
                    "adjustment": {"type": "string", "description": "Bar adjustment mode.", "default": "raw"},
                    "params_json": {"type": "string", "description": "JSON object string passed to the strategy as params.", "default": "{}"},
                    "run_directory_name": {
                        "type": "string",
                        "description": "Optional output folder name under outputs/. If omitted, the backend uses the next SYMBOL# directory.",
                    },
                },
                "required": ["strategy_path", "symbol", "timeframe", "start", "end"],
            },
        ),
    ]
    return [types.Tool(function_declarations=functions)]


def report_missing_information(missing_information: list[str], request_message: str) -> dict[str, Any]:
    """Print a missing-info error and return a user-facing request for the missing details."""
    normalized = [item.strip() for item in missing_information if item and item.strip()]
    print(f"NOT_ENOUGH_INFO: missing={normalized} request={request_message}")
    return {
        "status": "not_enough_info",
        "missing_information": normalized,
        "request_message": request_message,
    }


TOOL_MAP: dict[str, Callable[..., Any]] = {
    "generate_strategy_code": generate_strategy_code,
    "run_backtest": run_backtest,
    "report_missing_information": report_missing_information,
}


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
    with open("agent_tool_calls.log", "a") as f:
        f.write(f"Calling tool: {name} with args: {args}\n")
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
