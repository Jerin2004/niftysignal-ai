import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const API = import.meta.env.VITE_API_URL || 'https://nifty-ai-production.up.railway.app/api';

// ─── Global CSS ───────────────────────────────────────────────────────────────
const injectCSS = () => {
  if (document.getElementById('ns-css')) return;
  const s = document.createElement('style');
  s.id = 'ns-css';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html{font-size:13px;-webkit-text-size-adjust:100%;}
    body{font-family:'IBM Plex Sans',sans-serif;background:#050608;color:#C8D4E0;line-height:1.5;overflow-x:hidden;}
    ::-webkit-scrollbar{width:2px;height:2px;}
    ::-webkit-scrollbar-thumb{background:#1A2332;}
    input,select,button{font-family:inherit;}
    input:focus,select:focus{outline:none;}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
    @keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
    @keyframes blink{0%,100%{opacity:1}49%{opacity:1}50%{opacity:0}}
    .fu{animation:fadeUp .18s ease both;}
    .rh:hover{background:rgba(255,255,255,.025)!important;}
    .btn:hover{filter:brightness(1.2);}
    @media(max-width:768px){html{font-size:12px;}}
  `;
  document.head.appendChild(s);
};
injectCSS();

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:    '#050608',
  bg1:   '#090C10',
  bg2:   '#0D1117',
  bg3:   '#111820',
  bg4:   '#162030',
  bdr:   '#1A2433',
  bdr2:  '#243040',
  text:  '#E2EBF3',
  t2:    '#7A90A8',
  t3:    '#3A4A5A',
  green: '#00FF88',
  greenD:'#001A0E',
  greenB:'#004422',
  red:   '#FF3344',
  redD:  '#1A0205',
  redB:  '#550A12',
  amber: '#FFB800',
  amberD:'#1A1200',
  amberB:'#553C00',
  blue:  '#0088FF',
  blueD: '#001428',
  blueB: '#003380',
  cyan:  '#00CCFF',
  mono:  "'IBM Plex Mono',monospace",
};

const fmt = (v,d=2) => v!=null ? (+v).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d}) : '—';
const pct = v => v!=null ? `${v>=0?'+':''}${(+v).toFixed(2)}%` : '—';
const gc  = v => v>=0 ? C.green : C.red;
const M   = {fontFamily:C.mono};

// ─── Signal pill ──────────────────────────────────────────────────────────────
const Pill = ({type, lg}) => {
  const map = {
    BUY:     [C.greenD, C.green,  C.greenB],
    SELL:    [C.redD,   C.red,    C.redB],
    HOLD:    [C.amberD, C.amber,  C.amberB],
    CALL:    [C.blueD,  C.blue,   C.blueB],
    PUT:     [C.redD,   '#FF44AA',C.redB],
    NEUTRAL: [C.bg3,    C.t3,     C.bdr],
  };
  const [bg,col,bd] = map[type]||map.NEUTRAL;
  return (
    <span style={{
      background:bg, color:col, border:`1px solid ${bd}`,
      fontSize:lg?11:9, fontWeight:700, letterSpacing:'.08em',
      padding:lg?'3px 10px':'2px 7px', borderRadius:2,
      whiteSpace:'nowrap', textTransform:'uppercase', ...M,
      boxShadow:`0 0 8px ${col}22`
    }}>{type}</span>
  );
};

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spin = ({msg='Fetching...'}) => (
  <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'48px 16px',gap:12}}>
    <div style={{width:16,height:16,border:`1px solid ${C.bdr2}`,borderTopColor:C.green,borderRadius:'50%',animation:'spin .6s linear infinite'}}/>
    <span style={{fontSize:11,color:C.t3,...M}}>{msg}</span>
  </div>
);

// ─── Section label ────────────────────────────────────────────────────────────
const SLabel = ({children}) => (
  <div style={{fontSize:9,color:C.t3,letterSpacing:'.15em',textTransform:'uppercase',marginBottom:8,fontWeight:600,...M}}>
    {children}
  </div>
);

// ─── IST Clock ────────────────────────────────────────────────────────────────
function Clock() {
  const [s, setS] = useState({t:'',open:false});
  useEffect(() => {
    const tick = () => {
      const ist = new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Kolkata'}));
      const h=ist.getHours(),m=ist.getMinutes(),d=ist.getDay();
      const open = d>0&&d<6&&((h>9||(h===9&&m>=15))&&(h<15||(h===15&&m<=30)));
      setS({t:ist.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}),open});
    };
    tick(); const id=setInterval(tick,1000); return()=>clearInterval(id);
  },[]);
  return (
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <div style={{width:5,height:5,borderRadius:'50%',background:s.open?C.green:C.red,animation:s.open?'pulse 2s infinite':'none',boxShadow:s.open?`0 0 6px ${C.green}`:'none'}}/>
      <span style={{fontSize:10,color:s.open?C.green:C.red,fontWeight:600,...M}}>{s.open?'OPEN':'CLOSED'}</span>
      <span style={{fontSize:10,color:C.t3,...M}}>{s.t}</span>
    </div>
  );
}

// ─── Market ticker strip ──────────────────────────────────────────────────────
function TickerStrip({data}) {
  const items = ['NIFTY50','BANKNIFTY','SENSEX','VIX'];
  const labels = {NIFTY50:'NIFTY',BANKNIFTY:'BANKNIFTY',SENSEX:'SENSEX',VIX:'VIX'};
  return (
    <div style={{background:C.bg2,borderBottom:`1px solid ${C.bdr}`,padding:'6px 16px',display:'flex',gap:24,overflowX:'auto',scrollbarWidth:'none'}}>
      {items.map(k => {
        const d = data?.[k];
        const up = (d?.change_pct||0) >= 0;
        return (
          <div key={k} style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
            <span style={{fontSize:10,color:C.t2,fontWeight:600,letterSpacing:'.08em',...M}}>{labels[k]}</span>
            <span style={{fontSize:11,color:C.text,fontWeight:500,...M}}>{d?.value ? fmt(d.value,0) : '—'}</span>
            {d?.change_pct ? (
              <span style={{fontSize:10,color:gc(d.change_pct),...M,fontWeight:600}}>
                {up?'▲':'▼'} {pct(d.change_pct)}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────
const MetCard = ({label, value, sub, subColor, accent, small}) => (
  <div style={{background:C.bg2,border:`1px solid ${accent?accent:C.bdr}`,borderRadius:4,padding:small?'8px 10px':'10px 12px',position:'relative',overflow:'hidden'}}>
    {accent && <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:accent,boxShadow:`0 0 8px ${accent}`}}/>}
    <div style={{fontSize:8,color:C.t3,letterSpacing:'.12em',textTransform:'uppercase',marginBottom:4,fontWeight:600,...M}}>{label}</div>
    <div style={{fontSize:small?14:17,fontWeight:600,color:C.text,...M,letterSpacing:'-0.5px'}}>{value}</div>
    {sub && <div style={{fontSize:9,marginTop:2,color:subColor||C.t3,...M}}>{sub}</div>}
  </div>
);

// ─── Sentiment bar ────────────────────────────────────────────────────────────
const SentBar = ({val}) => {
  const pv = Math.round((val||0)*100);
  const col = val>0.65?C.green:val<0.4?C.red:C.amber;
  return (
    <div>
      <span style={{fontSize:9,color:col,...M,fontWeight:600}}>{pv}%</span>
      <div style={{height:2,background:C.bg4,borderRadius:1,overflow:'hidden',marginTop:2}}>
        <div style={{width:`${pv}%`,height:'100%',background:col,borderRadius:1,boxShadow:`0 0 4px ${col}`}}/>
      </div>
    </div>
  );
};

// ─── Stock card (mobile) ──────────────────────────────────────────────────────
const StockCard = ({s, onClick}) => {
  if (s.error) return null;
  const signalColor = s.signal==='BUY'?C.green:s.signal==='SELL'?C.red:C.amber;
  return (
    <div className="rh fu" onClick={onClick} style={{
      background:C.bg2,
      border:`1px solid ${C.bdr}`,
      borderLeft:`2px solid ${signalColor}`,
      borderRadius:4,
      padding:'10px 12px',
      marginBottom:6,
      cursor:'pointer',
      boxShadow:`-2px 0 12px ${signalColor}11`
    }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
        <div>
          <div style={{fontWeight:600,color:C.text,fontSize:13,...M,letterSpacing:'-.3px'}}>{s.sym}</div>
          <div style={{color:C.t2,fontSize:10,marginTop:1}}>{s.name}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontWeight:600,color:C.text,fontSize:13,...M}}>₹{fmt(s.price)}</div>
          <div style={{color:gc(s.change_pct),fontSize:10,...M,marginTop:1,fontWeight:600}}>{pct(s.change_pct)}</div>
        </div>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',gap:5}}>
          <Pill type={s.signal}/>
          {s.opt_rec && s.opt_rec !== 'NEUTRAL' && <Pill type={s.opt_rec}/>}
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <div>
            <div style={{fontSize:8,color:C.t3,letterSpacing:'.1em',...M}}>RSI</div>
            <div style={{fontSize:10,color:s.rsi<35?C.green:s.rsi>65?C.red:C.t2,...M,fontWeight:600}}>{s.rsi??'—'}</div>
          </div>
          <div style={{width:50}}>
            <div style={{fontSize:8,color:C.t3,letterSpacing:'.1em',...M,marginBottom:1}}>SENT</div>
            <SentBar val={s.sentiment??0.5}/>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Desktop stock row ────────────────────────────────────────────────────────
const StockRow = ({s, onClick, i}) => {
  if (s.error) return null;
  const cols = '80px 1fr 88px 84px 46px 90px 100px';
  return (
    <div className="rh" onClick={onClick} style={{
      display:'grid',gridTemplateColumns:cols,gap:8,
      padding:'8px 14px',
      borderBottom:`1px solid ${C.bdr}11`,
      cursor:'pointer',alignItems:'center',
      animationDelay:`${i*8}ms`
    }}>
      <span style={{fontWeight:600,color:C.text,...M,fontSize:12,letterSpacing:'-.2px'}}>{s.sym}</span>
      <span style={{color:C.t2,fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</span>
      <span style={{color:C.text,...M,fontSize:12}}>₹{fmt(s.price)}</span>
      <span style={{color:gc(s.change_pct),fontWeight:600,...M,fontSize:11}}>{pct(s.change_pct)}</span>
      <span style={{color:s.rsi>65?C.red:s.rsi<35?C.green:C.t3,...M,fontSize:11}}>{s.rsi??'—'}</span>
      <SentBar val={s.sentiment??0.5}/>
      <div style={{display:'flex',gap:4,alignItems:'center'}}>
        <Pill type={s.signal}/>
        {s.opt_rec && s.opt_rec!=='NEUTRAL' && <Pill type={s.opt_rec}/>}
      </div>
    </div>
  );
};

// ─── Stocks list ──────────────────────────────────────────────────────────────
function StocksList({onSelect}) {
  const [stocks, setStocks]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [sector, setSector]     = useState('');
  const [sort, setSort]         = useState('signal');
  const [search, setSearch]     = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth<768);
  const [countdown, setCountdown] = useState(300);
  const prevRef = useRef({});

  useEffect(()=>{
    const r=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener('resize',r); return()=>window.removeEventListener('resize',r);
  },[]);

  const load = useCallback((force=false) => {
    const url = force?`${API}/stocks?force_refresh=true`:`${API}/stocks`;
    axios.get(url,{timeout:15000}).then(r=>{
      const ns = r.data.stocks||r.data||[];
      setStocks(ns); setLoading(false);
      ns.forEach(s=>{ prevRef.current[s.sym]=s.signal; });
    }).catch(()=>setLoading(false));
  },[]);

  useEffect(()=>{
    load();
    const id=setInterval(()=>{
      setCountdown(n=>{if(n<=1){load();return 300;}return n-1;});
    },1000);
    return()=>clearInterval(id);
  },[load]);

  const SECTORS=['Banking','IT','Energy','FMCG','Auto','Pharma','Finance','Infra','Consumer','Conglomerate','Metal','Tech','Healthcare','Retail','Aviation','Defence','Travel'];
  const sigOrd={BUY:0,SELL:1,HOLD:2};
  const valid = stocks.filter(s=>!s.error);
  const filtered = valid
    .filter(s=>(!search||s.sym?.includes(search.toUpperCase())||s.name?.toLowerCase().includes(search.toLowerCase()))&&(!sector||s.sector===sector))
    .sort((a,b)=>sort==='signal'?(sigOrd[a.signal]??2)-(sigOrd[b.signal]??2):sort==='change_pct'?(b.change_pct||0)-(a.change_pct||0):sort==='sentiment'?(b.sentiment||0)-(a.sentiment||0):(a.rsi||50)-(b.rsi||50));

  const buys=valid.filter(s=>s.signal==='BUY').length;
  const sells=valid.filter(s=>s.signal==='SELL').length;
  const holds=valid.filter(s=>s.signal==='HOLD').length;

  return (
    <div>
      {/* Signal summary */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:10}}>
        {[[buys,'BUY SIGNALS',C.green],[holds,'HOLD',C.amber],[sells,'SELL SIGNALS',C.red]].map(([n,l,c])=>(
          <div key={l} style={{background:C.bg2,border:`1px solid ${c}33`,borderRadius:4,padding:'8px 10px',textAlign:'center'}}>
            <div style={{fontSize:18,fontWeight:700,color:c,...M}}>{n}</div>
            <div style={{fontSize:8,color:C.t3,letterSpacing:'.1em',marginTop:2,...M}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap'}}>
        <input
          style={{background:C.bg3,border:`1px solid ${C.bdr2}`,borderRadius:3,padding:'5px 9px',fontSize:11,color:C.text,flex:1,minWidth:90,...M}}
          placeholder="SEARCH..." value={search} onChange={e=>setSearch(e.target.value)}
        />
        <select style={{background:C.bg3,border:`1px solid ${C.bdr2}`,borderRadius:3,padding:'5px 8px',fontSize:11,color:C.text,...M}} value={sector} onChange={e=>setSector(e.target.value)}>
          <option value="">ALL SECTORS</option>
          {SECTORS.map(s=><option key={s}>{s.toUpperCase()}</option>)}
        </select>
        <select style={{background:C.bg3,border:`1px solid ${C.bdr2}`,borderRadius:3,padding:'5px 8px',fontSize:11,color:C.text,...M}} value={sort} onChange={e=>setSort(e.target.value)}>
          <option value="signal">SIGNAL</option>
          <option value="change_pct">CHANGE</option>
          <option value="sentiment">SENTIMENT</option>
          <option value="rsi">RSI</option>
        </select>
        <button className="btn" onClick={()=>load(true)} style={{background:C.bg3,border:`1px solid ${C.bdr2}`,color:C.t2,borderRadius:3,padding:'5px 10px',fontSize:11,cursor:'pointer',...M}}>↺</button>
        <span style={{fontSize:9,color:C.t3,alignSelf:'center',...M}}>{countdown}s</span>
      </div>

      {loading ? <Spin msg="FETCHING NSE DATA..."/> :
        filtered.length===0 ? <div style={{padding:32,textAlign:'center',color:C.t3,fontSize:11,...M}}>NO STOCKS FOUND</div> :
        isMobile ? (
          filtered.map(s=><StockCard key={s.sym} s={s} onClick={()=>onSelect(s.sym)}/>)
        ) : (
          <div style={{background:C.bg2,border:`1px solid ${C.bdr}`,borderRadius:4,overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'80px 1fr 88px 84px 46px 90px 100px',gap:8,padding:'6px 14px',fontSize:8,color:C.t3,fontWeight:700,letterSpacing:'.12em',background:C.bg3,borderBottom:`1px solid ${C.bdr}`,...M}}>
              <span>SYMBOL</span><span>COMPANY</span><span>PRICE</span><span>CHANGE</span><span>RSI</span><span>SENTIMENT</span><span>SIGNAL</span>
            </div>
            {filtered.map((s,i)=><StockRow key={s.sym} s={s} i={i} onClick={()=>onSelect(s.sym)}/>)}
          </div>
        )
      }
    </div>
  );
}

// ─── Stock detail ─────────────────────────────────────────────────────────────
function StockDetail({symbol, onBack}) {
  const [data,setData]     = useState(null);
  const [plan,setPlan]     = useState(null);
  const [chart,setChart]   = useState([]);
  const [period,setPeriod] = useState('3mo');
  const [loading,setLoading] = useState(true);
  const [msg,setMsg]       = useState('');

  useEffect(()=>{
    setLoading(true);
    Promise.all([
      axios.get(`${API}/stock/${symbol}`),
      axios.get(`${API}/chart/${symbol}?period=3mo`),
      axios.get(`${API}/trade-plan/${symbol}?capital=100000`),
    ]).then(([dr,cr,tr])=>{
      setData(dr.data); setChart(cr.data.data||[]); setPlan(tr.data); setLoading(false);
    }).catch(()=>setLoading(false));
  },[symbol]);

  useEffect(()=>{
    axios.get(`${API}/chart/${symbol}?period=${period}`).then(r=>setChart(r.data.data||[])).catch(()=>{});
  },[symbol,period]);

  const addPaper = async() => {
    if(!plan?.stop_loss){setMsg('NO TRADE SETUP');return;}
    try{
      await axios.post(`${API}/paper/trades`,{sym:symbol,signal:plan.signal,entry:plan.entry,stop_loss:plan.stop_loss,target1:plan.target1,target2:plan.target2,qty:plan.position_sizing?.quantity||1,notes:''});
      setMsg('✓ LOGGED');setTimeout(()=>setMsg(''),3000);
    }catch{setMsg('FAILED');}
  };

  if(loading) return <Spin msg={`LOADING ${symbol}...`}/>;
  if(!data) return <div style={{padding:20,textAlign:'center',color:C.red,fontSize:11,...M}}>FAILED TO LOAD {symbol}</div>;

  const up = (data.change_pct||0)>=0;
  const chartColor = up?C.green:C.red;
  const hasSignal = plan?.signal==='BUY'||plan?.signal==='SELL';

  return (
    <div className="fu">
      <button onClick={onBack} style={{background:'transparent',border:`1px solid ${C.bdr}`,color:C.t2,padding:'4px 10px',borderRadius:3,fontSize:10,cursor:'pointer',marginBottom:12,...M,letterSpacing:'.08em'}}>← BACK</button>

      {/* Header */}
      <div style={{borderLeft:`3px solid ${up?C.green:C.red}`,paddingLeft:12,marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{fontSize:22,fontWeight:700,color:C.text,...M,letterSpacing:'-1px'}}>{data.sym}</div>
            <div style={{color:C.t2,fontSize:11,marginTop:2}}>{data.name} <span style={{color:C.t3}}>·</span> {data.sector}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:24,fontWeight:700,...M,color:C.text}}>₹{fmt(data.price)}</div>
            <div style={{color:gc(data.change_pct),fontWeight:700,...M,fontSize:12,marginTop:2}}>{pct(data.change_pct)}</div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:10}}>
        {[['RSI',data.rsi,data.rsi<35?C.green:data.rsi>65?C.red:null],['52W HIGH',data.week_high?`₹${fmt(data.week_high,0)}`:'—',null],['52W LOW',data.week_low?`₹${fmt(data.week_low,0)}`:'—',null]].map(([l,v,ac])=>(
          <MetCard key={l} label={l} value={v??'—'} accent={ac} small/>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:10}}>
        {[['P/E',data.pe_ratio?fmt(data.pe_ratio):'—',null],['BETA',data.beta?fmt(data.beta):'—',null],['SENTIMENT',data.sentiment?`${Math.round(data.sentiment*100)}%`:'—',null]].map(([l,v,ac])=>(
          <MetCard key={l} label={l} value={v??'—'} accent={ac} small/>
        ))}
      </div>

      {/* Trade setup */}
      {hasSignal && plan && (
        <div style={{background:C.bg2,border:`1px solid ${plan.signal==='BUY'?C.greenB:C.redB}`,borderRadius:4,padding:12,marginBottom:10,position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:plan.signal==='BUY'?C.green:C.red,boxShadow:`0 0 12px ${plan.signal==='BUY'?C.green:C.red}`}}/>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:6}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <SLabel>TRADE SETUP</SLabel>
              <Pill type={plan.signal} lg/>
            </div>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <span style={{fontSize:10,color:C.t2,...M}}>{plan.trade_quality}</span>
              <span style={{fontSize:13,fontWeight:700,...M,color:plan.rr_ratio>=2?C.green:plan.rr_ratio>=1?C.amber:C.red}}>R:R 1:{plan.rr_ratio}</span>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:8}}>
            {[['ENTRY',C.text,`₹${fmt(plan.entry)}`],['STOP LOSS',C.red,`₹${fmt(plan.stop_loss)}`],['TARGET 1',C.green,`₹${fmt(plan.target1)}`],['TARGET 2',C.green,`₹${fmt(plan.target2)}`]].map(([l,c,v])=>(
              <div key={l} style={{background:C.bg3,borderRadius:3,padding:'8px 10px',border:`1px solid ${C.bdr}`}}>
                <div style={{fontSize:8,color:C.t3,letterSpacing:'.12em',marginBottom:3,...M}}>{l}</div>
                <div style={{fontSize:15,fontWeight:700,color:c,...M}}>{v}</div>
              </div>
            ))}
          </div>

          {plan.position_sizing && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:10}}>
              {[['QTY (1% RISK)',C.text,plan.position_sizing.quantity],['TOTAL COST',C.t2,`₹${fmt(plan.position_sizing.total_cost,0)}`]].map(([l,c,v])=>(
                <div key={l} style={{background:C.bg3,borderRadius:3,padding:'8px 10px',border:`1px solid ${C.bdr}`}}>
                  <div style={{fontSize:8,color:C.t3,letterSpacing:'.12em',marginBottom:3,...M}}>{l}</div>
                  <div style={{fontSize:14,fontWeight:600,color:c,...M}}>{v}</div>
                </div>
              ))}
            </div>
          )}

          <button className="btn" onClick={addPaper} style={{
            width:'100%',background:C.greenD,border:`1px solid ${C.greenB}`,
            color:C.green,borderRadius:3,padding:'9px',fontSize:11,fontWeight:700,cursor:'pointer',...M,
            letterSpacing:'.08em',boxShadow:`0 0 12px ${C.green}22`
          }}>+ ADD TO PAPER TRADES</button>
          {msg&&<div style={{marginTop:6,fontSize:10,color:msg.startsWith('✓')?C.green:C.red,...M,textAlign:'center'}}>{msg}</div>}
        </div>
      )}

      {/* Chart */}
      <div style={{background:C.bg2,border:`1px solid ${C.bdr}`,borderRadius:4,padding:'10px 12px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <SLabel>PRICE CHART</SLabel>
          <div style={{display:'flex',gap:3}}>
            {['1mo','3mo','6mo','1y'].map(p=>(
              <button key={p} onClick={()=>setPeriod(p)} style={{background:period===p?C.bg4:'transparent',border:`1px solid ${period===p?C.bdr2:C.bdr}`,color:period===p?C.text:C.t3,borderRadius:2,padding:'2px 7px',fontSize:9,cursor:'pointer',...M,letterSpacing:'.06em'}}>{p.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chart} margin={{top:4,right:0,left:0,bottom:0}}>
            <defs>
              <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColor} stopOpacity={0.15}/>
                <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="1 4" stroke={C.bdr} vertical={false} opacity={0.5}/>
            <XAxis dataKey="date" tick={{fontSize:8,fill:C.t3,fontFamily:C.mono}} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
            <YAxis tick={{fontSize:8,fill:C.t3,fontFamily:C.mono}} tickLine={false} axisLine={false} tickFormatter={v=>`₹${Math.round(v)}`} width={52}/>
            <Tooltip contentStyle={{background:C.bg3,border:`1px solid ${C.bdr2}`,borderRadius:3,fontSize:10,fontFamily:C.mono}} formatter={v=>[`₹${fmt(v)}`,'CLOSE']} labelStyle={{color:C.t2}}/>
            <Area type="monotone" dataKey="close" stroke={chartColor} strokeWidth={1.5} fill="url(#cg)" dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Options ──────────────────────────────────────────────────────────────────
function Options() {
  const [sym,setSym]     = useState('RELIANCE');
  const [data,setData]   = useState(null);
  const [loading,setLoading] = useState(false);
  const SYMS = ['RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','WIPRO','TATAMOTORS','SBIN','ITC','KOTAKBANK','AXISBANK','HCLTECH','BAJFINANCE','MARUTI','SUNPHARMA'];

  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}}>
        <select style={{background:C.bg3,border:`1px solid ${C.bdr2}`,borderRadius:3,padding:'7px 10px',fontSize:11,color:C.text,flex:1,...M}} value={sym} onChange={e=>setSym(e.target.value)}>
          {SYMS.map(s=><option key={s}>{s}</option>)}
        </select>
        <button className="btn" onClick={()=>{setLoading(true);axios.get(`${API}/options/${sym}`).then(r=>{setData(r.data);setLoading(false);}).catch(()=>setLoading(false));}}
          style={{background:C.greenD,border:`1px solid ${C.greenB}`,color:C.green,borderRadius:3,padding:'7px 16px',fontSize:11,fontWeight:700,cursor:'pointer',...M,letterSpacing:'.08em'}}>
          ANALYZE
        </button>
      </div>
      {loading&&<Spin msg="FETCHING OPTIONS..."/>}
      {data&&!loading&&(
        <div className="fu">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:10}}>
            <MetCard label="SPOT PRICE" value={`₹${fmt(data.spot)}`} small/>
            <MetCard label="ATM STRIKE" value={`₹${data.atm_strike}`} small/>
          </div>
          <div style={{background:C.bg2,border:`1px solid ${C.bdr}`,borderRadius:4,overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 60px 1fr',borderBottom:`1px solid ${C.bdr}`,padding:'6px 10px'}}>
              <div style={{fontSize:8,color:C.green,fontWeight:700,letterSpacing:'.1em',...M,textAlign:'center'}}>CALLS</div>
              <div style={{fontSize:8,color:C.t3,fontWeight:700,letterSpacing:'.1em',...M,textAlign:'center'}}>STRIKE</div>
              <div style={{fontSize:8,color:C.red,fontWeight:700,letterSpacing:'.1em',...M,textAlign:'center'}}>PUTS</div>
            </div>
            {(data.chain||[]).map((row,i)=>{
              const isATM = row.strike===data.atm_strike;
              return (
                <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 60px 1fr',borderBottom:`1px solid ${C.bdr}11`,background:isATM?`${C.blue}11`:'transparent'}}>
                  <div style={{padding:'6px 10px',textAlign:'center'}}>
                    <div style={{fontSize:11,color:C.green,...M,fontWeight:row.call?.inTheMoney?700:400}}>{row.call?.lastPrice?`₹${fmt(row.call.lastPrice)}`:'—'}</div>
                    <div style={{fontSize:8,color:C.t3,...M}}>{row.call?.openInterest?`${(row.call.openInterest/1000).toFixed(0)}K OI`:'—'}</div>
                  </div>
                  <div style={{padding:'6px',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',borderLeft:`1px solid ${C.bdr}22`,borderRight:`1px solid ${C.bdr}22`}}>
                    <span style={{fontSize:isATM?12:10,fontWeight:isATM?700:500,color:isATM?C.cyan:C.t2,...M}}>
                      {row.strike}{isATM&&<span style={{fontSize:7,color:C.cyan,marginLeft:2}}>ATM</span>}
                    </span>
                  </div>
                  <div style={{padding:'6px 10px',textAlign:'center'}}>
                    <div style={{fontSize:11,color:C.red,...M,fontWeight:row.put?.inTheMoney?700:400}}>{row.put?.lastPrice?`₹${fmt(row.put.lastPrice)}`:'—'}</div>
                    <div style={{fontSize:8,color:C.t3,...M}}>{row.put?.openInterest?`${(row.put.openInterest/1000).toFixed(0)}K OI`:'—'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── News ─────────────────────────────────────────────────────────────────────
function News() {
  const [articles,setArticles] = useState([]);
  const [loading,setLoading]   = useState(true);
  const [noKey,setNoKey]       = useState(false);

  useEffect(()=>{
    axios.get(`${API}/news`).then(r=>{
      if(r.data.note) setNoKey(true);
      setArticles(r.data.articles||[]); setLoading(false);
    }).catch(()=>setLoading(false));
  },[]);

  return (
    <div>
      {noKey&&<div style={{background:C.amberD,border:`1px solid ${C.amberB}`,borderRadius:3,padding:'8px 12px',marginBottom:10,fontSize:10,color:C.amber,...M}}>
        ADD NEWS_API_KEY TO .ENV FOR LIVE NEWS · newsapi.org
      </div>}
      {loading?<Spin msg="LOADING NEWS..."/>:articles.length===0?
        <div style={{padding:32,textAlign:'center',color:C.t3,fontSize:11,...M}}>NO NEWS DATA</div>:
        articles.map((a,i)=>(
          <div key={i} style={{borderBottom:`1px solid ${C.bdr}22`,padding:'10px 0'}}>
            <a href={a.url} target="_blank" rel="noreferrer" style={{color:C.text,fontSize:12,lineHeight:1.5,display:'block',marginBottom:4,textDecoration:'none'}}>{a.title}</a>
            <div style={{display:'flex',gap:10,fontSize:9,color:C.t3,alignItems:'center',...M}}>
              <span style={{color:C.t2,fontWeight:600}}>{a.source}</span>
              <span>SENT: <span style={{color:a.sentiment>0.65?C.green:a.sentiment<0.4?C.red:C.amber,fontWeight:700}}>{Math.round(a.sentiment*100)}%</span></span>
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ─── Paper trading ────────────────────────────────────────────────────────────
function PaperTrading() {
  const [stats,setStats]     = useState(null);
  const [loading,setLoading] = useState(true);
  const [closing,setClosing] = useState(null);
  const [exitPrice,setExitPrice] = useState('');
  const [msg,setMsg]         = useState('');

  const load = useCallback(()=>{
    axios.get(`${API}/paper/stats`).then(r=>{setStats(r.data);setLoading(false);}).catch(()=>setLoading(false));
  },[]);

  useEffect(()=>{load();},[load]);

  const closeTrade = async(id) => {
    if(!exitPrice) return;
    try{
      await axios.post(`${API}/paper/trades/${id}/close`,{exit_price:parseFloat(exitPrice),notes:'Manual close'});
      setClosing(null); setExitPrice(''); setMsg('✓ CLOSED'); setTimeout(()=>setMsg(''),3000); load();
    }catch{setMsg('FAILED');}
  };

  const del = async(id)=>{
    if(!window.confirm('DELETE?')) return;
    await axios.delete(`${API}/paper/trades/${id}`); load();
  };

  if(loading) return <Spin/>;
  const trades = stats?.trades||[];
  const open   = trades.filter(t=>t.status==='OPEN');
  const closed = trades.filter(t=>t.status==='CLOSED');

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:12}}>
        <MetCard label="TOTAL TRADES" value={stats?.total_trades??0} small/>
        <MetCard label="WIN RATE" value={`${stats?.win_rate??0}%`} accent={stats?.win_rate>50?C.green:null} small/>
        <MetCard label="TOTAL P&L" value={`₹${fmt(stats?.total_pnl??0,0)}`} accent={gc(stats?.total_pnl||0)} subColor={gc(stats?.total_pnl||0)} small/>
        <MetCard label="OPEN TRADES" value={stats?.open??0} accent={stats?.open?C.blue:null} small/>
      </div>

      {msg&&<div style={{background:C.greenD,border:`1px solid ${C.greenB}`,borderRadius:3,padding:'6px 10px',marginBottom:8,fontSize:10,color:C.green,...M}}>{msg}</div>}

      {open.length>0&&(
        <div style={{marginBottom:10}}>
          <SLabel>OPEN TRADES</SLabel>
          {open.map(t=>(
            <div key={t.id} style={{background:C.bg2,border:`1px solid ${C.bdr}`,borderRadius:4,padding:'10px 12px',marginBottom:6}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:6}}>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <span style={{fontWeight:700,color:C.text,fontSize:13,...M}}>{t.sym}</span>
                  <Pill type={t.signal}/>
                  <span style={{fontSize:9,color:C.t3,...M}}>×{t.qty} @ ₹{fmt(t.entry)}</span>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4,marginBottom:8}}>
                {[['SL',C.red,`₹${fmt(t.stop_loss)}`],['T1',C.green,`₹${fmt(t.target1)}`],['T2',C.green,`₹${fmt(t.target2)}`]].map(([l,c,v])=>(
                  <div key={l} style={{background:C.bg3,borderRadius:2,padding:'5px 7px',border:`1px solid ${C.bdr}`}}>
                    <div style={{fontSize:7,color:C.t3,...M,letterSpacing:'.1em'}}>{l}</div>
                    <div style={{fontSize:11,fontWeight:700,color:c,...M}}>{v}</div>
                  </div>
                ))}
              </div>
              {closing===t.id?(
                <div style={{display:'flex',gap:5}}>
                  <input style={{flex:1,background:C.bg3,border:`1px solid ${C.bdr2}`,borderRadius:2,padding:'6px 8px',fontSize:11,color:C.text,...M}} placeholder="EXIT ₹" value={exitPrice} onChange={e=>setExitPrice(e.target.value)}/>
                  <button style={{background:C.greenD,border:`1px solid ${C.greenB}`,color:C.green,borderRadius:2,padding:'6px 12px',fontSize:10,fontWeight:700,cursor:'pointer',...M}} onClick={()=>closeTrade(t.id)}>CONFIRM</button>
                  <button style={{background:'transparent',border:`1px solid ${C.bdr}`,color:C.t3,borderRadius:2,padding:'6px 10px',fontSize:10,cursor:'pointer',...M}} onClick={()=>setClosing(null)}>✕</button>
                </div>
              ):(
                <div style={{display:'flex',gap:5}}>
                  <button style={{flex:1,background:C.bg3,border:`1px solid ${C.bdr2}`,color:C.t2,borderRadius:2,padding:'6px',fontSize:10,cursor:'pointer',...M,letterSpacing:'.06em'}} onClick={()=>setClosing(t.id)}>CLOSE</button>
                  <button style={{background:'transparent',border:`1px solid ${C.redB}`,color:C.red,borderRadius:2,padding:'6px 10px',fontSize:10,cursor:'pointer',...M}} onClick={()=>del(t.id)}>DELETE</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {closed.length>0&&(
        <div>
          <SLabel>CLOSED TRADES</SLabel>
          {closed.slice().reverse().map(t=>(
            <div key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${C.bdr}22`,flexWrap:'wrap',gap:4}}>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <span style={{fontWeight:700,color:C.text,...M,fontSize:12}}>{t.sym}</span>
                <Pill type={t.signal}/>
              </div>
              <div style={{display:'flex',gap:10,alignItems:'center'}}>
                <span style={{color:C.t2,...M,fontSize:10}}>₹{fmt(t.entry)}→₹{fmt(t.exit_price)}</span>
                <span style={{color:gc(t.pnl||0),fontWeight:700,...M,fontSize:12}}>{(t.pnl||0)>=0?'+':''}₹{fmt(t.pnl||0,0)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {trades.length===0&&(
        <div style={{padding:40,textAlign:'center'}}>
          <div style={{fontSize:12,color:C.t2,marginBottom:4,...M}}>NO PAPER TRADES</div>
          <div style={{fontSize:10,color:C.t3}}>Go to Equity Signals → click a BUY stock → Add to paper trades</div>
        </div>
      )}
    </div>
  );
}

// ─── Bottom nav ───────────────────────────────────────────────────────────────
function BottomNav({tab,setTab}) {
  const tabs=[{k:'equity',icon:'◈',l:'SIGNALS'},{k:'options',icon:'⚡',l:'OPTIONS'},{k:'paper',icon:'◉',l:'PAPER'},{k:'news',icon:'◎',l:'NEWS'}];
  return (
    <div style={{position:'fixed',bottom:0,left:0,right:0,background:C.bg1,borderTop:`1px solid ${C.bdr}`,display:'flex',zIndex:100,paddingBottom:'env(safe-area-inset-bottom)'}}>
      {tabs.map(({k,icon,l})=>(
        <button key={k} onClick={()=>setTab(k)} style={{flex:1,background:'none',border:'none',padding:'10px 4px 8px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
          <span style={{fontSize:14,color:tab===k?C.green:C.t3}}>{icon}</span>
          <span style={{fontSize:8,color:tab===k?C.green:C.t3,fontWeight:700,letterSpacing:'.1em',...M}}>{l}</span>
          {tab===k&&<div style={{width:20,height:1,background:C.green,boxShadow:`0 0 6px ${C.green}`}}/>}
        </button>
      ))}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,setTab]       = useState('equity');
  const [overview,setOv]   = useState(null);
  const [selected,setSel]  = useState(null);
  const [apiOk,setApiOk]   = useState(null);
  const [isMobile,setMob]  = useState(window.innerWidth<768);

  useEffect(()=>{
    const r=()=>setMob(window.innerWidth<768);
    window.addEventListener('resize',r); return()=>window.removeEventListener('resize',r);
  },[]);

  useEffect(()=>{
    axios.get(`${API}/health`).then(()=>setApiOk(true)).catch(()=>setApiOk(false));
    const ov=()=>axios.get(`${API}/market/overview`).then(r=>setOv(r.data)).catch(()=>{});
    ov(); const id=setInterval(ov,60000); return()=>clearInterval(id);
  },[]);

  const tabs=[['equity','SIGNALS'],['options','OPTIONS'],['paper','PAPER'],['news','NEWS']];

  return (
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,fontFamily:"'IBM Plex Sans',sans-serif",paddingBottom:isMobile?65:0}}>
      {/* Navbar */}
      <nav style={{background:C.bg1,borderBottom:`1px solid ${C.bdr}`,padding:`0 ${isMobile?12:20}px`,height:44,display:'flex',alignItems:'center',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginRight:isMobile?'auto':24}}>
          <div style={{width:6,height:6,background:C.green,borderRadius:'50%',animation:'pulse 2s infinite',boxShadow:`0 0 8px ${C.green}`}}/>
          <span style={{fontSize:13,fontWeight:600,color:C.text,...M,letterSpacing:'-.3px'}}>
            NIFTY<span style={{color:C.green}}>SIGNAL</span><span style={{color:C.t3,fontWeight:400}}>.AI</span>
          </span>
        </div>

        {!isMobile&&(
          <div style={{display:'flex',height:'100%'}}>
            {tabs.map(([k,l])=>(
              <button key={k} onClick={()=>{setTab(k);setSel(null);}} style={{
                padding:'0 14px',height:44,fontSize:10,fontWeight:700,letterSpacing:'.1em',
                color:tab===k?C.green:C.t3,cursor:'pointer',border:'none',background:'none',
                borderBottom:tab===k?`1px solid ${C.green}`:'1px solid transparent',
                ...M, transition:'color .15s'
              }}>{l}</button>
            ))}
          </div>
        )}

        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:isMobile?8:16}}>
          {!isMobile&&<Clock/>}
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <div style={{width:4,height:4,borderRadius:'50%',background:apiOk===true?C.green:apiOk===false?C.red:C.amber,boxShadow:apiOk===true?`0 0 5px ${C.green}`:undefined}}/>
            {!isMobile&&<span style={{fontSize:9,color:apiOk===true?C.green:apiOk===false?C.red:C.t3,...M,letterSpacing:'.08em'}}>{apiOk===true?'CONNECTED':apiOk===false?'OFFLINE':'...'}</span>}
          </div>
        </div>
      </nav>

      {/* Ticker */}
      <TickerStrip data={overview}/>

      {/* Mobile header extras */}
      {isMobile&&(
        <div style={{padding:'6px 12px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:`1px solid ${C.bdr}22`}}>
          <Clock/>
          <span style={{fontSize:9,color:apiOk===true?C.green:C.red,...M,fontWeight:700}}>{apiOk===true?'● CONNECTED':'● OFFLINE'}</span>
        </div>
      )}

      {/* Content */}
      <div style={{padding:`10px ${isMobile?12:20}px`,maxWidth:1440,margin:'0 auto'}}>
        {apiOk===false&&(
          <div style={{background:C.redD,border:`1px solid ${C.redB}`,borderRadius:3,padding:'8px 12px',marginBottom:10,fontSize:10,color:C.red,...M,letterSpacing:'.04em'}}>
            BACKEND OFFLINE — CHECK RAILWAY DEPLOYMENT
          </div>
        )}

        {tab==='equity'&&(selected
          ?<StockDetail symbol={selected} onBack={()=>setSel(null)}/>
          :<StocksList onSelect={s=>{setSel(s);}}/>
        )}
        {tab==='options'&&<Options/>}
        {tab==='paper'&&<PaperTrading/>}
        {tab==='news'&&<News/>}
      </div>

      {isMobile&&<BottomNav tab={tab} setTab={k=>{setTab(k);setSel(null);}}/>}

      {!isMobile&&(
        <div style={{textAlign:'center',padding:'10px 20px',borderTop:`1px solid ${C.bdr}22`,fontSize:8,color:C.t3,...M,letterSpacing:'.1em'}}>
          NIFTYSIGNAL.AI · FOR RESEARCH PURPOSES ONLY · NOT SEBI-REGISTERED INVESTMENT ADVICE
        </div>
      )}
    </div>
  );
}
