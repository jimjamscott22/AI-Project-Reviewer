import { Icon } from '../components/Icon';

export function Stub({ label }: { label: string }) {
  return (
    <section className="apr-page" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <Icon n="barricade" size={34} style={{ color: 'var(--color-accent)' }} />
        <h4 style={{ marginTop: 'var(--space-3)' }}>{label}</h4>
        <p className="text-muted" style={{ fontSize: 14 }}>
          Not part of this build yet — Dashboard, Reviews and Insights are wired up.
        </p>
      </div>
    </section>
  );
}
