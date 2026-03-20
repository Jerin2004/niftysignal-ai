"""
Zerodha Kite Integration
- Login flow with token management
- Real-time quotes for all NSE stocks
- Auto token refresh daily
"""
import os, json, time, logging
from pathlib import Path
from datetime import datetime, date
from dotenv import load_dotenv
try:
    from kiteconnect import KiteConnect
except ImportError:
    KiteConnect = None

load_dotenv()

log = logging.getLogger("zerodha")

API_KEY    = os.getenv("ZERODHA_API_KEY", "")
API_SECRET = os.getenv("ZERODHA_API_SECRET", "")
TOKEN_FILE = Path("data/zerodha_token.json")
DATA_DIR   = Path("data")
DATA_DIR.mkdir(exist_ok=True)

kite = KiteConnect(api_key=API_KEY) if (API_KEY and KiteConnect) else None


def save_token(access_token: str):
    TOKEN_FILE.write_text(json.dumps({
        "access_token": access_token,
        "date": date.today().isoformat()
    }))


def load_token() -> str | None:
    if not TOKEN_FILE.exists():
        return None
    data = json.loads(TOKEN_FILE.read_text())
    if data.get("date") != date.today().isoformat():
        log.info("Zerodha token expired — need fresh login")
        return None
    return data.get("access_token")


def get_login_url() -> str:
    if not kite:
        return ""
    return kite.login_url()


def complete_login(request_token: str) -> str:
    """Exchange request token for access token"""
    if not kite:
        raise Exception("Zerodha API key not configured")
    data = kite.generate_session(request_token, api_secret=API_SECRET)
    access_token = data["access_token"]
    kite.set_access_token(access_token)
    save_token(access_token)
    log.info("Zerodha login successful")
    return access_token


def init_kite() -> bool:
    """Initialize kite with saved token"""
    if not kite:
        return False
    token = load_token()
    if not token:
        return False
    kite.set_access_token(token)
    try:
        kite.profile()
        log.info("Zerodha session active")
        return True
    except Exception as e:
        log.warning(f"Zerodha token invalid: {e}")
        TOKEN_FILE.unlink(missing_ok=True)
        return False


def get_quotes(symbols: list[str]) -> dict:
    """
    Get live quotes for a list of symbols
    symbols should be like ['NSE:RELIANCE', 'NSE:TCS', ...]
    Returns dict with price, change, volume etc
    """
    if not kite:
        return {}
    token = load_token()
    if not token:
        return {}
    try:
        kite.set_access_token(token)
        kite.profile()
    except Exception as e:
        log.error(f"Kite session error: {e}")
        return {}
    try:
        quotes = kite.quote(symbols)
        result = {}
        for sym, q in quotes.items():
            name = sym.replace("NSE:", "")
            result[name] = {
                "price":      q["last_price"],
                "open":       q["ohlc"]["open"],
                "high":       q["ohlc"]["high"],
                "low":        q["ohlc"]["low"],
                "close":      q["ohlc"]["close"],
                "change":     round(q["last_price"] - q["ohlc"]["close"], 2),
                "change_pct": round(((q["last_price"] - q["ohlc"]["close"]) / q["ohlc"]["close"]) * 100, 2),
                "volume":     q["volume"],
                "bid":        q.get("depth", {}).get("buy", [{}])[0].get("price", 0),
                "ask":        q.get("depth", {}).get("sell", [{}])[0].get("price", 0),
                "source":     "zerodha_live",
                "timestamp":  datetime.now().isoformat(),
            }
        return result
    except Exception as e:
        log.error(f"Zerodha quote error: {e}")
        return {}


def get_indices() -> dict:
    """Get live Nifty, BankNifty, Sensex"""
    if not kite:
        return {}
    token = load_token()
    if not token:
        return {}
    try:
        kite.set_access_token(token)
        kite.profile()
    except Exception as e:
        log.error(f"Kite session error: {e}")
        return {}
    try:
        indices = {
            "NSE:NIFTY 50":     "NIFTY50",
            "NSE:NIFTY BANK":   "BANKNIFTY",
            "BSE:SENSEX":       "SENSEX",
            "NSE:INDIA VIX":    "VIX",
        }
        quotes = kite.quote(list(indices.keys()))
        result = {}
        for sym, key in indices.items():
            if sym in quotes:
                q = quotes[sym]
                curr = q["last_price"]
                prev = q["ohlc"]["close"]
                chg  = round(curr - prev, 2)
                result[key] = {
                    "value":      round(curr, 2),
                    "change":     chg,
                    "change_pct": round((chg / prev) * 100, 2) if prev else 0,
                    "direction":  "up" if chg >= 0 else "down",
                    "source":     "zerodha_live",
                }
        result["last_updated"] = datetime.now().isoformat()
        return result
    except Exception as e:
        log.error(f"Zerodha indices error: {e}")
        return {}


def get_all_nse_symbols() -> list[str]:
    """Get full list of NSE instruments"""
    if not kite:
        return []
    token = load_token()
    if not token:
        return []
    kite.set_access_token(token)
    try:
        instruments = kite.instruments("NSE")
        # Filter only EQ (equity) stocks
        symbols = [
            i["tradingsymbol"]
            for i in instruments
            if i["instrument_type"] == "EQ" and i["segment"] == "NSE"
        ]
        # Save to file for reference
        Path("data/nse_symbols.json").write_text(
            json.dumps(sorted(symbols), indent=2)
        )
        log.info(f"Fetched {len(symbols)} NSE symbols")
        return symbols
    except Exception as e:
        log.error(f"Failed to fetch NSE instruments: {e}")
        return []


def is_logged_in() -> bool:
    return load_token() is not None
