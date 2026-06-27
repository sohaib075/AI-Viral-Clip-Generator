import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, CreditCard, Bell, Shield } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Settings = () => {
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/user/settings`)
      .then(res => res.json())
      .then(data => setUserProfile(data))
      .catch(err => console.error('Failed to fetch user settings:', err));
  }, []);

  if (!userProfile) {
    return (
      <div className="flex justify-center items-center h-screen w-full">
        <div className="w-12 h-12 border-4 border-white/20 border-t-[#66fcf1] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col p-8 animate-fade-in-up">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-gray-400" />
          Settings
        </h1>
        <p className="text-gray-400 font-medium">Manage your account preferences and billing.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Settings Sidebar */}
        <div className="w-full md:w-64 flex flex-col gap-2">
          {[
            { name: 'Profile', icon: <User className="w-5 h-5" />, active: true },
            { name: 'Billing & Plans', icon: <CreditCard className="w-5 h-5" />, active: false },
            { name: 'Notifications', icon: <Bell className="w-5 h-5" />, active: false },
            { name: 'Security', icon: <Shield className="w-5 h-5" />, active: false },
          ].map(item => (
            <button 
              key={item.name}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
                item.active 
                  ? 'bg-white/10 text-white' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {item.icon}
              {item.name}
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div className="flex-1 glass-panel p-8 rounded-3xl">
          <h2 className="text-xl font-bold text-white mb-6 border-b border-white/10 pb-4">Profile Information</h2>
          
          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-white/10 to-[#66fcf1] p-1">
              <img 
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=800&auto=format&fit=crop&q=80" 
                alt="Avatar" 
                className="w-full h-full rounded-full border-4 border-black object-cover"
              />
            </div>
            <div>
              <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg transition-colors mb-2 text-sm">
                Change Avatar
              </button>
              <p className="text-xs text-gray-500">JPG, GIF or PNG. 1MB max.</p>
            </div>
          </div>

          <form className="space-y-6 max-w-xl">
            <div className="flex gap-6">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-bold text-gray-400">First Name</label>
                <input type="text" defaultValue={userProfile.firstName} className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-white text-white" />
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-sm font-bold text-gray-400">Last Name</label>
                <input type="text" defaultValue={userProfile.lastName} className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-white text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-400">Email Address</label>
              <input type="email" defaultValue={userProfile.email} className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-white text-white" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-400">Company</label>
              <input type="text" defaultValue={userProfile.company} className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-white text-white" />
            </div>

            <div className="pt-6 border-t border-white/10 flex justify-end gap-4">
              <button type="button" className="px-6 py-3 font-bold text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button type="button" className="px-6 py-3 bg-white hover:bg-[#52c9c1] text-black font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(102,252,241,0.3)]">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
