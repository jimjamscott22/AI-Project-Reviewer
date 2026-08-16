const {useState,useEffect} = React;
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "compact",
  "scoreAccent": "green",
  "insightsPanel": true
}/*EDITMODE-END*/;
const NAV=[['house','Dashboard','dashboard'],['git-branch','Repositories','repos'],['list-checks','Reviews','reviews'],['chart-line','Insights','insights'],['gear','Settings','settings']];
function Sidebar({screen,go}){
  return <aside className="apr-side">
    <div className="apr-brand"><span className="apr-brandmark"><I n="terminal-window" size={17}/></span> AI Project Reviewer</div>
    <nav className="apr-nav">{NAV.map(([ic,l,id])=><button key={id} className={'apr-nav-it'+(screen===id?' apr-nav-on':'')} onClick={()=>go(id)}><I n={ic} size={18} w={screen===id?'fill':null}/> {l}</button>)}</nav>
    <div className="card apr-pad apr-protip">
      <h6 className="apr-kicker" style={{color:'var(--color-accent)'}}><I n="sparkle" size={12}/> Pro Tip</h6>
      <p style={{fontSize:13,margin:'4px 0 var(--space-3)',opacity:.85}}>Connect a repo to get automated reviews on new commits.</p>
      <button className="btn btn-primary" style={{alignSelf:'flex-start'}}><I n="github-logo" size={15}/> Connect GitHub</button>
    </div>
    <div className="apr-user"><span className="apr-avatar"><I n="robot" size={18}/></span>
      <div style={{flex:1,minWidth:0}}><b style={{fontSize:13,display:'block'}}>DevUser</b><small className="text-muted" style={{fontSize:11}}>developer@example.com</small></div>
      <I n="caret-down" size={13} style={{opacity:.6}}/></div>
  </aside>;
}
function Chip({ok,icon,label}){
  return <span className="apr-chip" title={ok?'Connected':'Endpoint unreachable — using sample data. Edit APR_CONFIG in reviewer-data.js.'}>
    <span className="apr-dot" style={{background:ok?'var(--apr-good)':'var(--apr-warn)'}}></span><I n={icon} size={13}/> {label}</span>;
}
function TopBar({screen,go,theme,setTheme,rerun,running,generated,db,llm}){
  const titles={dashboard:'Dashboard',repos:'Repositories',insights:'Insights',settings:'Settings'};
  return <header className="apr-top">
    {screen==='reviews'
      ? <button className="btn btn-ghost" style={{color:'inherit'}} onClick={()=>go('dashboard')}><I n="arrow-left" size={15}/> Back to reviews</button>
      : <h5 style={{margin:0}}>{titles[screen]}</h5>}
    <span style={{flex:1}}></span>
    <Chip ok={db} icon="database" label="mariadb @ pi"/>
    <Chip ok={llm} icon="cpu" label={APR_CONFIG.llmModel+' (local)'}/>
    {screen==='reviews'&&<span className="text-muted" style={{fontSize:13}}>Review generated <b style={{color:'var(--color-text)',fontWeight:500}}>{generated}</b></span>}
    {screen==='reviews'&&<button className="btn btn-secondary" onClick={rerun} disabled={running}><I n="arrows-clockwise" size={15} style={running?{animation:'apr-spin 1s linear infinite'}:null}/> {running?'Reviewing…':'Re-run Review'}</button>}
    <button className="btn btn-secondary btn-icon" title="Toggle light/dark" onClick={()=>setTheme(theme==='dark'?'light':'dark')}><I n={theme==='dark'?'sun':'moon'} size={16}/></button>
  </header>;
}
function App(){
  const [t,setTweak]=useTweaks(TWEAK_DEFAULTS);
  const [theme,setTheme]=useState(()=>localStorage.getItem('apr-theme')||'dark');
  const [screen,setScreen]=useState('reviews');
  const [sel,setSel]=useState('threatstream');
  const [tab,setTab]=useState('ai');
  const [repos,setRepos]=useState(window.APR_SAMPLE);
  const [db,setDb]=useState(false), [llm,setLlm]=useState(false);
  const [running,setRunning]=useState(false);
  const [generated,setGenerated]=useState('2 hours ago');
  const [summary,setSummary]=useState(null);
  useEffect(()=>{ document.documentElement.dataset.theme=theme; localStorage.setItem('apr-theme',theme); },[theme]);
  useEffect(()=>{ APR.load().then(r=>{ setDb(r.live); if(r.live) setRepos(r.repos); }); APR.ping(APR_CONFIG.llmBase).then(setLlm); },[]);
  const openReview=id=>{ setSel(id); setTab('ai'); setSummary(null); setScreen('reviews'); };
  const rerun=async()=>{ setRunning(true); const repo=repos.find(r=>r.id===sel);
    const res=await APR.rerun(repo); setSummary(res.summary); setLlm(res.live); setGenerated('just now'); setRunning(false); };
  const body= screen==='reviews'? <ReviewScreen repos={repos} sel={sel} onSel={openReview} tab={tab} setTab={setTab} summary={summary} showPanel={t.insightsPanel}/>
    : screen==='dashboard'? <Dashboard repos={repos} openReview={openReview}/>
    : screen==='insights'? <InsightsScreen repos={repos} openReview={openReview}/>
    : <Stub label={screen==='repos'?'Repositories':'Settings'}/>;
  return <div className={'apr-app'+(t.density==='cozy'?' apr-cozy':'')+(t.scoreAccent==='blurple'?' apr-mono':'')}>
    <Sidebar screen={screen} go={s=>{setScreen(s);}}/>
    <div className="apr-body">
      <TopBar screen={screen} go={setScreen} theme={theme} setTheme={setTheme} rerun={rerun} running={running} generated={generated} db={db} llm={llm}/>
      {body}
    </div>
    <TweaksPanel>
      <TweakSection label="Layout"/>
      <TweakRadio label="Density" value={t.density} options={['compact','cozy']} onChange={v=>setTweak('density',v)}/>
      <TweakToggle label="Insights panel" value={t.insightsPanel} onChange={v=>setTweak('insightsPanel',v)}/>
      <TweakSection label="Color"/>
      <TweakRadio label="Score accent" value={t.scoreAccent} options={['green','blurple']} onChange={v=>setTweak('scoreAccent',v)}/>
    </TweaksPanel>
  </div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
