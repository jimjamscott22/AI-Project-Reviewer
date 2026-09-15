import { useState } from 'react';
import { Icon } from '../components/Icon';
import { login } from '../data/api';

interface LoginScreenProps {
  onAuthenticated: () => void;
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await login(token.trim());
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 'var(--space-4)' }}>
      <form onSubmit={(event) => void submit(event)} className="card elev-sm apr-pad" style={{ width: 'min(360px, 100%)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <h5 className="apr-row" style={{ margin: 0, gap: 8 }}>
          <Icon n="lock-key" size={18} /> Sign in
        </h5>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
          This reviewer instance requires an access token. Enter it below to continue.
        </p>
        <input
          className="input"
          type="password"
          placeholder="Access token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          disabled={submitting}
          autoFocus
          aria-label="Access token"
        />
        {error && (
          <p role="alert" style={{ color: 'var(--apr-bad)', fontSize: 13, margin: 0 }}>
            {error}
          </p>
        )}
        <button className="btn btn-primary" type="submit" disabled={submitting || !token.trim()}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
