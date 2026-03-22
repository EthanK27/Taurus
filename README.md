# Taurus


Taurus is a local AI trading strategy playground. You describe a strategy in plain English, Gemini turns it into code, the backend runs a backtest, and the frontend shows the result as an interactive graph with summary notes.

The project is split into two parts:

- `frontend/` - Next.js app for entering prompts and viewing strategy results
- `backend/gemini_alpaca_agent/` - Python strategy generator + backtesting engine

## What It Does

- Takes a natural-language trading prompt
- Generates a strategy file with Gemini
- Runs a local backtest using Alpaca market data
- Saves outputs for each run
- Displays performance graphs and summary notes in the frontend

## Tech Stack

- Next.js
- React
- Python
- Gemini API
- Alpaca API
- Pandas / NumPy

## Project Structure

```text
Taurus/
├─ frontend/
│  ├─ src/app/
│  └─ package.json
├─ backend/
│  ├─ requirements.txt
│  └─ gemini_alpaca_agent/
│     ├─ gemini_backtest_agent.py
│     ├─ alpaca_tools.py
│     ├─ backtester.py
│     ├─ strategy_tools.py
│     ├─ outputs/
│     └─ strategies/
└─ README.md
```

## Requirements

Before running the project, make sure you have:

- Node.js 18+ installed
- npm installed
- Python 3.10+ installed
- a Gemini API key
- Alpaca API keys

## Environment Variables

Create this file:

`backend/gemini_alpaca_agent/.env`

Use this format:

```env
GEMINI_API_KEY=your_gemini_api_key
ALPACA_API_KEY=your_alpaca_api_key
ALPACA_SECRET_KEY=your_alpaca_secret_key
ALPACA_PAPER=true
ALPACA_DATA_FEED=iex
GEMINI_MODEL=gemini-2.5-flash
```

## Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/your-username/taurus.git
cd taurus/Taurus
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 3. Create a Python virtual environment

Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..
```

macOS / Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

## Running The App

You’ll usually want the frontend running, and the frontend will call the Python backend automatically.

### Start the frontend

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:3000
```

### Optional: test the backend directly

Windows PowerShell:

```powershell
cd backend\gemini_alpaca_agent
python .\gemini_backtest_agent.py "Generate me a strategy to buy Nvidia stock when it is at a month's low and sell at all time high."
```

macOS / Linux:

```bash
cd backend/gemini_alpaca_agent
python gemini_backtest_agent.py "Generate me a strategy to buy Nvidia stock when it is at a month's low and sell at all time high."
```

## How To Use It

1. Start the frontend with `npm run dev`
2. Open `http://localhost:3000`
3. Enter a prompt describing a trading strategy
4. Wait for Taurus to generate the strategy and run the backtest
5. Review the graph, strategy notes, and metrics

Example prompt:

```text
Generate me a strategy to buy Nvidia stock when it is at a month's low, and sell only at all time high for one year ago to Feb 2026.
```

## Output Files

Each successful run creates output files inside:

`backend/gemini_alpaca_agent/outputs`

Typical output includes:

- `run_metadata.json`
- `*_summary.json`
- `*_equity.csv`
- `*_trades.json`
- `*_pnl_log.json`

These are used by the frontend to render graphs and summary information.

## Useful Commands

Run frontend:

```bash
cd frontend
npm run dev
```

Lint frontend:

```bash
cd frontend
npm run lint
```

Build frontend:

```bash
cd frontend
npm run build
```

Run backend directly:

```bash
cd backend/gemini_alpaca_agent
python gemini_backtest_agent.py "your prompt here"
```

## Troubleshooting

### Missing `GEMINI_API_KEY`

Make sure your `.env` file exists at:

`backend/gemini_alpaca_agent/.env`

and includes:

```env
GEMINI_API_KEY=your_key_here
```

### Graph page is blank

Check that a run created files inside:

`backend/gemini_alpaca_agent/outputs/<run-name>/`

especially:

- `*_pnl_log.json`
- `*_summary.json`

### Python environment issues

Make sure your virtual environment is activated before running backend commands.

### Alpaca data issues

Double-check:

- `ALPACA_API_KEY`
- `ALPACA_SECRET_KEY`
- `ALPACA_DATA_FEED`

## Notes

- This is a local development project
- Backtests are hypothetical and not real financial advice
- The backtester currently supports long/flat strategies


