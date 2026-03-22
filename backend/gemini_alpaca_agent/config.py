from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    alpaca_api_key: str = os.getenv("ALPACA_API_KEY", "")
    alpaca_secret_key: str = os.getenv("ALPACA_SECRET_KEY", "")
    alpaca_paper: bool = os.getenv("ALPACA_PAPER", "true").lower() in {"1", "true", "yes"}
    default_data_feed: str = os.getenv("ALPACA_DATA_FEED", "iex")
    default_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    strategies_dir: str = os.getenv("STRATEGIES_DIR", "strategies")
    outputs_dir: str = os.getenv("OUTPUTS_DIR", "outputs")


settings = Settings()
