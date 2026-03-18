"""
Trading Engine — Target price, Stop loss, Risk/Reward, Paper trading tracker
"""
import json, math, time
from datetime import datetime, date
from pathlib import Path

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
PAPER_FILE = DATA_DIR / "paper_trades.json"
HISTORY_FILE = DATA_DIR / "signal_history.json"


def calc_atr(high, low, close, period=14):
    """Average True Range — measures volatility"""
    tr_list = []
    for i in range(1, len(close)):
        tr = max(
            high.iloc[i] - low.iloc[i],
            abs(high.iloc[i] - close.iloc[i-1]),
            abs(low.iloc[i] - close.iloc[i-1])
        )
        tr_list.append(tr)
    if len(tr_list) < period:
        return None
    atr = sum(tr_list[-period:]) / period
    return round(atr, 2)


def calc_support_resistance(close, high, low, lookback=20):
    """Find recent support and resistance levels"""
    recent_high = float(high.rolling(lookback).max().iloc[-1])
    recent_low  = float(low.rolling(lookback).min().iloc[-1])
    curr        = float(close.iloc[-1])

    # Resistance levels above current price
    resistance = round(recent_high, 2)

    # Support levels below current price
    support = round(recent_low, 2)

    return support, resistance


def calc_trade_levels(curr_price, signal, atr, support, resistance):
    """
    Calculate entry, target, stop loss based on signal direction
    Returns dict with full trade plan
    """
    if atr is None or atr == 0:
        atr = curr_price * 0.015  # fallback: 1.5% of price

    if signal == "BUY":
        entry      = round(curr_price, 2)
        stop_loss  = round(curr_price - (1.5 * atr), 2)
        target1    = round(curr_price + (2.0 * atr), 2)
        target2    = round(curr_price + (3.5 * atr), 2)
        target3    = round(min(resistance, curr_price + (5.0 * atr)), 2)
        risk       = round(entry - stop_loss, 2)
        reward1    = round(target1 - entry, 2)
        rr_ratio   = round(reward1 / risk, 2) if risk > 0 else 0
        direction  = "LONG"

    elif signal == "SELL":
        entry      = round(curr_price, 2)
        stop_loss  = round(curr_price + (1.5 * atr), 2)
        target1    = round(curr_price - (2.0 * atr), 2)
        target2    = round(curr_price - (3.5 * atr), 2)
        target3    = round(max(support, curr_price - (5.0 * atr)), 2)
        risk       = round(stop_loss - entry, 2)
        reward1    = round(entry - target1, 2)
        rr_ratio   = round(reward1 / risk, 2) if risk > 0 else 0
        direction  = "SHORT"

    else:  # HOLD
        return {
            "signal": "HOLD",
            "direction": "NEUTRAL",
            "entry": curr_price,
            "stop_loss": None,
            "target1": None,
            "target2": None,
            "target3": None,
            "risk": None,
            "reward": None,
            "rr_ratio": None,
            "atr": round(atr, 2),
            "support": support,
            "resistance": resistance,
            "trade_quality": "SKIP",
            "note": "No clear signal — wait for confirmation"
        }

    # Trade quality based on R:R ratio
    if rr_ratio >= 2.5:
        quality = "EXCELLENT"
        quality_note = "Strong setup — R:R above 2.5"
    elif rr_ratio >= 1.5:
        quality = "GOOD"
        quality_note = "Decent setup — R:R above 1.5"
    elif rr_ratio >= 1.0:
        quality = "FAIR"
        quality_note = "Marginal setup — consider waiting"
    else:
        quality = "POOR"
        quality_note = "Bad R:R — skip this trade"

    return {
        "signal": signal,
        "direction": direction,
        "entry": entry,
        "stop_loss": stop_loss,
        "target1": target1,
        "target2": target2,
        "target3": target3,
        "risk_per_share": risk,
        "reward_per_share": reward1,
        "rr_ratio": rr_ratio,
        "atr": round(atr, 2),
        "support": support,
        "resistance": resistance,
        "trade_quality": quality,
        "note": quality_note,
        "stop_loss_pct": round((abs(entry - stop_loss) / entry) * 100, 2),
        "target1_pct": round((abs(target1 - entry) / entry) * 100, 2),
    }


def calc_position_size(capital, entry, stop_loss, risk_pct=1.0):
    """
    How many shares to buy based on capital and risk tolerance
    Default: risk only 1% of capital per trade
    """
    risk_amount = capital * (risk_pct / 100)
    risk_per_share = abs(entry - stop_loss)
    if risk_per_share == 0:
        return 0
    qty = math.floor(risk_amount / risk_per_share)
    total_cost = round(qty * entry, 2)
    return {
        "quantity": qty,
        "total_cost": total_cost,
        "risk_amount": round(risk_amount, 2),
        "risk_pct": risk_pct,
        "capital_used_pct": round((total_cost / capital) * 100, 2)
    }


# ── Paper Trading Tracker ─────────────────────────────────────────────────────

def load_paper_trades():
    if PAPER_FILE.exists():
        with open(PAPER_FILE) as f:
            return json.load(f)
    return {"trades": [], "summary": {"total": 0, "wins": 0, "losses": 0, "open": 0, "pnl": 0}}


def save_paper_trades(data):
    with open(PAPER_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)


def open_paper_trade(sym, signal, entry, stop_loss, target1, target2, qty, notes=""):
    data = load_paper_trades()
    trade_id = f"{sym}_{int(time.time())}"
    trade = {
        "id": trade_id,
        "sym": sym,
        "signal": signal,
        "direction": "LONG" if signal == "BUY" else "SHORT",
        "entry": entry,
        "stop_loss": stop_loss,
        "target1": target1,
        "target2": target2,
        "qty": qty,
        "status": "OPEN",
        "opened_at": datetime.now().isoformat(),
        "closed_at": None,
        "exit_price": None,
        "exit_reason": None,
        "pnl": None,
        "pnl_pct": None,
        "notes": notes
    }
    data["trades"].append(trade)
    data["summary"]["total"] += 1
    data["summary"]["open"] += 1
    save_paper_trades(data)
    return trade


def close_paper_trade(trade_id, exit_price, exit_reason="manual"):
    data = load_paper_trades()
    for trade in data["trades"]:
        if trade["id"] == trade_id and trade["status"] == "OPEN":
            trade["status"] = "CLOSED"
            trade["closed_at"] = datetime.now().isoformat()
            trade["exit_price"] = exit_price
            trade["exit_reason"] = exit_reason

            if trade["direction"] == "LONG":
                pnl = (exit_price - trade["entry"]) * trade["qty"]
                pnl_pct = ((exit_price - trade["entry"]) / trade["entry"]) * 100
            else:
                pnl = (trade["entry"] - exit_price) * trade["qty"]
                pnl_pct = ((trade["entry"] - exit_price) / trade["entry"]) * 100

            trade["pnl"] = round(pnl, 2)
            trade["pnl_pct"] = round(pnl_pct, 2)

            data["summary"]["open"] = max(0, data["summary"]["open"] - 1)
            data["summary"]["pnl"] = round(data["summary"]["pnl"] + pnl, 2)
            if pnl >= 0:
                data["summary"]["wins"] += 1
            else:
                data["summary"]["losses"] += 1
            break

    save_paper_trades(data)
    return data


def get_paper_summary():
    data = load_paper_trades()
    trades = data["trades"]
    closed = [t for t in trades if t["status"] == "CLOSED"]
    wins = [t for t in closed if (t["pnl"] or 0) >= 0]
    win_rate = round(len(wins) / len(closed) * 100, 1) if closed else 0
    avg_win  = round(sum(t["pnl"] for t in wins) / len(wins), 2) if wins else 0
    losses_t = [t for t in closed if (t["pnl"] or 0) < 0]
    avg_loss = round(sum(t["pnl"] for t in losses_t) / len(losses_t), 2) if losses_t else 0
    expectancy = round((win_rate/100 * avg_win) + ((1-win_rate/100) * avg_loss), 2) if closed else 0

    return {
        **data["summary"],
        "closed": len(closed),
        "win_rate": win_rate,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "expectancy": expectancy,
        "trades": trades[-20:]  # last 20 trades
    }
