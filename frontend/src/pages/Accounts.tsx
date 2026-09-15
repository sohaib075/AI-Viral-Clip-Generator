import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Video, Camera, Smartphone, MessageCircle, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch, errorMessage } from '../api';
import { API_URL } from '../config';
import { PageHeader, Panel } from '../components/ui';
import { PLATFORMS, platformName, type Account } from '../types';

const PLATFORM_ICONS: Record<string, ReactNode> = {
    youtube: <Video className="w-6 h-6 text-red-500" aria-hidden="true" />,
    instagram: <Camera className="w-6 h-6 text-pink-500" aria-hidden="true" />,
    tiktok: <Smartphone className="w-6 h-6 text-[var(--color-ink)]" aria-hidden="true" />,
    x: <MessageCircle className="w-6 h-6 text-[var(--color-ink)]" aria-hidden="true" />,
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
        <div className="page-shell animate-fade-in-up max-w-5xl mx-auto">
            <PageHeader
                title="Social Accounts"
                subtitle="Connect your social media accounts for fully automated publishing."
            />

            {notice && (
                <div
                    className={`mb-6 px-4 py-3 rounded-[10px] border text-sm font-medium flex items-center gap-2 ${
                        notice.ok
                            ? 'bg-[rgba(61,154,106,0.12)] border-[rgba(61,154,106,0.35)] text-[var(--color-ok)]'
                            : 'alert-error'
                    }`}
                    role="status"
                >
                    {notice.ok ? <CheckCircle className="w-4 h-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />}
                    {notice.text}
                </div>
            )}

            {error && (
                <div className="alert-error mb-6" role="alert">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {PLATFORMS.map(platform => {
                    const connectedAccs = accounts.filter(a => a.platform === platform.id);
                    const isConnected = connectedAccs.length > 0;

                    return (
                        <Panel key={platform.id} className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-[var(--color-canvas)] rounded-[10px] border border-[var(--color-border)]">{PLATFORM_ICONS[platform.id]}</div>
                                {loading || error ? null : isConnected ? (
                                    <span className="px-2.5 py-1 bg-[rgba(61,154,106,0.12)] text-[var(--color-ok)] border border-[rgba(61,154,106,0.35)] rounded-md text-xs font-bold flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" aria-hidden="true" /> Connected
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-1 bg-[var(--color-canvas)] text-[var(--color-muted)] border border-[var(--color-border)] rounded-md text-xs font-bold flex items-center gap-1">
                                        <XCircle className="w-3 h-3" aria-hidden="true" /> Not Connected
                                    </span>
                                )}
                            </div>
                            <h2 className="font-display text-xl font-bold text-[var(--color-ink)] mb-1">{platform.name}</h2>

                            <div className="mt-6 space-y-3">
                                {connectedAccs.map(acc => (
                                    <div key={acc.id} className="flex items-center justify-between bg-[var(--color-canvas)] p-3 rounded-[10px] border border-[var(--color-border)]">
                                        <span className="text-sm text-[var(--color-ink)] font-medium truncate">{acc.account_name}</span>
                                        <button
                                            type="button"
                                            onClick={() => disconnectAccount(acc)}
                                            className="text-xs text-[var(--color-danger)] hover:opacity-80 font-bold"
                                        >
                                            Disconnect
                                        </button>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={() => connectAccount(platform.id)}
                                    disabled={connecting !== null}
                                    className="btn-secondary w-full"
                                >
                                    {connecting === platform.id && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                                    {isConnected ? 'Reconnect or add account' : '+ Connect Account'}
                                </button>
                            </div>
                        </Panel>
                    );
                })}
            </div>
        </div>
    );
};

export default Accounts;
