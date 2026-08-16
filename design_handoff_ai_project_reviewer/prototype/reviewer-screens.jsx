function Dashboard({repos,openReview}){
  const avg=Math.round(repos.reduce((a,r)=>a+r.score,0)/repos.length);
  const gaps=repos.reduce((a,r)=>a+r.portfolio.checks.filter(c=>!c[1]).length,0);
  const worstCats={};
  repos.forEach(r=>r.cats.forEach(([n,ic,s])=>{ if(!worstCats[n])worstCats[n]={icon:ic,total:0,n:0}; worstCats[n].total+=s; worstCats[n].n++; }));
  const attention=Object.entries(worstCats).map(([n,v])=>[n,v.icon,Math.round(v.total/v.n)]).sort((a,b)=>a[2]-b[2]).slice(0,3);
  return <section className="apr-page">
    <div className="apr-stats">
      {[['git-branch','Repositories',repos.length],['gauge','Average score',avg],['sparkle','Reviews run','12'],['warning','Open gaps',gaps]].map(([ic,l,v],i)=>
        <div key={i} className="card elev-sm apr-pad apr-stat"><I n={ic} size={19} style={{color:'var(--color-accent)'}}/><b>{v}</b><span className="text-muted">{l}</span></div>)}
    </div>
    <div className="card elev-sm apr-pad">
      <h6 className="apr-kicker" style={{marginBottom:'var(--space-2)'}}>Recent reviews</h6>
      <table className="table"><thead><tr><th>Repository</th><th>Score</th><th>Grade</th><th>Top gap</th><th>Reviewed</th></tr></thead>
        <tbody>{[...repos].sort((a,b)=>b.score-a.score).map(r=><tr key={r.id} style={{cursor:'pointer'}} onClick={()=>openReview(r.id)}>
          <td><span className="apr-row" style={{gap:8}}><RepoIcon repo={r} size={24}/>{r.name}</span></td>
          <td><b style={{color:scoreVar(r.score)}}>{r.score}</b><span className="text-muted">/100</span></td>
          <td>{APR.grade(r.score)}</td>
          <td className="text-muted" style={{fontSize:13}}>{r.portfolio.checks.find(c=>!c[1])?.[0]||'—'}</td>
          <td className="text-muted" style={{fontSize:13}}>{r.updated}</td></tr>)}</tbody></table>
    </div>
    <div className="card elev-sm apr-pad">
      <h6 className="apr-kicker" style={{marginBottom:'var(--space-3)'}}>Weakest categories across your repos</h6>
      <div className="apr-attn">{attention.map(([n,ic,s],i)=><div key={i} className="apr-cat card">
        <span className="apr-cat-ic"><I n={ic} size={17}/></span>
        <div className="apr-cat-bd"><div className="apr-row" style={{justifyContent:'space-between'}}><span style={{fontSize:13}}>{n}</span><b style={{color:scoreVar(s),fontSize:13}}>{s}<span className="text-muted" style={{fontWeight:400}}> avg</span></b></div>
          <div className="apr-bar"><div style={{width:s+'%',background:scoreVar(s)}}></div></div></div></div>)}</div>
    </div>
  </section>;
}
function InsightsScreen({repos,openReview}){
  const cats={};
  repos.forEach(r=>r.cats.forEach(([n,ic,s])=>{ (cats[n]=cats[n]||{icon:ic,vals:[]}).vals.push([r,s]); }));
  const rows=Object.entries(cats).map(([n,{icon,vals}])=>{
    const avg=Math.round(vals.reduce((a,v)=>a+v[1],0)/vals.length);
    const best=vals.reduce((a,v)=>v[1]>a[1]?v:a), worst=vals.reduce((a,v)=>v[1]<a[1]?v:a);
    return [n,icon,avg,best,worst];
  }).sort((a,b)=>b[2]-a[2]);
  const gapCount={};
  repos.forEach(r=>r.portfolio.checks.forEach(([l,d])=>{ if(!d) gapCount[l]=(gapCount[l]||0)+1; }));
  const common=Object.entries(gapCount).sort((a,b)=>b[1]-a[1]).slice(0,5);
  return <section className="apr-page">
    <div className="apr-ins-grid">
      <div className="card elev-sm apr-pad">
        <h6 className="apr-kicker" style={{marginBottom:'var(--space-3)'}}>Category averages</h6>
        <div style={{display:'grid',gap:'var(--space-3)'}}>{rows.map(([n,ic,avg,best,worst],i)=><div key={i} className="apr-cat" style={{padding:0}}>
          <span className="apr-cat-ic"><I n={ic} size={17}/></span>
          <div className="apr-cat-bd">
            <div className="apr-row" style={{justifyContent:'space-between'}}><span style={{fontSize:13}}>{n}</span><span style={{fontSize:12}}><b style={{color:scoreVar(avg)}}>{avg}</b><span className="text-muted">/100 avg</span></span></div>
            <div className="apr-bar"><div style={{width:avg+'%',background:scoreVar(avg)}}></div></div>
            <div className="apr-row" style={{justifyContent:'space-between',fontSize:11,marginTop:3}} >
              <span className="text-muted">Best: {best[0].name} · {best[1]}</span><span className="text-muted">Lowest: {worst[0].name} · {worst[1]}</span></div>
          </div></div>)}</div>
      </div>
      <div className="card elev-sm apr-pad">
        <h6 className="apr-kicker" style={{marginBottom:'var(--space-3)'}}>Common gaps</h6>
        <ul className="apr-ul">{common.map(([l,n],i)=><li key={i} className="apr-li"><I n="warning" size={15} style={{color:'var(--apr-warn)',marginTop:3}}/>
          <span style={{flex:1}}>{l}</span><span className="tag tag-neutral">{n} repo{n>1?'s':''}</span></li>)}</ul>
        <p className="text-muted" style={{fontSize:12,marginTop:'var(--space-3)',marginBottom:0}}>Gaps counted from each repo's portfolio-readiness checklist.</p>
      </div>
    </div>
    <h6 className="apr-kicker">Repositories</h6>
    <div className="apr-ins-repos">{repos.map(r=><button key={r.id} className="card elev-sm apr-pad apr-ins-repo" onClick={()=>openReview(r.id)}>
      <div className="apr-row" style={{gap:8}}><RepoIcon repo={r} size={26}/><b style={{fontSize:14}}>{r.name}</b></div>
      <div className="apr-row" style={{gap:6,marginTop:'var(--space-2)'}}><b style={{fontSize:22,color:scoreVar(r.score)}}>{r.score}</b><span className="text-muted" style={{fontSize:12}}>/100 · {APR.grade(r.score)}</span></div>
      <div className="apr-bar" style={{marginTop:6}}><div style={{width:r.score+'%',background:scoreVar(r.score)}}></div></div>
    </button>)}</div>
  </section>;
}
function Stub({label}){
  return <section className="apr-page" style={{display:'grid',placeItems:'center',minHeight:'60vh'}}>
    <div style={{textAlign:'center',maxWidth:340}}>
      <I n="barricade" size={34} style={{color:'var(--color-accent)'}}/>
      <h4 style={{marginTop:'var(--space-3)'}}>{label}</h4>
      <p className="text-muted" style={{fontSize:14}}>Not part of this prototype yet — Dashboard, Reviews and Insights are wired up.</p>
    </div></section>;
}
Object.assign(window,{Dashboard,InsightsScreen,Stub});
