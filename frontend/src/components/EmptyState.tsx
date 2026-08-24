import { Icon } from './Icon';

interface EmptyStateProps {
  title: string;
  body: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
}

export function EmptyState({ title, body, icon = 'tray', actionLabel, onAction, busy = false }: EmptyStateProps) {
  return (
    <section className="apr-page apr-empty-page" aria-live="polite" aria-busy={busy}>
      <div className="card elev-sm apr-pad apr-empty">
        <Icon n={icon} size={32} style={busy ? { animation: 'apr-spin 1s linear infinite' } : undefined} />
        <h4>{title}</h4>
        <p className="text-muted">{body}</p>
        {actionLabel && onAction && (
          <button className="btn btn-primary" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
    </section>
  );
}
