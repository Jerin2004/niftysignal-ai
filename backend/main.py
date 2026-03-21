from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import requests
import os, math, time, json, threading
from datetime import datetime, date
from pathlib import Path
from dotenv import load_dotenv
from typing import Optional
import pytz
import schedule

load_dotenv()

# Import multi-source data fetcher
try:
    from nse_data import fetch_stock_full, calc_rsi, calc_macd, calc_ema, get_historical_data
    USE_MULTI_SOURCE = True
except ImportError:
    USE_MULTI_SOURCE = False

app = FastAPI(title="NiftySignal AI", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

IST = pytz.timezone("Asia/Kolkata")

def is_market_hours():
    now = datetime.now(IST)
    if now.weekday() >= 5: return False
    h, m = now.hour, now.minute
    return (h == 9 and m >= 15) or (10 <= h <= 14) or (h == 15 and m <= 30)

def background_scheduler():
    """Runs in background thread — auto-fetches data during market hours"""
    import logging
    log = logging.getLogger("bg_scheduler")

    def run_fetch():
        log.info("BG scheduler: fetching stocks via stooq...")
        stocks = []
        for stock in NIFTY50:
            try:
                s = fetch_live_stock(stock["sym"], stock["name"], stock["sector"])
                stocks.append(s)
                time.sleep(0.3)
            except Exception as e:
                stocks.append({"sym": stock["sym"].replace(".NS",""), "name": stock["name"], "sector": stock["sector"], "error": str(e)})
        if stocks:
            with open(DATA_DIR / "stocks_latest.json", "w") as f:
                json.dump(stocks, f, default=str)
            mem_set("stocks_all", stocks)
            log.info(f"BG scheduler: saved {len(stocks)} stocks")

        # Refresh indices via stooq
        from nse_data import fetch_stooq
        from io import StringIO
        stooq_indices = {"NIFTY50":"nifty50.ns","BANKNIFTY":"niftybank.ns","SENSEX":"bse30.in"}
        result = {}
        for iname, sym in stooq_indices.items():
            try:
                url = f"https://stooq.com/q/d/l/?s={sym}&i=d"
                r = requests.get(url, timeout=10, headers={"User-Agent":"Mozilla/5.0"})
                if r.status_code == 200 and len(r.text) > 50:
                    df = pd.read_csv(StringIO(r.text))
                    if len(df) >= 2:
                        curr = float(df["Close"].iloc[-1])
                        prev = float(df["Close"].iloc[-2])
                        chg = round(curr-prev,2)
                        chg_pct = round((chg/prev)*100,2)
                        result[iname] = {"value":round(curr,2),"change":chg,"change_pct":chg_pct,"direction":"up" if chg>=0 else "down"}
            except Exception as e:
                log.warning(f"Stooq index {iname} failed: {e}")
        for k in ["NIFTYMIDCAP","VIX"]:
            result.setdefault(k, {"value":0,"change":0,"change_pct":0,"direction":"flat"})
        if result:
            result["last_updated"] = datetime.now().isoformat()
            with open(DATA_DIR / "indices_latest.json", "w") as f:
                json.dump(result, f)
            mem_set("overview", result)

    schedule.every(5).minutes.do(run_fetch)

    log.info("Background scheduler started — auto-refreshes every 5 min")
    # Wait 10 seconds before first fetch to let server start
    time.sleep(10)
    log.info("Starting initial data fetch via stooq...")
    run_fetch()
    while True:
        schedule.run_pending()
        time.sleep(30)

@app.on_event("startup")
def start_background_scheduler():
    t = threading.Thread(target=background_scheduler, daemon=True)
    t.start()

NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

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

    # Additional popular stocks
    {"sym": "EICHERMOT.NS",  "name": "Eicher Motors",          "sector": "Auto"},
    {"sym": "BAJAJ-AUTO.NS", "name": "Bajaj Auto",              "sector": "Auto"},
    {"sym": "HEROMOTOCO.NS", "name": "Hero MotoCorp",           "sector": "Auto"},
    {"sym": "ASIANPAINT.NS", "name": "Asian Paints",            "sector": "Consumer"},
    {"sym": "ULTRACEMCO.NS", "name": "UltraTech Cement",        "sector": "Infra"},
    {"sym": "JSWSTEEL.NS",   "name": "JSW Steel",               "sector": "Metal"},
    {"sym": "TATASTEEL.NS",  "name": "Tata Steel",              "sector": "Metal"},
    {"sym": "HINDALCO.NS",   "name": "Hindalco",                "sector": "Metal"},
    {"sym": "TECHM.NS",      "name": "Tech Mahindra",           "sector": "IT"},
    {"sym": "MCDOWELL-N.NS", "name": "United Spirits",          "sector": "FMCG"},
    {"sym": "PIDILITIND.NS", "name": "Pidilite Industries",     "sector": "Consumer"},
    {"sym": "DABUR.NS",      "name": "Dabur India",             "sector": "FMCG"},
    {"sym": "GODREJCP.NS",   "name": "Godrej Consumer",         "sector": "FMCG"},
    {"sym": "DIVISLAB.NS",   "name": "Divis Laboratories",      "sector": "Pharma"},
    {"sym": "CIPLA.NS",      "name": "Cipla",                   "sector": "Pharma"},
    {"sym": "APOLLOHOSP.NS", "name": "Apollo Hospitals",        "sector": "Healthcare"},
    {"sym": "DMART.NS",      "name": "Avenue Supermarts",       "sector": "Retail"},
    {"sym": "INDIGO.NS",     "name": "IndiGo Airlines",         "sector": "Aviation"},
    {"sym": "TATACONSUM.NS", "name": "Tata Consumer",           "sector": "FMCG"},
    {"sym": "BPCL.NS",       "name": "BPCL",                    "sector": "Energy"},
    {"sym": "IOC.NS",        "name": "Indian Oil Corp",         "sector": "Energy"},
    {"sym": "GAIL.NS",       "name": "GAIL India",              "sector": "Energy"},
    {"sym": "VEDL.NS",       "name": "Vedanta",                 "sector": "Metal"},
    {"sym": "ZOMATO.NS",     "name": "Zomato",                  "sector": "Tech"},
    {"sym": "PAYTM.NS",      "name": "Paytm",                   "sector": "Tech"},
    {"sym": "NYKAA.NS",      "name": "Nykaa",                   "sector": "Tech"},
    {"sym": "IRCTC.NS",      "name": "IRCTC",                   "sector": "Travel"},
    {"sym": "HAL.NS",        "name": "Hindustan Aeronautics",   "sector": "Defence"},
    {"sym": "BEL.NS",        "name": "Bharat Electronics",      "sector": "Defence"},
]

_mem = {}
def mem_get(key, ttl=300):
    if key in _mem:
        d, ts = _mem[key]
        if time.time() - ts < ttl: return d
    return None
def mem_set(key, data): _mem[key] = (data, time.time())
def load_json(fname):
    p = DATA_DIR / fname
    if p.exists():
        with open(p) as f: return json.load(f)
    return None

# ── Indicators ────────────────────────────────────────────────────────────────
def calc_rsi(close, period=14):
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(com=period-1, min_periods=period).mean()
    loss = (-delta.clip(upper=0)).ewm(com=period-1, min_periods=period).mean()
    rs = gain / loss.replace(0, float('nan'))
    rsi = 100 - (100 / (1 + rs))
    val = rsi.iloc[-1]
    return round(float(val), 1) if not math.isnan(val) else None

def calc_macd(close, fast=12, slow=26, signal=9):
    macd_line = close.ewm(span=fast, adjust=False).mean() - close.ewm(span=slow, adjust=False).mean()
    hist = macd_line - macd_line.ewm(span=signal, adjust=False).mean()
    val = hist.iloc[-1]
    return float(val) if not math.isnan(val) else None

def calc_ema(close, period=20):
    val = close.ewm(span=period, adjust=False).mean().iloc[-1]
    return float(val) if not math.isnan(val) else None

def calc_bb_pct(close, period=20):
    sma = close.rolling(period).mean()
    std = close.rolling(period).std()
    rng = (sma + 2*std).iloc[-1] - (sma - 2*std).iloc[-1]
    return round((close.iloc[-1] - (sma - 2*std).iloc[-1]) / rng, 2) if rng != 0 else 0.5

def calc_atr(high, low, close, period=14):
    tr = pd.concat([high-low, (high-close.shift()).abs(), (low-close.shift()).abs()], axis=1).max(axis=1)
    val = tr.ewm(span=period, adjust=False).mean().iloc[-1]
    return round(float(val), 2) if not math.isnan(val) else None

def calc_levels(close, high, low, lookback=20):
    rh = float(high.rolling(lookback).max().iloc[-1])
    rl = float(low.rolling(lookback).min().iloc[-1])
    pivot = round((rh + rl + float(close.iloc[-1])) / 3, 2)
    return {
        "pivot": pivot,
        "r1": round(2*pivot - rl, 2), "r2": round(pivot + (rh - rl), 2),
        "s1": round(2*pivot - rh, 2), "s2": round(pivot - (rh - rl), 2)
    }

def calc_targets(curr, signal, atr, levels):
    if atr is None: atr = curr * 0.015
    if signal == "BUY":
        sl  = round(curr - 1.5 * atr, 2)
        t1  = round(curr + 1.0 * atr, 2)
        t2  = round(curr + 2.0 * atr, 2)
        t3  = round(levels.get("r2", curr + 3*atr), 2)
        risk = round(curr - sl, 2)
        rew  = round(t2 - curr, 2)
    elif signal == "SELL":
        sl  = round(curr + 1.5 * atr, 2)
        t1  = round(curr - 1.0 * atr, 2)
        t2  = round(curr - 2.0 * atr, 2)
        t3  = round(levels.get("s2", curr - 3*atr), 2)
        risk = round(sl - curr, 2)
        rew  = round(curr - t2, 2)
    else:
        return {"entry":None,"stop_loss":None,"target1":None,"target2":None,"target3":None,"risk":None,"reward":None,"rr_ratio":None,"atr":atr}
    rr = round(rew / risk, 2) if risk > 0 else 0
    return {"entry":curr,"stop_loss":sl,"target1":t1,"target2":t2,"target3":t3,"risk":risk,"reward":rew,"rr_ratio":rr,"atr":atr}

# ── Sentiment & Signal ────────────────────────────────────────────────────────
def score_sentiment(text):
    pos = ["profit","growth","beats","record","surge","gain","rises","strong","upgrade","buy","bullish","expansion","award","wins","approves","dividend","outperform","revenue","deal","approved","launch"]
    neg = ["loss","fall","drops","decline","cuts","miss","bearish","sell","downgrade","risk","concern","layoff","investigation","fine","penalty","fraud","default","debt","recall","ban","delay","weak"]
    t = text.lower()
    p = sum(1 for w in pos if w in t); n = sum(1 for w in neg if w in t)
    return round(p/(p+n), 2) if (p+n) else 0.5

def compute_signal(rsi, macd_diff, pve, sent):
    score = 0.0
    if rsi is not None:
        if rsi < 35: score += 2.0
        elif rsi < 45: score += 1.0
        elif rsi > 65: score -= 2.0
        elif rsi > 55: score -= 1.0
    if macd_diff is not None: score += 1.5 if macd_diff > 0 else -1.5
    if pve is not None:
        if pve > 0.02: score += 1.0
        elif pve < -0.02: score -= 1.0
    if sent is not None:
        if sent > 0.7: score += 1.5
        elif sent > 0.55: score += 0.5
        elif sent < 0.35: score -= 1.5
        elif sent < 0.45: score -= 0.5
    conf = min(abs(score)/6.0, 1.0)
    if score >= 2.0: return "BUY", round(conf, 2)
    elif score <= -2.0: return "SELL", round(conf, 2)
    return "HOLD", round(conf, 2)

def get_news_sentiment(symbol, name):
    if not NEWS_API_KEY: return round(0.45 + hash(symbol) % 100 / 200, 2)
    c = mem_get(f"sent_{symbol}", 900)
    if c is not None: return c
    try:
        r = requests.get("https://newsapi.org/v2/everything",
            params={"q":f"{name} OR {symbol} stock","language":"en","sortBy":"publishedAt","pageSize":10,"apiKey":NEWS_API_KEY}, timeout=5)
        arts = r.json().get("articles",[])
        if not arts: return 0.5
        result = round(sum(score_sentiment(a.get("title","")+" "+(a.get("description") or "")) for a in arts)/len(arts), 2)
        mem_set(f"sent_{symbol}", result)
        return result
    except: return 0.5

# ── Core stock fetch ──────────────────────────────────────────────────────────
def fetch_live_stock(sym, name, sector):
    """Fetch stock data using stooq — works from any IP worldwide"""
    symbol = sym.replace(".NS", "")
    from nse_data import fetch_stock_full
    try:
        base = fetch_stock_full(symbol, name, sector)
        sent = get_news_sentiment(symbol, name)
        signal, conf = compute_signal(base.get("rsi"), base.get("macd_diff"), base.get("price_vs_ema20"), sent)

        # Calculate targets using trading engine
        curr = base["price"]
        hist = None
        try:
            from nse_data import get_data
            hist = get_data(symbol)
        except: pass

        atr = levels = None
        if hist is not None:
            close_col = next((c for c in hist.columns if c.lower()=="close"), None)
            high_col  = next((c for c in hist.columns if c.lower()=="high"), None)
            low_col   = next((c for c in hist.columns if c.lower()=="low"), None)
            if close_col and high_col and low_col:
                close = hist[close_col].dropna()
                high  = hist[high_col].dropna()
                low   = hist[low_col].dropna()
                atr    = calc_atr(high, low, close)
                levels = calc_levels(close, high, low)

        targets = calc_targets(curr, signal, atr or 0, levels or {})

        base.update({
            "sentiment": sent, "signal": signal, "confidence": conf,
            "opt_rec": "CALL" if signal=="BUY" else "PUT" if signal=="SELL" else "NEUTRAL",
            "bb_pct": None,
            "entry":     targets.get("entry"),
            "stop_loss": targets.get("stop_loss"),
            "target1":   targets.get("target1"),
            "target2":   targets.get("target2"),
            "target3":   targets.get("target3"),
            "risk":      targets.get("risk"),
            "reward":    targets.get("reward"),
            "rr_ratio":  targets.get("rr_ratio"),
            "atr":       atr,
            "support":   levels.get("s1") if levels else None,
            "resistance":levels.get("r1") if levels else None,
            "pivot":     levels.get("pivot") if levels else None,
            "source":    "stooq"
        })
        return base
    except Exception as e:
        raise ValueError(f"Failed to fetch {symbol}: {e}")

# ── API Routes ────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    sf = DATA_DIR/"stocks_latest.json"
    return {"status":"ok","time":datetime.now().isoformat(),"news_api":bool(NEWS_API_KEY),
            "scheduler_cache":sf.exists(),
            "cache_age_mins":round((time.time()-sf.stat().st_mtime)/60,1) if sf.exists() else None}

@app.get("/api/market/overview")
def market_overview():
    cached = load_json("indices_latest.json")
    if cached: return {**cached, "source":"scheduler_cache"}
    c = mem_get("overview")
    if c: return c
    from io import StringIO
    stooq_map = {"NIFTY50":"nifty50.ns","BANKNIFTY":"niftybank.ns","SENSEX":"bse30.in"}
    result = {}
    for key, sym in stooq_map.items():
        try:
            url = f"https://stooq.com/q/d/l/?s={sym}&i=d"
            r = requests.get(url, timeout=10, headers={"User-Agent":"Mozilla/5.0"})
            if r.status_code==200 and len(r.text)>50 and "No data" not in r.text:
                df = pd.read_csv(StringIO(r.text))
                if len(df)>=2:
                    curr=round(float(df["Close"].iloc[-1]),2); prev=round(float(df["Close"].iloc[-2]),2)
                    chg=round(curr-prev,2); chg_pct=round((chg/prev)*100,2)
                    result[key]={"value":curr,"change":chg,"change_pct":chg_pct,"direction":"up" if chg>=0 else "down"}
                    continue
        except: pass
        result[key]={"value":0,"change":0,"change_pct":0,"direction":"flat"}
    result["NIFTYMIDCAP"]={"value":0,"change":0,"change_pct":0,"direction":"flat"}
    result["VIX"]={"value":0,"change":0,"change_pct":0,"direction":"flat"}
    result["source"]="stooq"; result["last_updated"]=datetime.now().isoformat()
    mem_set("overview",result); save_json("indices_latest.json",result)
    return result

@app.get("/api/stocks")
def get_all_stocks(sector: Optional[str]=Query(None), force_refresh: bool=False):
    if not force_refresh:
        fd = load_json("stocks_latest.json")
        if fd:
            stocks = [s for s in fd if not sector or sector=="all" or s.get("sector","")==sector]
            return {"stocks":stocks,"source":"scheduler_cache",
                    "cache_age_mins":round((time.time()-(DATA_DIR/"stocks_latest.json").stat().st_mtime)/60,1)}
    c = mem_get("stocks_all")
    if c:
        stocks = [s for s in c if not sector or sector=="all" or s.get("sector","")==sector]
        return {"stocks":stocks,"source":"memory_cache"}
    # No cache yet — return loading state with helpful message
    if c and not force_refresh:
        return {"stocks":[s for s in c if not sector or sector=="all" or s.get("sector","")==sector],"source":"memory_cache"}
    stocks = []
    for stock in NIFTY50:
        try:
            s = fetch_live_stock(stock["sym"], stock["name"], stock["sector"])
            stocks.append(s); time.sleep(0.15)
        except Exception as e:
            stocks.append({"sym":stock["sym"].replace(".NS",""),"name":stock["name"],"sector":stock["sector"],"error":str(e)})
    mem_set("stocks_all", stocks)
    return {"stocks":[s for s in stocks if not sector or sector=="all" or s.get("sector","")==sector],"source":"live"}

@app.get("/api/stock/{symbol}")
def get_stock_detail(symbol: str):
    sym_ns = symbol.upper()+".NS"
    cached = load_json("stocks_latest.json")
    base = next((s for s in (cached or []) if s.get("sym")==symbol.upper()), None)
    if not base:
        meta = next((s for s in NIFTY50 if s["sym"]==sym_ns), {"sym":sym_ns,"name":symbol,"sector":"Unknown"})
        try: base = fetch_live_stock(sym_ns, meta["name"], meta["sector"])
        except Exception as e: raise HTTPException(status_code=500, detail=str(e))
    try:
        t = yf.Ticker(sym_ns); info = t.info
        base.update({"market_cap":info.get("marketCap"),"pe_ratio":info.get("trailingPE"),
                     "pb_ratio":info.get("priceToBook"),"dividend_yield":info.get("dividendYield"),
                     "eps":info.get("trailingEps"),"beta":info.get("beta")})
        hist = t.history(period="1y", interval="1d")
        base["chart"]=[{"date":str(idx.date()),"open":round(float(r["Open"]),2),"high":round(float(r["High"]),2),
                         "low":round(float(r["Low"]),2),"close":round(float(r["Close"]),2),"volume":int(r["Volume"])}
                        for idx,r in hist.iterrows()]
    except Exception as e: base["fundamentals_error"]=str(e)
    return base

@app.get("/api/options/{symbol}")
def get_options(symbol: str, expiry: Optional[str]=Query(None)):
    sym_ns = symbol.upper()+".NS"; spot = 1000
    try:
        t = yf.Ticker(sym_ns); hist = t.history(period="5d")
        if hist.empty: raise HTTPException(status_code=404, detail="No price data")
        spot = round(float(hist["Close"].iloc[-1]),2)
        expiries = t.options
        if not expiries: return _synth_options(symbol, spot)
        target = expiry if expiry and expiry in expiries else expiries[0]
        chain = t.option_chain(target)
        calls_df, puts_df = chain.calls, chain.puts
        atm_idx = (calls_df["strike"]-spot).abs().idxmin()
        atm_strike = float(calls_df.loc[atm_idx,"strike"])
        sr = calls_df[(calls_df["strike"]>=atm_strike*0.95)&(calls_df["strike"]<=atm_strike*1.05)]
        def r2d(row):
            return {"strike":float(row.get("strike",0)),"lastPrice":round(float(row.get("lastPrice",0)),2),
                    "bid":round(float(row.get("bid",0)),2),"ask":round(float(row.get("ask",0)),2),
                    "volume":int(row.get("volume",0)) if not math.isnan(float(row.get("volume",0) or 0)) else 0,
                    "openInterest":int(row.get("openInterest",0)) if not math.isnan(float(row.get("openInterest",0) or 0)) else 0,
                    "impliedVolatility":round(float(row.get("impliedVolatility",0)),4),
                    "inTheMoney":bool(row.get("inTheMoney",False))}
        chain_data=[]
        for _,row in sr.iterrows():
            pr=puts_df[puts_df["strike"]==row["strike"]]
            chain_data.append({"call":r2d(row),"put":r2d(pr.iloc[0]) if not pr.empty else {},"strike":float(row["strike"])})
        cached=load_json("stocks_latest.json") or []
        sig=next((s for s in cached if s.get("sym")==symbol.upper()),{})
        return {"symbol":symbol,"spot":spot,"expiry":target,"all_expiries":list(expiries[:6]),"atm_strike":atm_strike,
                "chain":chain_data,"signal":sig.get("signal","HOLD"),"opt_rec":sig.get("opt_rec","NEUTRAL"),
                "confidence":sig.get("confidence",0.5),"sentiment":sig.get("sentiment",0.5),"rsi":sig.get("rsi")}
    except HTTPException: raise
    except: return _synth_options(symbol, spot)

def _synth_options(symbol, spot):
    atm=round(spot/50)*50; chain=[]
    for i in range(-3,4):
        strike=atm+i*50; iv=0.18+abs(i)*0.02
        cp=round(max(spot-strike,0)+spot*iv*0.1,2); pp=round(max(strike-spot,0)+spot*iv*0.1,2)
        chain.append({"strike":strike,
            "call":{"strike":strike,"lastPrice":cp,"bid":round(cp*.97,2),"ask":round(cp*1.03,2),"volume":1200,"openInterest":45000,"impliedVolatility":round(iv,4),"inTheMoney":spot>strike},
            "put": {"strike":strike,"lastPrice":pp,"bid":round(pp*.97,2),"ask":round(pp*1.03,2),"volume":980,"openInterest":38000,"impliedVolatility":round(iv,4),"inTheMoney":spot<strike}})
    return {"symbol":symbol,"spot":spot,"expiry":"estimated","all_expiries":["estimated"],"atm_strike":atm,
            "chain":chain,"signal":"HOLD","opt_rec":"NEUTRAL","confidence":0.5,"sentiment":0.5,"rsi":None,"note":"Live options chain unavailable"}

@app.get("/api/chart/{symbol}")
def get_chart(symbol: str, period: str="3mo", interval: str="1d"):
    c = mem_get(f"chart_{symbol}_{period}_{interval}", 900)
    if c: return c
    try:
        t = yf.Ticker(symbol.upper()+".NS"); hist = t.history(period=period, interval=interval)
        if hist.empty: raise HTTPException(status_code=404, detail="No chart data")
        data=[{"date":str(idx.date()) if interval=="1d" else str(idx),
               "open":round(float(r["Open"]),2),"high":round(float(r["High"]),2),
               "low":round(float(r["Low"]),2),"close":round(float(r["Close"]),2),"volume":int(r["Volume"])}
              for idx,r in hist.iterrows()]
        result={"symbol":symbol,"period":period,"interval":interval,"data":data}
        mem_set(f"chart_{symbol}_{period}_{interval}", result)
        return result
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/news")
def get_news(symbol: Optional[str]=Query(None), limit: int=20):
    cf = load_json("news_latest.json")
    if cf and not symbol:
        return {"articles":cf.get("articles",[])[:limit],"source":"scheduler_cache","fetched_at":cf.get("fetched_at")}
    if not NEWS_API_KEY: return {"articles":[],"note":"Add NEWS_API_KEY to .env for live news"}
    c = mem_get(f"news_{symbol or 'all'}", 900)
    if c: return c
    try:
        query = f"{symbol} NSE stock India" if symbol else "Nifty BSE NSE India stock market"
        r = requests.get("https://newsapi.org/v2/everything",
            params={"q":query,"language":"en","sortBy":"publishedAt","pageSize":limit,"apiKey":NEWS_API_KEY},timeout=8)
        articles=r.json().get("articles",[])
        result={"articles":[{"title":a["title"],"source":a["source"]["name"],"url":a["url"],
                              "published":a["publishedAt"],"symbol":symbol or "MARKET",
                              "sentiment":score_sentiment(a["title"]+" "+(a.get("description") or ""))}
                             for a in articles if a.get("title")],"source":"live"}
        mem_set(f"news_{symbol or 'all'}", result)
        return result
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/signals/history")
def signal_history():
    data = load_json("signal_history.json")
    if not data: return {"history":[],"note":"Run scheduler.py to build signal history"}
    return {"history":data}



# ── Trading Engine ────────────────────────────────────────────────────────────
from trading_engine import (
    calc_atr, calc_support_resistance, calc_trade_levels,
    calc_position_size, open_paper_trade, close_paper_trade, get_paper_summary,
    load_paper_trades
)
from pydantic import BaseModel

class CloseIn(BaseModel):
    exit_price: float
    notes: str = ""

@app.get("/api/trade-plan/{symbol}")
def get_trade_plan(symbol: str, capital: float = Query(100000)):
    sym_ns = symbol.upper() + ".NS"
    try:
        t = yf.Ticker(sym_ns)
        hist = t.history(period="90d", interval="1d")
        if hist.empty or len(hist) < 10:
            raise HTTPException(status_code=404, detail="Not enough data")
        close = hist["Close"]; high = hist["High"]; low = hist["Low"]
        curr = round(float(close.iloc[-1]), 2)
        atr = calc_atr(high, low, close)
        support, resistance = calc_support_resistance(close, high, low)
        cached = load_json("stocks_latest.json") or []
        sig_data = next((s for s in cached if s.get("sym") == symbol.upper()), None)
        if not sig_data:
            meta = next((s for s in NIFTY50 if s["sym"]==sym_ns),
                        {"sym":sym_ns,"name":symbol,"sector":"Unknown"})
            sig_data = fetch_live_stock(sym_ns, meta["name"], meta["sector"])
        signal = sig_data.get("signal", "HOLD")
        levels = calc_trade_levels(curr, signal, atr, support, resistance)
        position = calc_position_size(capital, curr, levels["stop_loss"]) if levels.get("stop_loss") else None
        return {"symbol": symbol.upper(), "current_price": curr, "signal": signal,
                "confidence": sig_data.get("confidence"), "sentiment": sig_data.get("sentiment"),
                "rsi": sig_data.get("rsi"), **levels, "position_sizing": position,
                "capital": capital, "generated_at": datetime.now().isoformat()}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

from paper_trading import add_trade, close_trade, get_stats, delete_trade, load_trades
from pydantic import BaseModel

class AddTradeIn(BaseModel):
    sym: str
    signal: str
    entry: float
    stop_loss: float
    target1: float
    target2: float
    qty: int
    notes: str = ""

class CloseTradeIn(BaseModel):
    exit_price: float
    notes: str = "manual"

@app.get("/api/paper/trades")
def get_paper_trades():
    return load_trades()

@app.get("/api/paper/stats")
def paper_stats():
    return get_stats()

@app.post("/api/paper/trades")
def create_paper_trade(t: AddTradeIn):
    trade = add_trade(t.sym, t.signal, t.entry, t.stop_loss, t.target1, t.target2, t.qty, t.notes)
    return {"status": "opened", "trade": trade}

@app.post("/api/paper/trades/{trade_id}/close")
def close_paper_trade_endpoint(trade_id: int, body: CloseTradeIn):
    data = close_trade(trade_id, body.exit_price, body.notes)
    return {"status": "closed", "stats": get_stats()}

@app.delete("/api/paper/trades/{trade_id}")
def delete_paper_trade(trade_id: int):
    deleted = delete_trade(trade_id)
    return {"status": "deleted" if deleted else "not found"}


# ── Zerodha Integration ───────────────────────────────────────────────────────
from zerodha import (
    get_login_url, complete_login, init_kite,
    get_quotes, get_indices as z_get_indices,
    get_all_nse_symbols, is_logged_in
)

@app.get("/api/zerodha/login-url")
def zerodha_login_url():
    url = get_login_url()
    if not url:
        raise HTTPException(status_code=400, detail="Zerodha API key not configured in .env")
    return {"login_url": url, "instructions": "Open this URL in browser, login with Zerodha, then paste the request_token here"}

@app.get("/auth/callback")
def zerodha_callback(request_token: str = Query(...), action: str = Query("login"), status: str = Query("success")):
    try:
        token = complete_login(request_token)
        return {"status": "success", "message": "Zerodha login successful! You can close this tab.", "token_saved": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/zerodha/status")
def zerodha_status():
    logged_in = is_logged_in()
    if logged_in:
        init_kite()
    return {
        "logged_in": logged_in,
        "api_key_configured": bool(os.getenv("ZERODHA_API_KEY")),
        "message": "Connected — live data active" if logged_in else "Not logged in — open /api/zerodha/login-url to connect"
    }

@app.get("/api/zerodha/quotes")
def zerodha_quotes(symbols: str = Query(...)):
    sym_list = [f"NSE:{s.strip().upper()}" for s in symbols.split(",")]
    quotes = get_quotes(sym_list)
    if not quotes:
        raise HTTPException(status_code=401, detail="Not logged in to Zerodha or session expired")
    return quotes

@app.get("/api/zerodha/indices")
def zerodha_indices():
    data = z_get_indices()
    if not data:
        raise HTTPException(status_code=401, detail="Not logged in to Zerodha")
    return data

@app.get("/api/zerodha/all-symbols")
def zerodha_all_symbols():
    symbols = get_all_nse_symbols()
    return {"count": len(symbols), "symbols": symbols[:100], "saved_to": "data/nse_symbols.json"}
