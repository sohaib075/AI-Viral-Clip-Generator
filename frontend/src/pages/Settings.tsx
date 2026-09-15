import { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, KeyRound, Server, Share2, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, errorMessage, getToken, setToken } from '../api';
import { API_URL } from '../config';
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
    <div className="w-full max-w-4xl mx-auto flex flex-col p-8 animate-fade-in-up gap-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-gray-400" aria-hidden="true" />
          Settings
        </h1>
        <p className="text-gray-400 font-medium">Connection and access settings for this browser.</p>
      </div>

      {/* Server */}
      <section className="glass-panel p-8 rounded-3xl" aria-labelledby="server-heading">
        <h2 id="server-heading" className="text-xl font-bold text-white mb-6 border-b border-white/10 pb-4 flex items-center gap-2">
          <Server className="w-5 h-5" aria-hidden="true" /> Server
        </h2>
        <dl className="space-y-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-400 font-bold">API address</dt>
            <dd className="text-white font-mono break-all text-right">{API_URL}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-400 font-bold">Status</dt>
            <dd className="text-right">
              {session ? (
                <span className="text-green-400 font-semibold flex items-center gap-1 justify-end"><CheckCircle className="w-4 h-4" aria-hidden="true" /> Connected</span>
              ) : connectionError ? (
                <span className="text-red-400 font-semibold flex items-center gap-1 justify-end"><AlertTriangle className="w-4 h-4" aria-hidden="true" /> {connectionError}</span>
              ) : (
                <span className="text-gray-400">Checking...</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* Access token */}
      <section className="glass-panel p-8 rounded-3xl" aria-labelledby="token-heading">
        <h2 id="token-heading" className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <KeyRound className="w-5 h-5" aria-hidden="true" /> Access Token
        </h2>
        <p className="text-sm text-gray-400 mb-6 border-b border-white/10 pb-4">
          {session?.tokenRequired
            ? 'This server requires the API_TOKEN from backend/.env. It is stored only in this browser.'
            : 'This server does not require an access token. Set API_TOKEN in backend/.env to protect it.'}
        </p>

        <div className="space-y-3 max-w-xl">
          <label htmlFor="settings-token" className="text-sm font-bold text-gray-400">{hasStoredToken ? 'Replace access token' : 'Access token'}</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="settings-token"
              type="password"
              autoComplete="off"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              className="flex-1 px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-white text-white"
            />
            <button
              type="button"
              onClick={saveToken}
              disabled={!tokenInput.trim() || saving}
              className="px-6 py-3 bg-white hover:bg-gray-200 text-black font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Save
            </button>
          </div>
          {hasStoredToken && (
            <button type="button" onClick={clearToken} className="text-sm font-semibold text-red-400 hover:text-red-300">
              Remove stored token
            </button>
          )}
          {tokenMessage && (
            <p className={`text-sm font-medium ${tokenMessage.ok ? 'text-green-400' : 'text-red-400'}`} role="status">{tokenMessage.text}</p>
          )}
        </div>
      </section>

      {/* Publishing */}
      <section className="glass-panel p-8 rounded-3xl" aria-labelledby="publishing-heading">
        <h2 id="publishing-heading" className="text-xl font-bold text-white mb-6 border-b border-white/10 pb-4 flex items-center gap-2">
          <Share2 className="w-5 h-5" aria-hidden="true" /> Publishing
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/accounts" className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors">Manage social accounts</Link>
          <Link to="/queue" className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors">Open publishing queue</Link>
          <Link to="/how-it-works" className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors">How it works</Link>
        </div>
      </section>
    </div>
  );
};

export default Settings;
