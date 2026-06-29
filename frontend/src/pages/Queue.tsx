import React, { useEffect, useState } from 'react';
import { Calendar, Clock, RefreshCw, AlertTriangle, CheckCircle, Video, Play, LayoutGrid } from 'lucide-react';
import { API_URL } from '../config';

interface Post {
    id: string;
    clip_url: string;
    platforms: string;
    title: string;
    scheduled_time: string;
    status: string;
    retry_count: number;
    error_message?: string;
}

const Queue = () => {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchPosts = async () => {
        setRefreshing(true);
        try {
            const res = await fetch(`${API_URL}/api/posts`);
            const data = await res.json();
            setPosts(data);
        } catch (e) {
            console.error("Failed to fetch posts", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPosts();
        const interval = setInterval(fetchPosts, 5000); // Poll every 5s for live updates
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'pending': return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10';
            case 'uploaded': return 'text-green-400 border-green-400/30 bg-green-400/10';
            case 'failed': return 'text-red-400 border-red-400/30 bg-red-400/10';
            default: return 'text-gray-400 border-gray-400/30 bg-gray-400/10';
        }
    };

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
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    <span>Refresh Queue</span>
                </button>
            </div>

            {/* Desktop View (Table) */}
            <div className="hidden md:block glass-panel rounded-3xl overflow-hidden border border-white/10 animate-slide-up shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-black/50 border-b border-white/5 text-xs uppercase tracking-widest text-gray-500 font-bold">
                                <th className="p-6 font-semibold">Video</th>
                                <th className="p-6 font-semibold">Platforms</th>
                                <th className="p-6 font-semibold">Scheduled For</th>
                                <th className="p-6 font-semibold">Status</th>
                                <th className="p-6 font-semibold">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {posts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <LayoutGrid className="w-8 h-8 mb-3 opacity-50" />
                                            <span className="text-sm font-medium">No posts in the queue.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : posts.map((post, index) => {
                                let platformsArr = [];
                                try { platformsArr = JSON.parse(post.platforms); } catch(e) {}

                                return (
                                    <tr key={post.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="p-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 shrink-0 group-hover:scale-105 transition-transform duration-300">
                                                    <Video className="w-5 h-5 text-gray-300" />
                                                </div>
                                                <div className="max-w-[250px] truncate font-bold text-white text-sm">
                                                    {post.title || 'Untitled Clip'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex flex-wrap gap-2">
                                                {platformsArr.map((p: string) => (
                                                    <span key={p} className="px-2.5 py-1 bg-white/10 text-gray-200 text-[10px] rounded-lg uppercase font-bold tracking-wider border border-white/5 shadow-sm">
                                                        {p}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-6 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-gray-400 font-medium text-sm">
                                                <Clock className="w-4 h-4 text-gray-500" />
                                                {new Date(post.scheduled_time + 'Z').toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider flex items-center gap-1.5 w-max ${getStatusColor(post.status)} shadow-sm`}>
                                                {post.status === 'pending' && <Calendar className="w-3.5 h-3.5" />}
                                                {post.status === 'uploaded' && <CheckCircle className="w-3.5 h-3.5" />}
                                                {post.status === 'failed' && <AlertTriangle className="w-3.5 h-3.5" />}
                                                {post.status}
                                            </span>
                                        </td>
                                        <td className="p-6">
                                            {post.status === 'pending' && post.retry_count > 0 && (
                                                <div className="text-yellow-400 text-xs font-semibold whitespace-nowrap flex items-center gap-1">
                                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                                    Retrying ({post.retry_count}/3)
                                                </div>
                                            )}
                                            {post.status === 'failed' && (
                                                <div className="text-red-400/90 text-xs font-medium max-w-[250px] break-words leading-relaxed border-l-2 border-red-500/30 pl-3 py-1">
                                                    {post.error_message || 'Upload error'}
                                                </div>
                                            )}
                                            {post.status === 'uploaded' && (
                                                <div className="text-gray-500 text-xs font-medium">
                                                    Published successfully
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile View (Cards) */}
            <div className="md:hidden flex flex-col gap-4 animate-slide-up">
                {posts.length === 0 ? (
                    <div className="glass-panel p-10 rounded-2xl flex flex-col items-center justify-center text-gray-500 border border-white/5">
                        <LayoutGrid className="w-8 h-8 mb-3 opacity-50" />
                        <span className="text-sm font-medium">No posts in the queue.</span>
                    </div>
                ) : posts.map((post) => {
                    let platformsArr = [];
                    try { platformsArr = JSON.parse(post.platforms); } catch(e) {}

                    return (
                        <div key={post.id} className="glass-panel rounded-2xl p-5 border border-white/5 hover:border-white/20 transition-all flex flex-col gap-4 shadow-lg">
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 shrink-0">
                                        <Video className="w-4 h-4 text-gray-300" />
                                    </div>
                                    <div className="truncate font-bold text-white text-sm max-w-[150px]">
                                        {post.title || 'Untitled Clip'}
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded-md text-[9px] font-bold border uppercase tracking-wider flex items-center gap-1 shrink-0 ${getStatusColor(post.status)}`}>
                                    {post.status === 'pending' && <Calendar className="w-3 h-3" />}
                                    {post.status === 'uploaded' && <CheckCircle className="w-3 h-3" />}
                                    {post.status === 'failed' && <AlertTriangle className="w-3 h-3" />}
                                    {post.status}
                                </span>
                            </div>

                            <div className="h-[1px] w-full bg-white/5 my-1"></div>

                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Platforms</span>
                                    <div className="flex flex-wrap gap-1.5 justify-end">
                                        {platformsArr.map((p: string) => (
                                            <span key={p} className="px-2 py-0.5 bg-white/10 text-gray-200 text-[9px] rounded uppercase font-bold tracking-wider">
                                                {p}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Scheduled</span>
                                    <div className="flex items-center gap-1.5 text-gray-300 font-medium text-xs">
                                        <Clock className="w-3.5 h-3.5 text-gray-500" />
                                        {new Date(post.scheduled_time + 'Z').toLocaleString()}
                                    </div>
                                </div>

                                {(post.status === 'failed' || (post.status === 'pending' && post.retry_count > 0)) && (
                                    <div className="mt-2 p-3 rounded-xl bg-black/40 border border-white/5">
                                        {post.status === 'pending' && post.retry_count > 0 && (
                                            <div className="text-yellow-400 text-xs font-semibold flex items-center gap-2">
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                Retrying ({post.retry_count}/3)
                                            </div>
                                        )}
                                        {post.status === 'failed' && (
                                            <div className="text-red-400/90 text-xs font-medium break-words leading-relaxed">
                                                {post.error_message || 'Upload error'}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Queue;
