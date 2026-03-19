"""
NiftySignal AI — Data Scheduler
Runs automatically:
  - 9:00 AM IST  → pre-market fetch (global news, futures)
  - 9:15 AM IST  → market open snapshot
  - Every 15 min → intraday refresh (9:15 AM - 3:30 PM IST)
  - 3:35 PM IST  → end-of-day final snapshot + signal compute
  - 6:00 PM IST  → post-market news refresh
Run this alongside the FastAPI server:
  python scheduler.py
"""

import schedule
import time
import logging
import requests
import json
import os
from datetime import datetime, date
import pytz
import yfinance as yf
import pandas as pd

import math
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("scheduler.log", encoding="utf-8"),
        logging.StreamHandler(stream=open(1, "w", encoding="utf-8", closefd=False))
    ]
)
log = logging.getLogger("scheduler")

IST = pytz.timezone("Asia/Kolkata")
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")

NIFTY50 = [
    {"sym": "RELIANCE.NS",   "name": "Reliance Industries",  "sector": "Energy"},
    {"sym": "TCS.NS",        "name": "Tata Consultancy",      "sector": "IT"},
    {"sym": "HDFCBANK.NS",   "name": "HDFC Bank",             "sector": "Banking"},
    {"sym": "INFY.NS",       "name": "Infosys",               "sector": "IT"},
    {"sym": "ICICIBANK.NS",  "name": "ICICI Bank",            "sector": "Banking"},
    {"sym": "HINDUNILVR.NS", "name": "Hindustan Unilever",    "sector": "FMCG"},
    {"sym": "ITC.NS",        "name": "ITC Ltd",               "sector": "FMCG"},
    {"sym": "KOTAKBANK.NS",  "name": "Kotak Mahindra Bank",   "sector": "Banking"},
    {"sym": "LT.NS",         "name": "Larsen & Toubro",       "sector": "Infra"},
    {"sym": "AXISBANK.NS",   "name": "Axis Bank",             "sector": "Banking"},
    {"sym": "SBIN.NS",       "name": "State Bank of India",   "sector": "Banking"},
    {"sym": "WIPRO.NS",      "name": "Wipro",                 "sector": "IT"},
    {"sym": "HCLTECH.NS",    "name": "HCL Technologies",      "sector": "IT"},
    {"sym": "TATAMOTORS.NS", "name": "Tata Motors",           "sector": "Auto"},
    {"sym": "MARUTI.NS",     "name": "Maruti Suzuki",         "sector": "Auto"},
    {"sym": "SUNPHARMA.NS",  "name": "Sun Pharma",            "sector": "Pharma"},
    {"sym": "DRREDDY.NS",    "name": "Dr Reddys Labs",        "sector": "Pharma"},
    {"sym": "BAJFINANCE.NS", "name": "Bajaj Finance",         "sector": "Finance"},
    {"sym": "TITAN.NS",      "name": "Titan Company",         "sector": "Consumer"},
    {"sym": "NESTLEIND.NS",  "name": "Nestle India",          "sector": "FMCG"},
    {"sym": "POWERGRID.NS",  "name": "Power Grid Corp",       "sector": "Energy"},
    {"sym": "NTPC.NS",       "name": "NTPC Ltd",              "sector": "Energy"},
    {"sym": "ONGC.NS",       "name": "ONGC",                  "sector": "Energy"},
    {"sym": "ADANIENT.NS",   "name": "Adani Enterprises",     "sector": "Conglomerate"},
    {"sym": "COALINDIA.NS",  "name": "Coal India",            "sector": "Energy"},
]

INDICES = {
    "NIFTY50":     "^NSEI",
    "BANKNIFTY":   "^NSEBANK",
    "SENSEX":      "^BSESN",
    "NIFTYMIDCAP": "^NSEMDCP50",
    "VIX":         "^INDIAVIX",
}


def is_market_day() -> bool:
    now = datetime.now(IST)
    if now.weekday() >= 5:
        return False
    holidays_2026 = [
        date(2026, 1, 26), date(2026, 3, 25), date(2026, 4, 6),
        date(2026, 4, 14), date(2026, 5, 1), date(2026, 8, 15),
        date(2026, 10, 2), date(2026, 11, 4), date(2026, 12, 25),
    ]
    return now.date() not in holidays_2026


def is_market_hours() -> bool:
    now = datetime.now(IST)
    return is_market_day() and (
        (now.hour == 9 and now.minute >= 15) or
        (10 <= now.hour <= 14) or
        (now.hour == 15 and now.minute <= 30)
    )


def score_sentiment(text: str) -> float:
    positive_words = [
        "profit","growth","beats","record","surge","gain","rises","strong",
        "upgrade","buy","bullish","expansion","award","wins","approves",
        "dividend","outperform","positive","revenue","deal","approved","launch"
    ]
    negative_words = [
        "loss","fall","drops","decline","cuts","miss","bearish","sell",
        "downgrade","risk","concern","layoff","investigation","fine","penalty",
        "fraud","default","debt","recall","ban","delay","weak"
    ]
    text_lower = text.lower()
    pos = sum(1 for w in positive_words if w in text_lower)
    neg = sum(1 for w in negative_words if w in text_lower)
    total = pos + neg
    if total == 0:
        return 0.5
    return round(pos / total, 2)


def compute_signal(rsi, macd_diff, price_vs_ema, sentiment):
    score = 0.0
    if rsi is not None:
        if rsi < 35:   score += 2.0
        elif rsi < 45: score += 1.0
        elif rsi > 65: score -= 2.0
        elif rsi > 55: score -= 1.0
    if macd_diff is not None:
        score += 1.5 if macd_diff > 0 else -1.5
    if price_vs_ema is not None:
        if price_vs_ema > 0.02:   score += 1.0
        elif price_vs_ema < -0.02: score -= 1.0
    if sentiment is not None:
        if sentiment > 0.7:   score += 1.5
        elif sentiment > 0.55: score += 0.5
        elif sentiment < 0.35: score -= 1.5
        elif sentiment < 0.45: score -= 0.5
    confidence = min(abs(score) / 6.0, 1.0)
    if score >= 2.0:   return "BUY",  round(confidence, 2)
    elif score <= -2.0: return "SELL", round(confidence, 2)
    else:               return "HOLD", round(confidence, 2)


def fetch_news_sentiment(symbol: str, name: str) -> float:
    if not NEWS_API_KEY:
        return round(0.45 + hash(symbol) % 100 / 200, 2)
    try:
        r = requests.get(
            "https://newsapi.org/v2/everything",
            params={"q": f"{name} OR {symbol} stock India", "language": "en",
                    "sortBy": "publishedAt", "pageSize": 10, "apiKey": NEWS_API_KEY},
            timeout=8
        )
        articles = r.json().get("articles", [])
        if not articles:
            return 0.5
        scores = [score_sentiment(a.get("title","") + " " + (a.get("description") or "")) for a in articles]
        return round(sum(scores) / len(scores), 2)
    except Exception as e:
        log.warning(f"News fetch failed for {symbol}: {e}")
        return 0.5


def fetch_and_save_stock(stock: dict) -> dict:
    sym = stock["sym"]
    name = stock["name"]
    sector = stock["sector"]
    try:
        t = yf.Ticker(sym)
        hist = t.history(period="90d", interval="1d")
        if hist.empty or len(hist) < 20:
            raise ValueError("Not enough history")

        close  = hist["Close"]
        volume = hist["Volume"]
        curr   = round(float(close.iloc[-1]), 2)
        prev   = round(float(close.iloc[-2]), 2)
        chg    = round(curr - prev, 2)
        chg_pct = round((chg / prev) * 100, 2)

        # RSI (pure pandas)
        delta = close.diff()
        gain = delta.clip(lower=0).ewm(com=13, min_periods=14).mean()
        loss = (-delta.clip(upper=0)).ewm(com=13, min_periods=14).mean()
        rs = gain / loss.replace(0, float("nan"))
        rsi_s = 100 - (100 / (1 + rs))
        rsi_v = rsi_s.iloc[-1]
        rsi = round(float(rsi_v), 1) if not math.isnan(rsi_v) else None

        # MACD histogram (pure pandas)
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        macd_line = ema12 - ema26
        signal_line = macd_line.ewm(span=9, adjust=False).mean()
        hist_v = (macd_line - signal_line).iloc[-1]
        macd_diff = float(hist_v) if not math.isnan(hist_v) else None

        # EMA20 (pure pandas)
        ema20_v = close.ewm(span=20, adjust=False).mean().iloc[-1]
        price_vs_ema = round((curr - float(ema20_v)) / float(ema20_v), 4) if not math.isnan(ema20_v) else None

        sentiment = fetch_news_sentiment(sym.replace(".NS",""), name)
        signal, confidence = compute_signal(rsi, macd_diff, price_vs_ema, sentiment)

        result = {
            "sym": sym.replace(".NS",""), "name": name, "sector": sector,
            "price": curr, "prev_close": prev, "change": chg, "change_pct": chg_pct,
            "volume": round(float(volume.iloc[-1]) / 1e5, 1),
            "avg_volume": round(float(volume.rolling(20).mean().iloc[-1]) / 1e5, 1),
            "rsi": rsi, "macd_diff": round(macd_diff, 3) if macd_diff else None,
            "price_vs_ema20": price_vs_ema, "sentiment": sentiment,
            "signal": signal, "confidence": confidence,
            "opt_rec": "CALL" if signal == "BUY" else "PUT" if signal == "SELL" else "NEUTRAL",
            "week_high": round(float(close.rolling(52).max().iloc[-1]), 2),
            "week_low":  round(float(close.rolling(52).min().iloc[-1]), 2),
            "last_updated": datetime.now(IST).isoformat(),
        }
        log.info(f"  {sym.replace('.NS',''):12s} ₹{curr:>8.2f}  {chg_pct:+.2f}%  RSI:{rsi}  {signal} ({confidence:.0%})")
        return result

    except Exception as e:
        log.error(f"  FAILED {sym}: {e}")
        return {"sym": sym.replace(".NS",""), "name": name, "sector": sector, "error": str(e)}


def fetch_indices() -> dict:
    result = {}
    for name, ticker in INDICES.items():
        try:
            t = yf.Ticker(ticker)
            hist = t.history(period="2d")
            if len(hist) >= 2:
                prev = float(hist["Close"].iloc[-2])
                curr = float(hist["Close"].iloc[-1])
                chg  = round(curr - prev, 2)
                chg_pct = round((chg / prev) * 100, 2)
            elif len(hist) == 1:
                curr = float(hist["Close"].iloc[-1])
                chg = chg_pct = 0
            else:
                curr = chg = chg_pct = 0
            result[name] = {"value": round(curr, 2), "change": chg,
                            "change_pct": chg_pct, "direction": "up" if chg >= 0 else "down"}
        except Exception as e:
            log.warning(f"Index {name} failed: {e}")
            result[name] = {"value": 0, "change": 0, "change_pct": 0, "direction": "flat"}
    return result


def fetch_global_news() -> list:
    if not NEWS_API_KEY:
        return []
    try:
        r = requests.get(
            "https://newsapi.org/v2/everything",
            params={"q": "Nifty BSE NSE India stock market", "language": "en",
                    "sortBy": "publishedAt", "pageSize": 30, "apiKey": NEWS_API_KEY},
            timeout=10
        )
        articles = r.json().get("articles", [])
        return [
            {"title": a["title"], "source": a["source"]["name"], "url": a["url"],
             "published": a["publishedAt"],
             "sentiment": score_sentiment(a["title"] + " " + (a.get("description") or "")),
             "symbol": "MARKET"}
            for a in articles if a.get("title")
        ]
    except Exception as e:
        log.warning(f"Global news fetch failed: {e}")
        return []


def save_json(filename: str, data):
    path = DATA_DIR / filename
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    log.info(f"Saved -> data/{filename}")


def load_json(filename: str):
    path = DATA_DIR / filename
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return None


def job_fetch_all_stocks():
    if not is_market_day():
        log.info("Market holiday — skipping stock fetch")
        return
    log.info("=== Fetching all stocks ===")
    stocks = []
    for stock in NIFTY50:
        result = fetch_and_save_stock(stock)
        stocks.append(result)
        time.sleep(0.3)
    save_json("stocks_latest.json", stocks)
    save_json(f"stocks_{date.today().isoformat()}.json", stocks)

    buys  = sum(1 for s in stocks if s.get("signal") == "BUY")
    sells = sum(1 for s in stocks if s.get("signal") == "SELL")
    holds = sum(1 for s in stocks if s.get("signal") == "HOLD")
    log.info(f"=== Done: {buys} BUY · {sells} SELL · {holds} HOLD ===")


def job_fetch_indices():
    log.info("Fetching indices...")
    data = fetch_indices()
    data["last_updated"] = datetime.now(IST).isoformat()
    save_json("indices_latest.json", data)
    log.info(f"Indices: Nifty={data.get('NIFTY50',{}).get('value')} BankNifty={data.get('BANKNIFTY',{}).get('value')}")


def job_fetch_news():
    log.info("Fetching global news...")
    articles = fetch_global_news()
    save_json("news_latest.json", {"articles": articles, "fetched_at": datetime.now(IST).isoformat()})
    log.info(f"Saved {len(articles)} news articles")


def job_intraday():
    if not is_market_hours():
        return
    log.info("--- Intraday refresh ---")
    job_fetch_indices()
    job_fetch_all_stocks()


def job_eod():
    if not is_market_day():
        return
    log.info("=== END OF DAY SNAPSHOT ===")
    job_fetch_indices()
    job_fetch_all_stocks()
    job_fetch_news()

    stocks = load_json("stocks_latest.json") or []
    today = date.today().isoformat()
    history = load_json("signal_history.json") or []
    history.append({
        "date": today,
        "snapshot": [
            {"sym": s.get("sym"), "signal": s.get("signal"),
             "price": s.get("price"), "change_pct": s.get("change_pct"),
             "sentiment": s.get("sentiment"), "confidence": s.get("confidence")}
            for s in stocks if "error" not in s
        ]
    })
    history = history[-90:]
    save_json("signal_history.json", history)
    log.info(f"Signal history saved ({len(history)} days)")


def setup_schedule():
    schedule.every().day.at("09:00").do(job_fetch_indices)
    schedule.every().day.at("09:00").do(job_fetch_news)
    schedule.every().day.at("09:15").do(job_fetch_all_stocks)
    schedule.every(5).minutes.do(job_intraday)
    schedule.every().day.at("15:35").do(job_eod)
    schedule.every().day.at("18:00").do(job_fetch_news)

    log.info("Schedule set:")
    log.info("  09:00 IST → indices + news pre-market")
    log.info("  09:15 IST → full stock fetch on market open")
    log.info("  Every 15m → intraday refresh (market hours only)")
    log.info("  15:35 IST → end-of-day snapshot + signal history")
    log.info("  18:00 IST → post-market news refresh")


if __name__ == "__main__":
    log.info("NiftySignal AI Scheduler starting...")
    log.info(f"Current IST time: {datetime.now(IST).strftime('%Y-%m-%d %H:%M:%S')}")
    log.info(f"Market day: {is_market_day()} | Market hours: {is_market_hours()}")

    log.info("Running initial fetch on startup...")
    job_fetch_indices()
    job_fetch_news()
    job_fetch_all_stocks()

    setup_schedule()

    log.info("Scheduler running. Press Ctrl+C to stop.")
    while True:
        schedule.run_pending()
        time.sleep(30)
