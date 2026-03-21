import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API = import.meta.env.VITE_API_URL || 'https://nifty-ai-production.up.railway.app/api';

// ── Global CSS ────────────────────────────────────────────────────────────────
const injectCSS = () => {
  if (document.getElementById('ns-css')) return;
  const el = document.createElement('style');
  el.id = 'ns-css';
  el.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@300;400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 14px; -webkit-text-size-adjust: 100%; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #0a0a0f; color: #c9d1d9; line-height: 1.5; overflow-x: hidden; }
    ::-webkit-scrollbar { width: 3px; height: 3px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }
    input, select, button, textarea { font-family: inherit; }
    input:focus, select:focus { outline: none; }
    a { color: inherit; text-decoration: none; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes slideIn { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
    .fade-up { animation: fadeUp .2s ease both; }
    .hover-row:hover { background: rgba(255,255,255,0.03) !important; }
    .hover-btn:hover { opacity: 0.85; }
    @media (max-width: 768px) {
      html { font-size: 13px; }
    }
  `;
  document.head.appendChild(el);
};
injectCSS();

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:     '#0a0a0f',
  bg1:    '#0d1117',
  bg2:    '#161b22',
  bg3:    '#1c2128',
  bdr:    '#21262d',
  bdr2:   '#30363d',
  text:   '#e6edf3',
  text2:  '#8b949e',
  text3:  '#484f58',
  green:  '#3fb950',
  greenD: '#0b3d16',
  greenB: '#196127',
  red:    '#f85149',
  redD:   '#3d0b0b',
  redB:   '#6e1c1c',
  amber:  '#e3b341',
  amberD: '#3d2b00',
  blue:   '#58a6ff',
  blueD:  '#0c2040',
  blueB:  '#1a3a6e',
  teal:   '#39d353',
};

// ── Utilities ─────────────────────────────────────────────────────────────────
const fmt  = (v, d=2) => v != null ? (+v).toLocaleString('en-IN', {minimumFractionDigits:d, maximumFractionDigits:d}) : '—';
const pct  = (v) => v != null ? `${v>=0?'+':''}${(+v).toFixed(2)}%` : '—';
const gc   = (v) => v >= 0 ? C.green : C.red;
const mono = {fontFamily:"'JetBrains Mono',monospace"};

// ── Atoms ─────────────────────────────────────────────────────────────────────
const Pill = ({type, size='sm'}) => {
  const map = {
    BUY:       [C.greenD, C.green,  C.greenB],
    SELL:      [C.redD,   C.red,    C.redB],
    HOLD:      [C.amberD, C.amber,  '#5a4500'],
    CALL:      [C.blueD,  C.blue,   C.blueB],
    PUT:       [C.redD,   '#f472b6',C.redB],
    NEUTRAL:   ['#161b22',C.text3,  C.bdr2],
    OPEN:      [C.blueD,  C.blue,   C.blueB],
    CLOSED:    ['#161b22',C.text3,  C.bdr],
    EXCELLENT: [C.greenD, C.green,  C.greenB],
    GOOD:      [C.blueD,  C.blue,   C.blueB],
    FAIR:      [C.amberD, C.amber,  '#5a4500'],
    POOR:      [C.redD,   C.red,    C.redB],
    SKIP:      ['#161b22',C.text3,  C.bdr],
  };
  const [bg,col,bd] = map[type] || map.NEUTRAL;
  return (
    <span style={{
      background:bg, color:col, border:`1px solid ${bd}`,
      fontSize: size==='lg'?12:10, fontWeight:600,
      padding: size==='lg'?'3px 10px':'2px 7px',
      borderRadius:4, display:'inline-block', letterSpacing:'.04em', whiteSpace:'nowrap'
    }}>{type}</span>
  );
};

const Spinner = ({text='Loading...'}) => (
  <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'48px 16px',gap:12,color:C.text3}}>
    <div style={{width:18,height:18,border:`2px solid ${C.bdr2}`,borderTopColor:C.green,borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
    <span style={{fontSize:12}}>{text}</span>
  </div>
);

const SentBar = ({val}) => {
  const pv = Math.round((val||0)*100);
  const col = val>0.65?C.green:val<0.4?C.red:C.amber;
  return (
    <div>
      <span style={{fontSize:10,color:col,...mono,fontWeight:500}}>{pv}%</span>
      <div style={{height:2,background:C.bg3,borderRadius:1,overflow:'hidden',marginTop:3}}>
        <div style={{width:`${pv}%`,height:'100%',background:col,borderRadius:1}}/>
      </div>
    </div>
  );
};

const Card = ({children, style={}}) => (
  <div style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:10,padding:14,marginBottom:10,...style}}>
    {children}
  </div>
);

const MetCard = ({label, value, sub, subColor, accent}) => (
  <div style={{background:C.bg1,border:`1px solid ${accent||C.bdr}`,borderRadius:10,padding:'12px 14px',position:'relative',overflow:'hidden'}}>
    {accent && <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${accent},transparent)`}}/>}
    <div style={{fontSize:10,color:C.text3,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4,fontWeight:500}}>{label}</div>
    <div style={{fontSize:18,fontWeight:700,color:C.text,...mono,letterSpacing:'-0.5px'}}>{value}</div>
    {sub && <div style={{fontSize:10,marginTop:2,color:subColor||C.text3,...mono}}>{sub}</div>}
  </div>
);

// ── IST Clock ─────────────────────────────────────────────────────────────────
function ISTClock() {
  const [info, setInfo] = useState({time:'', open:false});
  useEffect(() => {
    const tick = () => {
      const ist = new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Kolkata'}));
      const h = ist.getHours(), m = ist.getMinutes(), d = ist.getDay();
      const open = d>0&&d<6&&((h>9||(h===9&&m>=15))&&(h<15||(h===15&&m<=30)));
      setInfo({
        time: ist.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}),
        open
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <div style={{width:6,height:6,borderRadius:'50%',background:info.open?C.green:C.red,animation:info.open?'pulse 2s infinite':'none',flexShrink:0}}/>
      <span style={{fontSize:11,color:info.open?C.green:C.red,fontWeight:500,whiteSpace:'nowrap'}}>{info.open?'OPEN':'CLOSED'}</span>
      <span style={{fontSize:11,color:C.text3,...mono,whiteSpace:'nowrap'}}>{info.time}</span>
    </div>
  );
}

// ── Market Banner ─────────────────────────────────────────────────────────────
function MarketBanner({data}) {
  const indices = [['NIFTY50','Nifty 50'],['BANKNIFTY','Bank Nifty'],['SENSEX','Sensex'],['VIX','VIX']];
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:12}}>
      {indices.map(([k,l]) => {
        const d = data?.[k];
        const up = (d?.change_pct||0) >= 0;
        return (
          <MetCard key={k} label={l}
            value={d?.value ? fmt(d.value,0) : '—'}
            sub={d ? `${up?'▲':'▼'} ${pct(d.change_pct)}` : 'Loading...'}
            subColor={d ? gc(d.change_pct) : C.text3}
            accent={d ? gc(d.change_pct) : null}
          />
        );
      })}
    </div>
  );
}

// ── Signal Summary Bar ────────────────────────────────────────────────────────
function SignalBar({stocks}) {
  const buys  = stocks.filter(s=>s.signal==='BUY').length;
  const sells = stocks.filter(s=>s.signal==='SELL').length;
  const holds = stocks.filter(s=>s.signal==='HOLD').length;
  const total = buys + sells + holds || 1;
  return (
    <div style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'10px 14px',marginBottom:10}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
        <span style={{fontSize:11,color:C.text3,fontWeight:500}}>Market sentiment</span>
        <span style={{fontSize:11,color:C.text3,...mono}}>{stocks.filter(s=>!s.error).length} stocks</span>
      </div>
      <div style={{display:'flex',height:6,borderRadius:3,overflow:'hidden',gap:2,marginBottom:6}}>
        <div style={{width:`${buys/total*100}%`,background:C.green,borderRadius:3}}/>
        <div style={{width:`${holds/total*100}%`,background:C.amber,borderRadius:3}}/>
        <div style={{width:`${sells/total*100}%`,background:C.red,borderRadius:3}}/>
      </div>
      <div style={{display:'flex',gap:16}}>
        {[[buys,'BUY',C.green],[holds,'HOLD',C.amber],[sells,'SELL',C.red]].map(([n,l,c])=>(
          <div key={l} style={{display:'flex',alignItems:'center',gap:5}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:c}}/>
            <span style={{fontSize:11,color:c,fontWeight:600,...mono}}>{n} {l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Alert Banner ──────────────────────────────────────────────────────────────
function AlertBanner({alerts, onSelect, onDismiss}) {
  if (!alerts.length) return null;
  return (
    <div style={{marginBottom:10}}>
      {alerts.map((a,i) => (
        <div key={i} className="fade-up" style={{
          display:'flex',alignItems:'center',gap:8,padding:'8px 12px',
          borderRadius:8,marginBottom:6,
          background:a.to==='BUY'?C.greenD:C.redD,
          border:`1px solid ${a.to==='BUY'?C.greenB:C.redB}`,
        }}>
          <div style={{width:6,height:6,borderRadius:'50%',background:a.to==='BUY'?C.green:C.red,animation:'pulse 1s infinite',flexShrink:0}}/>
          <span style={{fontWeight:700,color:C.text,fontSize:13,...mono}}>{a.sym}</span>
          <Pill type={a.to} size="lg"/>
          <span style={{color:C.text2,fontSize:11,...mono}}>₹{fmt(a.price)}</span>
          <span style={{marginLeft:'auto',fontSize:10,color:C.text3,...mono}}>{a.time}</span>
          <button style={{background:C.bg2,border:`1px solid ${C.bdr2}`,color:C.text,padding:'2px 8px',borderRadius:4,fontSize:11,cursor:'pointer'}} onClick={()=>onSelect(a.sym)}>→</button>
          <button style={{background:'transparent',border:'none',color:C.text3,cursor:'pointer',fontSize:14,padding:'0 2px'}} onClick={()=>onDismiss(i)}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ── Stock Card (Mobile) ───────────────────────────────────────────────────────
function StockCard({s, onClick}) {
  if (s.error) return null;
  return (
    <div className="hover-row" onClick={onClick} style={{
      background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:10,
      padding:'12px 14px',marginBottom:8,cursor:'pointer',
      borderLeft:`3px solid ${s.signal==='BUY'?C.green:s.signal==='SELL'?C.red:C.bdr}`
    }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div>
          <div style={{fontWeight:700,color:C.text,fontSize:14,...mono}}>{s.sym}</div>
          <div style={{color:C.text2,fontSize:11,marginTop:1}}>{s.name}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontWeight:600,color:C.text,fontSize:14,...mono}}>₹{fmt(s.price)}</div>
          <div style={{color:gc(s.change_pct),fontSize:11,...mono,marginTop:1}}>{pct(s.change_pct)}</div>
        </div>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <Pill type={s.signal}/>
          <Pill type={s.opt_rec||'NEUTRAL'}/>
        </div>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <div>
            <div style={{fontSize:9,color:C.text3,textTransform:'uppercase',letterSpacing:'.06em'}}>RSI</div>
            <div style={{fontSize:11,color:s.rsi<35?C.green:s.rsi>65?C.red:C.text2,...mono,fontWeight:500}}>{s.rsi??'—'}</div>
          </div>
          <div style={{width:60}}>
            <div style={{fontSize:9,color:C.text3,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:2}}>Sent.</div>
            <SentBar val={s.sentiment??0.5}/>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Desktop Stock Row ─────────────────────────────────────────────────────────
function StockRow({s, onClick}) {
  if (s.error) return null;
  const cols = '76px 1fr 88px 88px 50px 100px 108px';
  return (
    <div className="hover-row" style={{display:'grid',gridTemplateColumns:cols,gap:8,padding:'9px 14px',borderBottom:`1px solid rgba(33,38,45,0.6)`,cursor:'pointer',alignItems:'center'}} onClick={onClick}>
      <span style={{fontWeight:600,color:C.text,...mono,fontSize:12}}>{s.sym}</span>
      <span style={{color:C.text2,fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</span>
      <span style={{color:C.text,...mono,fontSize:12}}>₹{fmt(s.price)}</span>
      <span style={{color:gc(s.change_pct),fontWeight:500,...mono,fontSize:12}}>{pct(s.change_pct)}</span>
      <span style={{color:s.rsi>65?C.red:s.rsi<35?C.green:C.text3,...mono,fontSize:11}}>{s.rsi??'—'}</span>
      <SentBar val={s.sentiment??0.5}/>
      <div style={{display:'flex',gap:4}}><Pill type={s.signal}/><Pill type={s.opt_rec||'NEUTRAL'}/></div>
    </div>
  );
}

// ── Stocks List ───────────────────────────────────────────────────────────────
function StocksList({onSelect}) {
  const [stocks,setStocks]     = useState([]);
  const [loading,setLoading]   = useState(true);
  const [sector,setSector]     = useState('');
  const [sort,setSort]         = useState('signal');
  const [search,setSearch]     = useState('');
  const [alerts,setAlerts]     = useState([]);
  const [countdown,setCountdown] = useState(300);
  const [isMobile,setIsMobile] = useState(window.innerWidth < 768);
  const prevRef = useRef({});

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const loadStocks = useCallback((force=false) => {
    const url = force ? `${API}/stocks?force_refresh=true` : `${API}/stocks`;
    axios.get(url, {timeout: 15000}).then(r => {
      const ns = r.data.stocks || r.data || [];
      const valid = ns.filter(s => !s.error);
      const newAlerts = [];
      valid.forEach(s => {
        const old = prevRef.current[s.sym];
        if (old && old !== s.signal && s.signal !== 'HOLD') {
          newAlerts.push({sym:s.sym, from:old, to:s.signal, price:s.price, time:new Date().toLocaleTimeString('en-IN')});
        }
        prevRef.current[s.sym] = s.signal;
      });
      if (newAlerts.length) {
        setAlerts(a => [...newAlerts, ...a].slice(0,5));
        if ('Notification' in window && Notification.permission === 'granted')
          newAlerts.forEach(a => new Notification(`${a.sym} → ${a.to}`, {body:`₹${a.price}`}));
      }
      setStocks(ns);
      setLoading(false);
    }).catch((err) => {
      console.log('Stocks fetch error:', err.message);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadStocks();
    if ('Notification' in window) Notification.requestPermission();
    const id = setInterval(() => {
      setCountdown(n => { if (n<=1){loadStocks();return 300;} return n-1; });
    }, 1000);
    return () => clearInterval(id);
  }, [loadStocks]);

  const SECTORS = ['Banking','IT','Energy','FMCG','Auto','Pharma','Finance','Infra','Consumer','Conglomerate','Metal','Tech','Healthcare','Retail','Aviation','Defence','Travel'];
  const sigOrd = {BUY:0,SELL:1,HOLD:2};
  const valid = stocks.filter(s => !s.error);
  const filtered = valid
    .filter(s=>(!search||s.sym?.includes(search.toUpperCase())||s.name?.toLowerCase().includes(search.toLowerCase()))&&(!sector||s.sector===sector))
    .sort((a,b)=>sort==='signal'?(sigOrd[a.signal]??2)-(sigOrd[b.signal]??2):sort==='change_pct'?(b.change_pct||0)-(a.change_pct||0):sort==='sentiment'?(b.sentiment||0)-(a.sentiment||0):(a.rsi||50)-(b.rsi||50));

  return (
    <div>
      <AlertBanner alerts={alerts} onSelect={onSelect} onDismiss={i=>setAlerts(a=>a.filter((_,j)=>j!==i))}/>
      {valid.length > 0 && <SignalBar stocks={valid}/>}

      <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
        <input
          style={{background:C.bg2,border:`1px solid ${C.bdr2}`,borderRadius:8,padding:'7px 10px',fontSize:12,color:C.text,flex:1,minWidth:100}}
          placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={{background:C.bg2,border:`1px solid ${C.bdr2}`,borderRadius:8,padding:'7px 10px',fontSize:12,color:C.text}} value={sector} onChange={e=>setSector(e.target.value)}>
          <option value="">All sectors</option>
          {SECTORS.map(s=><option key={s}>{s}</option>)}
        </select>
        <select style={{background:C.bg2,border:`1px solid ${C.bdr2}`,borderRadius:8,padding:'7px 10px',fontSize:12,color:C.text}} value={sort} onChange={e=>setSort(e.target.value)}>
          <option value="signal">Signal</option>
          <option value="change_pct">Change</option>
          <option value="sentiment">Sentiment</option>
          <option value="rsi">RSI</option>
        </select>
        <button className="hover-btn" style={{background:C.bg2,border:`1px solid ${C.bdr2}`,borderRadius:8,padding:'7px 12px',fontSize:11,color:C.text2,cursor:'pointer',whiteSpace:'nowrap'}} onClick={()=>loadStocks(true)}>↺</button>
      </div>
      <div style={{fontSize:10,color:C.text3,marginBottom:8,textAlign:'right',...mono}}>
        next refresh in {countdown}s
      </div>

      {loading ? <Spinner text="Fetching live NSE data..."/> :
        filtered.length === 0 ? <div style={{padding:32,textAlign:'center',color:C.text3,fontSize:12}}>No stocks found</div> :
        isMobile ? (
          filtered.map(s => <StockCard key={s.sym} s={s} onClick={()=>onSelect(s.sym)}/>)
        ) : (
          <div style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:10,overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'76px 1fr 88px 88px 50px 100px 108px',gap:8,padding:'7px 14px',fontSize:10,color:C.text3,fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',background:'rgba(22,27,34,0.8)',borderBottom:`1px solid ${C.bdr}`}}>
              <span>Symbol</span><span>Company</span><span>Price</span><span>Change</span><span>RSI</span><span>Sentiment</span><span>Signal</span>
            </div>
            {filtered.map(s => <StockRow key={s.sym} s={s} onClick={()=>onSelect(s.sym)}/>)}
          </div>
        )
      }
    </div>
  );
}

// ── Stock Detail ──────────────────────────────────────────────────────────────
function StockDetail({symbol, onBack}) {
  const [data,setData]       = useState(null);
  const [plan,setPlan]       = useState(null);
  const [chart,setChart]     = useState([]);
  const [period,setPeriod]   = useState('3mo');
  const [loading,setLoading] = useState(true);
  const [msg,setMsg]         = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      axios.get(`${API}/stock/${symbol}`),
      axios.get(`${API}/chart/${symbol}?period=3mo`),
      axios.get(`${API}/trade-plan/${symbol}?capital=100000`),
    ]).then(([dr,cr,tr]) => {
      setData(dr.data); setChart(cr.data.data||[]); setPlan(tr.data); setLoading(false);
    }).catch(() => setLoading(false));
  }, [symbol]);

  useEffect(() => {
    axios.get(`${API}/chart/${symbol}?period=${period}`).then(r=>setChart(r.data.data||[])).catch(()=>{});
  }, [symbol, period]);

  const addPaper = async () => {
    if (!plan?.stop_loss) { setMsg('No trade setup'); return; }
    try {
      await axios.post(`${API}/paper/trades`, {
        sym:symbol, signal:plan.signal, entry:plan.entry,
        stop_loss:plan.stop_loss, target1:plan.target1,
        target2:plan.target2, qty:plan.position_sizing?.quantity||1, notes:''
      });
      setMsg('✓ Paper trade logged!');
      setTimeout(() => setMsg(''), 4000);
    } catch(e) { setMsg('Failed'); }
  };

  if (loading) return <Spinner text={`Loading ${symbol}...`}/>;
  if (!data) return <div style={{color:C.red,padding:20,textAlign:'center'}}>Failed to load {symbol}</div>;

  const chartColor = (data.change_pct||0) >= 0 ? C.green : C.red;
  const hasSignal = plan?.signal==='BUY' || plan?.signal==='SELL';
  const qc = {EXCELLENT:C.green,GOOD:C.blue,FAIR:C.amber,POOR:C.red,SKIP:C.text3};

  return (
    <div className="fade-up">
      <button onClick={onBack} style={{background:'transparent',border:`1px solid ${C.bdr}`,color:C.text2,padding:'6px 12px',borderRadius:6,fontSize:12,cursor:'pointer',marginBottom:14,display:'flex',alignItems:'center',gap:6}}>
        ← All stocks
      </button>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
        <div>
          <div style={{fontSize:24,fontWeight:700,color:C.text,...mono,letterSpacing:'-1px'}}>{data.sym}</div>
          <div style={{color:C.text2,fontSize:12,marginTop:2}}>{data.name} · {data.sector}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:22,fontWeight:700,color:C.text,...mono}}>₹{fmt(data.price)}</div>
          <div style={{color:gc(data.change_pct),fontWeight:500,...mono,fontSize:12,marginTop:2}}>{pct(data.change_pct)}</div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10}}>
        {[['RSI',data.rsi],['52W H',data.week_high?`₹${fmt(data.week_high,0)}`:'—'],['52W L',data.week_low?`₹${fmt(data.week_low,0)}`:'—']].map(([l,v])=>(
          <MetCard key={l} label={l} value={v??'—'} accent={l==='RSI'&&data.rsi?(data.rsi<35?C.green:data.rsi>65?C.red:null):null}/>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10}}>
        {[['P/E',data.pe_ratio?fmt(data.pe_ratio):'—'],['Beta',data.beta?fmt(data.beta):'—'],['Sent.',data.sentiment?`${Math.round(data.sentiment*100)}%`:'—']].map(([l,v])=>(
          <MetCard key={l} label={l} value={v??'—'}/>
        ))}
      </div>

      {hasSignal && plan && (
        <Card style={{borderColor:plan.signal==='BUY'?C.greenB:C.redB,marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:13,fontWeight:600,color:C.text}}>Trade setup</span>
              <Pill type={plan.signal} size="lg"/>
            </div>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <span style={{fontSize:11,color:qc[plan.trade_quality]||C.text3,fontWeight:600}}>{plan.trade_quality}</span>
              <span style={{fontSize:12,color:plan.rr_ratio>=2?C.green:plan.rr_ratio>=1?C.amber:C.red,fontWeight:700,...mono}}>R:R 1:{plan.rr_ratio}</span>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
            {[['Entry',C.text,`₹${fmt(plan.entry)}`],['Stop loss',C.red,`₹${fmt(plan.stop_loss)}`],['Target 1',C.green,`₹${fmt(plan.target1)}`],['Target 2',C.green,`₹${fmt(plan.target2)}`]].map(([l,c,v])=>(
              <div key={l} style={{background:C.bg2,borderRadius:8,padding:'10px 12px',border:`1px solid ${C.bdr}`}}>
                <div style={{fontSize:10,color:C.text3,marginBottom:4,textTransform:'uppercase',letterSpacing:'.07em'}}>{l}</div>
                <div style={{fontSize:16,fontWeight:600,color:c,...mono}}>{v}</div>
              </div>
            ))}
          </div>

          {plan.position_sizing && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
              {[['Qty (1% risk)',C.text,plan.position_sizing.quantity],['Total cost',C.text2,`₹${fmt(plan.position_sizing.total_cost,0)}`]].map(([l,c,v])=>(
                <div key={l} style={{background:C.bg2,borderRadius:8,padding:'8px 12px',border:`1px solid ${C.bdr}`}}>
                  <div style={{fontSize:10,color:C.text3,marginBottom:3,textTransform:'uppercase',letterSpacing:'.07em'}}>{l}</div>
                  <div style={{fontSize:14,fontWeight:600,color:c,...mono}}>{v}</div>
                </div>
              ))}
            </div>
          )}

          <button className="hover-btn" onClick={addPaper} style={{
            width:'100%',background:C.greenD,border:`1px solid ${C.greenB}`,
            color:C.green,borderRadius:8,padding:'10px',fontSize:13,fontWeight:600,cursor:'pointer'
          }}>+ Add to paper trades</button>
          {msg && <div style={{marginTop:8,fontSize:12,color:msg.startsWith('✓')?C.green:C.red,...mono,textAlign:'center'}}>{msg}</div>}
        </Card>
      )}

      <Card>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <span style={{fontSize:10,color:C.text3,textTransform:'uppercase',letterSpacing:'.07em',fontWeight:600}}>Price chart</span>
          <div style={{display:'flex',gap:4}}>
            {['1mo','3mo','6mo','1y'].map(p=>(
              <button key={p} style={{background:period===p?C.bg3:'transparent',border:`1px solid ${period===p?C.bdr2:C.bdr}`,color:period===p?C.text:C.text3,borderRadius:4,padding:'3px 8px',fontSize:11,cursor:'pointer'}} onClick={()=>setPeriod(p)}>{p}</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chart} margin={{top:4,right:0,left:0,bottom:0}}>
            <defs>
              <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColor} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke={C.bdr} vertical={false}/>
            <XAxis dataKey="date" tick={{fontSize:9,fill:C.text3}} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
            <YAxis tick={{fontSize:9,fill:C.text3}} tickLine={false} axisLine={false} tickFormatter={v=>`₹${Math.round(v)}`} width={55}/>
            <Tooltip contentStyle={{background:C.bg2,border:`1px solid ${C.bdr2}`,borderRadius:6,fontSize:11}} formatter={v=>[`₹${fmt(v)}`,'Close']} labelStyle={{color:C.text2}}/>
            <Area type="monotone" dataKey="close" stroke={chartColor} strokeWidth={1.5} fill="url(#cg)" dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ── Options ───────────────────────────────────────────────────────────────────
function OptionsAdvisor() {
  const [sym,setSym]     = useState('RELIANCE');
  const [data,setData]   = useState(null);
  const [loading,setLoading] = useState(false);
  const SYMS = ['RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','WIPRO','TATAMOTORS','SBIN','ITC','KOTAKBANK','AXISBANK','HCLTECH','BAJFINANCE','MARUTI','SUNPHARMA'];

  const analyze = () => { setLoading(true); axios.get(`${API}/options/${sym}`).then(r=>{setData(r.data);setLoading(false);}).catch(()=>setLoading(false)); };

  return (
    <div>
      <Card>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div style={{flex:1,minWidth:120}}>
            <div style={{fontSize:10,color:C.text3,marginBottom:4,textTransform:'uppercase',letterSpacing:'.07em'}}>Stock</div>
            <select style={{background:C.bg2,border:`1px solid ${C.bdr2}`,borderRadius:8,padding:'8px 10px',fontSize:12,color:C.text,width:'100%'}} value={sym} onChange={e=>setSym(e.target.value)}>
              {SYMS.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <button className="hover-btn" style={{background:C.greenD,border:`1px solid ${C.greenB}`,color:C.green,borderRadius:8,padding:'8px 18px',fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}} onClick={analyze}>
            {loading ? 'Loading...' : 'Analyze'}
          </button>
        </div>
      </Card>

      {data && (
        <div className="fade-up">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
            <MetCard label="Spot price" value={`₹${fmt(data.spot)}`}/>
            <MetCard label="ATM strike" value={`₹${data.atm_strike}`}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
            <div style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'12px 14px'}}>
              <div style={{fontSize:10,color:C.text3,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:6}}>Signal</div>
              <Pill type={data.signal||'HOLD'} size="lg"/>
            </div>
            <div style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'12px 14px'}}>
              <div style={{fontSize:10,color:C.text3,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:6}}>Recommendation</div>
              <Pill type={data.opt_rec||'NEUTRAL'} size="lg"/>
            </div>
          </div>

          <Card>
            <div style={{fontSize:10,color:C.text3,fontWeight:600,textTransform:'uppercase',letterSpacing:'.07em',marginBottom:10}}>Options chain</div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${C.bdr}`}}>
                    <th colSpan={2} style={{color:C.green,padding:'4px 8px',textAlign:'center',fontWeight:600}}>CALLS</th>
                    <th style={{color:C.text2,padding:'4px 8px',textAlign:'center',fontWeight:600}}>Strike</th>
                    <th colSpan={2} style={{color:C.red,padding:'4px 8px',textAlign:'center',fontWeight:600}}>PUTS</th>
                  </tr>
                  <tr style={{borderBottom:`1px solid ${C.bdr}`,fontSize:10,color:C.text3}}>
                    <th style={{padding:'3px 8px',textAlign:'center',fontWeight:500}}>Prem</th>
                    <th style={{padding:'3px 8px',textAlign:'center',fontWeight:500}}>OI</th>
                    <th style={{padding:'3px 8px',textAlign:'center',fontWeight:600,color:C.text2}}>—</th>
                    <th style={{padding:'3px 8px',textAlign:'center',fontWeight:500}}>Prem</th>
                    <th style={{padding:'3px 8px',textAlign:'center',fontWeight:500}}>OI</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.chain||[]).map((row,i) => {
                    const isATM = row.strike === data.atm_strike;
                    return (
                      <tr key={i} style={{background:isATM?'rgba(88,166,255,0.05)':'transparent',borderBottom:`1px solid rgba(33,38,45,.5)`}}>
                        <td style={{padding:'7px 8px',textAlign:'center',color:C.green,...mono,fontWeight:row.call?.inTheMoney?600:400}}>{row.call?.lastPrice?`₹${fmt(row.call.lastPrice)}`:'—'}</td>
                        <td style={{padding:'7px 8px',textAlign:'center',color:C.text3,...mono,fontSize:10}}>{row.call?.openInterest?`${(row.call.openInterest/1000).toFixed(0)}K`:'—'}</td>
                        <td style={{padding:'7px 8px',textAlign:'center',color:isATM?C.blue:C.text2,...mono,fontWeight:isATM?700:500}}>
                          {row.strike}{isATM&&<span style={{fontSize:8,color:C.blue,marginLeft:3}}>ATM</span>}
                        </td>
                        <td style={{padding:'7px 8px',textAlign:'center',color:C.red,...mono,fontWeight:row.put?.inTheMoney?600:400}}>{row.put?.lastPrice?`₹${fmt(row.put.lastPrice)}`:'—'}</td>
                        <td style={{padding:'7px 8px',textAlign:'center',color:C.text3,...mono,fontSize:10}}>{row.put?.openInterest?`${(row.put.openInterest/1000).toFixed(0)}K`:'—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── News ──────────────────────────────────────────────────────────────────────
function NewsFeed() {
  const [articles,setArticles] = useState([]);
  const [loading,setLoading]   = useState(true);
  const [noKey,setNoKey]       = useState(false);

  useEffect(() => {
    axios.get(`${API}/news`).then(r => {
      if (r.data.note) setNoKey(true);
      setArticles(r.data.articles||[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      {noKey && (
        <div style={{background:C.amberD,border:`1px solid #5a4500`,borderRadius:8,padding:'10px 12px',marginBottom:10,fontSize:12,color:C.amber}}>
          Add <code style={{fontFamily:'JetBrains Mono,monospace',background:'rgba(255,255,255,0.05)',padding:'1px 5px',borderRadius:3}}>NEWS_API_KEY</code> to .env for live news · <a href="https://newsapi.org" style={{color:C.blue}}>newsapi.org</a>
        </div>
      )}
      <Card>
        {loading ? <Spinner/> : articles.length===0 ? (
          <div style={{padding:32,textAlign:'center',color:C.text3,fontSize:12}}>No news. Add NEWS_API_KEY to .env</div>
        ) : articles.map((a,i) => (
          <div key={i} style={{padding:'12px 0',borderBottom:i<articles.length-1?`1px solid ${C.bdr}`:'none'}}>
            <a href={a.url} target="_blank" rel="noreferrer" style={{color:C.text,fontSize:13,lineHeight:1.5,fontWeight:400,display:'block',marginBottom:5}}>{a.title}</a>
            <div style={{display:'flex',gap:8,fontSize:11,color:C.text3,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{color:C.text2,fontWeight:500}}>{a.source}</span>
              <span>·</span>
              <span>Sent: <span style={{color:a.sentiment>0.65?C.green:a.sentiment<0.4?C.red:C.amber,fontWeight:600,...mono}}>{Math.round(a.sentiment*100)}%</span></span>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── Paper Trading ─────────────────────────────────────────────────────────────
function PaperTrading() {
  const [stats,setStats]     = useState(null);
  const [loading,setLoading] = useState(true);
  const [closing,setClosing] = useState(null);
  const [exitPrice,setExitPrice] = useState('');
  const [msg,setMsg]         = useState('');

  const load = useCallback(() => {
    axios.get(`${API}/paper/stats`).then(r=>{setStats(r.data);setLoading(false);}).catch(()=>setLoading(false));
  },[]);

  useEffect(() => { load(); }, [load]);

  const closeTrade = async (id) => {
    if (!exitPrice) return;
    try {
      await axios.post(`${API}/paper/trades/${id}/close`, {exit_price:parseFloat(exitPrice),notes:'Manual close'});
      setClosing(null); setExitPrice('');
      setMsg('✓ Trade closed'); setTimeout(()=>setMsg(''),3000);
      load();
    } catch(e) { setMsg('Failed'); }
  };

  const deleteTrade = async (id) => {
    if (!window.confirm('Delete?')) return;
    await axios.delete(`${API}/paper/trades/${id}`);
    load();
  };

  if (loading) return <Spinner/>;
  const trades = stats?.trades||[];
  const open   = trades.filter(t=>t.status==='OPEN');
  const closed = trades.filter(t=>t.status==='CLOSED');

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:10}}>
        <MetCard label="Total trades" value={stats?.total_trades??0}/>
        <MetCard label="Win rate" value={`${stats?.win_rate??0}%`} accent={stats?.win_rate>50?C.green:null}/>
        <MetCard label="Total P&L" value={`₹${fmt(stats?.total_pnl??0,0)}`} accent={gc(stats?.total_pnl||0)} subColor={gc(stats?.total_pnl||0)}/>
        <MetCard label="Open trades" value={stats?.open??0} accent={stats?.open?C.blue:null}/>
      </div>

      {msg && <div style={{background:C.greenD,border:`1px solid ${C.greenB}`,borderRadius:8,padding:'8px 12px',marginBottom:10,fontSize:12,color:C.green,...mono}}>{msg}</div>}

      {open.length>0 && (
        <Card style={{marginBottom:10}}>
          <div style={{fontSize:10,color:C.text3,textTransform:'uppercase',letterSpacing:'.07em',fontWeight:600,marginBottom:10}}>Open trades</div>
          {open.map(t=>(
            <div key={t.id} style={{padding:'12px 0',borderBottom:`1px solid ${C.bdr}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:6}}>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{fontWeight:700,color:C.text,fontSize:14,...mono}}>{t.sym}</span>
                  <Pill type={t.signal}/>
                  <span style={{fontSize:11,color:C.text3,...mono}}>×{t.qty}</span>
                </div>
                <span style={{fontSize:11,color:C.text2,...mono}}>₹{fmt(t.entry)}</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:8}}>
                {[['SL',C.red,`₹${fmt(t.stop_loss)}`],['T1',C.green,`₹${fmt(t.target1)}`],['T2',C.green,`₹${fmt(t.target2)}`]].map(([l,c,v])=>(
                  <div key={l} style={{background:C.bg2,borderRadius:6,padding:'6px 8px',border:`1px solid ${C.bdr}`}}>
                    <div style={{fontSize:9,color:C.text3,marginBottom:2}}>{l}</div>
                    <div style={{fontSize:12,fontWeight:600,color:c,...mono}}>{v}</div>
                  </div>
                ))}
              </div>
              {closing===t.id ? (
                <div style={{display:'flex',gap:6}}>
                  <input style={{flex:1,background:C.bg3,border:`1px solid ${C.bdr2}`,borderRadius:6,padding:'7px 10px',fontSize:12,color:C.text}} placeholder="Exit price ₹" value={exitPrice} onChange={e=>setExitPrice(e.target.value)}/>
                  <button style={{background:C.greenD,border:`1px solid ${C.greenB}`,color:C.green,borderRadius:6,padding:'7px 14px',fontSize:12,fontWeight:600,cursor:'pointer'}} onClick={()=>closeTrade(t.id)}>Confirm</button>
                  <button style={{background:'transparent',border:`1px solid ${C.bdr}`,color:C.text3,borderRadius:6,padding:'7px 10px',fontSize:12,cursor:'pointer'}} onClick={()=>setClosing(null)}>Cancel</button>
                </div>
              ) : (
                <div style={{display:'flex',gap:6}}>
                  <button style={{flex:1,background:C.bg2,border:`1px solid ${C.bdr2}`,color:C.text2,borderRadius:6,padding:'7px',fontSize:12,cursor:'pointer'}} onClick={()=>setClosing(t.id)}>Close trade</button>
                  <button style={{background:'transparent',border:`1px solid ${C.redB}`,color:C.red,borderRadius:6,padding:'7px 12px',fontSize:12,cursor:'pointer'}} onClick={()=>deleteTrade(t.id)}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {closed.length>0 && (
        <Card>
          <div style={{fontSize:10,color:C.text3,textTransform:'uppercase',letterSpacing:'.07em',fontWeight:600,marginBottom:10}}>Closed trades</div>
          {closed.slice().reverse().map(t=>(
            <div key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:`1px solid rgba(33,38,45,.5)`,flexWrap:'wrap',gap:6}}>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <span style={{fontWeight:700,color:C.text,...mono,fontSize:13}}>{t.sym}</span>
                <Pill type={t.signal}/>
              </div>
              <div style={{display:'flex',gap:12,alignItems:'center'}}>
                <span style={{color:C.text2,...mono,fontSize:12}}>₹{fmt(t.entry)} → ₹{fmt(t.exit_price)}</span>
                <span style={{color:gc(t.pnl||0),fontWeight:700,...mono,fontSize:13}}>{(t.pnl||0)>=0?'+':''}₹{fmt(t.pnl||0,0)}</span>
              </div>
            </div>
          ))}
        </Card>
      )}

      {trades.length===0 && (
        <Card style={{textAlign:'center',padding:40}}>
          <div style={{fontSize:13,color:C.text2,marginBottom:6}}>No paper trades yet</div>
          <div style={{fontSize:12,color:C.text3}}>Go to Equity Signals → click a BUY stock → Add to paper trades</div>
        </Card>
      )}
    </div>
  );
}

// ── Bottom Nav (Mobile) ───────────────────────────────────────────────────────
function BottomNav({tab, setTab, isMobile}) {
  if (!isMobile) return null;
  const tabs = [
    {k:'equity',icon:'📊',label:'Signals'},
    {k:'options',icon:'⚡',label:'Options'},
    {k:'paper',icon:'📈',label:'Paper'},
    {k:'news',icon:'📰',label:'News'},
  ];
  return (
    <div style={{position:'fixed',bottom:0,left:0,right:0,background:C.bg1,borderTop:`1px solid ${C.bdr}`,display:'flex',zIndex:100,paddingBottom:'env(safe-area-inset-bottom)'}}>
      {tabs.map(({k,icon,label})=>(
        <button key={k} onClick={()=>setTab(k)} style={{flex:1,background:'none',border:'none',padding:'10px 4px 8px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
          <span style={{fontSize:18}}>{icon}</span>
          <span style={{fontSize:10,color:tab===k?C.green:C.text3,fontWeight:tab===k?600:400}}>{label}</span>
          {tab===k&&<div style={{width:16,height:2,background:C.green,borderRadius:1}}/>}
        </button>
      ))}
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,setTab]           = useState('equity');
  const [overview,setOverview] = useState(null);
  const [selected,setSelected] = useState(null);
  const [apiOk,setApiOk]       = useState(null);
  const [isMobile,setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    axios.get(`${API}/health`).then(()=>setApiOk(true)).catch(()=>setApiOk(false));
    const loadOv = () => axios.get(`${API}/market/overview`).then(r=>setOverview(r.data)).catch(()=>{});
    loadOv();
    const id = setInterval(loadOv, 60000);
    return () => clearInterval(id);
  }, []);

  const desktopTabs = [['equity','Equity signals'],['options','Options'],['paper','Paper trading'],['news','News']];

  return (
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,fontFamily:"'Inter',sans-serif",paddingBottom:isMobile?70:0}}>
      {/* Nav */}
      <nav style={{background:'rgba(10,10,15,0.95)',backdropFilter:'blur(16px)',borderBottom:`1px solid ${C.bdr}`,padding:`0 ${isMobile?12:24}px`,display:'flex',alignItems:'center',height:48,position:'sticky',top:0,zIndex:100,gap:isMobile?8:0}}>
        <div style={{display:'flex',alignItems:'center',gap:6,marginRight:isMobile?'auto':24}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:C.green,animation:'pulse 2s infinite',flexShrink:0}}/>
          <span style={{fontSize:14,fontWeight:700,color:C.text,letterSpacing:'-0.3px',whiteSpace:'nowrap'}}>
            NiftySignal<span style={{color:C.green}}>.</span>AI
          </span>
        </div>

        {!isMobile && (
          <div style={{display:'flex',height:'100%'}}>
            {desktopTabs.map(([k,l])=>(
              <button key={k} style={{padding:'0 14px',height:48,fontSize:12,fontWeight:tab===k?500:400,color:tab===k?C.text:C.text2,cursor:'pointer',border:'none',background:'none',borderBottom:tab===k?`2px solid ${C.green}`:'2px solid transparent',transition:'all .15s',whiteSpace:'nowrap'}} onClick={()=>{setTab(k);setSelected(null);}}>
                {l}
              </button>
            ))}
          </div>
        )}

        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:isMobile?8:16}}>
          {!isMobile && <ISTClock/>}
          <div style={{display:'flex',alignItems:'center',gap:5}}>
            <div style={{width:5,height:5,borderRadius:'50%',background:apiOk===true?C.green:apiOk===false?C.red:C.amber}}/>
            {!isMobile && <span style={{fontSize:11,color:apiOk===true?C.green:apiOk===false?C.red:C.text3,...mono}}>{apiOk===true?'connected':apiOk===false?'offline':'...'}</span>}
          </div>
        </div>
      </nav>

      {/* Main */}
      <div style={{padding:`12px ${isMobile?12:24}px`,maxWidth:1400,margin:'0 auto'}}>
        {apiOk===false && (
          <div style={{background:C.redD,border:`1px solid ${C.redB}`,borderRadius:8,padding:'10px 12px',marginBottom:10,fontSize:12,color:C.red}}>
            Backend offline — check Railway deployment
          </div>
        )}

        {isMobile && (
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <ISTClock/>
            <span style={{fontSize:10,color:apiOk===true?C.green:C.red,...mono}}>{apiOk===true?'● connected':'● offline'}</span>
          </div>
        )}

        <MarketBanner data={overview}/>

        {tab==='equity' && (selected
          ? <StockDetail symbol={selected} onBack={()=>setSelected(null)}/>
          : <StocksList onSelect={s=>{setSelected(s);}}/>
        )}
        {tab==='options' && <OptionsAdvisor/>}
        {tab==='paper'   && <PaperTrading/>}
        {tab==='news'    && <NewsFeed/>}
      </div>

      <BottomNav tab={tab} setTab={(k)=>{setTab(k);setSelected(null);}} isMobile={isMobile}/>

      {!isMobile && (
        <div style={{textAlign:'center',padding:'12px 24px',borderTop:`1px solid ${C.bdr}`,fontSize:10,color:C.text3}}>
          NiftySignal AI · Research purposes only · Not SEBI-registered investment advice
        </div>
      )}
    </div>
  );
}
