import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Video, Camera, Smartphone, MessageCircle, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch, errorMessage } from '../api';
import { API_URL } from '../config';
import { PLATFORMS, platformName, type Account } from '../types';

const PLATFORM_ICONS: Record<string, ReactNode> = {
    youtube: <Video className="w-6 h-6 text-red-500" aria-hidden="true" />,
    instagram: <Camera className="w-6 h-6 text-pink-500" aria-hidden="true" />,
    tiktok: <Smartphone className="w-6 h-6 text-[#25F4EE]" aria-hidden="true" />,
    x: <MessageCircle className="w-6 h-6 text-white" aria-hidden="true" />,
};

// Reasons the backend sends back after an OAuth flow (?error=...)
const OAUTH_ERRORS: Record<string, string> = {
    setup_required: "This platform isn't configured on the server yet. Add its client ID and secret to backend/.env.",
    invalid_state: 'The connection link expired or was already used. Please try again.',
    access_denied: 'The connection was cancelled.',
    oauth_failed: "The platform didn't accept the connection. Please try again.",
    encryption_key_missing: 'The server needs ENCRYPTION_KEY in backend/.env before accounts can be connected.',
    unauthorized: 'Your session expired. Please try connecting again.',
    platform_not_implemented: "Connecting this platform isn't supported.",
};

const Accounts = () => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [connecting, setConnecting] = useState<string | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

    const fetchAccounts = useCallback(async () => {
        try {
            setAccounts(await apiFetch<Account[]>('/api/accounts'));
            setError('');
        } catch (e) {
            setError(errorMessage(e, 'Could not load connected accounts.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

    // Show the result of an OAuth flow once, then clean the URL
    useEffect(() => {
        const connected = searchParams.get('connected');
        const oauthError = searchParams.get('error');
        if (!connected && !oauthError) return;
        setNotice(connected
            ? { ok: true, text: `${platformName(connected)} connected.` }
            : { ok: false, text: OAUTH_ERRORS[oauthError!] || 'Connecting the account failed.' });
        setSearchParams({}, { replace: true });
    }, [searchParams, setSearchParams]);

    const connectAccount = async (platformId: string) => {
        setConnecting(platformId);
        setNotice(null);
        try {
            // The OAuth flow runs as a page navigation, which can't send the access token, so get a one-time ticket first
            const returnTo = `${window.location.origin}/accounts`;
            const { ticket } = await apiFetch<{ ticket: string }>('/api/oauth/ticket', {
                method: 'POST',
                body: JSON.stringify({ platform: platformId, returnTo })
            });
            const params = new URLSearchParams({ ticket, return_to: returnTo });
            window.location.href = `${API_URL}/auth/${platformId}?${params}`;
        } catch (e) {
            setNotice({ ok: false, text: errorMessage(e, 'Could not start connecting the account.') });
            setConnecting(null);
        }
    };

    const disconnectAccount = async (account: Account) => {
        if (!window.confirm(`Disconnect ${account.account_name}? Scheduled posts to ${platformName(account.platform)} will fail until you reconnect.`)) return;
        try {
            await apiFetch(`/api/accounts/${encodeURIComponent(account.id)}`, { method: 'DELETE' });
            fetchAccounts();
        } catch (e) {
            setNotice({ ok: false, text: errorMessage(e, 'Could not disconnect the account.') });
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto pt-24 md:pt-8">
            <h1 className="text-4xl font-bold text-white mb-2">Social Accounts</h1>
            <p className="text-gray-400 mb-8 text-lg font-medium">Connect your social media accounts for fully automated publishing.</p>

            {notice && (
                <div className={`mb-6 px-4 py-3 rounded-xl border text-sm font-medium flex items-center gap-2 ${notice.ok ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`} role="status">
                    {notice.ok ? <CheckCircle className="w-4 h-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />}
                    {notice.text}
                </div>
            )}

            {error && (
                <div className="mb-6 px-4 py-3 rounded-xl border bg-red-500/10 border-red-500/30 text-red-400 text-sm font-medium" role="alert">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {PLATFORMS.map(platform => {
                    const connectedAccs = accounts.filter(a => a.platform === platform.id);
                    const isConnected = connectedAccs.length > 0;

                    return (
                        <div key={platform.id} className="glass-panel p-6 rounded-3xl relative overflow-hidden group hover:border-white/50 transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-white/5 rounded-2xl">{PLATFORM_ICONS[platform.id]}</div>
                                {loading || error ? null : isConnected ? (
                                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" aria-hidden="true" /> Connected
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 bg-white/5 text-gray-400 rounded-full text-xs font-bold flex items-center gap-1">
                                        <XCircle className="w-3 h-3" aria-hidden="true" /> Not Connected
                                    </span>
                                )}
                            </div>
                            <h2 className="text-xl font-bold text-white mb-1">{platform.name}</h2>

                            <div className="mt-6 space-y-3">
                                {connectedAccs.map(acc => (
                                    <div key={acc.id} className="flex items-center justify-between bg-black/50 p-3 rounded-xl border border-white/5">
                                        <span className="text-sm text-gray-300 font-medium truncate">{acc.account_name}</span>
                                        <button
                                            type="button"
                                            onClick={() => disconnectAccount(acc)}
                                            className="text-xs text-red-400 hover:text-red-300 font-bold"
                                        >
                                            Disconnect
                                        </button>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={() => connectAccount(platform.id)}
                                    disabled={connecting !== null}
                                    className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/5 hover:border-white/30 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {connecting === platform.id && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                                    {isConnected ? 'Reconnect or add account' : '+ Connect Account'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Accounts;
