import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { apiFetch, errorMessage, getToken, setToken, AUTH_REQUIRED_EVENT } from '../api';
import type { Session } from '../types';

type GateState = 'checking' | 'ready' | 'needs-token';

const AuthGate = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<GateState>('checking');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const check = useCallback(async () => {
    try {
      const session = await apiFetch<Session>('/api/session');
      setState(!session.tokenRequired || session.authenticated ? 'ready' : 'needs-token');
    } catch {
      setState('ready');
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => {
    const onAuthRequired = () => setState('needs-token');
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const previous = getToken();
    setToken(input.trim());
    try {
      const session = await apiFetch<Session>('/api/session');
      if (session.authenticated) {
        setInput('');
        setState('ready');
      } else {
        setToken(previous);
        setError('That access token is not valid.');
      }
    } catch (err) {
      setToken(previous);
      setError(errorMessage(err, 'Could not check the token.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'checking') {
    return (
      <div className="min-h-screen studio-bg flex items-center justify-center" role="status" aria-label="Connecting to the server">
        <Loader2 className="w-7 h-7 text-[var(--color-accent)] animate-spin" />
      </div>
    );
  }

  if (state === 'needs-token') {
    return (
      <div className="min-h-screen studio-bg flex items-center justify-center p-6">
        <form onSubmit={submit} className="panel w-full max-w-md p-8 space-y-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-accent-soft)] flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-[var(--color-accent)]" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-[var(--color-ink)]">Access token required</h1>
              <p className="text-sm text-[var(--color-muted)] mt-1">
                Enter the <code className="text-[var(--color-ink)]">API_TOKEN</code> from <code className="text-[var(--color-ink)]">backend/.env</code>.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="access-token" className="field-label">Access token</label>
            <input
              id="access-token"
              type="password"
              autoComplete="current-password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="field-input"
              autoFocus
            />
            {error && <p className="mt-2 text-sm text-[var(--color-danger)]" role="alert">{error}</p>}
          </div>

          <button type="submit" disabled={!input.trim() || submitting} className="btn-primary w-full">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Continue
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthGate;
