"""
NSE Data Fetcher — works from any IP worldwide
Uses multiple fallback sources:
1. NSE India unofficial API (with headers)
2. Yahoo Finance with retry logic
3. Stooq as final fallback
"""
import requests
import pandas as pd
import time
import math
import logging
from datetime import datetime, date

log = logging.getLogger("nse_data")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.nseindia.com/",
    "Origin": "https://www.nseindia.com",
    "Connection": "keep-alive",
}

NSE_SESSION = None

def get_nse_session():
    global NSE_SESSION
    try:
        s = requests.Session()
        s.headers.update(HEADERS)
        s.get("https://www.nseindia.com", timeout=10)
        s.get("https://www.nseindia.com/market-data/live-equity-market", timeout=10)
        NSE_SESSION = s
        return s
    except Exception as e:
        log.warning(f"NSE session failed: {e}")
        return None


def fetch_nse_quote(symbol: str) -> dict | None:
    """Fetch live quote from NSE India"""
    try:
        s = get_nse_session()
        if not s:
            return None
        url = f"https://www.nseindia.com/api/quote-equity?symbol={symbol}"
        r = s.get(url, timeout=8)
        if r.status_code != 200:
            return None
        data = r.json()
        pd_data = data.get("priceInfo", {})
        return {
            "price":      pd_data.get("lastPrice", 0),
            "change":     pd_data.get("change", 0),
            "change_pct": pd_data.get("pChange", 0),
            "open":       pd_data.get("open", 0),
            "high":       pd_data.get("intraDayHighLow", {}).get("max", 0),
            "low":        pd_data.get("intraDayHighLow", {}).get("min", 0),
            "prev_close": pd_data.get("previousClose", 0),
            "volume":     data.get("marketDeptOrderBook", {}).get("tradeInfo", {}).get("totalTradedVolume", 0),
            "source":     "nse_direct"
        }
    except Exception as e:
        log.warning(f"NSE quote failed for {symbol}: {e}")
        return None


def fetch_yfinance_history(symbol_ns: str, period="90d") -> pd.DataFrame | None:
    """Fetch historical data via yfinance with retry"""
    import yfinance as yf
    for attempt in range(3):
        try:
            t = yf.Ticker(symbol_ns)
            hist = t.history(period=period, interval="1d")
            if not hist.empty and len(hist) >= 10:
                return hist
            time.sleep(1)
        except Exception as e:
            log.warning(f"yfinance attempt {attempt+1} failed for {symbol_ns}: {e}")
            time.sleep(2)
    return None


def fetch_stooq_history(symbol: str, period_days=90) -> pd.DataFrame | None:
    """Fallback: fetch from stooq.com — works from any IP"""
    try:
        stooq_sym = f"{symbol}.NS"
        url = f"https://stooq.com/q/d/l/?s={stooq_sym}&i=d"
        r = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code != 200 or "No data" in r.text:
            return None
        from io import StringIO
        df = pd.read_csv(StringIO(r.text))
        df.columns = [c.strip() for c in df.columns]
        df["Date"] = pd.to_datetime(df["Date"])
        df = df.sort_values("Date").tail(period_days)
        df = df.rename(columns={"Open":"Open","High":"High","Low":"Low","Close":"Close","Volume":"Volume"})
        df = df.set_index("Date")
        if len(df) >= 10:
            return df
        return None
    except Exception as e:
        log.warning(f"Stooq fallback failed for {symbol}: {e}")
        return None


def get_historical_data(symbol: str, period="90d") -> pd.DataFrame | None:
    """
    Get historical OHLCV data — tries multiple sources
    symbol should be bare symbol like 'RELIANCE' (no .NS)
    """
    sym_ns = f"{symbol}.NS"

    # Try yfinance first
    hist = fetch_yfinance_history(sym_ns, period)
    if hist is not None:
        log.info(f"{symbol}: got data from yfinance ({len(hist)} rows)")
        return hist

    # Try stooq
    log.info(f"{symbol}: yfinance failed, trying stooq...")
    hist = fetch_stooq_history(symbol)
    if hist is not None:
        log.info(f"{symbol}: got data from stooq ({len(hist)} rows)")
        return hist

    # Try Alpha Vantage with demo key (limited but works)
    log.info(f"{symbol}: stooq failed, trying alpha vantage...")
    hist = fetch_alpha_vantage(symbol)
    if hist is not None:
        log.info(f"{symbol}: got data from alpha vantage ({len(hist)} rows)")
        return hist

    log.warning(f"{symbol}: all historical data sources failed")
    return None


def calc_rsi(close: pd.Series, period=14) -> float | None:
    try:
        delta = close.diff()
        gain = delta.clip(lower=0).ewm(com=period-1, min_periods=period).mean()
        loss = (-delta.clip(upper=0)).ewm(com=period-1, min_periods=period).mean()
        rs = gain / loss.replace(0, float('nan'))
        rsi = 100 - (100 / (1 + rs))
        val = rsi.iloc[-1]
        return round(float(val), 1) if not math.isnan(val) else None
    except:
        return None


def calc_macd(close: pd.Series) -> float | None:
    try:
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        hist = (ema12 - ema26 - (ema12 - ema26).ewm(span=9, adjust=False).mean()).iloc[-1]
        return float(hist) if not math.isnan(hist) else None
    except:
        return None


def calc_ema(close: pd.Series, period=20) -> float | None:
    try:
        val = close.ewm(span=period, adjust=False).mean().iloc[-1]
        return float(val) if not math.isnan(val) else None
    except:
        return None


def fetch_stock_full(symbol: str, name: str, sector: str) -> dict:
    """
    Full stock data with signals — works from any IP
    Tries multiple sources with fallbacks
    """
    # Try to get current price from Indian Stock API first (works from any IP)
    live = fetch_indian_stock_api(symbol)

    hist = get_historical_data(symbol)
    if hist is None:
        # If no historical data but we have live price, create minimal response
        if live:
            return {
                "sym": symbol, "name": name, "sector": sector,
                "price": live["price"],
                "prev_close": live["prev_close"],
                "change": live["change"],
                "change_pct": round(live["change_pct"], 2),
                "volume": round(live["volume"] / 1e5, 1) if live["volume"] else 0,
                "avg_volume": 0,
                "rsi": None, "macd_diff": None, "price_vs_ema20": None,
                "week_high": live["week_high"],
                "week_low": live["week_low"],
                "last_updated": datetime.now().isoformat(),
                "source": "indian_stock_api_only"
            }
        raise ValueError(f"No data available for {symbol}")

    close  = hist["Close"] if "Close" in hist.columns else hist.get("close", pd.Series())
    volume = hist["Volume"] if "Volume" in hist.columns else hist.get("volume", pd.Series())

    if len(close) < 10:
        raise ValueError(f"Not enough data for {symbol}")

    curr = round(float(close.iloc[-1]), 2)
    prev = round(float(close.iloc[-2]), 2)
    chg  = round(curr - prev, 2)
    chg_pct = round((chg / prev) * 100, 2)

    rsi       = calc_rsi(close)
    macd_diff = calc_macd(close)
    ema20     = calc_ema(close)
    pve       = round((curr - ema20) / ema20, 4) if ema20 else None

    high = hist["High"] if "High" in hist.columns else close
    low  = hist["Low"]  if "Low"  in hist.columns else close

    week_high = round(float(close.rolling(min(52, len(close))).max().iloc[-1]), 2)
    week_low  = round(float(close.rolling(min(52, len(close))).min().iloc[-1]), 2)

    vol_today = round(float(volume.iloc[-1]) / 1e5, 1) if len(volume) > 0 else 0
    vol_avg   = round(float(volume.rolling(20).mean().iloc[-1]) / 1e5, 1) if len(volume) >= 20 else vol_today

    return {
        "sym": symbol, "name": name, "sector": sector,
        "price": curr, "prev_close": prev, "change": chg, "change_pct": chg_pct,
        "volume": vol_today, "avg_volume": vol_avg,
        "rsi": rsi,
        "macd_diff": round(macd_diff, 3) if macd_diff else None,
        "price_vs_ema20": pve,
        "week_high": week_high, "week_low": week_low,
        "last_updated": datetime.now().isoformat(),
        "source": "multi_source"
    }


def fetch_indian_stock_api(symbol: str) -> dict | None:
    """
    Free Indian Stock Market API - works from any IP worldwide
    Source: https://military-jobye-haiqstudios-14f59639.koyeb.app
    """
    try:
        url = f"https://military-jobye-haiqstudios-14f59639.koyeb.app/stock?symbol={symbol}.NS"
        r = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code != 200:
            return None
        d = r.json()
        if d.get("status") != "success":
            return None
        info = d.get("info", {})
        return {
            "price":      info.get("currentPrice", 0),
            "change":     info.get("currentPrice", 0) - info.get("previousClose", 0),
            "change_pct": info.get("regularMarketChangePercent", 0),
            "prev_close": info.get("previousClose", 0),
            "volume":     info.get("volume", 0),
            "week_high":  info.get("fiftyTwoWeekHigh", 0),
            "week_low":   info.get("fiftyTwoWeekLow", 0),
            "pe_ratio":   info.get("trailingPE", None),
            "market_cap": info.get("marketCap", None),
            "source":     "indian_stock_api"
        }
    except Exception as e:
        log.warning(f"Indian stock API failed for {symbol}: {e}")
        return None


def fetch_alpha_vantage(symbol: str, api_key: str = "demo") -> pd.DataFrame | None:
    """Alpha Vantage - global API that includes Indian stocks"""
    try:
        url = f"https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=NSE:{symbol}&apikey={api_key}&outputsize=compact"
        r = requests.get(url, timeout=10)
        data = r.json()
        ts = data.get("Time Series (Daily)", {})
        if not ts:
            return None
        rows = []
        for date_str, vals in sorted(ts.items())[-90:]:
            rows.append({
                "Date": pd.to_datetime(date_str),
                "Open": float(vals["1. open"]),
                "High": float(vals["2. high"]),
                "Low":  float(vals["3. low"]),
                "Close": float(vals["4. close"]),
                "Volume": float(vals["5. volume"]),
            })
        df = pd.DataFrame(rows).set_index("Date")
        return df if len(df) >= 10 else None
    except Exception as e:
        log.warning(f"Alpha Vantage failed for {symbol}: {e}")
        return None
