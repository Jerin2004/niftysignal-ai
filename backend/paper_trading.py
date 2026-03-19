"""
Paper Trading - Clean implementation
Track trades, P&L, win rate
"""
import json, time, math
from datetime import datetime
from pathlib import Path

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
TRADES_FILE = DATA_DIR / "paper_trades.json"


def load_trades() -> dict:
    if TRADES_FILE.exists():
        with open(TRADES_FILE) as f:
            data = json.load(f)
        # Fix old format that doesn't have next_id
        if "next_id" not in data:
            data["next_id"] = len(data.get("trades", [])) + 1
        if "trades" not in data:
            data["trades"] = []
        return data
    return {"trades": [], "next_id": 1}


def save_trades(data: dict):
    with open(TRADES_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)


def add_trade(sym: str, signal: str, entry: float, stop_loss: float,
              target1: float, target2: float, qty: int, notes: str = "") -> dict:
    data = load_trades()
    trade = {
        "id":         data["next_id"],
        "sym":        sym.upper(),
        "signal":     signal,
        "direction":  "LONG" if signal == "BUY" else "SHORT",
        "entry":      round(entry, 2),
        "stop_loss":  round(stop_loss, 2),
        "target1":    round(target1, 2),
        "target2":    round(target2, 2),
        "qty":        qty,
        "status":     "OPEN",
        "opened_at":  datetime.now().isoformat(),
        "closed_at":  None,
        "exit_price": None,
        "exit_reason":None,
        "pnl":        None,
        "pnl_pct":    None,
        "notes":      notes,
    }
    data["trades"].append(trade)
    data["next_id"] += 1
    save_trades(data)
    return trade


def close_trade(trade_id: int, exit_price: float, notes: str = "manual") -> dict:
    data = load_trades()
    for trade in data["trades"]:
        if trade["id"] == trade_id and trade["status"] == "OPEN":
            trade["status"]     = "CLOSED"
            trade["closed_at"]  = datetime.now().isoformat()
            trade["exit_price"] = round(exit_price, 2)
            trade["exit_reason"]= notes

            if trade["direction"] == "LONG":
                pnl     = (exit_price - trade["entry"]) * trade["qty"]
                pnl_pct = ((exit_price - trade["entry"]) / trade["entry"]) * 100
            else:
                pnl     = (trade["entry"] - exit_price) * trade["qty"]
                pnl_pct = ((trade["entry"] - exit_price) / trade["entry"]) * 100

            trade["pnl"]     = round(pnl, 2)
            trade["pnl_pct"] = round(pnl_pct, 2)
            break

    save_trades(data)
    return data


def get_stats() -> dict:
    data  = load_trades()
    trades = data["trades"]
    closed = [t for t in trades if t["status"] == "CLOSED"]
    open_t = [t for t in trades if t["status"] == "OPEN"]
    wins   = [t for t in closed if (t["pnl"] or 0) > 0]
    losses = [t for t in closed if (t["pnl"] or 0) <= 0]

    total_pnl  = round(sum(t["pnl"] for t in closed), 2)
    win_rate   = round(len(wins) / len(closed) * 100, 1) if closed else 0
    avg_win    = round(sum(t["pnl"] for t in wins) / len(wins), 2) if wins else 0
    avg_loss   = round(sum(t["pnl"] for t in losses) / len(losses), 2) if losses else 0
    expectancy = round((win_rate/100 * avg_win) + ((1 - win_rate/100) * avg_loss), 2) if closed else 0

    return {
        "total_trades": len(trades),
        "open":         len(open_t),
        "closed":       len(closed),
        "wins":         len(wins),
        "losses":       len(losses),
        "win_rate":     win_rate,
        "total_pnl":    total_pnl,
        "avg_win":      avg_win,
        "avg_loss":     avg_loss,
        "expectancy":   expectancy,
        "trades":       sorted(trades, key=lambda x: x["id"], reverse=True),
    }


def delete_trade(trade_id: int) -> bool:
    data = load_trades()
    before = len(data["trades"])
    data["trades"] = [t for t in data["trades"] if t["id"] != trade_id]
    save_trades(data)
    return len(data["trades"]) < before
