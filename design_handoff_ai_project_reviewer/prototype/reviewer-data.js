// AI Project Reviewer — data layer.
// Backend plan: MariaDB on the Raspberry Pi behind a small REST API, plus a local
// LLM (Ollama) for review generation. The prototype tries both endpoints and falls
// back to the embedded sample data when they aren't reachable.
window.APR_CONFIG = {
  apiBase: 'http://raspberrypi.local:8080',   // REST API in front of MariaDB (e.g. GET /api/repos)
  llmBase: 'http://raspberrypi.local:11434',  // Ollama
  llmModel: 'llama3.1'
};
window.APR = {
  grade(s){ return s>=80?'Excellent':s>=65?'Good':s>=50?'Fair':'Needs work'; },
  async ping(url){ try{ const c=new AbortController(); setTimeout(()=>c.abort(),1500); const r=await fetch(url,{signal:c.signal,mode:'cors'}); return r.ok; }catch(e){ return false; } },
  async load(){ // repos from MariaDB API, else sample
    try{ const c=new AbortController(); setTimeout(()=>c.abort(),1500);
      const r=await fetch(APR_CONFIG.apiBase+'/api/repos',{signal:c.signal});
      if(r.ok) return {live:true, repos:await r.json()};
    }catch(e){}
    return {live:false, repos:window.APR_SAMPLE};
  },
  async rerun(repo){ // ask the local LLM for a fresh summary, else simulate
    try{ const c=new AbortController(); setTimeout(()=>c.abort(),8000);
      const r=await fetch(APR_CONFIG.llmBase+'/api/generate',{method:'POST',signal:c.signal,headers:{'content-type':'application/json'},
        body:JSON.stringify({model:APR_CONFIG.llmModel,stream:false,prompt:'In 2 sentences, summarize this code review: '+JSON.stringify({name:repo.name,scores:repo.cats,gaps:repo.improves})})});
      if(r.ok){ const j=await r.json(); if(j.response) return {live:true, summary:j.response.trim()}; }
    }catch(e){}
    await new Promise(res=>setTimeout(res,1400));
    return {live:false, summary:repo.ai};
  }
};
window.APR_SAMPLE = [
{ id:'threatstream', name:'ThreatStream-lite', vis:'Public', url:'github.com/example/ThreatStream-lite', updated:'2 hours ago', hue:152,
  lang:'Python', framework:'FastAPI', loc:'3,842', issues:4, prs:1, contributors:1, score:72,
  summary:[['cube','Type','FastAPI project',''],['shipping-container','Docker','Present','good'],['file-text','README','Present','good'],['git-branch','CI Workflow','Missing','warn'],['flask','Tests','Missing','warn'],['clock','Recent Activity','12 commits in last 14 days','good']],
  cats:[['Documentation','book-open',65],['Testing','flask',20],['Docker','shipping-container',85],['CI/CD','git-branch',15],['Security','shield-check',60],['Maintainability','wrench',78]],
  strengths:['Clean and modular FastAPI project structure.','Docker support is well implemented with a multi-stage Dockerfile.','Environment configuration is handled via .env.example.','Recent commit activity shows consistent development.'],
  improves:['No automated tests detected. Adding unit and integration tests will improve reliability.','CI workflow is missing. Consider adding a GitHub Actions workflow.','README is present but could be more comprehensive with usage examples and screenshots.','No licensing information found.'],
  steps:['Add tests using pytest and httpx for API endpoints.','Set up GitHub Actions for linting, tests, and Docker build.','Improve README with installation, usage, and screenshots.','Add a LICENSE file to clarify usage terms.'],
  portfolio:{verdict:'Good', blurb:'This project shows strong foundational work and has good potential for a portfolio piece.', checks:[['Clear project purpose',1],['Modern tech stack',1],['Dockerized application',1],['Automated tests',0],['CI/CD pipeline',0],['Detailed documentation',0],['License',0]], footer:'Address the gaps to make your project stand out to potential employers.'},
  ai:'ThreatStream-lite is a solid FastAPI project with good structure and Docker support. Focus on adding tests, CI/CD, and improving documentation to elevate it to production-ready and portfolio-ready quality.',
  quality:{metrics:[['Lint issues',23],['Complexity','B'],['Duplication','4%'],['Type hints','61%']],
    findings:[['warn','routers/feeds.py — 3 functions exceed 40 lines; extract enrichment logic.'],['warn','Broad `except Exception` in ingest.py hides parsing failures.'],['info','Consistent naming and module layout across the app package.']]},
  structure:['app/','├─ main.py            FastAPI app + router mounting','├─ routers/           feeds, indicators, health','├─ models/            Pydantic schemas','├─ services/          ingest + enrichment','├─ Dockerfile          multi-stage, slim runtime','└─ .env.example        12 documented variables'],
  deps:[['fastapi','0.110.0','0.115.2','outdated'],['uvicorn','0.29.0','0.30.1','ok'],['pydantic','2.7.1','2.8.2','ok'],['requests','2.28.0','2.32.3','major'],['python-dotenv','1.0.1','1.0.1','ok']],
  security:[['high','No rate limiting on public endpoints','Feed ingestion routes accept unauthenticated POSTs; add throttling or an API key.'],['med','Requests pinned to a version with known CVEs','Upgrade requests past 2.31 to clear CVE-2023-32681.'],['ok','No secrets committed','History scan found no keys or tokens.']]},
{ id:'dataviz', name:'DataViz Pro', vis:'Public', url:'github.com/example/dataviz-pro', updated:'1 day ago', hue:250,
  lang:'TypeScript', framework:'React + Vite', loc:'12,480', issues:2, prs:3, contributors:2, score:84,
  summary:[['cube','Type','React SPA',''],['shipping-container','Docker','Present','good'],['file-text','README','Comprehensive','good'],['git-branch','CI Workflow','Active','good'],['flask','Tests','214 passing','good'],['clock','Recent Activity','31 commits in last 14 days','good']],
  cats:[['Documentation','book-open',80],['Testing','flask',75],['Docker','shipping-container',60],['CI/CD','git-branch',90],['Security','shield-check',82],['Maintainability','wrench',88]],
  strengths:['Strict TypeScript with well-typed chart config layer.','CI runs lint, tests and a preview deploy on every PR.','Storybook covers the core chart components.','Small, focused components with clear ownership.'],
  improves:['Dockerfile is single-stage and ships dev dependencies.','E2E coverage is thin — only two Playwright specs.','Bundle analysis is not tracked; vendor chunk grew 18% this quarter.'],
  steps:['Split the Dockerfile into build and runtime stages.','Add Playwright specs for the dashboard builder flow.','Add bundle-size check to CI with a budget.'],
  portfolio:{verdict:'Excellent', blurb:'Polished, well-tested and documented — already a strong portfolio piece.', checks:[['Clear project purpose',1],['Modern tech stack',1],['Dockerized application',1],['Automated tests',1],['CI/CD pipeline',1],['Detailed documentation',1],['License',1]], footer:'Keep the demo deployment fresh — reviewers will click it.'},
  ai:'DataViz Pro is a mature React/TypeScript codebase with strong CI and testing discipline. The remaining gaps are operational: a leaner Docker image and deeper end-to-end coverage.',
  quality:{metrics:[['Lint issues',4],['Complexity','A'],['Duplication','2%'],['Type coverage','96%']],
    findings:[['info','Chart config union types are exemplary — consider extracting as a package.'],['warn','useDashboard hook at 180 lines; split fetch and layout concerns.']]},
  structure:['src/','├─ components/charts/   12 chart primitives','├─ components/builder/  drag-drop dashboard builder','├─ hooks/               data + layout hooks','├─ stories/             Storybook coverage','└─ e2e/                 2 Playwright specs'],
  deps:[['react','18.3.1','18.3.1','ok'],['vite','5.2.0','5.4.1','ok'],['d3','7.8.5','7.9.0','ok'],['zustand','4.5.2','4.5.4','ok']],
  security:[['ok','Dependencies clean','npm audit reports no known vulnerabilities.'],['med','Preview deploys are public','PR preview URLs are unauthenticated; gate behind a token.']]},
{ id:'taskflow', name:'TaskFlow API', vis:'Private', url:'github.com/example/taskflow-api', updated:'2 days ago', hue:200,
  lang:'JavaScript', framework:'Node + Express', loc:'6,910', issues:9, prs:0, contributors:1, score:58,
  summary:[['cube','Type','Express REST API',''],['shipping-container','Docker','Present','good'],['file-text','README','Minimal','warn'],['git-branch','CI Workflow','Lint only','warn'],['flask','Tests','38 passing','good'],['clock','Recent Activity','5 commits in last 14 days','warn']],
  cats:[['Documentation','book-open',55],['Testing','flask',45],['Docker','shipping-container',70],['CI/CD','git-branch',40],['Security','shield-check',50],['Maintainability','wrench',62]],
  strengths:['Clear route/controller/service layering.','Docker Compose brings up API + MariaDB in one command.','Input validation with celebrate on most write routes.'],
  improves:['Tests cover controllers but no integration tests against the database.','CI runs lint only — tests are not enforced.','README lacks setup and endpoint documentation.','JWT secret has a fallback default in config.'],
  steps:['Add supertest integration suite against a docker-compose DB.','Enforce the test suite in CI.','Document endpoints with a generated OpenAPI spec.','Remove the JWT secret fallback; fail fast when unset.'],
  portfolio:{verdict:'Fair', blurb:'Sound architecture, but hygiene gaps would show in a code review.', checks:[['Clear project purpose',1],['Modern tech stack',1],['Dockerized application',1],['Automated tests',1],['CI/CD pipeline',0],['Detailed documentation',0],['License',0]], footer:'Two focused weekends would move this to Good.'},
  ai:'TaskFlow API has clean layering and a working Docker setup, but CI enforcement, documentation, and a hard-coded JWT fallback hold the score down.',
  quality:{metrics:[['Lint issues',41],['Complexity','C'],['Duplication','7%'],['JSDoc coverage','22%']],
    findings:[['warn','controllers/tasks.js duplicates pagination logic from projects.js.'],['warn','Callback-style error handling mixed with async/await in services.'],['info','Validation schemas are consistent and centralized.']]},
  structure:['src/','├─ routes/              REST route definitions','├─ controllers/         request handling','├─ services/            business logic','├─ db/                  MariaDB pool + migrations','└─ docker-compose.yml   API + MariaDB'],
  deps:[['express','4.18.2','4.19.2','ok'],['mysql2','3.6.0','3.10.1','outdated'],['jsonwebtoken','8.5.1','9.0.2','major'],['celebrate','15.0.3','15.0.3','ok']],
  security:[['high','JWT secret fallback default','config.js falls back to a literal secret when env is unset.'],['med','jsonwebtoken 8.x','Upgrade to 9.x to clear known advisories.'],['ok','SQL access is parameterized','No string-built queries found.']]},
{ id:'mltoolkit', name:'ML-Toolkit', vis:'Public', url:'github.com/example/ml-toolkit', updated:'5 days ago', hue:35,
  lang:'Python', framework:'Library', loc:'9,215', issues:14, prs:2, contributors:3, score:41,
  summary:[['cube','Type','Python library',''],['shipping-container','Docker','Missing','warn'],['file-text','README','Present','good'],['git-branch','CI Workflow','Missing','warn'],['flask','Tests','Sparse','warn'],['clock','Recent Activity','2 commits in last 14 days','warn']],
  cats:[['Documentation','book-open',30],['Testing','flask',10],['Docker','shipping-container',35],['CI/CD','git-branch',5],['Security','shield-check',55],['Maintainability','wrench',52]],
  strengths:['Useful, focused utilities for feature engineering.','Notebook examples demonstrate the main workflows.'],
  improves:['Almost no test coverage — 3 test files for 40+ modules.','No CI, no packaging config; not installable via pip.','Docstrings missing on most public functions.','Pinned-nowhere dependencies make results unreproducible.'],
  steps:['Add pyproject.toml and publish a dev build to TestPyPI.','Stand up pytest with coverage gating on core modules.','Add GitHub Actions for lint + tests on 3.10–3.12.','Write docstrings for the public API and generate docs.'],
  portfolio:{verdict:'Needs work', blurb:'The ideas are good but the engineering scaffolding is missing.', checks:[['Clear project purpose',1],['Modern tech stack',1],['Dockerized application',0],['Automated tests',0],['CI/CD pipeline',0],['Detailed documentation',0],['License',1]], footer:'Packaging and tests first — everything else follows.'},
  ai:'ML-Toolkit contains genuinely useful feature-engineering utilities, but without packaging, tests, or CI it reads as a scratch repo rather than a library.',
  quality:{metrics:[['Lint issues',88],['Complexity','D'],['Duplication','11%'],['Docstrings','18%']],
    findings:[['warn','transforms.py is 900 lines; split by transform family.'],['warn','Mutable default arguments in 6 public functions.'],['warn','Numpy and pandas imported per-function in hot paths.']]},
  structure:['ml_toolkit/','├─ transforms.py        900-line grab bag','├─ encoders/            categorical encoders','├─ notebooks/           4 example notebooks','└─ tests/               3 files, core untested'],
  deps:[['numpy','unpinned','2.0.1','major'],['pandas','unpinned','2.2.2','major'],['scikit-learn','unpinned','1.5.1','major']],
  security:[['med','Unpinned dependencies','Builds are unreproducible and open to supply-chain drift.'],['ok','No network or secret handling','Library code has no credential surface.']]},
{ id:'portfolio', name:'Portfolio Site', vis:'Public', url:'github.com/example/portfolio', updated:'1 week ago', hue:300,
  lang:'Astro', framework:'Astro + Tailwind', loc:'2,140', issues:1, prs:0, contributors:1, score:66,
  summary:[['cube','Type','Static site',''],['shipping-container','Docker','N/A',''],['file-text','README','Present','good'],['git-branch','CI Workflow','Deploy on push','good'],['flask','Tests','Missing','warn'],['clock','Recent Activity','1 commit in last 14 days','warn']],
  cats:[['Documentation','book-open',70],['Testing','flask',35],['Docker','shipping-container',20],['CI/CD','git-branch',75],['Security','shield-check',72],['Maintainability','wrench',80]],
  strengths:['Fast static build with excellent Lighthouse scores.','Content collections keep projects and posts typed.','Deploys automatically to Pages on push.'],
  improves:['No link-check or accessibility pass in CI.','Project pages share near-identical layout code.','Two projects link to dead demos.'],
  steps:['Add lychee link-check and axe pass to the deploy workflow.','Extract a shared ProjectLayout component.','Fix or remove the two dead demo links.'],
  portfolio:{verdict:'Good', blurb:'Clean and fast — it is the portfolio, so polish counts double here.', checks:[['Clear project purpose',1],['Modern tech stack',1],['Dockerized application',0],['Automated tests',0],['CI/CD pipeline',1],['Detailed documentation',1],['License',1]], footer:'Dead demo links hurt more here than anywhere else.'},
  ai:'The portfolio site is fast, typed, and auto-deployed. Add link checking and an accessibility pass to CI, and fix the two dead demo links.',
  quality:{metrics:[['Lint issues',7],['Complexity','A'],['Duplication','9%'],['Type coverage','88%']],
    findings:[['info','Content collections schema is a good pattern to show off.'],['warn','ProjectCard and PostCard are 85% identical.']]},
  structure:['src/','├─ content/             typed collections: projects, posts','├─ layouts/             Base + Project layouts','├─ components/          cards, nav, footer','└─ .github/workflows/   deploy.yml'],
  deps:[['astro','4.8.0','4.13.1','outdated'],['tailwindcss','3.4.3','3.4.7','ok'],['@astrojs/mdx','3.0.1','3.1.3','ok']],
  security:[['ok','Static output','No server runtime to attack.'],['med','Astro 4.8','Upgrade past 4.10 for the dev-server advisory (build output unaffected).']]}
];
