import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Calendar, Clock, RefreshCw, AlertTriangle, CheckCircle, Video, LayoutGrid, Loader2, Trash2, RotateCcw } from 'lucide-react';
import { apiFetch, errorMessage } from '../api';
import { PageHeader, Panel } from '../components/ui';
import { platformName, type PlatformResult, type Post } from '../types';

const POLL_INTERVAL_MS = 5000;

const STATUS_STYLES: Record<Post['status'], { className: string; icon: ReactNode; label: string }> = {
    pending: { className: 'text-[var(--color-warn)] border-[rgba(212,168,74,0.35)] bg-[rgba(212,168,74,0.12)]', icon: <Calendar className="w-3.5 h-3.5" aria-hidden="true" />, label: 'Scheduled' },
    processing: { className: 'text-[var(--color-accent)] border-[rgba(232,93,59,0.35)] bg-[var(--color-accent-soft)]', icon: <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />, label: 'Publishing' },
    uploaded: { className: 'text-[var(--color-ok)] border-[rgba(61,154,106,0.35)] bg-[rgba(61,154,106,0.12)]', icon: <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />, label: 'Published' },
    failed: { className: 'text-[var(--color-danger)] border-[rgba(212,83,74,0.35)] bg-[rgba(212,83,74,0.12)]', icon: <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />, label: 'Failed' },
};

const parseJson = <T,>(value: string | null, fallback: T): T => {
    try {
        return value ? (JSON.parse(value) as T) : fallback;
    } catch {
        return fallback;
    }
};

const StatusBadge = ({ status }: { status: Post['status'] }) => {
    const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
    return (
        <span className={`px-3 py-1.5 rounded-md text-[10px] font-bold border uppercase tracking-wider flex items-center gap-1.5 w-max ${style.className}`}>
            {style.icon}
            {style.label}
        </span>
    );
};

const PlatformChips = ({ post }: { post: Post }) => {
    const platforms = parseJson<string[]>(post.platforms, []);
    const results = parseJson<Record<string, PlatformResult>>(post.platform_results, {});
    return (
        <div className="flex flex-wrap gap-2">
            {platforms.map(p => {
                const result = results[p];
                const uploaded = result === 'uploaded';
                const failed = typeof result === 'object' && Boolean(result?.error);
                return (
                    <span
                        key={p}
                        title={failed && typeof result === 'object' ? result.error : undefined}
                        className={`px-2.5 py-1 text-[10px] rounded-md uppercase font-bold tracking-wider border flex items-center gap-1
                            ${uploaded
                                ? 'bg-[rgba(61,154,106,0.12)] text-[var(--color-ok)] border-[rgba(61,154,106,0.35)]'
                                : failed
                                    ? 'bg-[rgba(212,83,74,0.12)] text-[var(--color-danger)] border-[rgba(212,83,74,0.35)]'
                                    : 'bg-[var(--color-canvas)] text-[var(--color-ink)] border-[var(--color-border)]'}`}
                    >
                        {uploaded && <CheckCircle className="w-3 h-3" aria-label="published" />}
                        {failed && <AlertTriangle className="w-3 h-3" aria-label="failed" />}
                        {platformName(p)}
                    </span>
                );
            })}
        </div>
    );
};

const Queue = () => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [busyPostId, setBusyPostId] = useState<string | null>(null);
    const inFlight = useRef(false);

    const fetchPosts = useCallback(async () => {
        if (inFlight.current) return;
        inFlight.current = true;
        setRefreshing(true);
        try {
            setPosts(await apiFetch<Post[]>('/api/posts'));
            setError('');
        } catch (e) {
            // Keep showing the last good list
            setError(errorMessage(e, 'Could not load the queue.'));
        } finally {
            inFlight.current = false;
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchPosts();
        const interval = setInterval(fetchPosts, POLL_INTERVAL_MS); // Poll for live updates
        return () => clearInterval(interval);
    }, [fetchPosts]);

    const postAction = async (post: Post, action: 'retry' | 'delete') => {
        if (action === 'delete' && !window.confirm(`Remove "${post.title || 'Untitled Clip'}" from the queue?`)) return;
        setBusyPostId(post.id);
        try {
            await apiFetch(action === 'retry' ? `/api/posts/${post.id}/retry` : `/api/posts/${post.id}`, { method: action === 'retry' ? 'POST' : 'DELETE' });
            await fetchPosts();
        } catch (e) {
            setError(errorMessage(e, action === 'retry' ? 'Could not retry the post.' : 'Could not remove the post.'));
        } finally {
            setBusyPostId(null);
        }
    };

    const renderActions = (post: Post) => (
        <div className="flex gap-2">
            {post.status === 'failed' && (
                <button type="button" onClick={() => postAction(post, 'retry')} disabled={busyPostId === post.id}
                    className="btn-secondary !px-3 !py-1.5 text-xs disabled:opacity-50">
                    <RotateCcw className="w-3 h-3" aria-hidden="true" /> Retry
                </button>
            )}
            {(post.status === 'failed' || post.status === 'pending') && (
                <button type="button" onClick={() => postAction(post, 'delete')} disabled={busyPostId === post.id}
                    className="px-3 py-1.5 rounded-[10px] border border-[rgba(212,83,74,0.35)] bg-[rgba(212,83,74,0.12)] hover:opacity-90 text-[var(--color-danger)] text-xs font-bold flex items-center gap-1 disabled:opacity-50">
                    <Trash2 className="w-3 h-3" aria-hidden="true" /> Remove
                </button>
            )}
        </div>
    );

    const renderDetails = (post: Post) => (
        <>
            {post.status === 'pending' && post.retry_count > 0 && (
                <div className="text-[var(--color-warn)] text-xs font-semibold flex items-center gap-1 mb-1">
                    <RefreshCw className="w-3 h-3" aria-hidden="true" />
                    Retry {post.retry_count} of 3 scheduled
                </div>
            )}
            {post.error_message && post.status !== 'uploaded' && (
                <div className={`text-xs font-medium break-words leading-relaxed border-l-2 pl-3 py-1 ${post.status === 'failed' ? 'text-[var(--color-danger)] border-[rgba(212,83,74,0.35)]' : 'text-[var(--color-warn)] border-[rgba(212,168,74,0.35)]'}`}>
                    {post.error_message}
                </div>
            )}
            {post.status === 'uploaded' && <div className="text-[var(--color-faint)] text-xs font-medium">Published successfully</div>}
        </>
    );

    const emptyState = (
        <div className="flex flex-col items-center justify-center text-[var(--color-faint)]">
            {loading ? <Loader2 className="w-8 h-8 mb-3 animate-spin text-[var(--color-accent)]" aria-hidden="true" /> : <LayoutGrid className="w-8 h-8 mb-3 opacity-50" aria-hidden="true" />}
            <span className="text-sm font-medium">{loading ? 'Loading queue...' : error ? 'The queue could not be loaded.' : 'No posts in the queue.'}</span>
        </div>
    );

    return (
        <div className="page-shell animate-fade-in-up max-w-6xl mx-auto">
            <PageHeader
                title="Publishing Queue"
                subtitle="Monitor and manage your automated scheduled uploads."
                action={
                    <button
                        type="button"
                        onClick={fetchPosts}
                        disabled={refreshing}
                        className="btn-secondary w-full md:w-auto"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                        Refresh Queue
                    </button>
                }
            />

            {error && (
                <div className="alert-error mb-6" role="alert">
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" /> {error}
                </div>
            )}

            {/* Desktop View (Table) */}
            <Panel className="hidden md:block overflow-hidden">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-[var(--color-canvas)] border-b border-[var(--color-border)] text-xs uppercase tracking-widest text-[var(--color-faint)] font-bold">
                                <th className="p-5 font-semibold">Video</th>
                                <th className="p-5 font-semibold">Platforms</th>
                                <th className="p-5 font-semibold">Scheduled For</th>
                                <th className="p-5 font-semibold">Status</th>
                                <th className="p-5 font-semibold">Details</th>
                                <th className="p-5 font-semibold"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                            {posts.length === 0 ? (
                                <tr><td colSpan={6} className="p-12 text-center">{emptyState}</td></tr>
                            ) : posts.map(post => (
                                <tr key={post.id} className="hover:bg-[var(--color-canvas)]/50 transition-colors align-top">
                                    <td className="p-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-[var(--color-canvas)] rounded-[10px] flex items-center justify-center border border-[var(--color-border)] shrink-0">
                                                <Video className="w-5 h-5 text-[var(--color-muted)]" aria-hidden="true" />
                                            </div>
                                            <div className="max-w-[220px] truncate font-bold text-[var(--color-ink)] text-sm" title={post.title || undefined}>
                                                {post.title || 'Untitled Clip'}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-5"><PlatformChips post={post} /></td>
                                    <td className="p-5 whitespace-nowrap">
                                        <div className="flex items-center gap-2 text-[var(--color-muted)] font-medium text-sm">
                                            <Clock className="w-4 h-4 text-[var(--color-faint)]" aria-hidden="true" />
                                            {new Date(post.scheduled_time.replace(' ', 'T') + 'Z').toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="p-5"><StatusBadge status={post.status} /></td>
                                    <td className="p-5 max-w-[260px]">{renderDetails(post)}</td>
                                    <td className="p-5">{renderActions(post)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>

            {/* Mobile View (Cards) */}
            <div className="md:hidden flex flex-col gap-4">
                {posts.length === 0 ? (
                    <Panel className="p-10">{emptyState}</Panel>
                ) : posts.map(post => (
                    <Panel key={post.id} className="p-5 flex flex-col gap-4">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 bg-[var(--color-canvas)] rounded-[10px] flex items-center justify-center border border-[var(--color-border)] shrink-0">
                                    <Video className="w-4 h-4 text-[var(--color-muted)]" aria-hidden="true" />
                                </div>
                                <div className="truncate font-bold text-[var(--color-ink)] text-sm">{post.title || 'Untitled Clip'}</div>
                            </div>
                            <StatusBadge status={post.status} />
                        </div>

                        <div className="h-px w-full bg-[var(--color-border)]" />

                        <PlatformChips post={post} />
                        <div className="flex items-center gap-1.5 text-[var(--color-muted)] font-medium text-xs">
                            <Clock className="w-3.5 h-3.5 text-[var(--color-faint)]" aria-hidden="true" />
                            {new Date(post.scheduled_time.replace(' ', 'T') + 'Z').toLocaleString()}
                        </div>
                        {renderDetails(post)}
                        {renderActions(post)}
                    </Panel>
                ))}
            </div>
        </div>
    );
};

export default Queue;
