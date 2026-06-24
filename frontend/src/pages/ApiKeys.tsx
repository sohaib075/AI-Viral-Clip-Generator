import React, { useState } from 'react';
import { Key, Copy, Plus, Trash2, Eye, EyeOff, AlertTriangle } from 'lucide-react';

const ApiKeys = () => {
  const [keys, setKeys] = useState([
    { id: '1', name: 'Production App', key: 'sk_live_...a8f2', created: 'Oct 12, 2023', lastUsed: '2 mins ago' },
    { id: '2', name: 'Development Testing', key: 'sk_test_...b9e4', created: 'Nov 05, 2023', lastUsed: '1 day ago' }
  ]);

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col p-8 animate-fade-in-up">
      {/* Header */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
            <Key className="w-8 h-8 text-yellow-400" />
            API Keys
          </h1>
          <p className="text-gray-400 font-medium">Manage your secret API keys for programmatic access.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-gray-200 font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]">
          <Plus className="w-5 h-5" /> Create New Secret Key
        </button>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex gap-4 items-start mb-8 text-yellow-200">
        <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-bold mb-1">Keep your keys secure</p>
          <p className="opacity-80">Do not share your API keys in publicly accessible areas such as GitHub, client-side code, and so forth. We automatically scan public repositories and will revoke exposed keys.</p>
        </div>
      </div>

      {/* Keys Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-black/40 text-xs uppercase font-bold text-gray-500 border-b border-white/10">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Secret Key</th>
              <th className="px-6 py-4">Created</th>
              <th className="px-6 py-4">Last Used</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {keys.map((k) => (
              <tr key={k.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4 font-bold text-white">{k.name}</td>
                <td className="px-6 py-4 font-mono">{k.key}</td>
                <td className="px-6 py-4">{k.created}</td>
                <td className="px-6 py-4">{k.lastUsed}</td>
                <td className="px-6 py-4 flex justify-end gap-3">
                  <button className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" title="Copy Key">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button className="p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-colors" title="Revoke Key">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ApiKeys;
