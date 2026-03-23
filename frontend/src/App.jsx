import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const API = import.meta.env.VITE_API_URL || 'https://nifty-ai-production.up.railway.app/api';

const injectCSS = () => {
  if (document.getElementById('ns-css')) return;
  const s = document.createElement('style');
  s.id = 'ns-css';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html{font-size:14px;-webkit-text-size-adjust:100%;}
    body{font-family:'Plus Jakarta Sans',sans-serif;background:#F7F8FA;color:#1A1D23;line-height:1.5;overflow-x:hidden;}
    ::-webkit-scrollbar{width:4px;height:4px;}
    ::-webkit-scrollbar-thumb{background:#E2E5EA;border-radius:4px;}
    input,select,button{font-family:inherit;}
    input:focus,select:focus{outline:none;}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    .fu{animation:fadeUp .2s ease both;}
    .card-hover{transition:box-shadow .15s,transform .15s;}
    .card-hover:hover{box-shadow:0 4px 20px rgba(0,0,0,.08)!important;transform:translateY(-1px);}
    .btn-hover:hover{filter:brightness(.95);}
    @media(max-width:768px){html{font-size:13px;}}
  `;
  document.head.appendChild(s);
};
injectCSS();

const C = {
  bg:     '#F7F8FA',
  bg1:    '#FFFFFF',
  bg2:    '#F0F2F5',
  bg3:    '#E8EBF0',
  bdr:    '#E2E5EA',
  bdr2:   '#D0D5DD',
  text:   '#1A1D23',
  t2:     '#5C6370',
  t3:     '#9CA3AF',
  green:  '#00A86B',
  greenL: '#E6F7F1',
  greenB: '#00A86B',
  red:    '#E53E3E',
  redL:   '#FEF2F2',
  redB:   '#E53E3E',
  amber:  '#D97706',
  amberL: '#FFFBEB',
  blue:   '#2563EB',
  blueL:  '#EFF6FF',
  purple: '#7C3AED',
  purpleL:'#F5F3FF',
};

const fmt = (v,d=2) => v!=null?(+v).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const pct = v => v!=null?`${v>=0?'+':''}${(+v).toFixed(2)}%`:'—';
const gc  = v => v>=0?C.green:C.red;
const gcBg= v => v>=0?C.greenL:C.redL;

const Pill = ({type, size='sm'}) => {
  const map = {
    BUY:     {bg:C.greenL, color:C.green,  border:'#A7F3D0', label:'BUY'},
    SELL:    {bg:C.redL,   color:C.red,    border:'#FECACA', label:'SELL'},
    HOLD:    {bg:C.amberL, color:C.amber,  border:'#FDE68A', label:'HOLD'},
    CALL:    {bg:C.blueL,  color:C.blue,   border:'#BFDBFE', label:'CALL'},
    PUT:     {bg:'#FDF2F8',color:'#BE185D', border:'#FBCFE8', label:'PUT'},
    NEUTRAL: {bg:C.bg2,    color:C.t3,     border:C.bdr,     label:'—'},
    EXCELLENT:{bg:C.greenL,color:C.green,  border:'#A7F3D0', label:'EXCELLENT'},
    GOOD:    {bg:C.blueL,  color:C.blue,   border:'#BFDBFE', label:'GOOD'},
    FAIR:    {bg:C.amberL, color:C.amber,  border:'#FDE68A', label:'FAIR'},
    POOR:    {bg:C.redL,   color:C.red,    border:'#FECACA', label:'POOR'},
  };
  const s = map[type]||map.NEUTRAL;
  const p = size==='lg'?'4px 12px':'3px 8px';
  const fs = size==='lg'?12:10;
  return (
    <span style={{background:s.bg,color:s.color,border:`1px solid ${s.border}`,
      fontSize:fs,fontWeight:600,padding:p,borderRadius:20,whiteSpace:'nowrap',letterSpacing:'.02em'}}>
      {s.label}
    </span>
  );
};

const Spin = ({msg='Loading...'}) => (
  <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'48px 16px',gap:12}}>
    <div style={{width:20,height:20,border:`2px solid ${C.bdr}`,borderTopColor:C.blue,borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
    <span style={{fontSize:12,color:C.t3}}>{msg}</span>
  </div>
);

const Tag = ({children,color}) => (
  <span style={{background:color+'18',color:color,fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:4,letterSpacing:'.03em'}}>{children}</span>
);

// Clock
function Clock() {
  const [s,setS] = useState({t:'',open:false});
  useEffect(()=>{
    const tick=()=>{
      const ist=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Kolkata'}));
      const h=ist.getHours(),m=ist.getMinutes(),d=ist.getDay();
      const open=d>0&&d<6&&((h>9||(h===9&&m>=15))&&(h<15||(h===15&&m<=30)));
      setS({t:ist.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}),open});
    };
    tick(); const id=setInterval(tick,1000); return()=>clearInterval(id);
  },[]);
  return (
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <div style={{width:7,height:7,borderRadius:'50%',background:s.open?C.green:C.red,animation:s.open?'pulse 2s infinite':'none'}}/>
      <span style={{fontSize:12,color:s.open?C.green:C.red,fontWeight:600}}>{s.open?'Market Open':'Market Closed'}</span>
      <span style={{fontSize:11,color:C.t3}}>{s.t} IST</span>
    </div>
  );
}

// Market banner
function MarketBanner({data}) {
  const items = [
    {k:'NIFTY50',l:'Nifty 50'},
    {k:'BANKNIFTY',l:'Bank Nifty'},
    {k:'SENSEX',l:'Sensex'},
    {k:'VIX',l:'India VIX'},
  ];
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:16}}>
      {items.map(({k,l})=>{
        const d = data?.[k];
        const up = (d?.change_pct||0)>=0;
        return (
          <div key={k} style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:12,padding:'12px 14px',boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
            <div style={{fontSize:11,color:C.t3,fontWeight:500,marginBottom:4}}>{l}</div>
            <div style={{fontSize:18,fontWeight:700,color:C.text,letterSpacing:'-.5px'}}>{d?.value?fmt(d.value,0):'—'}</div>
            {d?.change_pct!=null?(
              <div style={{display:'flex',alignItems:'center',gap:4,marginTop:3}}>
                <span style={{fontSize:11,color:gc(d.change_pct),fontWeight:600}}>{up?'▲':'▼'} {pct(d.change_pct)}</span>
              </div>
            ):<div style={{fontSize:11,color:C.t3,marginTop:3}}>Updating...</div>}
          </div>
        );
      })}
    </div>
  );
}

// Signal bar
function SignalBar({stocks}) {
  const valid = stocks.filter(s=>!s.error&&s.signal);
  const buys = valid.filter(s=>s.signal==='BUY').length;
  const sells = valid.filter(s=>s.signal==='SELL').length;
  const holds = valid.filter(s=>s.signal==='HOLD').length;
  const total = buys+sells+holds||1;
  return (
    <div style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:12,padding:'12px 14px',marginBottom:12,boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <span style={{fontSize:12,fontWeight:600,color:C.text}}>Market Sentiment</span>
        <span style={{fontSize:11,color:C.t3}}>{valid.length} stocks tracked</span>
      </div>
      <div style={{display:'flex',height:6,borderRadius:6,overflow:'hidden',gap:2,marginBottom:8}}>
        <div style={{width:`${buys/total*100}%`,background:C.green,borderRadius:6,transition:'width .3s'}}/>
        <div style={{width:`${holds/total*100}%`,background:'#FCD34D',borderRadius:6}}/>
        <div style={{width:`${sells/total*100}%`,background:C.red,borderRadius:6}}/>
      </div>
      <div style={{display:'flex',gap:16}}>
        {[[buys,'Buy',C.green],[holds,'Hold','#D97706'],[sells,'Sell',C.red]].map(([n,l,c])=>(
          <div key={l} style={{display:'flex',alignItems:'center',gap:5}}>
            <div style={{width:8,height:8,borderRadius:2,background:c}}/>
            <span style={{fontSize:11,fontWeight:600,color:c}}>{n} {l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Stock card mobile
function StockCard({s,onClick}) {
  if(s.error) return null;
  const isUp = (s.change_pct||0)>=0;
  const sigColor = s.signal==='BUY'?C.green:s.signal==='SELL'?C.red:C.amber;
  return (
    <div className="card-hover" onClick={onClick} style={{
      background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:14,
      padding:'14px 16px',marginBottom:10,cursor:'pointer',
      boxShadow:'0 1px 4px rgba(0,0,0,.05)',
      borderTop:`3px solid ${sigColor}`
    }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
        <div>
          <div style={{fontWeight:700,fontSize:15,color:C.text,letterSpacing:'-.3px'}}>{s.sym}</div>
          <div style={{fontSize:11,color:C.t3,marginTop:2}}>{s.name}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontWeight:700,fontSize:16,color:C.text}}>₹{fmt(s.price)}</div>
          <div style={{display:'flex',alignItems:'center',gap:4,marginTop:3,justifyContent:'flex-end'}}>
            <span style={{fontSize:11,fontWeight:600,color:gc(s.change_pct),background:gcBg(s.change_pct),padding:'2px 6px',borderRadius:6}}>{pct(s.change_pct)}</span>
          </div>
        </div>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',gap:6}}>
          <Pill type={s.signal} size="sm"/>
          {s.opt_rec&&s.opt_rec!=='NEUTRAL'&&<Pill type={s.opt_rec} size="sm"/>}
        </div>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:10,color:C.t3,marginBottom:1}}>RSI</div>
            <div style={{fontSize:12,fontWeight:600,color:s.rsi<35?C.green:s.rsi>65?C.red:C.text}}>{s.rsi??'—'}</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:10,color:C.t3,marginBottom:1}}>Sentiment</div>
            <div style={{fontSize:12,fontWeight:600,color:C.text}}>{s.sentiment?`${Math.round(s.sentiment*100)}%`:'—'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Desktop row
function StockRow({s,onClick}) {
  if(s.error) return null;
  return (
    <div className="card-hover" onClick={onClick} style={{
      display:'grid',gridTemplateColumns:'90px 1fr 90px 90px 54px 90px 110px',
      gap:8,padding:'11px 16px',borderBottom:`1px solid ${C.bdr}`,cursor:'pointer',alignItems:'center'
    }}>
      <span style={{fontWeight:600,fontSize:13,color:C.text}}>{s.sym}</span>
      <span style={{fontSize:12,color:C.t2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</span>
      <span style={{fontSize:13,fontWeight:500,color:C.text}}>₹{fmt(s.price)}</span>
      <span style={{fontSize:12,fontWeight:600,color:gc(s.change_pct),background:gcBg(s.change_pct),padding:'2px 6px',borderRadius:6,textAlign:'center'}}>{pct(s.change_pct)}</span>
      <span style={{fontSize:12,fontWeight:500,color:s.rsi<35?C.green:s.rsi>65?C.red:C.t2,textAlign:'center'}}>{s.rsi??'—'}</span>
      <div>
        <div style={{height:4,background:C.bg2,borderRadius:4,overflow:'hidden'}}>
          <div style={{width:`${Math.round((s.sentiment||0)*100)}%`,height:'100%',background:s.sentiment>0.65?C.green:s.sentiment<0.4?C.red:C.amber,borderRadius:4}}/>
        </div>
        <div style={{fontSize:10,color:C.t3,marginTop:2,textAlign:'center'}}>{s.sentiment?`${Math.round(s.sentiment*100)}%`:'—'}</div>
      </div>
      <div style={{display:'flex',gap:4}}>
        <Pill type={s.signal}/>
        {s.opt_rec&&s.opt_rec!=='NEUTRAL'&&<Pill type={s.opt_rec}/>}
      </div>
    </div>
  );
}

// Stocks list
function StocksList({onSelect}) {
  const [stocks,setStocks]   = useState([]);
  const [loading,setLoading] = useState(true);
  const [sector,setSector]   = useState('');
  const [sort,setSort]       = useState('signal');
  const [search,setSearch]   = useState('');
  const [isMobile,setMob]    = useState(window.innerWidth<768);
  const [countdown,setCd]    = useState(300);

  useEffect(()=>{const r=()=>setMob(window.innerWidth<768);window.addEventListener('resize',r);return()=>window.removeEventListener('resize',r);},[]);

  const load = useCallback((force=false)=>{
    axios.get(force?`${API}/stocks?force_refresh=true`:`${API}/stocks`,{timeout:15000})
      .then(r=>{setStocks(r.data.stocks||r.data||[]);setLoading(false);})
      .catch(()=>setLoading(false));
  },[]);

  useEffect(()=>{
    load();
    const id=setInterval(()=>setCd(n=>{if(n<=1){load();return 300;}return n-1;}),1000);
    return()=>clearInterval(id);
  },[load]);

  const SECTORS=['Banking','IT','Energy','FMCG','Auto','Pharma','Finance','Infra','Consumer','Conglomerate','Metal','Tech','Healthcare','Retail','Aviation','Defence','Travel'];
  const sigOrd={BUY:0,SELL:1,HOLD:2};
  const valid = stocks.filter(s=>!s.error);
  const filtered = valid
    .filter(s=>(!search||s.sym?.includes(search.toUpperCase())||s.name?.toLowerCase().includes(search.toLowerCase()))&&(!sector||s.sector===sector))
    .sort((a,b)=>sort==='signal'?(sigOrd[a.signal]??2)-(sigOrd[b.signal]??2):sort==='change_pct'?(b.change_pct||0)-(a.change_pct||0):sort==='sentiment'?(b.sentiment||0)-(a.sentiment||0):(a.rsi||50)-(b.rsi||50));

  return (
    <div>
      {valid.length>0&&<SignalBar stocks={valid}/>}

      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        <div style={{position:'relative',flex:1,minWidth:120}}>
          <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:C.t3,fontSize:14}}>🔍</span>
          <input style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'8px 10px 8px 32px',fontSize:12,color:C.text,width:'100%',boxShadow:'0 1px 3px rgba(0,0,0,.04)'}} placeholder="Search stocks..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'8px 10px',fontSize:12,color:C.text,boxShadow:'0 1px 3px rgba(0,0,0,.04)'}} value={sector} onChange={e=>setSector(e.target.value)}>
          <option value="">All Sectors</option>
          {SECTORS.map(s=><option key={s}>{s}</option>)}
        </select>
        <select style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'8px 10px',fontSize:12,color:C.text,boxShadow:'0 1px 3px rgba(0,0,0,.04)'}} value={sort} onChange={e=>setSort(e.target.value)}>
          <option value="signal">Sort: Signal</option>
          <option value="change_pct">Sort: Change</option>
          <option value="sentiment">Sort: Sentiment</option>
          <option value="rsi">Sort: RSI</option>
        </select>
        <button className="btn-hover" onClick={()=>load(true)} style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'8px 12px',fontSize:12,color:C.t2,cursor:'pointer',boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>↺</button>
      </div>
      <div style={{fontSize:11,color:C.t3,marginBottom:10,textAlign:'right'}}>Next refresh in {countdown}s</div>

      {loading?<Spin msg="Fetching live NSE data..."/>:
        filtered.length===0?<div style={{padding:40,textAlign:'center',color:C.t3,fontSize:13}}>No stocks found</div>:
        isMobile?filtered.map(s=><StockCard key={s.sym} s={s} onClick={()=>onSelect(s.sym)}/>):(
          <div style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:14,overflow:'hidden',boxShadow:'0 1px 6px rgba(0,0,0,.05)'}}>
            <div style={{display:'grid',gridTemplateColumns:'90px 1fr 90px 90px 54px 90px 110px',gap:8,padding:'10px 16px',fontSize:11,color:C.t3,fontWeight:600,background:C.bg2,borderBottom:`1px solid ${C.bdr}`}}>
              <span>Symbol</span><span>Company</span><span>Price</span><span>Change</span><span>RSI</span><span>Sentiment</span><span>Signal</span>
            </div>
            {filtered.map(s=><StockRow key={s.sym} s={s} onClick={()=>onSelect(s.sym)}/>)}
          </div>
        )
      }
    </div>
  );
}

// Stock detail
function StockDetail({symbol,onBack}) {
  const [data,setData]     = useState(null);
  const [plan,setPlan]     = useState(null);
  const [chart,setChart]   = useState([]);
  const [period,setPeriod] = useState('3mo');
  const [loading,setLoading] = useState(true);
  const [msg,setMsg]       = useState('');

  useEffect(()=>{
    setLoading(true);
    Promise.all([axios.get(`${API}/stock/${symbol}`),axios.get(`${API}/chart/${symbol}?period=3mo`),axios.get(`${API}/trade-plan/${symbol}?capital=100000`)])
      .then(([dr,cr,tr])=>{setData(dr.data);setChart(cr.data.data||[]);setPlan(tr.data);setLoading(false);})
      .catch(()=>setLoading(false));
  },[symbol]);

  useEffect(()=>{axios.get(`${API}/chart/${symbol}?period=${period}`).then(r=>setChart(r.data.data||[])).catch(()=>{});},[symbol,period]);

  const addPaper=async()=>{
    if(!plan?.stop_loss){setMsg('No trade setup available');return;}
    try{
      await axios.post(`${API}/paper/trades`,{sym:symbol,signal:plan.signal,entry:plan.entry,stop_loss:plan.stop_loss,target1:plan.target1,target2:plan.target2,qty:plan.position_sizing?.quantity||1,notes:''});
      setMsg('✓ Added to paper trades!');setTimeout(()=>setMsg(''),3000);
    }catch{setMsg('Failed to add');}
  };

  if(loading) return <Spin msg={`Loading ${symbol}...`}/>;
  if(!data) return <div style={{padding:20,textAlign:'center',color:C.red}}>Failed to load {symbol}</div>;

  const up=(data.change_pct||0)>=0;
  const chartColor=up?C.green:C.red;
  const hasSignal=plan?.signal==='BUY'||plan?.signal==='SELL';
  const sigColor=plan?.signal==='BUY'?C.green:C.red;
  const sigBg=plan?.signal==='BUY'?C.greenL:C.redL;

  return (
    <div className="fu">
      <button onClick={onBack} style={{background:'transparent',border:'none',color:C.blue,padding:'0 0 12px',fontSize:13,cursor:'pointer',fontWeight:500,display:'flex',alignItems:'center',gap:4}}>← Back to all stocks</button>

      <div style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:16,padding:'16px',marginBottom:12,boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{fontSize:22,fontWeight:700,color:C.text,letterSpacing:'-.5px'}}>{data.sym}</div>
            <div style={{fontSize:12,color:C.t3,marginTop:2}}>{data.name} · {data.sector}</div>
            {data.signal&&<div style={{marginTop:8}}><Pill type={data.signal} size="lg"/></div>}
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:26,fontWeight:700,color:C.text,letterSpacing:'-1px'}}>₹{fmt(data.price)}</div>
            <div style={{display:'inline-block',marginTop:4,background:gcBg(data.change_pct),padding:'3px 8px',borderRadius:8}}>
              <span style={{fontSize:12,fontWeight:600,color:gc(data.change_pct)}}>{up?'▲':'▼'} {pct(data.change_pct)}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
        {[['RSI (14)',data.rsi??'—'],['52W High',data.week_high?`₹${fmt(data.week_high,0)}`:'—'],['52W Low',data.week_low?`₹${fmt(data.week_low,0)}`:'—'],['P/E Ratio',data.pe_ratio?fmt(data.pe_ratio):'—'],['Beta',data.beta?fmt(data.beta):'—'],['Sentiment',data.sentiment?`${Math.round(data.sentiment*100)}%`:'—']].map(([l,v])=>(
          <div key={l} style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'10px 12px',boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
            <div style={{fontSize:10,color:C.t3,marginBottom:3}}>{l}</div>
            <div style={{fontSize:15,fontWeight:600,color:C.text}}>{v}</div>
          </div>
        ))}
      </div>

      {hasSignal&&plan&&(
        <div style={{background:sigBg,border:`2px solid ${sigColor}33`,borderRadius:16,padding:'16px',marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:15,fontWeight:700,color:C.text}}>Trade Setup</span>
              <Pill type={plan.signal} size="lg"/>
            </div>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <span style={{fontSize:12,color:C.t2}}>{plan.trade_quality}</span>
              <span style={{fontSize:14,fontWeight:700,color:plan.rr_ratio>=2?C.green:plan.rr_ratio>=1?C.amber:C.red}}>R:R 1:{plan.rr_ratio}</span>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
            {[['Entry Price',C.text,`₹${fmt(plan.entry)}`],['Stop Loss',C.red,`₹${fmt(plan.stop_loss)}`],['Target 1',C.green,`₹${fmt(plan.target1)}`],['Target 2',C.green,`₹${fmt(plan.target2)}`]].map(([l,c,v])=>(
              <div key={l} style={{background:'rgba(255,255,255,.7)',borderRadius:10,padding:'10px 12px',border:`1px solid rgba(0,0,0,.06)`}}>
                <div style={{fontSize:10,color:C.t3,marginBottom:3}}>{l}</div>
                <div style={{fontSize:16,fontWeight:700,color:c}}>{v}</div>
              </div>
            ))}
          </div>

          {plan.position_sizing&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
              {[['Quantity (1% risk)',C.text,plan.position_sizing.quantity],['Total Investment',C.t2,`₹${fmt(plan.position_sizing.total_cost,0)}`]].map(([l,c,v])=>(
                <div key={l} style={{background:'rgba(255,255,255,.7)',borderRadius:10,padding:'10px 12px',border:`1px solid rgba(0,0,0,.06)`}}>
                  <div style={{fontSize:10,color:C.t3,marginBottom:3}}>{l}</div>
                  <div style={{fontSize:15,fontWeight:600,color:c}}>{v}</div>
                </div>
              ))}
            </div>
          )}

          <button className="btn-hover" onClick={addPaper} style={{
            width:'100%',background:sigColor,border:'none',color:'#fff',
            borderRadius:10,padding:'12px',fontSize:13,fontWeight:600,cursor:'pointer',
            boxShadow:`0 4px 12px ${sigColor}44`
          }}>+ Add to Paper Trades</button>
          {msg&&<div style={{marginTop:8,fontSize:12,color:msg.startsWith('✓')?C.green:C.red,textAlign:'center',fontWeight:500}}>{msg}</div>}
        </div>
      )}

      <div style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:14,padding:'14px',boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>Price Chart</span>
          <div style={{display:'flex',gap:4}}>
            {['1mo','3mo','6mo','1y'].map(p=>(
              <button key={p} onClick={()=>setPeriod(p)} style={{background:period===p?C.blue:'transparent',border:`1px solid ${period===p?C.blue:C.bdr}`,color:period===p?'#fff':C.t2,borderRadius:8,padding:'4px 10px',fontSize:11,cursor:'pointer',fontWeight:500}}>{p}</button>
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
            <CartesianGrid strokeDasharray="2 4" stroke={C.bdr} vertical={false}/>
            <XAxis dataKey="date" tick={{fontSize:10,fill:C.t3}} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
            <YAxis tick={{fontSize:10,fill:C.t3}} tickLine={false} axisLine={false} tickFormatter={v=>`₹${Math.round(v)}`} width={55}/>
            <Tooltip contentStyle={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:8,fontSize:11,boxShadow:'0 4px 12px rgba(0,0,0,.1)'}} formatter={v=>[`₹${fmt(v)}`,'Close']} labelStyle={{color:C.t2}}/>
            <Area type="monotone" dataKey="close" stroke={chartColor} strokeWidth={2} fill="url(#cg)" dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Options
function Options() {
  const [sym,setSym]=useState('RELIANCE');
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const SYMS=['RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','WIPRO','TATAMOTORS','SBIN','ITC','KOTAKBANK','AXISBANK','HCLTECH','BAJFINANCE','MARUTI','SUNPHARMA'];
  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
        <select style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:10,padding:'9px 12px',fontSize:12,color:C.text,flex:1,boxShadow:'0 1px 3px rgba(0,0,0,.04)'}} value={sym} onChange={e=>setSym(e.target.value)}>
          {SYMS.map(s=><option key={s}>{s}</option>)}
        </select>
        <button className="btn-hover" onClick={()=>{setLoading(true);axios.get(`${API}/options/${sym}`).then(r=>{setData(r.data);setLoading(false);}).catch(()=>setLoading(false));}}
          style={{background:C.blue,border:'none',color:'#fff',borderRadius:10,padding:'9px 18px',fontSize:12,fontWeight:600,cursor:'pointer',boxShadow:'0 2px 8px rgba(37,99,235,.3)'}}>
          Analyze
        </button>
      </div>
      {loading&&<Spin msg="Fetching options data..."/>}
      {data&&!loading&&(
        <div className="fu">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
            {[['Spot Price',`₹${fmt(data.spot)}`],['ATM Strike',`₹${data.atm_strike}`]].map(([l,v])=>(
              <div key={l} style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:12,padding:'12px 14px',boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
                <div style={{fontSize:11,color:C.t3,marginBottom:4}}>{l}</div>
                <div style={{fontSize:18,fontWeight:700,color:C.text}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 70px 1fr',padding:'10px 12px',background:C.bg2,borderBottom:`1px solid ${C.bdr}`}}>
              <div style={{fontSize:11,color:C.green,fontWeight:600,textAlign:'center'}}>CALLS</div>
              <div style={{fontSize:11,color:C.t3,fontWeight:600,textAlign:'center'}}>STRIKE</div>
              <div style={{fontSize:11,color:C.red,fontWeight:600,textAlign:'center'}}>PUTS</div>
            </div>
            {(data.chain||[]).map((row,i)=>{
              const isATM=row.strike===data.atm_strike;
              return (
                <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 70px 1fr',borderBottom:`1px solid ${C.bdr}`,background:isATM?C.blueL:'transparent'}}>
                  <div style={{padding:'8px 12px',textAlign:'center'}}>
                    <div style={{fontSize:12,color:C.green,fontWeight:row.call?.inTheMoney?700:400}}>{row.call?.lastPrice?`₹${fmt(row.call.lastPrice)}`:'—'}</div>
                    <div style={{fontSize:10,color:C.t3}}>{row.call?.openInterest?`${(row.call.openInterest/1000).toFixed(0)}K OI`:'—'}</div>
                  </div>
                  <div style={{padding:'8px',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',borderLeft:`1px solid ${C.bdr}`,borderRight:`1px solid ${C.bdr}`}}>
                    <div>
                      <div style={{fontSize:isATM?13:12,fontWeight:isATM?700:500,color:isATM?C.blue:C.t2}}>{row.strike}</div>
                      {isATM&&<div style={{fontSize:8,color:C.blue,fontWeight:600}}>ATM</div>}
                    </div>
                  </div>
                  <div style={{padding:'8px 12px',textAlign:'center'}}>
                    <div style={{fontSize:12,color:C.red,fontWeight:row.put?.inTheMoney?700:400}}>{row.put?.lastPrice?`₹${fmt(row.put.lastPrice)}`:'—'}</div>
                    <div style={{fontSize:10,color:C.t3}}>{row.put?.openInterest?`${(row.put.openInterest/1000).toFixed(0)}K OI`:'—'}</div>
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

// News
function News() {
  const [articles,setArticles]=useState([]);
  const [loading,setLoading]=useState(true);
  const [noKey,setNoKey]=useState(false);
  useEffect(()=>{
    axios.get(`${API}/news`).then(r=>{if(r.data.note)setNoKey(true);setArticles(r.data.articles||[]);setLoading(false);}).catch(()=>setLoading(false));
  },[]);
  return (
    <div>
      {noKey&&<div style={{background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:10,padding:'10px 14px',marginBottom:12,fontSize:12,color:C.amber}}>
        Add <code style={{background:'#FEF3C7',padding:'1px 5px',borderRadius:4}}>NEWS_API_KEY</code> to .env for live news · <a href="https://newsapi.org" style={{color:C.blue}}>newsapi.org</a>
      </div>}
      {loading?<Spin/>:articles.length===0?<div style={{padding:40,textAlign:'center',color:C.t3}}>No news available</div>:
        articles.map((a,i)=>(
          <div key={i} style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:12,padding:'12px 14px',marginBottom:8,boxShadow:'0 1px 3px rgba(0,0,0,.04)'}}>
            <a href={a.url} target="_blank" rel="noreferrer" style={{color:C.text,fontSize:13,lineHeight:1.5,display:'block',marginBottom:6,textDecoration:'none',fontWeight:500}}>{a.title}</a>
            <div style={{display:'flex',gap:8,fontSize:11,color:C.t3,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{color:C.t2,fontWeight:500}}>{a.source}</span>
              <span>·</span>
              <span>Sentiment: <span style={{color:a.sentiment>0.65?C.green:a.sentiment<0.4?C.red:C.amber,fontWeight:600}}>{Math.round(a.sentiment*100)}%</span></span>
            </div>
          </div>
        ))
      }
    </div>
  );
}

// Paper trading
function PaperTrading() {
  const [stats,setStats]=useState(null);
  const [loading,setLoading]=useState(true);
  const [closing,setClosing]=useState(null);
  const [exitPrice,setExitPrice]=useState('');
  const [msg,setMsg]=useState('');
  const load=useCallback(()=>{axios.get(`${API}/paper/stats`).then(r=>{setStats(r.data);setLoading(false);}).catch(()=>setLoading(false));},[]);
  useEffect(()=>{load();},[load]);
  const closeTrade=async(id)=>{
    if(!exitPrice) return;
    try{await axios.post(`${API}/paper/trades/${id}/close`,{exit_price:parseFloat(exitPrice),notes:'Manual close'});setClosing(null);setExitPrice('');setMsg('✓ Trade closed');setTimeout(()=>setMsg(''),3000);load();}catch{setMsg('Failed');}
  };
  const del=async(id)=>{if(!window.confirm('Delete this trade?'))return;await axios.delete(`${API}/paper/trades/${id}`);load();};
  if(loading) return <Spin/>;
  const trades=stats?.trades||[];
  const open=trades.filter(t=>t.status==='OPEN');
  const closed=trades.filter(t=>t.status==='CLOSED');
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
        {[['Total Trades',stats?.total_trades??0,null],['Win Rate',`${stats?.win_rate??0}%`,stats?.win_rate>50?C.green:null],['Total P&L',`₹${fmt(stats?.total_pnl??0,0)}`,gc(stats?.total_pnl||0)],['Open Trades',stats?.open??0,stats?.open?C.blue:null]].map(([l,v,ac])=>(
          <div key={l} style={{background:C.bg1,border:`1px solid ${ac?ac+'44':C.bdr}`,borderRadius:12,padding:'12px 14px',boxShadow:'0 1px 4px rgba(0,0,0,.05)',borderTop:`3px solid ${ac||C.bdr}`}}>
            <div style={{fontSize:11,color:C.t3,marginBottom:4}}>{l}</div>
            <div style={{fontSize:20,fontWeight:700,color:ac||C.text}}>{v}</div>
          </div>
        ))}
      </div>
      {msg&&<div style={{background:C.greenL,border:'1px solid #A7F3D0',borderRadius:8,padding:'8px 12px',marginBottom:10,fontSize:12,color:C.green,fontWeight:500}}>{msg}</div>}
      {open.length>0&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:8}}>Open Trades</div>
          {open.map(t=>(
            <div key={t.id} style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:14,padding:'12px 14px',marginBottom:8,boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:6}}>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{fontWeight:700,fontSize:15,color:C.text}}>{t.sym}</span>
                  <Pill type={t.signal}/>
                  <span style={{fontSize:11,color:C.t3}}>×{t.qty} @ ₹{fmt(t.entry)}</span>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:10}}>
                {[['Stop Loss',C.red,`₹${fmt(t.stop_loss)}`],['Target 1',C.green,`₹${fmt(t.target1)}`],['Target 2',C.green,`₹${fmt(t.target2)}`]].map(([l,c,v])=>(
                  <div key={l} style={{background:C.bg2,borderRadius:8,padding:'8px 10px'}}>
                    <div style={{fontSize:10,color:C.t3,marginBottom:2}}>{l}</div>
                    <div style={{fontSize:13,fontWeight:600,color:c}}>{v}</div>
                  </div>
                ))}
              </div>
              {closing===t.id?(
                <div style={{display:'flex',gap:6}}>
                  <input style={{flex:1,background:C.bg2,border:`1px solid ${C.bdr}`,borderRadius:8,padding:'8px 10px',fontSize:12,color:C.text}} placeholder="Exit price ₹" value={exitPrice} onChange={e=>setExitPrice(e.target.value)}/>
                  <button style={{background:C.green,border:'none',color:'#fff',borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:600,cursor:'pointer'}} onClick={()=>closeTrade(t.id)}>Confirm</button>
                  <button style={{background:C.bg2,border:`1px solid ${C.bdr}`,color:C.t2,borderRadius:8,padding:'8px 12px',fontSize:12,cursor:'pointer'}} onClick={()=>setClosing(null)}>Cancel</button>
                </div>
              ):(
                <div style={{display:'flex',gap:6}}>
                  <button style={{flex:1,background:C.bg2,border:`1px solid ${C.bdr}`,color:C.t2,borderRadius:8,padding:'8px',fontSize:12,cursor:'pointer',fontWeight:500}} onClick={()=>setClosing(t.id)}>Close Trade</button>
                  <button style={{background:C.redL,border:`1px solid #FECACA`,color:C.red,borderRadius:8,padding:'8px 12px',fontSize:12,cursor:'pointer'}} onClick={()=>del(t.id)}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {closed.length>0&&(
        <div>
          <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:8}}>Closed Trades</div>
          <div style={{background:C.bg1,border:`1px solid ${C.bdr}`,borderRadius:14,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
            {closed.slice().reverse().map((t,i)=>(
              <div key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderBottom:i<closed.length-1?`1px solid ${C.bdr}`:'none',flexWrap:'wrap',gap:6}}>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{fontWeight:600,fontSize:13,color:C.text}}>{t.sym}</span>
                  <Pill type={t.signal}/>
                </div>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <span style={{fontSize:11,color:C.t3}}>₹{fmt(t.entry)} → ₹{fmt(t.exit_price)}</span>
                  <span style={{fontSize:13,fontWeight:700,color:gc(t.pnl||0),background:gcBg(t.pnl||0),padding:'2px 8px',borderRadius:6}}>{(t.pnl||0)>=0?'+':''}₹{fmt(t.pnl||0,0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {trades.length===0&&(
        <div style={{padding:48,textAlign:'center'}}>
          <div style={{fontSize:32,marginBottom:12}}>📊</div>
          <div style={{fontSize:14,color:C.t2,fontWeight:500,marginBottom:6}}>No paper trades yet</div>
          <div style={{fontSize:12,color:C.t3}}>Go to Signals → click a BUY stock → Add to paper trades</div>
        </div>
      )}
    </div>
  );
}

// Bottom nav
function BottomNav({tab,setTab}) {
  const tabs=[{k:'equity',icon:'📊',l:'Signals'},{k:'options',icon:'⚡',l:'Options'},{k:'paper',icon:'📈',l:'Paper'},{k:'news',icon:'📰',l:'News'}];
  return (
    <div style={{position:'fixed',bottom:0,left:0,right:0,background:C.bg1,borderTop:`1px solid ${C.bdr}`,display:'flex',zIndex:100,paddingBottom:'env(safe-area-inset-bottom)',boxShadow:'0 -4px 12px rgba(0,0,0,.08)'}}>
      {tabs.map(({k,icon,l})=>(
        <button key={k} onClick={()=>setTab(k)} style={{flex:1,background:'none',border:'none',padding:'10px 4px 8px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
          <span style={{fontSize:18}}>{icon}</span>
          <span style={{fontSize:10,color:tab===k?C.blue:C.t3,fontWeight:tab===k?600:400}}>{l}</span>
          {tab===k&&<div style={{width:18,height:2,background:C.blue,borderRadius:2}}/>}
        </button>
      ))}
    </div>
  );
}

// App root
export default function App() {
  const [tab,setTab]     = useState('equity');
  const [ov,setOv]       = useState(null);
  const [sel,setSel]     = useState(null);
  const [apiOk,setApiOk] = useState(null);
  const [mob,setMob]     = useState(window.innerWidth<768);

  useEffect(()=>{const r=()=>setMob(window.innerWidth<768);window.addEventListener('resize',r);return()=>window.removeEventListener('resize',r);},[]);

  useEffect(()=>{
    axios.get(`${API}/health`).then(()=>setApiOk(true)).catch(()=>setApiOk(false));
    const load=()=>axios.get(`${API}/market/overview`).then(r=>setOv(r.data)).catch(()=>{});
    load(); const id=setInterval(load,60000); return()=>clearInterval(id);
  },[]);

  const tabs=[['equity','Signals'],['options','Options'],['paper','Paper'],['news','News']];

  return (
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:"'Plus Jakarta Sans',sans-serif",paddingBottom:mob?70:0}}>
      {/* Nav */}
      <nav style={{background:C.bg1,borderBottom:`1px solid ${C.bdr}`,padding:`0 ${mob?14:24}px`,height:52,display:'flex',alignItems:'center',position:'sticky',top:0,zIndex:100,boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginRight:mob?'auto':28}}>
          <div style={{width:28,height:28,background:'linear-gradient(135deg,#2563EB,#7C3AED)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'#fff',fontSize:14,fontWeight:700}}>N</span>
          </div>
          <div>
            <span style={{fontSize:14,fontWeight:700,color:C.text,letterSpacing:'-.3px'}}>NiftySignal</span>
            <span style={{fontSize:14,fontWeight:300,color:C.t2}}>.AI</span>
          </div>
        </div>

        {!mob&&(
          <div style={{display:'flex',height:'100%',gap:4}}>
            {tabs.map(([k,l])=>(
              <button key={k} onClick={()=>{setTab(k);setSel(null);}} style={{
                padding:'0 14px',height:52,fontSize:13,fontWeight:tab===k?600:400,
                color:tab===k?C.blue:C.t2,cursor:'pointer',border:'none',background:'none',
                borderBottom:tab===k?`2px solid ${C.blue}`:'2px solid transparent',
                transition:'all .15s'
              }}>{l}</button>
            ))}
          </div>
        )}

        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:mob?8:16}}>
          {!mob&&<Clock/>}
          <div style={{display:'flex',alignItems:'center',gap:5,background:apiOk===true?C.greenL:C.redL,padding:'4px 10px',borderRadius:20}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:apiOk===true?C.green:C.red}}/>
            <span style={{fontSize:11,fontWeight:500,color:apiOk===true?C.green:C.red}}>{apiOk===true?'Live':'Offline'}</span>
          </div>
        </div>
      </nav>

      {mob&&(
        <div style={{padding:'8px 14px',background:C.bg1,borderBottom:`1px solid ${C.bdr}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <Clock/>
        </div>
      )}

      {/* Main content */}
      <div style={{padding:`14px ${mob?14:24}px`,maxWidth:1400,margin:'0 auto'}}>
        {apiOk===false&&(
          <div style={{background:C.redL,border:`1px solid #FECACA`,borderRadius:10,padding:'10px 14px',marginBottom:12,fontSize:12,color:C.red,fontWeight:500}}>
            Backend offline — check Railway deployment
          </div>
        )}

        <MarketBanner data={ov}/>

        {tab==='equity'&&(sel?<StockDetail symbol={sel} onBack={()=>setSel(null)}/>:<StocksList onSelect={s=>setSel(s)}/>)}
        {tab==='options'&&<Options/>}
        {tab==='paper'&&<PaperTrading/>}
        {tab==='news'&&<News/>}
      </div>

      {mob&&<BottomNav tab={tab} setTab={k=>{setTab(k);setSel(null);}}/>}

      {!mob&&(
        <div style={{textAlign:'center',padding:'12px 24px',borderTop:`1px solid ${C.bdr}`,fontSize:11,color:C.t3,background:C.bg1}}>
          NiftySignal AI · For research purposes only · Not SEBI-registered investment advice
        </div>
      )}
    </div>
  );
}
