import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API =
  import.meta.env.VITE_API_URL ||
  "https://nifty-ai-production.up.railway.app/api";

// ── Global styles injected into document ─────────────────────────────────────
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: #080b0f; color: #c9d1d9; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #0d1117; }
  ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes slideIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes flash { 0%{background:#1a3a2a} 100%{background:transparent} }
  .row-flash { animation: flash 1s ease-out; }
  .mono { font-family: 'JetBrains Mono', monospace; }
`;
if (!document.getElementById("ns-styles")) {
  const s = document.createElement("style");
  s.id = "ns-styles";
  s.textContent = globalCSS;
  document.head.appendChild(s);
}

const T = {
  bg: "#080b0f",
  bgCard: "#0d1117",
  bgHover: "#161b22",
  bgInput: "#161b22",
  border: "#21262d",
  border2: "#30363d",
  text: "#e6edf3",
  text2: "#8b949e",
  text3: "#484f58",
  green: "#3fb950",
  greenBg: "#0d2b1a",
  greenBd: "#1a4a2e",
  red: "#f85149",
  redBg: "#2b0d0d",
  redBd: "#4a1a1a",
  amber: "#d29922",
  amberBg: "#2b2000",
  blue: "#58a6ff",
  blueBg: "#0d2240",
  purple: "#a371f7",
  accent: "#238636",
};

const S = {
  app: {
    minHeight: "100vh",
    background: T.bg,
    color: T.text,
    fontFamily: "'Inter',sans-serif",
  },
  nav: {
    background: "rgba(13,17,23,0.95)",
    backdropFilter: "blur(12px)",
    borderBottom: `1px solid ${T.border}`,
    padding: "0 24px",
    display: "flex",
    alignItems: "center",
    height: 52,
    gap: 0,
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  logo: {
    fontSize: 15,
    fontWeight: 600,
    color: T.text,
    letterSpacing: "-0.3px",
    marginRight: 32,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: T.green,
    animation: "pulse 2s infinite",
  },
  navBtn: (a) => ({
    padding: "0 16px",
    height: 52,
    fontSize: 13,
    fontWeight: a ? 500 : 400,
    color: a ? T.text : T.text2,
    cursor: "pointer",
    border: "none",
    background: "none",
    borderBottom: a ? `2px solid ${T.green}` : "2px solid transparent",
    transition: "all .15s",
    whiteSpace: "nowrap",
  }),
  main: { padding: "16px 24px", maxWidth: 1600, margin: "0 auto" },
  grid4: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 10,
    marginBottom: 16,
  },
  metric: {
    background: T.bgCard,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "12px 16px",
    position: "relative",
    overflow: "hidden",
  },
  metricAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    background: `linear-gradient(90deg, ${T.green}, transparent)`,
  },
  mLabel: {
    fontSize: 10,
    color: T.text3,
    textTransform: "uppercase",
    letterSpacing: ".08em",
    marginBottom: 6,
    fontWeight: 500,
  },
  mVal: {
    fontSize: 22,
    fontWeight: 600,
    color: T.text,
    fontFamily: "'JetBrains Mono',monospace",
    letterSpacing: "-0.5px",
  },
  mSub: {
    fontSize: 11,
    marginTop: 4,
    fontFamily: "'JetBrains Mono',monospace",
  },
  card: {
    background: T.bgCard,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  secTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: T.text3,
    textTransform: "uppercase",
    letterSpacing: ".1em",
    marginBottom: 12,
  },
  tHead: {
    display: "grid",
    gridTemplateColumns: "76px 1fr 82px 82px 52px 100px 108px",
    gap: 8,
    padding: "6px 12px",
    fontSize: 10,
    color: T.text3,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: ".06em",
    borderBottom: `1px solid ${T.border}`,
    background: "rgba(22,27,34,0.5)",
  },
  tRow: {
    display: "grid",
    gridTemplateColumns: "76px 1fr 82px 82px 52px 100px 108px",
    gap: 8,
    padding: "9px 12px",
    fontSize: 12,
    borderBottom: `1px solid rgba(33,38,45,0.5)`,
    cursor: "pointer",
    alignItems: "center",
    transition: "background .1s",
  },
  btn: {
    background: T.accent,
    color: "#fff",
    border: `1px solid ${T.green}`,
    borderRadius: 6,
    padding: "7px 16px",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all .15s",
  },
  btnSm: {
    background: "transparent",
    color: T.text2,
    border: `1px solid ${T.border2}`,
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 11,
    cursor: "pointer",
    transition: "all .15s",
  },
  btnOutline: {
    background: "transparent",
    color: T.text2,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 12,
    cursor: "pointer",
  },
  input: {
    background: T.bgInput,
    border: `1px solid ${T.border2}`,
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12,
    color: T.text,
    outline: "none",
    fontFamily: "'Inter',sans-serif",
  },
  select: {
    background: T.bgInput,
    border: `1px solid ${T.border2}`,
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12,
    color: T.text,
    outline: "none",
    fontFamily: "'Inter',sans-serif",
  },
};

const pill = (type) => {
  const m = {
    BUY: [T.greenBg, T.green, T.greenBd],
    SELL: [T.redBg, T.red, T.redBd],
    HOLD: [T.amberBg, T.amber, "#3d2e00"],
    CALL: [T.blueBg, T.blue, "#1a3a5c"],
    PUT: [T.redBg, "#f472b6", T.redBd],
    NEUTRAL: ["#161b22", T.text3, T.border],
    OPEN: [T.blueBg, T.blue, "#1a3a5c"],
    CLOSED: ["#161b22", T.text3, T.border],
  };
  const [bg, color, bd] = m[type] || m.NEUTRAL;
  return (
    <span
      style={{
        background: bg,
        color,
        border: `1px solid ${bd}`,
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 4,
        display: "inline-block",
        letterSpacing: ".04em",
      }}
    >
      {type}
    </span>
  );
};

const fmt = (v, d = 2) =>
  v != null
    ? (+v).toLocaleString("en-IN", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      })
    : "—";
const fmtPct = (v) =>
  v != null ? `${v >= 0 ? "+" : ""}${(+v).toFixed(2)}%` : "—";
const cc = (v) => (v >= 0 ? T.green : T.red);
const Spinner = () => (
  <div
    style={{ textAlign: "center", padding: 40, color: T.text3, fontSize: 13 }}
  >
    <div
      style={{
        width: 20,
        height: 20,
        border: `2px solid ${T.border2}`,
        borderTopColor: T.green,
        borderRadius: "50%",
        animation: "spin .7s linear infinite",
        margin: "0 auto 12px",
        display: "block",
      }}
    />
    Loading...
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);
const SentBar = ({ val }) => {
  const c = val > 0.65 ? T.green : val < 0.4 ? T.red : T.amber;
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: T.text3,
          marginBottom: 2,
          fontFamily: "'JetBrains Mono',monospace",
        }}
      >
        {Math.round(val * 100)}%
      </div>
      <div
        style={{
          height: 3,
          background: T.border,
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.round(val * 100)}%`,
            height: "100%",
            background: c,
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
};

// ── Market Banner ─────────────────────────────────────────────────────────────
function MarketBanner({ data }) {
  const now = new Date();
  const ist = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const h = ist.getHours(),
    m = ist.getMinutes();
  const isOpen =
    (h > 9 || (h === 9 && m >= 15)) && (h < 15 || (h === 15 && m <= 30));
  const timeStr = ist.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: isOpen ? T.green : T.red,
              animation: isOpen ? "pulse 2s infinite" : "none",
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: isOpen ? T.green : T.red,
              fontWeight: 500,
            }}
          >
            {isOpen ? "MARKET OPEN" : "MARKET CLOSED"}
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            color: T.text3,
            fontFamily: "'JetBrains Mono',monospace",
          }}
        >
          {timeStr} IST
        </span>
        {data?.source && (
          <span
            style={{
              fontSize: 10,
              color: T.text3,
              marginLeft: "auto",
              background: T.bgCard,
              border: `1px solid ${T.border}`,
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            {data.source === "scheduler_cache" ? "cached" : "live"}
          </span>
        )}
      </div>
      <div style={S.grid4}>
        {[
          ["NIFTY50", "Nifty 50"],
          ["BANKNIFTY", "Bank Nifty"],
          ["SENSEX", "Sensex"],
          ["VIX", "India VIX"],
        ].map(([k, l]) => {
          const d = data?.[k];
          if (!d)
            return (
              <div key={k} style={S.metric}>
                <div style={S.mLabel}>{l}</div>
                <div style={{ ...S.mVal, color: T.text3 }}>—</div>
              </div>
            );
          const isUp = d.change_pct >= 0;
          return (
            <div
              key={k}
              style={{ ...S.metric, borderColor: isUp ? T.greenBd : T.redBd }}
            >
              <div
                style={{
                  ...S.metricAccent,
                  background: `linear-gradient(90deg,${isUp ? T.green : T.red},transparent)`,
                }}
              />
              <div style={S.mLabel}>{l}</div>
              <div style={S.mVal}>{d.value ? fmt(d.value, 0) : "—"}</div>
              <div
                style={{
                  ...S.mSub,
                  color: cc(d.change_pct),
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <span>{isUp ? "▲" : "▼"}</span>
                <span>{fmtPct(d.change_pct)}</span>
                <span style={{ color: T.text3 }}>
                  ({fmt(Math.abs(d.change), 0)})
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stocks Table ──────────────────────────────────────────────────────────────
function StocksTable({ onSelect }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sector, setSector] = useState("");
  const [sort, setSort] = useState("signal");
  const [search, setSearch] = useState("");
  const [lastSignals, setLastSignals] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [nextRefresh, setNextRefresh] = useState(300);

  const loadStocks = (force = false) => {
    const url = force ? `${API}/stocks?force_refresh=true` : `${API}/stocks`;
    if (force) setLoading(true);
    axios
      .get(url)
      .then((r) => {
        const newStocks = r.data.stocks || r.data;
        setStocks((prev) => {
          const newAlerts = [];
          newStocks.forEach((s) => {
            const oldSig = prev.find((p) => p.sym === s.sym)?.signal;
            if (oldSig && oldSig !== s.signal && s.signal !== "HOLD") {
              newAlerts.push({
                sym: s.sym,
                from: oldSig,
                to: s.signal,
                price: s.price,
                time: new Date().toLocaleTimeString("en-IN"),
              });
            }
          });
          if (newAlerts.length) {
            setAlerts((a) => [...newAlerts, ...a].slice(0, 5));
            if (
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              newAlerts.forEach(
                (a) =>
                  new Notification(`NiftySignal: ${a.sym} → ${a.to}`, {
                    body: `Price ₹${a.price} | Signal changed to ${a.to}`,
                  }),
              );
            }
          }
          return newStocks;
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadStocks();
    if ("Notification" in window) Notification.requestPermission();
    const interval = setInterval(() => {
      setNextRefresh((n) => {
        if (n <= 1) {
          loadStocks();
          return 300;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const sigOrd = { BUY: 0, HOLD: 1, SELL: 2 };
  const filtered = stocks
    .filter(
      (s) =>
        (!search ||
          s.sym?.includes(search.toUpperCase()) ||
          s.name?.toLowerCase().includes(search.toLowerCase())) &&
        (!sector || s.sector === sector),
    )
    .sort((a, b) =>
      sort === "signal"
        ? (sigOrd[a.signal] ?? 1) - (sigOrd[b.signal] ?? 1)
        : sort === "change_pct"
          ? (b.change_pct || 0) - (a.change_pct || 0)
          : sort === "sentiment"
            ? (b.sentiment || 0) - (a.sentiment || 0)
            : (a.rsi || 50) - (b.rsi || 50),
    );

  const buys = stocks.filter((s) => s.signal === "BUY").length,
    sells = stocks.filter((s) => s.signal === "SELL").length;

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 14,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          style={{ ...S.input, width: 160 }}
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={S.select}
          value={sector}
          onChange={(e) => setSector(e.target.value)}
        >
          <option value="">All sectors</option>
          {[
            "Banking",
            "IT",
            "Energy",
            "FMCG",
            "Auto",
            "Pharma",
            "Finance",
            "Infra",
            "Consumer",
            "Conglomerate",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          style={S.select}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="signal">Sort: Signal</option>
          <option value="change_pct">Sort: Change</option>
          <option value="sentiment">Sort: Sentiment</option>
          <option value="rsi">Sort: RSI</option>
        </select>
        <button style={S.btnSm} onClick={() => loadStocks(true)}>
          ↺ Refresh
        </button>
        <span style={{ fontSize: 11, color: "#555" }}>
          Auto-refresh in {nextRefresh}s
        </span>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
          <span style={{ color: "#22c55e", fontWeight: 600 }}>{buys} BUY</span>{" "}
          ·{" "}
          <span style={{ color: "#ef4444", fontWeight: 600 }}>
            {sells} SELL
          </span>{" "}
          ·{" "}
          <span style={{ color: "#f59e0b", fontWeight: 600 }}>
            {stocks.length - buys - sells} HOLD
          </span>
        </div>
      </div>
      {alerts.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {alerts.map((a, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 14px",
                borderRadius: 8,
                marginBottom: 6,
                background: a.to === "BUY" ? "#0d2b1a" : "#2b0d0d",
                border: `1px solid ${a.to === "BUY" ? "#22c55e" : "#ef4444"}`,
              }}
            >
              <span style={{ fontSize: 16 }}>🔔</span>
              <span style={{ fontWeight: 700, color: "#fff" }}>{a.sym}</span>
              <span style={{ color: "#888", fontSize: 13 }}>
                signal changed to
              </span>
              <span
                style={{
                  fontWeight: 700,
                  color: a.to === "BUY" ? "#22c55e" : "#ef4444",
                  fontSize: 15,
                }}
              >
                {a.to}
              </span>
              <span style={{ color: "#888", fontSize: 13 }}>at ₹{a.price}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#555" }}>
                {a.time}
              </span>
              <button
                style={{ ...S.btnSm, padding: "2px 8px", fontSize: 11 }}
                onClick={() => onSelect(a.sym)}
              >
                View →
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={S.card}>
        <div style={S.tHead}>
          <span>Symbol</span>
          <span>Company</span>
          <span>Price</span>
          <span>Change</span>
          <span>RSI</span>
          <span>Sentiment</span>
          <span>Signal</span>
        </div>
        {loading ? (
          <Spinner />
        ) : (
          filtered.map((s) => (
            <div
              key={s.sym}
              style={S.tRow}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = T.bgHover)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
              onClick={() => onSelect(s.sym)}
            >
              <span
                style={{
                  fontWeight: 600,
                  color: T.text,
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 12,
                }}
              >
                {s.sym}
              </span>
              <span
                style={{
                  color: T.text2,
                  fontSize: 11,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.name}
              </span>
              <span
                style={{
                  color: T.text,
                  fontWeight: 500,
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 12,
                }}
              >
                ₹{fmt(s.price)}
              </span>
              <span
                style={{
                  color: cc(s.change_pct),
                  fontWeight: 500,
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 12,
                }}
              >
                {fmtPct(s.change_pct)}
              </span>
              <span
                style={{
                  color: s.rsi > 65 ? T.red : s.rsi < 35 ? T.green : T.text3,
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 12,
                }}
              >
                {s.rsi ?? "—"}
              </span>
              <SentBar val={s.sentiment ?? 0.5} />
              <div style={{ display: "flex", gap: 4 }}>
                {pill(s.signal)}
                {pill(s.opt_rec)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Stock Detail ──────────────────────────────────────────────────────────────
function StockDetail({ symbol, onBack, onAddTrade }) {
  const [data, setData] = useState(null);
  const [tradePlan, setTradePlan] = useState(null);
  const [chart, setChart] = useState([]);
  const [period, setPeriod] = useState("3mo");
  const [loading, setLoading] = useState(true);
  const [addMsg, setAddMsg] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      axios.get(`${API}/stock/${symbol}`),
      axios.get(`${API}/chart/${symbol}?period=3mo`),
      axios.get(`${API}/trade-plan/${symbol}?capital=100000`),
    ])
      .then(([dr, cr, tr]) => {
        setData(dr.data);
        setChart(cr.data.data || []);
        setTradePlan(tr.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [symbol]);

  useEffect(() => {
    axios
      .get(`${API}/chart/${symbol}?period=${period}`)
      .then((r) => setChart(r.data.data || []))
      .catch(() => {});
  }, [symbol, period]);

  if (loading) return <Spinner />;
  if (!data)
    return <div style={{ color: "#888", padding: 20 }}>Failed to load</div>;
  const chartColor = data.change_pct >= 0 ? "#22c55e" : "#ef4444";
  const hasSignal = data.signal === "BUY" || data.signal === "SELL";

  return (
    <div>
      <button style={S.btnSm} onClick={onBack}>
        ← Back
      </button>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          margin: "16px 0",
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>
            {data.sym}
          </div>
          <div style={{ color: "#888", fontSize: 14 }}>
            {data.name} · {data.sector}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#fff" }}>
            ₹{fmt(data.price)}
          </div>
          <div style={{ color: cc(data.change_pct), fontWeight: 600 }}>
            {fmtPct(data.change_pct)}
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6,1fr)",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {[
          ["RSI (14)", data.rsi],
          ["52W High", data.week_high ? "₹" + fmt(data.week_high, 0) : "—"],
          ["52W Low", data.week_low ? "₹" + fmt(data.week_low, 0) : "—"],
          ["P/E", data.pe_ratio ? fmt(data.pe_ratio) : "—"],
          ["Beta", data.beta ? fmt(data.beta) : "—"],
          [
            "Sentiment",
            data.sentiment ? Math.round(data.sentiment * 100) + "%" : "—",
          ],
        ].map(([l, v]) => (
          <div key={l} style={S.metric}>
            <div style={S.mLabel}>{l}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
              {v ?? "—"}
            </div>
          </div>
        ))}
      </div>

      {/* Trade setup box */}
      {hasSignal && tradePlan && (
        <div
          style={{
            ...S.card,
            border: `1px solid ${data.signal === "BUY" ? "#22c55e" : "#ef4444"}`,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>
              Trade setup — {data.sym}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {pill(data.signal)}
              <span style={{ fontSize: 12, color: "#666" }}>
                Confidence: {Math.round((tradePlan.confidence || 0) * 100)}% ·
                R:R = {tradePlan.rr_ratio ?? "—"} · Quality:{" "}
                <span
                  style={{
                    color:
                      tradePlan.trade_quality === "EXCELLENT"
                        ? "#22c55e"
                        : tradePlan.trade_quality === "GOOD"
                          ? "#60a5fa"
                          : "#f59e0b",
                  }}
                >
                  {tradePlan.trade_quality}
                </span>
              </span>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5,1fr)",
              gap: 10,
              marginBottom: 14,
            }}
          >
            {[
              [
                "Entry price",
                "#fff",
                tradePlan.entry ? "₹" + fmt(tradePlan.entry) : "—",
              ],
              [
                "Stop loss",
                "#ef4444",
                tradePlan.stop_loss ? "₹" + fmt(tradePlan.stop_loss) : "—",
              ],
              [
                "Target 1",
                "#22c55e",
                tradePlan.target1 ? "₹" + fmt(tradePlan.target1) : "—",
              ],
              [
                "Target 2",
                "#22c55e",
                tradePlan.target2 ? "₹" + fmt(tradePlan.target2) : "—",
              ],
              [
                "Target 3",
                "#60a5fa",
                tradePlan.target3 ? "₹" + fmt(tradePlan.target3) : "—",
              ],
            ].map(([l, c, v]) => (
              <div
                key={l}
                style={{ background: "#1e1e28", borderRadius: 8, padding: 12 }}
              >
                <div style={{ fontSize: 11, color: "#666", marginBottom: 6 }}>
                  {l}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: c }}>
                  {v}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 10,
              marginBottom: 14,
            }}
          >
            {[
              [
                "Risk/share",
                "#ef4444",
                tradePlan.risk_per_share
                  ? "₹" + fmt(tradePlan.risk_per_share)
                  : "—",
              ],
              [
                "Reward/share",
                "#22c55e",
                tradePlan.reward_per_share
                  ? "₹" + fmt(tradePlan.reward_per_share)
                  : "—",
              ],
              [
                "Qty (1% risk)",
                "#fff",
                tradePlan.position_sizing?.quantity ?? "—",
              ],
              [
                "Total cost",
                "#aaa",
                tradePlan.position_sizing?.total_cost
                  ? "₹" + fmt(tradePlan.position_sizing.total_cost, 0)
                  : "—",
              ],
            ].map(([l, c, v]) => (
              <div
                key={l}
                style={{ background: "#1e1e28", borderRadius: 8, padding: 12 }}
              >
                <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
                  {l}
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: c }}>
                  {v}
                </div>
              </div>
            ))}
          </div>
          <button
            style={{
              ...S.btn,
              opacity: tradePlan && tradePlan.stop_loss ? 1 : 0.5,
            }}
            onClick={async () => {
              if (!tradePlan || !tradePlan.stop_loss) {
                setAddMsg("No trade plan available");
                return;
              }
              try {
                await axios.post(`${API}/paper/trades`, {
                  sym: symbol,
                  signal: tradePlan.signal,
                  entry: tradePlan.entry,
                  stop_loss: tradePlan.stop_loss,
                  target1: tradePlan.target1,
                  target2: tradePlan.target2,
                  qty: tradePlan.position_sizing?.quantity || 1,
                  notes: "",
                });
                setAddMsg("✓ Paper trade opened! Check Paper Trading tab");
                setTimeout(() => setAddMsg(""), 4000);
              } catch (e) {
                setAddMsg("Failed — check backend");
              }
            }}
          >
            + Add to paper trades
          </button>
          {addMsg && (
            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                color: addMsg.startsWith("✓") ? "#22c55e" : "#ef4444",
              }}
            >
              {addMsg}
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <span style={S.secTitle}>Price chart</span>
          <div style={{ display: "flex", gap: 6 }}>
            {["1mo", "3mo", "6mo", "1y"].map((p) => (
              <button
                key={p}
                style={{
                  ...S.btnSm,
                  background: period === p ? "#6c63ff" : "transparent",
                  color: period === p ? "#fff" : "#888",
                  border: "none",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 12,
                }}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chart}>
            <defs>
              <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColor} stopOpacity={0.15} />
                <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e28" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#666" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#666" }}
              tickLine={false}
              tickFormatter={(v) => `₹${Math.round(v)}`}
              width={70}
            />
            <Tooltip
              contentStyle={{
                background: "#1e1e28",
                border: "1px solid #2a2a38",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v) => [`₹${fmt(v)}`, "Close"]}
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke={chartColor}
              strokeWidth={2}
              fill="url(#cg)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          fontSize: 11,
          color: "#444",
          padding: "10px 0",
          borderTop: "1px solid #2a2a38",
        }}
      >
        Signal methodology: RSI(14) + MACD crossover + EMA20 deviation + news
        sentiment. Stop loss = 1.5×ATR. Targets = 1×ATR and 2×ATR. Not
        SEBI-registered investment advice.
      </div>
    </div>
  );
}

// ── Paper Trading ─────────────────────────────────────────────────────────────
function PaperTrading({ prefill, onClear }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(null);
  const [exitPrice, setExitPrice] = useState("");
  const [msg, setMsg] = useState("");

  const loadStats = useCallback(() => {
    axios
      .get(`${API}/paper/stats`)
      .then((r) => {
        setStats(r.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const closeTrade = async (id) => {
    if (!exitPrice) return;
    try {
      await axios.post(`${API}/paper/trades/${id}/close`, {
        exit_price: parseFloat(exitPrice),
        notes: "Manual close",
      });
      setClosing(null);
      setExitPrice("");
      setMsg("Trade closed!");
      setTimeout(() => setMsg(""), 3000);
      loadStats();
    } catch (e) {
      setMsg("Failed to close trade");
    }
  };

  const deleteTrade = async (id) => {
    if (!window.confirm("Delete this trade?")) return;
    await axios.delete(`${API}/paper/trades/${id}`);
    loadStats();
  };

  if (loading) return <Spinner />;
  const trades = stats?.trades || [];
  const open = trades.filter((t) => t.status === "OPEN");
  const closed = trades.filter((t) => t.status === "CLOSED");

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          ["Total trades", stats?.total_trades ?? 0, "#fff"],
          ["Open", stats?.open ?? 0, "#fff"],
          ["Win rate", (stats?.win_rate ?? 0) + "%", "#22c55e"],
          [
            "Total P&L",
            "₹" + (stats?.total_pnl ?? 0),
            cc(stats?.total_pnl || 0),
          ],
          [
            "Expectancy",
            "₹" + (stats?.expectancy ?? 0),
            cc(stats?.expectancy || 0),
          ],
        ].map(([l, v, c]) => (
          <div key={l} style={S.metric}>
            <div style={S.mLabel}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
          </div>
        ))}
      </div>

      {msg && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            marginBottom: 12,
            background: "#0d2b1a",
            color: "#22c55e",
            fontSize: 13,
          }}
        >
          {msg}
        </div>
      )}

      {open.length > 0 && (
        <div style={{ ...S.card, marginBottom: 14 }}>
          <div style={S.secTitle}>Open trades</div>
          {open.map((t) => (
            <div
              key={t.id}
              style={{ padding: "12px 0", borderBottom: "1px solid #1a1a24" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span
                    style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}
                  >
                    {t.sym}
                  </span>
                  {pill(t.signal)}
                  <span style={{ fontSize: 12, color: "#666" }}>
                    Qty: {t.qty} · Entry: ₹{fmt(t.entry)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {closing === t.id ? (
                    <>
                      <input
                        style={{ ...S.input, width: 100, padding: "4px 8px" }}
                        placeholder="Exit ₹"
                        value={exitPrice}
                        onChange={(e) => setExitPrice(e.target.value)}
                      />
                      <button
                        style={{ ...S.btn, padding: "5px 12px", fontSize: 12 }}
                        onClick={() => closeTrade(t.id)}
                      >
                        Confirm
                      </button>
                      <button style={S.btnSm} onClick={() => setClosing(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button style={S.btnSm} onClick={() => setClosing(t.id)}>
                        Close trade
                      </button>
                      <button
                        style={{ ...S.btnSm, color: "#ef4444" }}
                        onClick={() => deleteTrade(t.id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  gap: 8,
                  fontSize: 12,
                }}
              >
                {[
                  ["Stop loss", "#ef4444", "₹" + fmt(t.stop_loss)],
                  ["Target 1", "#22c55e", "₹" + fmt(t.target1)],
                  ["Target 2", "#22c55e", "₹" + fmt(t.target2)],
                  [
                    "Opened",
                    "#888",
                    new Date(t.opened_at).toLocaleDateString("en-IN"),
                  ],
                ].map(([l, c, v]) => (
                  <div
                    key={l}
                    style={{
                      background: "#1e1e28",
                      borderRadius: 6,
                      padding: "6px 10px",
                    }}
                  >
                    <div style={{ color: "#555", marginBottom: 2 }}>{l}</div>
                    <div style={{ fontWeight: 600, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {closed.length > 0 && (
        <div style={S.card}>
          <div style={S.secTitle}>Closed trades</div>
          {closed
            .slice()
            .reverse()
            .map((t) => (
              <div
                key={t.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "70px 80px 80px 80px 80px 80px 1fr",
                  gap: 8,
                  padding: "10px 0",
                  borderBottom: "1px solid #1a1a24",
                  fontSize: 13,
                  alignItems: "center",
                }}
              >
                <span style={{ fontWeight: 700, color: "#fff" }}>{t.sym}</span>
                {pill(t.signal)}
                <span style={{ color: "#888" }}>₹{fmt(t.entry)}</span>
                <span style={{ color: "#aaa" }}>→ ₹{fmt(t.exit_price)}</span>
                <span style={{ color: cc(t.pnl || 0), fontWeight: 700 }}>
                  {t.pnl >= 0 ? "+" : ""}₹{fmt(t.pnl)}
                </span>
                <span style={{ color: cc(t.pnl_pct || 0) }}>
                  {t.pnl_pct >= 0 ? "+" : ""}
                  {fmt(t.pnl_pct)}%
                </span>
                <span style={{ fontSize: 11, color: "#555" }}>
                  {new Date(t.opened_at).toLocaleDateString("en-IN")}
                </span>
              </div>
            ))}
        </div>
      )}

      {trades.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>
            No paper trades yet
          </div>
          <div style={{ fontSize: 13, color: "#555" }}>
            Go to Equity Signals, click a BUY stock, and click "+ Add to paper
            trades"
          </div>
        </div>
      )}
    </div>
  );
}

// ── Options ───────────────────────────────────────────────────────────────────
function OptionsAdvisor() {
  const [sym, setSym] = useState("RELIANCE");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyze = () => {
    setLoading(true);
    axios
      .get(`${API}/options/${sym}`)
      .then((r) => {
        setData(r.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  return (
    <div>
      <div style={S.card}>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>
              Stock
            </div>
            <select
              style={S.select}
              value={sym}
              onChange={(e) => setSym(e.target.value)}
            >
              {[
                "RELIANCE",
                "TCS",
                "HDFCBANK",
                "INFY",
                "ICICIBANK",
                "WIPRO",
                "TATAMOTORS",
                "SBIN",
                "ITC",
                "KOTAKBANK",
                "AXISBANK",
                "HCLTECH",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <button style={S.btn} onClick={analyze}>
            {loading ? "Analyzing..." : "Analyze options"}
          </button>
        </div>
      </div>
      {data && (
        <>
          <div style={S.grid4}>
            {[
              ["Spot price", "₹" + fmt(data.spot)],
              ["ATM strike", "₹" + data.atm_strike],
              ["Signal", data.signal],
              ["Recommendation", data.opt_rec],
            ].map(([l, v]) => (
              <div key={l} style={S.metric}>
                <div style={S.mLabel}>{l}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {l === "Signal" || l === "Recommendation" ? (
                    pill(v)
                  ) : (
                    <span style={{ color: "#fff" }}>{v}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <div style={S.secTitle}>
              Options chain — {data.symbol} · {data.expiry}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 1fr",
                gap: 0,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  padding: "6px 10px",
                  fontSize: 11,
                  color: "#555",
                  textAlign: "center",
                }}
              >
                <span>Premium</span>
                <span>OI</span>
                <span>Vol</span>
                <span>IV</span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#555",
                  textAlign: "center",
                  padding: "6px 0",
                }}
              >
                Strike
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  padding: "6px 10px",
                  fontSize: 11,
                  color: "#555",
                  textAlign: "center",
                }}
              >
                <span>Premium</span>
                <span>OI</span>
                <span>Vol</span>
                <span>IV</span>
              </div>
            </div>
            {(data.chain || []).map((row, i) => {
              const isATM = row.strike === data.atm_strike;
              return (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 80px 1fr",
                    borderBottom: "1px solid #1a1a24",
                    background: isATM ? "#1c1c2a" : "transparent",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4,1fr)",
                      padding: "8px 10px",
                      background: row.call?.inTheMoney
                        ? "#0d2018"
                        : "transparent",
                      borderRight: "1px solid #2a2a38",
                    }}
                  >
                    <span
                      style={{
                        color: "#22c55e",
                        textAlign: "center",
                        fontSize: 13,
                      }}
                    >
                      ₹{fmt(row.call?.lastPrice)}
                    </span>
                    <span
                      style={{
                        color: "#666",
                        textAlign: "center",
                        fontSize: 11,
                      }}
                    >
                      {row.call?.openInterest
                        ? (row.call.openInterest / 1000).toFixed(0) + "K"
                        : "—"}
                    </span>
                    <span
                      style={{
                        color: "#666",
                        textAlign: "center",
                        fontSize: 11,
                      }}
                    >
                      {row.call?.volume || "—"}
                    </span>
                    <span
                      style={{
                        color: "#666",
                        textAlign: "center",
                        fontSize: 11,
                      }}
                    >
                      {row.call?.impliedVolatility
                        ? (row.call.impliedVolatility * 100).toFixed(1) + "%"
                        : "—"}
                    </span>
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      padding: "8px 4px",
                      fontWeight: isATM ? 700 : 600,
                      fontSize: 13,
                      color: isATM ? "#fff" : "#aaa",
                      borderRight: "1px solid #2a2a38",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                    }}
                  >
                    {row.strike}
                    {isATM && (
                      <span style={{ fontSize: 9, color: "#6c63ff" }}>ATM</span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4,1fr)",
                      padding: "8px 10px",
                      background: row.put?.inTheMoney
                        ? "#200d0d"
                        : "transparent",
                    }}
                  >
                    <span
                      style={{
                        color: "#ef4444",
                        textAlign: "center",
                        fontSize: 13,
                      }}
                    >
                      ₹{fmt(row.put?.lastPrice)}
                    </span>
                    <span
                      style={{
                        color: "#666",
                        textAlign: "center",
                        fontSize: 11,
                      }}
                    >
                      {row.put?.openInterest
                        ? (row.put.openInterest / 1000).toFixed(0) + "K"
                        : "—"}
                    </span>
                    <span
                      style={{
                        color: "#666",
                        textAlign: "center",
                        fontSize: 11,
                      }}
                    >
                      {row.put?.volume || "—"}
                    </span>
                    <span
                      style={{
                        color: "#666",
                        textAlign: "center",
                        fontSize: 11,
                      }}
                    >
                      {row.put?.impliedVolatility
                        ? (row.put.impliedVolatility * 100).toFixed(1) + "%"
                        : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── News ──────────────────────────────────────────────────────────────────────
function NewsFeed() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noKey, setNoKey] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    axios
      .get(`${API}/news`)
      .then((r) => {
        if (r.data.note) setNoKey(true);
        setArticles(r.data.articles || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = filter
    ? articles.filter(
        (a) =>
          a.symbol?.includes(filter.toUpperCase()) ||
          a.title?.toLowerCase().includes(filter.toLowerCase()),
      )
    : articles;

  return (
    <div>
      {noKey && (
        <div
          style={{
            ...S.card,
            borderColor: "#f59e0b",
            background: "#1e1a0d",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 13, color: "#f59e0b" }}>
            Add NEWS_API_KEY to backend/.env for live news. Get free key at{" "}
            <a href="https://newsapi.org" style={{ color: "#60a5fa" }}>
              newsapi.org
            </a>
          </div>
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <input
          style={{ ...S.input, width: 200 }}
          placeholder="Filter..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div style={S.card}>
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#555" }}>
            No news. Add NEWS_API_KEY to .env
          </div>
        ) : (
          filtered.map((a, i) => (
            <div
              key={i}
              style={{
                padding: "12px 0",
                borderBottom:
                  i < filtered.length - 1 ? "1px solid #1a1a24" : "none",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  color: "#e2e2e8",
                  lineHeight: 1.5,
                  marginBottom: 5,
                }}
              >
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#e2e2e8", textDecoration: "none" }}
                >
                  {a.title}
                </a>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#555",
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#888", fontWeight: 600 }}>
                  {a.source}
                </span>
                <span>{new Date(a.published).toLocaleDateString("en-IN")}</span>
                <span>
                  Sentiment:{" "}
                  <span
                    style={{
                      color:
                        a.sentiment > 0.65
                          ? "#22c55e"
                          : a.sentiment < 0.4
                            ? "#ef4444"
                            : "#f59e0b",
                      fontWeight: 600,
                    }}
                  >
                    {Math.round(a.sentiment * 100)}%
                  </span>
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("equity");
  const [overview, setOverview] = useState(null);
  const [selectedStock, setSelectedStock] = useState(null);
  const [apiOk, setApiOk] = useState(null);
  const [paperPrefill, setPaperPrefill] = useState(null);

  useEffect(() => {
    axios
      .get(`${API}/health`)
      .then(() => setApiOk(true))
      .catch(() => setApiOk(false));
    axios
      .get(`${API}/market/overview`)
      .then((r) => setOverview(r.data))
      .catch(() => {});
    const t = setInterval(
      () =>
        axios
          .get(`${API}/market/overview`)
          .then((r) => setOverview(r.data))
          .catch(() => {}),
      60000,
    );
    return () => clearInterval(t);
  }, []);

  const handleAddTrade = (data) => {
    setPaperPrefill(data);
    setTab("paper");
    setSelectedStock(null);
  };

  const tabs = [
    ["equity", "Equity signals"],
    ["options", "Options chain"],
    ["paper", "Paper trading"],
    ["news", "News & sentiment"],
  ];

  return (
    <div style={S.app}>
      <nav style={S.nav}>
        <div style={S.logo}>
          <div style={S.logoDot} />
          <span>NiftySignal</span>
          <span style={{ color: T.text3, fontWeight: 300 }}>AI</span>
        </div>
        <div style={{ display: "flex", height: "100%" }}>
          {tabs.map(([k, l]) => (
            <button
              key={k}
              style={S.navBtn(tab === k)}
              onClick={() => {
                setTab(k);
                setSelectedStock(null);
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background:
                  apiOk === true ? T.green : apiOk === false ? T.red : T.amber,
                animation: apiOk === true ? "pulse 2s infinite" : "none",
              }}
            />
            <span
              style={{
                color:
                  apiOk === true ? T.green : apiOk === false ? T.red : T.text3,
              }}
            >
              {apiOk === true
                ? "API connected"
                : apiOk === false
                  ? "API offline"
                  : "connecting..."}
            </span>
          </div>
        </div>
      </nav>

      <div style={S.main}>
        {apiOk === false && (
          <div
            style={{
              ...S.card,
              borderColor: T.redBd,
              background: T.redBg,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 12, color: T.red }}>
              Backend not running — run:{" "}
              <code
                style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  background: "rgba(255,255,255,0.05)",
                  padding: "1px 6px",
                  borderRadius: 3,
                }}
              >
                python -m uvicorn main:app --port 8000
              </code>
            </div>
          </div>
        )}

        <MarketBanner data={overview} />

        {tab === "equity" &&
          (selectedStock ? (
            <StockDetail
              symbol={selectedStock}
              onBack={() => setSelectedStock(null)}
              onAddTrade={handleAddTrade}
            />
          ) : (
            <StocksTable onSelect={setSelectedStock} />
          ))}
        {tab === "options" && <OptionsAdvisor />}
        {tab === "paper" && (
          <PaperTrading
            prefill={paperPrefill}
            onClear={() => setPaperPrefill(null)}
          />
        )}
        {tab === "news" && <NewsFeed />}
      </div>

      <div
        style={{
          textAlign: "center",
          padding: "16px 24px",
          borderTop: "1px solid #1e1e28",
          fontSize: 11,
          color: "#444",
        }}
      >
        NiftySignal AI · Educational & research purposes only · Not
        SEBI-registered investment advice · Consult a qualified financial
        advisor before trading
      </div>
    </div>
  );
}

// ── Paper Trading Components (appended) ──────────────────────────────────────

export function TradingPanel({ symbol, onClose }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [adding, setAdding] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  React.useEffect(() => {
    setLoading(true);
    axios
      .get(`${API}/targets/${symbol}`)
      .then((r) => {
        setData(r.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [symbol]);

  const addTrade = async () => {
    if (!data) return;
    setAdding(true);
    try {
      await axios.post(`${API}/paper/trades`, {
        sym: data.sym,
        signal: data.signal,
        price: data.price,
        stop_loss: data.stop_loss,
        target1: data.target1,
        target2: data.target2,
        confidence: data.confidence || 0.5,
        notes: `Auto from signal at ${new Date().toLocaleTimeString("en-IN")}`,
      });
      setMsg("Trade added to paper tracker!");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg("Failed to add trade");
    }
    setAdding(false);
  };

  if (loading)
    return (
      <div style={S.card}>
        <Spinner />
      </div>
    );
  if (!data) return null;

  const isLong = data.signal === "BUY";
  const signalColor = isLong
    ? "#22c55e"
    : data.signal === "SELL"
      ? "#ef4444"
      : "#f59e0b";

  return (
    <div style={S.card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
            {data.sym}
          </span>
          <span style={{ ...S.pill(data.signal), marginLeft: 10 }}>
            {data.signal}
          </span>
          <span style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>
            Confidence: {Math.round((data.confidence || 0) * 100)}%
          </span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>
          ₹{fmt(data.price)}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {[
          ["Entry price", `₹${fmt(data.entry)}`, "#fff"],
          ["Stop loss", `₹${fmt(data.stop_loss)}`, "#ef4444"],
          ["Target 1", `₹${fmt(data.target1)}`, "#22c55e"],
          ["Target 2", `₹${fmt(data.target2)}`, "#60a5fa"],
        ].map(([label, val, color]) => (
          <div
            key={label}
            style={{ background: "#1e1e28", borderRadius: 8, padding: 12 }}
          >
            <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {[
          ["Risk", `₹${fmt(data.risk)} (${data.sl_pct}%)`, "#ef4444"],
          ["Reward", `₹${fmt(data.reward)} (${data.t1_pct}%)`, "#22c55e"],
          [
            "R:R Ratio",
            `1 : ${data.rr_ratio}`,
            data.rr_ratio >= 1.5 ? "#22c55e" : "#f59e0b",
          ],
          ["ATR", data.atr ? `₹${fmt(data.atr)}` : "—", "#888"],
        ].map(([label, val, color]) => (
          <div
            key={label}
            style={{ background: "#1e1e28", borderRadius: 8, padding: 12 }}
          >
            <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
      </div>

      {data.pivot && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5,1fr)",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {[
            ["Support 2", data.support2],
            ["Support 1", data.support1],
            ["Pivot", data.pivot],
            ["Resistance 1", data.resistance1],
            ["Resistance 2", data.resistance2],
          ].map(([label, val]) => (
            <div
              key={label}
              style={{
                background: "#16161e",
                border: "1px solid #2a2a38",
                borderRadius: 8,
                padding: 10,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 10, color: "#555", marginBottom: 3 }}>
                {label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#aaa" }}>
                ₹{fmt(val)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          style={S.btn}
          onClick={addTrade}
          disabled={adding || data.signal === "HOLD"}
        >
          {adding ? "Adding..." : `+ Add to paper trades`}
        </button>
        {data.signal === "HOLD" && (
          <span style={{ fontSize: 12, color: "#888" }}>
            No trade — signal is HOLD
          </span>
        )}
        {msg && <span style={{ fontSize: 12, color: "#22c55e" }}>{msg}</span>}
      </div>
      <div style={{ fontSize: 11, color: "#444", marginTop: 10 }}>
        Stop loss and targets calculated using ATR(14) + pivot point analysis.
        Not investment advice.
      </div>
    </div>
  );
}

export function PaperTracker() {
  const [trades, setTrades] = React.useState([]);
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [closing, setClosing] = React.useState(null);
  const [exitPrice, setExitPrice] = React.useState("");

  const load = () => {
    Promise.all([
      axios.get(`${API}/paper/trades`),
      axios.get(`${API}/paper/stats`),
    ])
      .then(([tr, st]) => {
        setTrades(tr.data.trades || []);
        setStats(st.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  React.useEffect(() => {
    load();
  }, []);

  const closeTrade = async (id) => {
    if (!exitPrice) return;
    await axios.post(`${API}/paper/trades/${id}/close`, {
      exit_price: parseFloat(exitPrice),
      notes: "Manual close",
    });
    setClosing(null);
    setExitPrice("");
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 12,
            marginBottom: 16,
          }}
        >
          {[
            ["Total trades", stats.total_trades],
            ["Win rate", `${stats.win_rate}%`],
            [
              "Avg P&L",
              `${stats.avg_pnl_pct > 0 ? "+" : ""}${stats.avg_pnl_pct}%`,
            ],
            ["Open trades", stats.open_trades],
          ].map(([label, val]) => (
            <div key={label} style={S.metricCard}>
              <div style={S.metricLabel}>{label}</div>
              <div style={{ ...S.metricVal, fontSize: 22 }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      <div style={S.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <span style={S.sectionTitle}>Paper trades</span>
          <button style={S.btnOutline} onClick={load}>
            ↺ Refresh
          </button>
        </div>

        {trades.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#555" }}>
            No paper trades yet. Click on a stock → view targets → Add to paper
            trades.
          </div>
        ) : (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "70px 80px 80px 80px 80px 80px 1fr 100px",
                gap: 8,
                padding: "8px 12px",
                fontSize: 11,
                color: "#555",
                fontWeight: 600,
                textTransform: "uppercase",
                borderBottom: "1px solid #2a2a38",
              }}
            >
              <span>Symbol</span>
              <span>Signal</span>
              <span>Entry</span>
              <span>SL</span>
              <span>T1</span>
              <span>Current</span>
              <span>P&L</span>
              <span>Action</span>
            </div>
            {trades.map((t) => {
              const pnl = t.unrealized_pnl_pct ?? t.pnl_pct;
              const pnlColor =
                pnl > 0 ? "#22c55e" : pnl < 0 ? "#ef4444" : "#888";
              return (
                <div
                  key={t.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "70px 80px 80px 80px 80px 80px 1fr 100px",
                    gap: 8,
                    padding: "10px 12px",
                    fontSize: 13,
                    borderBottom: "1px solid #1a1a24",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "#fff" }}>
                    {t.sym}
                  </span>
                  <span style={S.pill(t.signal)}>{t.signal}</span>
                  <span>₹{fmt(t.entry)}</span>
                  <span style={{ color: "#ef4444" }}>₹{fmt(t.stop_loss)}</span>
                  <span style={{ color: "#22c55e" }}>₹{fmt(t.target1)}</span>
                  <span style={{ color: "#aaa" }}>
                    {t.current_price
                      ? `₹${fmt(t.current_price)}`
                      : t.exit_price
                        ? `₹${fmt(t.exit_price)}`
                        : "—"}
                  </span>
                  <span style={{ color: pnlColor, fontWeight: 600 }}>
                    {pnl != null
                      ? `${pnl > 0 ? "+" : ""}${pnl.toFixed(2)}%`
                      : "—"}
                    {t.status === "OPEN" ? (
                      <span
                        style={{ fontSize: 10, color: "#666", marginLeft: 6 }}
                      >
                        unrealized
                      </span>
                    ) : (
                      <span
                        style={{ fontSize: 10, color: "#555", marginLeft: 6 }}
                      >
                        closed
                      </span>
                    )}
                  </span>
                  <div>
                    {t.status === "OPEN" ? (
                      closing === t.id ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <input
                            style={{
                              ...S.input,
                              width: 80,
                              padding: "4px 8px",
                              fontSize: 12,
                            }}
                            placeholder="Exit ₹"
                            value={exitPrice}
                            onChange={(e) => setExitPrice(e.target.value)}
                          />
                          <button
                            style={{
                              ...S.btn,
                              padding: "4px 8px",
                              fontSize: 11,
                            }}
                            onClick={() => closeTrade(t.id)}
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <button
                          style={S.btnOutline}
                          onClick={() => setClosing(t.id)}
                        >
                          Close
                        </button>
                      )
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          color: t.pnl > 0 ? "#22c55e" : "#ef4444",
                        }}
                      >
                        {t.outcome?.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
