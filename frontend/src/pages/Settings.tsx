import { useState, useEffect, useCallback } from 'react';
import { KeyRound, Server, Share2, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, errorMessage, getToken, setToken } from '../api';
import { API_URL } from '../config';
import { PageHeader, Panel } from '../components/ui';
import type { Session } from '../types';

const Settings = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [connectionError, setConnectionError] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [tokenMessage, setTokenMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasStoredToken, setHasStoredToken] = useState(Boolean(getToken()));

  const checkSession = useCallback(async () => {
    try {
      setSession(await apiFetch<Session>('/api/session'));
      setConnectionError('');
    } catch (err) {
      setSession(null);
      setConnectionError(errorMessage(err, 'Could not reach the server.'));
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const saveToken = async () => {
    setSaving(true);
    setTokenMessage(null);
    const previous = getToken();
    setToken(tokenInput.trim());
    try {
      const result = await apiFetch<Session>('/api/session');
      if (result.tokenRequired && !result.authenticated) {
        setToken(previous);
        setTokenMessage({ ok: false, text: 'That access token is not valid.' });
      } else {
        setTokenInput('');
        setHasStoredToken(Boolean(getToken()));
        setSession(result);
        setTokenMessage({ ok: true, text: 'Access token saved in this browser.' });
      }
    } catch (err) {
      setToken(previous);
      setTokenMessage({ ok: false, text: errorMessage(err, 'Could not check the token.') });
    } finally {
      setSaving(false);
    }
  };

  const clearToken = () => {
    setToken('');
    setHasStoredToken(false);
    setTokenMessage({ ok: true, text: 'Access token removed from this browser.' });
    checkSession();
  };

  return (
    <div className="page-shell max-w-3xl mx-auto animate-fade-in-up gap-6">
      <PageHeader
        title="Settings"
        subtitle="Connection and access for this browser."
      />

      <Panel className="p-6 sm:p-8">
        <h2 className="font-display text-lg font-bold text-[var(--color-ink)] mb-5 flex items-center gap-2 pb-4 border-b border-[var(--color-border)]">
          <Server className="w-5 h-5 text-[var(--color-muted)]" aria-hidden="true" /> Server
        </h2>
        <dl className="space-y-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--color-muted)] font-medium">API address</dt>
            <dd className="text-[var(--color-ink)] font-mono break-all text-right text-xs sm:text-sm">{API_URL || '(same origin)'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--color-muted)] font-medium">Status</dt>
            <dd className="text-right">
              {session ? (
                <span className="text-[var(--color-ok)] font-semibold inline-flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" aria-hidden="true" /> Connected
                </span>
              ) : connectionError ? (
                <span className="text-[var(--color-danger)] font-semibold inline-flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" /> {connectionError}
                </span>
              ) : (
                <span className="text-[var(--color-faint)]">Checking…</span>
              )}
            </dd>
          </div>
        </dl>
      </Panel>

      <Panel className="p-6 sm:p-8">
        <h2 className="font-display text-lg font-bold text-[var(--color-ink)] mb-2 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-[var(--color-muted)]" aria-hidden="true" /> Access token
        </h2>
        <p className="text-sm text-[var(--color-muted)] mb-5 pb-4 border-b border-[var(--color-border)]">
          {session?.tokenRequired
            ? 'This server requires the API_TOKEN from backend/.env. It stays only in this browser.'
            : 'This server does not require a token. Set API_TOKEN in backend/.env to protect it.'}
        </p>

        <div className="space-y-3 max-w-xl">
          <label htmlFor="settings-token" className="field-label">
            {hasStoredToken ? 'Replace access token' : 'Access token'}
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="settings-token"
              type="password"
              autoComplete="off"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="field-input flex-1"
            />
            <button
              type="button"
              onClick={saveToken}
              disabled={!tokenInput.trim() || saving}
              className="btn-primary shrink-0"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Save
            </button>
          </div>
          {hasStoredToken && (
            <button type="button" onClick={clearToken} className="text-sm font-semibold text-[var(--color-danger)] hover:opacity-80">
              Remove stored token
            </button>
          )}
          {tokenMessage && (
            <p className={`text-sm font-medium ${tokenMessage.ok ? 'text-[var(--color-ok)]' : 'text-[var(--color-danger)]'}`} role="status">
              {tokenMessage.text}
            </p>
          )}
        </div>
      </Panel>

      <Panel className="p-6 sm:p-8">
        <h2 className="font-display text-lg font-bold text-[var(--color-ink)] mb-5 flex items-center gap-2 pb-4 border-b border-[var(--color-border)]">
          <Share2 className="w-5 h-5 text-[var(--color-muted)]" aria-hidden="true" /> Publishing
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/accounts" className="btn-secondary">Social accounts</Link>
          <Link to="/queue" className="btn-secondary">Publishing queue</Link>
          <Link to="/how-it-works" className="btn-secondary">How it works</Link>
        </div>
      </Panel>
    </div>
  );
};

export default Settings;
