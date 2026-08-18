import { Icon } from '../components/Icon';
import { Ring } from '../components/Ring';
import { RepoIcon } from '../components/RepoIcon';
import { RepoRail } from '../components/RepoRail';
import { SummaryItem } from '../components/SummaryItem';
import { InsightCol } from '../components/InsightCol';
import { TabAI } from '../components/tabs/TabAI';
import { TabQuality } from '../components/tabs/TabQuality';
import { TabStructure } from '../components/tabs/TabStructure';
import { TabDeps } from '../components/tabs/TabDeps';
import { TabSecurity } from '../components/tabs/TabSecurity';
import type { Repo, TabId } from '../data/types';

const TABS: [TabId, string, string, React.ComponentType<{ repo: Repo }>][] = [
  ['ai', 'sparkle', 'AI Review', TabAI],
  ['quality', 'code', 'Code Quality', TabQuality],
  ['structure', 'tree-structure', 'Structure', TabStructure],
  ['deps', 'package', 'Dependencies', TabDeps],
  ['security', 'shield-check', 'Security', TabSecurity],
];

interface ReviewScreenProps {
  repos: Repo[];
  sel: string;
  onSel: (id: string) => void;
  tab: TabId;
  setTab: (t: TabId) => void;
  summary: string | null;
  showPanel: boolean;
}

export function ReviewScreen({ repos, sel, onSel, tab, setTab, summary, showPanel }: ReviewScreenProps) {
  const repo = repos.find((r) => r.id === sel) || repos[0];
  const Body = (TABS.find((t) => t[0] === tab) || TABS[0])[3];
  return (
    <div className={'apr-review' + (showPanel ? '' : ' apr-nopanel')}>
      <RepoRail repos={repos} sel={repo.id} onSel={onSel} />
      <section className="apr-main">
        <div className="card elev-sm apr-pad apr-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="apr-row" style={{ gap: 10, marginBottom: 'var(--space-3)' }}>
              <Icon n="sparkle" w="fill" size={26} style={{ color: 'var(--apr-good)' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: 26 }}>AI Project Reviewer</h3>
                <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
                  Automated review and actionable insights for your codebase.
                </p>
              </div>
            </div>
            <div className="apr-row" style={{ gap: 12 }}>
              <RepoIcon repo={repo} size={40} />
              <div>
                <div className="apr-row" style={{ gap: 8 }}>
                  <b style={{ fontSize: 17 }}>{repo.name}</b>
                  <span className="tag tag-neutral">{repo.vis}</span>
                </div>
                <a href="#" onClick={(e) => e.preventDefault()} className="text-muted" style={{ fontSize: 12, color: 'inherit' }}>
                  {repo.url} <Icon n="arrow-square-out" size={11} />
                </a>
              </div>
            </div>
          </div>
          <Ring score={repo.score} />
        </div>
        <div className="card elev-sm apr-pad">
          <h6 className="apr-kicker" style={{ marginBottom: 'var(--space-3)' }}>
            Project Summary
          </h6>
          <div className="apr-summary">
            {repo.summary.map((it, i) => (
              <SummaryItem key={i} it={it} />
            ))}
          </div>
        </div>
        <nav className="apr-tabs">
          {TABS.map(([id, ic, l]) => (
            <button key={id} className={'apr-tab' + (id === tab ? ' apr-tab-on' : '')} onClick={() => setTab(id)}>
              <Icon n={ic} size={15} /> {l}
            </button>
          ))}
        </nav>
        <Body repo={repo} />
        <div className="card elev-sm apr-pad">
          <h6 className="apr-kicker" style={{ color: 'var(--apr-good)', marginBottom: 6 }}>
            <Icon n="sparkle" size={13} /> AI Summary
          </h6>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{summary || repo.ai}</p>
        </div>
      </section>
      {showPanel && <InsightCol repo={repo} />}
    </div>
  );
}
