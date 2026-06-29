import React, { useEffect, useState } from 'react';
import { Calendar, Clock, RefreshCw, AlertTriangle, CheckCircle, Video } from 'lucide-react';
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
            case 'pending': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
            case 'uploaded': return 'text-green-400 bg-green-400/10 border-green-400/20';
            case 'failed': return 'text-red-400 bg-red-400/10 border-red-400/20';
            default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto pt-24 md:pt-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-4xl font-black text-white mb-2">Publishing Queue</h1>
                    <p className="text-gray-400 text-lg font-medium">Monitor and manage your automated scheduled uploads.</p>
                </div>
                <button
                    type="button"
                    onClick={fetchPosts}
                    disabled={refreshing}
                    aria-label="Refresh publishing queue"
                    className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <RefreshCw className={`w-5 h-5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="glass-panel rounded-3xl overflow-hidden border border-white/10">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-black/50 border-b border-white/5 text-sm uppercase tracking-wider text-gray-500 font-bold">
                            <th className="p-5">Video</th>
                            <th className="p-5">Platforms</th>
                            <th className="p-5">Scheduled For</th>
                            <th className="p-5">Status</th>
                            <th className="p-5">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {posts.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-500 font-medium">No posts in the queue.</td>
                            </tr>
                        ) : posts.map(post => {
                            let platformsArr = [];
                            try { platformsArr = JSON.parse(post.platforms); } catch(e) {}

                            return (
                                <tr key={post.id} className="hover:bg-white/5 transition-all">
                                    <td className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                                                <Video className="w-5 h-5 text-gray-300" />
                                            </div>
                                            <div className="max-w-[200px] truncate font-bold text-white">
                                                {post.title || 'Untitled Clip'}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex flex-wrap gap-1">
                                            {platformsArr.map((p: string) => (
                                                <span key={p} className="px-2 py-1 bg-white/10 text-gray-300 text-xs rounded-md uppercase font-bold tracking-wider">
                                                    {p}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex items-center gap-2 text-gray-400 font-medium text-sm">
                                            <Clock className="w-4 h-4" />
                                            {new Date(post.scheduled_time + 'Z').toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider flex items-center gap-1 w-max ${getStatusColor(post.status)}`}>
                                            {post.status === 'pending' && <Calendar className="w-3 h-3" />}
                                            {post.status === 'uploaded' && <CheckCircle className="w-3 h-3" />}
                                            {post.status === 'failed' && <AlertTriangle className="w-3 h-3" />}
                                            {post.status}
                                        </span>
                                    </td>
                                    <td className="p-5">
                                        {post.status === 'pending' && post.retry_count > 0 && (
                                            <span className="text-yellow-400 text-sm font-medium">Retrying ({post.retry_count}/3)</span>
                                        )}
                                        {post.status === 'failed' && (
                                            <span className="text-red-400 text-sm font-medium">{post.error_message || 'Upload error'}</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Queue;
