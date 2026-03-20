"""
NSE Data Fetcher — works from any IP worldwide
Primary: Stooq (Poland-based, no IP restrictions)
Fallback: Yahoo Finance v8 direct API
"""
import requests
import pandas as pd
import math
import logging
import time
from datetime import datetime
from io import StringIO

log = logging.getLogger("nse_data")

def fetch_stooq(symbol: str, days=100) -> pd.DataFrame | None:
    """Fetch from stooq.com — works from any IP, no restrictions"""
    try:
        sym = f"{symbol}.NS"
        url = f"https://stooq.com/q/d/l/?s={sym}&i=d"
        r = requests.get(url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })
        if r.status_code != 200 or len(r.text) < 100:
            return None
        if "No data" in r.text or "Exceeded" in r.text:
            return None
        df = pd.read_csv(StringIO(r.text))
        if df.empty or len(df) < 5:
            return None
        df.columns = [c.strip() for c in df.columns]
        df["Date"] = pd.to_datetime(df["Date"])
        df = df.sort_values("Date").tail(days).set_index("Date")
        log.info(f"Stooq: {symbol} got {len(df)} rows")
        return df
    except Exception as e:
        log.warning(f"Stooq failed for {symbol}: {e}")
        return None


def fetch_yahoo_direct(symbol: str, days=100) -> pd.DataFrame | None:
    """Yahoo Finance v8 API direct — sometimes works from non-Indian IPs"""
    try:
        import time as t
        end = int(t.time())
        start = end - days * 86400
        sym = f"{symbol}.NS"
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&period1={start}&period2={end}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
        }
        r = requests.get(url, timeout=15, headers=headers)
        if r.status_code != 200:
            return None
        data = r.json()
        result = data.get("chart", {}).get("result", [])
        if not result:
            return None
        ts = result[0].get("timestamp", [])
        quotes = result[0].get("indicators", {}).get("quote", [{}])[0]
        if not ts or not quotes.get("close"):
            return None
        df = pd.DataFrame({
            "Date": pd.to_datetime(ts, unit="s"),
            "Open": quotes.get("open", []),
            "High": quotes.get("high", []),
            "Low": quotes.get("low", []),
            "Close": quotes.get("close", []),
            "Volume": quotes.get("volume", []),
        }).dropna(subset=["Close"]).set_index("Date")
        log.info(f"Yahoo direct: {symbol} got {len(df)} rows")
        return df if len(df) >= 5 else None
    except Exception as e:
        log.warning(f"Yahoo direct failed for {symbol}: {e}")
        return None


def get_data(symbol: str) -> pd.DataFrame | None:
    """Get stock data — tries stooq first, then yahoo direct"""
    df = fetch_stooq(symbol)
    if df is not None:
        return df
    log.info(f"{symbol}: stooq failed, trying yahoo direct...")
    df = fetch_yahoo_direct(symbol)
    return df


def calc_rsi(close: pd.Series, period=14):
    try:
        delta = close.diff()
        gain = delta.clip(lower=0).ewm(com=period-1, min_periods=period).mean()
        loss = (-delta.clip(upper=0)).ewm(com=period-1, min_periods=period).mean()
        rs = gain / loss.replace(0, float("nan"))
        rsi = 100 - (100 / (1 + rs))
        val = rsi.iloc[-1]
        return round(float(val), 1) if not math.isnan(val) else None
    except:
        return None


def calc_macd(close: pd.Series):
    try:
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        macd_line = ema12 - ema26
        signal = macd_line.ewm(span=9, adjust=False).mean()
        hist = (macd_line - signal).iloc[-1]
        return float(hist) if not math.isnan(hist) else None
    except:
        return None


def calc_ema(close: pd.Series, period=20):
    try:
        val = close.ewm(span=period, adjust=False).mean().iloc[-1]
        return float(val) if not math.isnan(val) else None
    except:
        return None


def fetch_stock_full(symbol: str, name: str, sector: str) -> dict:
    """Full stock data with signals — works from any IP"""
    df = get_data(symbol)
    if df is None:
        raise ValueError(f"No data for {symbol}")

    # Normalise column names
    df.columns = [c.strip() for c in df.columns]
    close_col = next((c for c in df.columns if c.lower() == "close"), None)
    vol_col   = next((c for c in df.columns if c.lower() == "volume"), None)
    if not close_col:
        raise ValueError(f"No close price column for {symbol}")

    close  = df[close_col].dropna()
    volume = df[vol_col].dropna() if vol_col else pd.Series([0]*len(close))

    if len(close) < 5:
        raise ValueError(f"Not enough rows for {symbol}")

    curr = round(float(close.iloc[-1]), 2)
    prev = round(float(close.iloc[-2]), 2) if len(close) >= 2 else curr
    chg  = round(curr - prev, 2)
    chg_pct = round((chg / prev) * 100, 2) if prev else 0

    rsi       = calc_rsi(close)
    macd_diff = calc_macd(close)
    ema20     = calc_ema(close, 20)
    pve       = round((curr - ema20) / ema20, 4) if ema20 else None

    n = min(52, len(close))
    week_high = round(float(close.rolling(n).max().iloc[-1]), 2)
    week_low  = round(float(close.rolling(n).min().iloc[-1]), 2)

    vol_today = round(float(volume.iloc[-1]) / 1e5, 1) if len(volume) > 0 else 0
    vol_avg   = round(float(volume.rolling(min(20,len(volume))).mean().iloc[-1]) / 1e5, 1) if len(volume) >= 5 else vol_today

    return {
        "sym": symbol, "name": name, "sector": sector,
        "price": curr, "prev_close": prev,
        "change": chg, "change_pct": chg_pct,
        "volume": vol_today, "avg_volume": vol_avg,
        "rsi": rsi,
        "macd_diff": round(macd_diff, 3) if macd_diff else None,
        "price_vs_ema20": pve,
        "week_high": week_high, "week_low": week_low,
        "last_updated": datetime.now().isoformat(),
        "source": "stooq"
    }
