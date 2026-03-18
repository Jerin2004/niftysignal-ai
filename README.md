# NiftySignal AI — Indian Stock Market Predictor

Full-stack platform: real NSE/BSE data · AI signals · Options chain · News sentiment

---

## What's included

- **25 Nifty 50 stocks** with live prices from Yahoo Finance (NSE)
- **AI signal engine**: RSI + MACD + EMA20 + News sentiment → BUY/SELL/HOLD
- **Options chain**: Live Call/Put data with IV, OI, premium, ATM strike
- **News sentiment**: Keyword-based scoring (upgrade to FinBERT for production)
- **Interactive charts**: Area charts with period selector (1m/3m/6m/1y)
- **Market overview**: Nifty 50, Bank Nifty, Sensex, Midcap indices
- **Sector filter + search + sort** across all stocks
- **White-label ready**: Change logo/colors in App.js → deploy for brokers

---

## Quick start (run today)

### Prerequisites
- Python 3.10+
- Node.js 18+
- pip

### Step 1 — Backend

```bash
cd backend
pip install -r requirements.txt

# Optional: add NewsAPI key for live news
cp .env.example .env
# Edit .env → add NEWS_API_KEY=your_key_here
# Get free key at https://newsapi.org (500 req/day)

# Terminal 1 — API server
python -m uvicorn main:app --reload --port 8000

# Terminal 2 — Auto data scheduler (run alongside the server)
python scheduler.py
```

Backend runs at: http://localhost:8000
API docs at: http://localhost:8000/docs

### How the scheduler works

The scheduler runs as a separate background process and keeps data fresh automatically:

| Time (IST)     | What it does                                      |
|----------------|---------------------------------------------------|
| 9:00 AM        | Fetches indices + global news (pre-market)        |
| 9:15 AM        | Full stock fetch — all 25 Nifty stocks with signals |
| Every 15 mins  | Intraday refresh during market hours only         |
| 3:35 PM        | End-of-day snapshot, saves signal history         |
| 6:00 PM        | Post-market news refresh                          |
| Weekends/holidays | Skips automatically                            |

Data is saved to `backend/data/` as JSON files:
- `stocks_latest.json` — latest signals for all stocks
- `indices_latest.json` — Nifty, BankNifty, Sensex, VIX
- `news_latest.json` — latest market news articles
- `signal_history.json` — 90-day rolling signal log (for backtesting)

The API always serves from these files first (fast), and falls back to live fetch only if files are missing.

### Step 2 — Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs at: http://localhost:3000

---

## API endpoints

| Endpoint | Description |
|---|---|
| GET /api/health | Server status |
| GET /api/market/overview | Nifty50, BankNifty, Sensex, Midcap |
| GET /api/stocks?sector=Banking | All stocks with AI signals |
| GET /api/stock/{symbol} | Full detail: technicals + fundamentals + chart |
| GET /api/options/{symbol}?expiry=date | Live options chain |
| GET /api/chart/{symbol}?period=3mo | OHLCV chart data |
| GET /api/news?symbol=TCS | News with sentiment scores |

---

## Signal methodology

For each stock the engine computes a score from -6 to +6:

| Indicator | Bullish | Bearish |
|---|---|---|
| RSI < 35 | +2.0 | — |
| RSI > 65 | — | -2.0 |
| MACD histogram > 0 | +1.5 | -1.5 |
| Price > EMA20 by 2%+ | +1.0 | -1.0 |
| News sentiment > 70% | +1.5 | -1.5 |

Score ≥ 2 → BUY · Score ≤ -2 → SELL · else HOLD

---

## Upgrade path

### Add FinBERT (better sentiment)
```bash
pip install transformers torch
```
In main.py, replace `score_sentiment()` with:
```python
from transformers import pipeline
finbert = pipeline("text-classification", model="ProsusAI/finbert")

def score_sentiment(text):
    result = finbert(text[:512])[0]
    if result["label"] == "positive": return result["score"]
    if result["label"] == "negative": return 1 - result["score"]
    return 0.5
```

### Add database (PostgreSQL)
```bash
pip install sqlalchemy asyncpg
```
Store signal history for backtesting and broker audit logs.

### White-label for brokers
1. In `frontend/src/App.js`, change `NiftySignal AI` to broker name
2. Change `#6c63ff` (purple) to broker brand color
3. Add broker logo in `frontend/public/`
4. Deploy backend on AWS/GCP, frontend on Vercel
5. Add JWT auth middleware in `main.py` for API key per broker

---

## Disclaimer

This software is for educational and research purposes only.
Not SEBI-registered investment advice.
Past performance does not guarantee future results.
Always consult a qualified SEBI-registered financial advisor before trading.
