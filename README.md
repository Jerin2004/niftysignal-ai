# NiftySignal AI 🇮🇳

> AI-powered Indian stock market prediction platform with live NSE data, BUY/SELL signals, options chain analysis and paper trading tracker.

**Live demo:** https://niftysignal-ai-6f1a.vercel.app

---

## What it does

- **Live signals** — BUY/SELL/HOLD for 54+ NSE stocks using RSI + MACD + EMA20 + News sentiment
- **Trade plan** — Entry price, stop loss, 3 targets, R:R ratio, position sizing
- **Options chain** — Live Call/Put data with IV, OI, premium, ATM strike highlighted
- **Paper trading** — Log signals, track P&L, build win rate history
- **Market overview** — Live Nifty 50, Bank Nifty, Sensex, India VIX
- **Auto-refresh** — Updates every 5 minutes during market hours (9:15 AM - 3:30 PM IST)

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI, uvicorn |
| Data | yfinance (NSE/BSE), NewsAPI |
| Signals | Pure pandas (RSI, MACD, EMA20, Bollinger Bands) |
| Broker API | Zerodha Kite Connect |
| Frontend | React, Vite, Recharts |
| Deployment | Railway (backend), Vercel (frontend) |
| CI/CD | GitHub Actions |

---

## Project structure

```
niftysignal/
├── backend/
│   ├── main.py              # FastAPI server + all API endpoints
│   ├── trading_engine.py    # Target price, stop loss, position sizing
│   ├── paper_trading.py     # Paper trade tracker
│   ├── zerodha.py           # Zerodha Kite API integration
│   ├── scheduler.py         # Standalone data scheduler (optional)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example         # Copy to .env and fill your keys
├── frontend/
│   ├── src/App.jsx          # Full React app
│   ├── package.json
│   └── vercel.json
├── .github/workflows/
│   └── deploy.yml           # CI/CD pipeline
└── README.md
```

---

## Quick start

### Prerequisites
- Python 3.11+
- Node.js 18+

### Step 1 — Clone

```bash
git clone https://github.com/Jerin2004/niftysignal-ai.git
cd niftysignal-ai
```

### Step 2 — Backend

```bash
cd backend
pip install -r requirements.txt
copy .env.example .env
# Edit .env with your API keys
python -m uvicorn main:app --port 8000
```

### Step 3 — Frontend

```bash
cd frontend
npm install --legacy-peer-deps
# Create frontend/.env.local with:
# VITE_API_URL=http://localhost:8000/api
npm start
```

---

## API keys needed

### NewsAPI (optional)
- Free at https://newsapi.org
- 500 req/day free plan
- Add as `NEWS_API_KEY` in `.env`

### Zerodha Kite (optional)
- Go to https://developers.kite.trade
- Create app — Personal plan (free)
- Add `ZERODHA_API_KEY` and `ZERODHA_API_SECRET` to `.env`

---

## Signal methodology

| Indicator | Bullish | Points |
|---|---|---|
| RSI < 35 | Oversold | +2.0 |
| RSI < 45 | Slightly oversold | +1.0 |
| RSI > 65 | Overbought | -2.0 |
| MACD histogram > 0 | Bullish crossover | +1.5 |
| Price > EMA20 by 2%+ | Above trend | +1.0 |
| News sentiment > 70% | Positive news | +1.5 |

Score ≥ 2 → BUY · Score ≤ -2 → SELL · else → HOLD

---

## Deployment

### Backend — Railway
```bash
npm install -g @railway/cli
railway login
cd backend
railway init
railway up
```

Add in Railway dashboard Variables:
- `ZERODHA_API_KEY`
- `ZERODHA_API_SECRET`
- `NEWS_API_KEY`

### Frontend — Vercel
1. Import repo on vercel.com
2. Root Directory: `frontend`
3. Environment variable: `VITE_API_URL=https://your-railway-url.up.railway.app/api`
4. Build command: `npm install --legacy-peer-deps && node ./node_modules/vite/bin/vite.js build`

---

## Data freshness

| Source | Delay |
|---|---|
| yfinance (default) | ~15 min |
| Zerodha Personal | ~1 min |
| Zerodha Connect | Real-time (₹2,000/month) |

---

## Disclaimer

Educational and research purposes only. Not SEBI-registered investment advice. Consult a qualified financial advisor before trading.

---

## License

MIT
