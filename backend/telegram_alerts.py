"""
Telegram Alert System for NiftySignal AI
Sends BUY/SELL signal alerts via Telegram bot
"""
import requests
import json
import os
import logging
from datetime import datetime
from pathlib import Path

log = logging.getLogger("telegram_alerts")

TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
SIGNALS_FILE = Path("data/prev_signals.json")

def send_telegram(message: str) -> bool:
    """Send a message via Telegram bot"""
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        log.warning("Telegram not configured — set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID")
        return False
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
        r = requests.post(url, json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message,
            "parse_mode": "HTML",
        }, timeout=10)
        if r.status_code == 200:
            log.info("Telegram alert sent!")
            return True
        else:
            log.warning(f"Telegram failed: {r.status_code} {r.text}")
            return False
    except Exception as e:
        log.warning(f"Telegram error: {e}")
        return False


def format_buy_alert(stock: dict) -> str:
    sym  = stock.get("sym", "")
    name = stock.get("name", "")
    price = stock.get("price", 0)
    entry = stock.get("entry", price)
    sl    = stock.get("stop_loss")
    t1    = stock.get("target1")
    t2    = stock.get("target2")
    t3    = stock.get("target3")
    rsi   = stock.get("rsi")
    conf  = stock.get("confidence", 0)
    sent  = stock.get("sentiment", 0)
    rr    = stock.get("rr_ratio")

    msg = f"""🟢 <b>BUY SIGNAL — {sym}</b>
{name}

💰 <b>Entry:</b> ₹{entry:,.2f}
🛑 <b>Stop Loss:</b> ₹{sl:,.2f} ({round((sl-entry)/entry*100,1)}%)
🎯 <b>Target 1:</b> ₹{t1:,.2f} (+{round((t1-entry)/entry*100,1)}%)
🎯 <b>Target 2:</b> ₹{t2:,.2f} (+{round((t2-entry)/entry*100,1)}%)
🎯 <b>Target 3:</b> ₹{t3:,.2f} (+{round((t3-entry)/entry*100,1)}%)

📊 RSI: {rsi} | Sentiment: {round(sent*100)}%
⚡ Confidence: {round(conf*100)}% | R:R: 1:{rr}

⏰ {datetime.now().strftime('%d %b %Y %H:%M IST')}
🔗 niftysignal-ai-6f1a.vercel.app"""
    return msg


def format_sell_alert(stock: dict) -> str:
    sym  = stock.get("sym", "")
    name = stock.get("name", "")
    price = stock.get("price", 0)
    entry = stock.get("entry", price)
    sl    = stock.get("stop_loss")
    t1    = stock.get("target1")
    t2    = stock.get("target2")
    rsi   = stock.get("rsi")
    conf  = stock.get("confidence", 0)
    sent  = stock.get("sentiment", 0)

    msg = f"""🔴 <b>SELL SIGNAL — {sym}</b>
{name}

💰 <b>Entry (Short):</b> ₹{entry:,.2f}
🛑 <b>Stop Loss:</b> ₹{sl:,.2f}
🎯 <b>Target 1:</b> ₹{t1:,.2f} (-{round((entry-t1)/entry*100,1)}%)
🎯 <b>Target 2:</b> ₹{t2:,.2f} (-{round((entry-t2)/entry*100,1)}%)

📊 RSI: {rsi} | Sentiment: {round(sent*100)}%
⚡ Confidence: {round(conf*100)}%

⏰ {datetime.now().strftime('%d %b %Y %H:%M IST')}
🔗 niftysignal-ai-6f1a.vercel.app"""
    return msg


def format_market_open() -> str:
    return """🔔 <b>Market Open — NiftySignal AI</b>

NSE market is now open (9:15 AM IST)
Monitoring 54 stocks for BUY/SELL signals...

You'll receive alerts when signals trigger.

🔗 niftysignal-ai-6f1a.vercel.app"""


def format_daily_summary(stocks: list) -> str:
    buys  = [s for s in stocks if s.get("signal") == "BUY" and not s.get("error")]
    sells = [s for s in stocks if s.get("signal") == "SELL" and not s.get("error")]
    holds = [s for s in stocks if s.get("signal") == "HOLD" and not s.get("error")]

    buy_list  = "\n".join([f"  • {s['sym']} ₹{s.get('price',0):,.0f} (RSI:{s.get('rsi','—')})" for s in buys[:5]])
    sell_list = "\n".join([f"  • {s['sym']} ₹{s.get('price',0):,.0f} (RSI:{s.get('rsi','—')})" for s in sells[:5]])

    msg = f"""📊 <b>NiftySignal AI — Daily Summary</b>
{datetime.now().strftime('%d %b %Y')}

🟢 BUY signals: {len(buys)}
{buy_list if buy_list else '  None'}

🔴 SELL signals: {len(sells)}
{sell_list if sell_list else '  None'}

🟡 HOLD: {len(holds)}

🔗 niftysignal-ai-6f1a.vercel.app"""
    return msg


def load_prev_signals() -> dict:
    """Load previously seen signals to detect changes"""
    try:
        if SIGNALS_FILE.exists():
            return json.loads(SIGNALS_FILE.read_text())
    except:
        pass
    return {}


def save_prev_signals(signals: dict):
    """Save current signals for comparison next time"""
    try:
        SIGNALS_FILE.parent.mkdir(exist_ok=True)
        SIGNALS_FILE.write_text(json.dumps(signals))
    except Exception as e:
        log.warning(f"Could not save signals: {e}")


def check_and_alert(stocks: list):
    """
    Compare current signals with previous signals.
    Send Telegram alert if any stock changed to BUY or SELL.
    """
    if not stocks:
        return

    prev = load_prev_signals()
    curr = {s["sym"]: s["signal"] for s in stocks if not s.get("error") and s.get("signal")}
    alerts_sent = 0

    for sym, signal in curr.items():
        old_signal = prev.get(sym)
        if old_signal and old_signal != signal:
            # Signal changed!
            stock = next((s for s in stocks if s.get("sym") == sym), None)
            if not stock:
                continue
            if signal == "BUY" and stock.get("entry") and stock.get("stop_loss"):
                msg = format_buy_alert(stock)
                if send_telegram(msg):
                    alerts_sent += 1
                    log.info(f"BUY alert sent for {sym}")
            elif signal == "SELL" and stock.get("entry") and stock.get("stop_loss"):
                msg = format_sell_alert(stock)
                if send_telegram(msg):
                    alerts_sent += 1
                    log.info(f"SELL alert sent for {sym}")

    save_prev_signals(curr)
    if alerts_sent:
        log.info(f"Sent {alerts_sent} Telegram alerts")


def send_market_open_alert():
    send_telegram(format_market_open())


def send_daily_summary(stocks: list):
    if stocks:
        send_telegram(format_daily_summary(stocks))
