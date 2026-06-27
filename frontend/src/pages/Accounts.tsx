import React, { useEffect, useState } from 'react';
import { Video, Camera, Smartphone, Users, Briefcase, MessageCircle, CheckCircle, XCircle } from 'lucide-react';
import { API_URL } from '../config';

interface Account {
    id: string;
    platform: string;
    account_name: string;
    status: string;
}

const Accounts = () => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);

    const platforms = [
        { id: 'youtube', name: 'YouTube Shorts', icon: <Video className="w-6 h-6 text-red-500" /> },
        { id: 'instagram', name: 'Instagram Reels', icon: <Camera className="w-6 h-6 text-pink-500" /> },
        { id: 'tiktok', name: 'TikTok', icon: <Smartphone className="w-6 h-6 text-[#25F4EE]" /> },
        { id: 'facebook', name: 'Facebook Reels', icon: <Users className="w-6 h-6 text-blue-500" /> },
        { id: 'linkedin', name: 'LinkedIn', icon: <Briefcase className="w-6 h-6 text-blue-700" /> },
        { id: 'x', name: 'X (Twitter)', icon: <MessageCircle className="w-6 h-6 text-white" /> },
    ];

    const fetchAccounts = async () => {
        try {
            const res = await fetch(`${API_URL}/api/accounts`);
            const data = await res.json();
            setAccounts(data);
        } catch (e) {
            console.error("Failed to fetch accounts", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const connectAccount = (platformId: string) => {
        // Redirect the user to the real OAuth provider
        window.location.href = `${API_URL}/auth/${platformId}`;
    };

    const disconnectAccount = async (id: string) => {
        try {
            await fetch(`${API_URL}/api/accounts/${id}`, { method: 'DELETE' });
            fetchAccounts();
        } catch (e) {
            console.error("Failed to disconnect", e);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto pt-24 md:pt-8">
            <h1 className="text-4xl font-bold text-white mb-2">Social Accounts</h1>
            <p className="text-gray-400 mb-8 text-lg font-medium">Connect your social media accounts for fully automated publishing.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {platforms.map(platform => {
                    const connectedAccs = accounts.filter(a => a.platform === platform.id);
                    const isConnected = connectedAccs.length > 0;

                    return (
                        <div key={platform.id} className="glass-panel p-6 rounded-3xl relative overflow-hidden group hover:border-white/50 transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-3 bg-white/5 rounded-2xl">{platform.icon}</div>
                                {isConnected ? (
                                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> Connected
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 bg-white/5 text-gray-400 rounded-full text-xs font-bold flex items-center gap-1">
                                        <XCircle className="w-3 h-3" /> Not Connected
                                    </span>
                                )}
                            </div>
                            <h3 className="text-xl font-bold text-white mb-1">{platform.name}</h3>
                            
                            <div className="mt-6 space-y-3">
                                {connectedAccs.map(acc => (
                                    <div key={acc.id} className="flex items-center justify-between bg-black/50 p-3 rounded-xl border border-white/5">
                                        <span className="text-sm text-gray-300 font-medium truncate">{acc.account_name}</span>
                                        <button 
                                            onClick={() => disconnectAccount(acc.id)}
                                            className="text-xs text-red-400 hover:text-red-300 font-bold"
                                        >
                                            Disconnect
                                        </button>
                                    </div>
                                ))}

                                <button 
                                    onClick={() => connectAccount(platform.id)}
                                    className="w-full py-3 bg-white/5 hover:bg-white/10 text-white hover:text-white font-bold rounded-xl transition-all border border-white/5 hover:border-white/30"
                                >
                                    + Connect Account
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
