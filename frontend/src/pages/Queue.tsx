import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Calendar, Clock, RefreshCw, AlertTriangle, CheckCircle, Video, LayoutGrid, Loader2, Trash2, RotateCcw } from 'lucide-react';
import { apiFetch, errorMessage } from '../api';
import { platformName, type PlatformResult, type Post } from '../types';

const POLL_INTERVAL_MS = 5000;

const STATUS_STYLES: Record<Post['status'], { className: string; icon: ReactNode; label: string }> = {
    pending: { className: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10', icon: <Calendar className="w-3.5 h-3.5" aria-hidden="true" />, label: 'Scheduled' },
    processing: { className: 'text-blue-400 border-blue-400/30 bg-blue-400/10', icon: <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />, label: 'Publishing' },
    uploaded: { className: 'text-green-400 border-green-400/30 bg-green-400/10', icon: <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />, label: 'Published' },
    failed: { className: 'text-red-400 border-red-400/30 bg-red-400/10', icon: <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />, label: 'Failed' },
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
        <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider flex items-center gap-1.5 w-max ${style.className}`}>
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
                        className={`px-2.5 py-1 text-[10px] rounded-lg uppercase font-bold tracking-wider border flex items-center gap-1
                            ${uploaded ? 'bg-green-500/10 text-green-400 border-green-500/20' : failed ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-white/10 text-gray-200 border-white/5'}`}
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
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50">
                    <RotateCcw className="w-3 h-3" aria-hidden="true" /> Retry
                </button>
            )}
            {(post.status === 'failed' || post.status === 'pending') && (
                <button type="button" onClick={() => postAction(post, 'delete')} disabled={busyPostId === post.id}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold flex items-center gap-1 disabled:opacity-50">
                    <Trash2 className="w-3 h-3" aria-hidden="true" /> Remove
                </button>
            )}
        </div>
    );

    const renderDetails = (post: Post) => (
        <>
            {post.status === 'pending' && post.retry_count > 0 && (
                <div className="text-yellow-400 text-xs font-semibold flex items-center gap-1 mb-1">
                    <RefreshCw className="w-3 h-3" aria-hidden="true" />
                    Retry {post.retry_count} of 3 scheduled
                </div>
            )}
            {post.error_message && post.status !== 'uploaded' && (
                <div className={`text-xs font-medium break-words leading-relaxed border-l-2 pl-3 py-1 ${post.status === 'failed' ? 'text-red-400/90 border-red-500/30' : 'text-yellow-400/80 border-yellow-500/30'}`}>
                    {post.error_message}
                </div>
            )}
            {post.status === 'uploaded' && <div className="text-gray-500 text-xs font-medium">Published successfully</div>}
        </>
    );

    const emptyState = (
        <div className="flex flex-col items-center justify-center text-gray-500">
            {loading ? <Loader2 className="w-8 h-8 mb-3 animate-spin" aria-hidden="true" /> : <LayoutGrid className="w-8 h-8 mb-3 opacity-50" aria-hidden="true" />}
            <span className="text-sm font-medium">{loading ? 'Loading queue...' : error ? 'The queue could not be loaded.' : 'No posts in the queue.'}</span>
        </div>
    );

    return (
        <div className="w-full flex flex-col p-6 lg:p-10 pt-24 md:pt-10 animate-fade-in-up">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Publishing Queue</h1>
                    <p className="text-gray-400 font-medium">Monitor and manage your automated scheduled uploads.</p>
                </div>

                <button
                    type="button"
                    onClick={fetchPosts}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-5 py-2.5 glass-panel rounded-xl hover:bg-white/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-white border border-white/10 w-full md:w-auto justify-center"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                    <span>Refresh Queue</span>
                </button>
            </div>

            {error && (
                <div className="mb-6 px-4 py-3 rounded-xl border bg-red-500/10 border-red-500/30 text-red-400 text-sm font-medium flex items-center gap-2" role="alert">
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" /> {error}
                </div>
            )}

            {/* Desktop View (Table) */}
            <div className="hidden md:block glass-panel rounded-3xl overflow-hidden border border-white/10 animate-slide-up shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-black/50 border-b border-white/5 text-xs uppercase tracking-widest text-gray-500 font-bold">
                                <th className="p-6 font-semibold">Video</th>
                                <th className="p-6 font-semibold">Platforms</th>
                                <th className="p-6 font-semibold">Scheduled For</th>
                                <th className="p-6 font-semibold">Status</th>
                                <th className="p-6 font-semibold">Details</th>
                                <th className="p-6 font-semibold"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {posts.length === 0 ? (
                                <tr><td colSpan={6} className="p-12 text-center">{emptyState}</td></tr>
                            ) : posts.map(post => (
                                <tr key={post.id} className="hover:bg-white/[0.02] transition-colors group align-top">
                                    <td className="p-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 shrink-0">
                                                <Video className="w-5 h-5 text-gray-300" aria-hidden="true" />
                                            </div>
                                            <div className="max-w-[220px] truncate font-bold text-white text-sm" title={post.title || undefined}>
                                                {post.title || 'Untitled Clip'}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6"><PlatformChips post={post} /></td>
                                    <td className="p-6 whitespace-nowrap">
                                        <div className="flex items-center gap-2 text-gray-400 font-medium text-sm">
                                            <Clock className="w-4 h-4 text-gray-500" aria-hidden="true" />
                                            {new Date(post.scheduled_time.replace(' ', 'T') + 'Z').toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="p-6"><StatusBadge status={post.status} /></td>
                                    <td className="p-6 max-w-[260px]">{renderDetails(post)}</td>
                                    <td className="p-6">{renderActions(post)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile View (Cards) */}
            <div className="md:hidden flex flex-col gap-4 animate-slide-up">
                {posts.length === 0 ? (
                    <div className="glass-panel p-10 rounded-2xl border border-white/5">{emptyState}</div>
                ) : posts.map(post => (
                    <div key={post.id} className="glass-panel rounded-2xl p-5 border border-white/5 hover:border-white/20 transition-all flex flex-col gap-4 shadow-lg">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 shrink-0">
                                    <Video className="w-4 h-4 text-gray-300" aria-hidden="true" />
                                </div>
                                <div className="truncate font-bold text-white text-sm">{post.title || 'Untitled Clip'}</div>
                            </div>
                            <StatusBadge status={post.status} />
                        </div>

                        <div className="h-[1px] w-full bg-white/5"></div>

                        <PlatformChips post={post} />
                        <div className="flex items-center gap-1.5 text-gray-300 font-medium text-xs">
                            <Clock className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
                            {new Date(post.scheduled_time.replace(' ', 'T') + 'Z').toLocaleString()}
                        </div>
                        {renderDetails(post)}
                        {renderActions(post)}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Queue;
