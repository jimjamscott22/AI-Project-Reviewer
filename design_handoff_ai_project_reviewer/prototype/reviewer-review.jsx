const {useState,useEffect,useRef} = React;
function I({n,size=16,w,style}){return <i className={'ph'+(w?'-'+w:'')+' ph-'+n} style={{fontSize:size,lineHeight:1,...style}}></i>;}
function scoreVar(s){return s>=65?'var(--apr-good)':s>=40?'var(--apr-warn)':'var(--apr-bad)';}
function Ring({score,size=118}){
  const r=(size-14)/2, c=2*Math.PI*r, col=scoreVar(score);
  return <div className="apr-ring" style={{width:size}}>
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--color-divider)" strokeWidth="7"></circle>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${c*score/100} ${c}`} transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{transition:'stroke-dasharray .8s ease'}}></circle>
    </svg>
    <div className="apr-ring-label"><b>{score}</b><span>/100</span></div>
    <div className="apr-ring-grade" style={{color:col}}>{APR.grade(score)}</div>
  </div>;
}
function RepoIcon({repo,size=34}){
  return <span className="apr-repoicon" style={{width:size,height:size,background:`oklch(0.35 0.06 ${repo.hue})`,color:`oklch(0.87 0.07 ${repo.hue})`}}><I n="code" size={size*0.55}/></span>;
}
function RepoRail({repos,sel,onSel}){
  const [q,setQ]=useState('');
  const list=repos.filter(r=>r.name.toLowerCase().includes(q.toLowerCase()));
  return <aside className="apr-rail">
    <div className="apr-rail-head"><h5 style={{margin:0}}>Repositories</h5><button className="btn btn-secondary apr-btn-sm"><I n="plus" size={13}/> Add Repo</button></div>
    <div className="apr-search"><I n="magnifying-glass" size={14}/><input className="apr-search-in" placeholder="Search repositories…" value={q} onChange={e=>setQ(e.target.value)}/></div>
    <div className="apr-rail-list">
      {list.map(r=><button key={r.id} className={'apr-repo'+(r.id===sel?' apr-repo-sel':'')} onClick={()=>onSel(r.id)}>
        <RepoIcon repo={r}/>
        <span className="apr-repo-txt"><b>{r.name}</b><small>Updated {r.updated}</small></span>
        <I n="github-logo" size={17} style={{opacity:.55}}/>
      </button>)}
      {!list.length&&<p className="text-muted" style={{fontSize:13,padding:'8px 4px'}}>No repositories match.</p>}
    </div>
    <a className="apr-rail-link" href="#" onClick={e=>e.preventDefault()}>View all repositories <I n="arrow-right" size={13}/></a>
  </aside>;
}
function SummaryItem({it}){
  const [icon,label,value,tone]=it;
  const col=tone==='good'?'var(--apr-good)':tone==='warn'?'var(--apr-warn)':'inherit';
  return <div className="apr-sum-it"><I n={icon} size={17} style={{color:col==='inherit'?'var(--color-accent)':col,marginTop:2}}/>
    <div><div className="apr-sum-l">{label}</div><div className="apr-sum-v" style={{color:col}}>{value}</div></div></div>;
}
const SEV={high:['var(--apr-bad)','warning-octagon'],med:['var(--apr-warn)','warning'],warn:['var(--apr-warn)','warning'],info:['var(--color-accent)','info'],ok:['var(--apr-good)','check-circle']};
function Finding({sev,children}){const [c,ic]=SEV[sev]||SEV.info;
  return <li className="apr-li"><I n={ic} size={15} style={{color:c,marginTop:3}}/><span>{children}</span></li>;}
function TabAI({repo}){
  return <div className="apr-ai-grid">
    <div className="card elev-sm apr-pad">
      <h5 className="apr-h5" style={{color:'var(--apr-good)'}}><I n="seal-check" size={17}/> Strengths</h5>
      <ul className="apr-ul">{repo.strengths.map((s,i)=><Finding key={i} sev="ok">{s}</Finding>)}</ul>
      <h5 className="apr-h5" style={{color:'var(--apr-warn)',marginTop:'var(--space-4)'}}><I n="hammer" size={17}/> Needs Improvement</h5>
      <ul className="apr-ul">{repo.improves.map((s,i)=><Finding key={i} sev="warn">{s}</Finding>)}</ul>
      <h5 className="apr-h5" style={{color:'var(--color-accent)',marginTop:'var(--space-4)'}}><I n="footprints" size={17}/> Recommended Next Steps</h5>
      <ol className="apr-ul apr-ol">{repo.steps.map((s,i)=><li key={i} className="apr-li"><span className="apr-num">{i+1}</span><span>{s}</span></li>)}</ol>
    </div>
    <div className="card elev-sm apr-pad apr-portfolio">
      <div className="apr-row" style={{justifyContent:'space-between'}}>
        <h5 className="apr-h5" style={{color:'var(--color-accent)'}}><I n="star" size={17}/> Portfolio Readiness</h5>
        <span className="tag" style={{background:'var(--apr-good-800)',color:'var(--apr-good-100)'}}>{repo.portfolio.verdict}</span>
      </div>
      <p style={{fontSize:13,opacity:.8}}>{repo.portfolio.blurb}</p>
      <ul className="apr-ul">{repo.portfolio.checks.map(([l,done],i)=><li key={i} className="apr-li" style={{opacity:done?1:.55}}>
        <I n={done?'check-circle':'circle'} w={done?'fill':null} size={16} style={{color:done?'var(--apr-good)':'var(--color-neutral-600)',marginTop:2}}/><span>{l}</span></li>)}</ul>
      <p className="text-muted" style={{fontSize:12,marginTop:'auto',marginBottom:0}}>{repo.portfolio.footer}</p>
    </div>
  </div>;
}
function TabQuality({repo}){
  return <div className="card elev-sm apr-pad">
    <div className="apr-metrics">{repo.quality.metrics.map(([l,v],i)=><div key={i} className="apr-metric"><b>{v}</b><span>{l}</span></div>)}</div>
    <h5 className="apr-h5" style={{marginTop:'var(--space-4)'}}>Findings</h5>
    <ul className="apr-ul">{repo.quality.findings.map(([sev,t],i)=><Finding key={i} sev={sev}>{t}</Finding>)}</ul>
  </div>;
}
function TabStructure({repo}){
  return <div className="card elev-sm apr-pad"><pre className="apr-tree">{repo.structure.join('\n')}</pre></div>;
}
function TabDeps({repo}){
  const tone={ok:['var(--apr-good)','Up to date'],outdated:['var(--apr-warn)','Update available'],major:['var(--apr-bad)','Major behind']};
  return <div className="card elev-sm apr-pad"><table className="table"><thead><tr><th>Package</th><th>Installed</th><th>Latest</th><th>Status</th></tr></thead>
    <tbody>{repo.deps.map(([n,c,l,s],i)=><tr key={i}><td style={{fontFamily:'ui-monospace,Menlo,monospace',fontSize:13}}>{n}</td><td>{c}</td><td>{l}</td>
      <td style={{color:tone[s][0]}}><I n={s==='ok'?'check':'arrow-up'} size={13}/> {tone[s][1]}</td></tr>)}</tbody></table></div>;
}
function TabSecurity({repo}){
  return <div className="card elev-sm apr-pad"><ul className="apr-ul" style={{gap:'var(--space-3)'}}>
    {repo.security.map(([sev,t,d],i)=>{const [c,ic]=SEV[sev];return <li key={i} className="apr-li">
      <I n={ic} size={17} style={{color:c,marginTop:2}}/><span><b style={{fontWeight:500}}>{t}</b><br/><span className="text-muted" style={{fontSize:13}}>{d}</span></span></li>;})}
  </ul></div>;
}
const TABS=[['ai','sparkle','AI Review',TabAI],['quality','code','Code Quality',TabQuality],['structure','tree-structure','Structure',TabStructure],['deps','package','Dependencies',TabDeps],['security','shield-check','Security',TabSecurity]];
function InsightCol({repo}){
  return <aside className="apr-insights">
    <div className="apr-row" style={{justifyContent:'space-between'}}><h4 style={{margin:0,fontSize:19}}>Insights</h4><I n="trend-up" size={17} style={{color:'var(--color-accent)'}}/></div>
    <h6 className="apr-kicker">Category Scores</h6>
    <div className="apr-cats">{repo.cats.map(([name,icon,s],i)=><div key={i} className="card apr-cat">
      <span className="apr-cat-ic"><I n={icon} size={17}/></span>
      <div className="apr-cat-bd"><div className="apr-row" style={{justifyContent:'space-between'}}><span style={{fontSize:13}}>{name}</span><span style={{fontSize:12}}><b style={{color:scoreVar(s)}}>{s}</b><span className="text-muted">/100</span></span></div>
        <div className="apr-bar"><div style={{width:s+'%',background:scoreVar(s)}}></div></div></div>
    </div>)}</div>
    <h6 className="apr-kicker">Repository Insights</h6>
    <div className="card apr-pad apr-kv">
      {[['Primary Language',repo.lang,'var(--color-accent)'],['Framework',repo.framework,''],['Lines of Code',repo.loc,''],['Open Issues',repo.issues,repo.issues>3?'var(--apr-warn)':''],['Pull Requests',repo.prs,''],['Contributors',repo.contributors,'']].map(([l,v,c],i)=>
        <div key={i} className="apr-kv-row"><span className="text-muted">{l}</span><b style={{color:c||'inherit',fontWeight:500}}>{v}</b></div>)}
    </div>
    <button className="btn btn-primary btn-block">View full insights <I n="arrow-right" size={14}/></button>
  </aside>;
}
function ReviewScreen({repos,sel,onSel,tab,setTab,summary,showPanel}){
  const repo=repos.find(r=>r.id===sel)||repos[0];
  const Body=(TABS.find(t=>t[0]===tab)||TABS[0])[3];
  return <div className={'apr-review'+(showPanel?'':' apr-nopanel')}>
    <RepoRail repos={repos} sel={repo.id} onSel={onSel}/>
    <section className="apr-main">
      <div className="card elev-sm apr-pad apr-head">
        <div style={{flex:1,minWidth:0}}>
          <div className="apr-row" style={{gap:10,marginBottom:'var(--space-3)'}}><I n="sparkle" w="fill" size={26} style={{color:'var(--apr-good)'}}/>
            <div><h3 style={{margin:0,fontSize:26}}>AI Project Reviewer</h3><p className="text-muted" style={{margin:0,fontSize:13}}>Automated review and actionable insights for your codebase.</p></div></div>
          <div className="apr-row" style={{gap:12}}>
            <RepoIcon repo={repo} size={40}/>
            <div><div className="apr-row" style={{gap:8}}><b style={{fontSize:17}}>{repo.name}</b><span className="tag tag-neutral">{repo.vis}</span></div>
              <a href="#" onClick={e=>e.preventDefault()} className="text-muted" style={{fontSize:12,color:'inherit'}}>{repo.url} <I n="arrow-square-out" size={11}/></a></div>
          </div>
        </div>
        <Ring score={repo.score}/>
      </div>
      <div className="card elev-sm apr-pad">
        <h6 className="apr-kicker" style={{marginBottom:'var(--space-3)'}}>Project Summary</h6>
        <div className="apr-summary">{repo.summary.map((it,i)=><SummaryItem key={i} it={it}/>)}</div>
      </div>
      <nav className="apr-tabs">{TABS.map(([id,ic,l])=><button key={id} className={'apr-tab'+(id===tab?' apr-tab-on':'')} onClick={()=>setTab(id)}><I n={ic} size={15}/> {l}</button>)}</nav>
      <Body repo={repo}/>
      <div className="card elev-sm apr-pad">
        <h6 className="apr-kicker" style={{color:'var(--apr-good)',marginBottom:6}}><I n="sparkle" size={13}/> AI Summary</h6>
        <p style={{margin:0,fontSize:14,lineHeight:1.6}}>{summary||repo.ai}</p>
      </div>
    </section>
    {showPanel&&<InsightCol repo={repo}/>}
  </div>;
}
Object.assign(window,{ReviewScreen,Ring,RepoIcon,scoreVar,I});
