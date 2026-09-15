import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { apiFetch, errorMessage, getToken, setToken, AUTH_REQUIRED_EVENT } from '../api';
import type { Session } from '../types';

type GateState = 'checking' | 'ready' | 'needs-token';

// When the backend has API_TOKEN set, asks for the token before showing the app
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
      // Backend unreachable: let the pages show their own connection errors
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
      <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Connecting to the server">
        <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
      </div>
    );
  }

  if (state === 'needs-token') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <form onSubmit={submit} className="glass-panel w-full max-w-md rounded-3xl p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Access token required</h1>
              <p className="text-sm text-gray-400">This server is protected. Enter the API_TOKEN from backend/.env.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="access-token" className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Access token</label>
            <input
              id="access-token"
              type="password"
              autoComplete="current-password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-white/40 text-white text-sm"
              autoFocus
            />
            {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={!input.trim() || submitting}
            className="w-full py-3 rounded-xl bg-white text-black font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
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
