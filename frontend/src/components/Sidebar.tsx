import { Home, Folder, BarChart, Settings, Zap, Key, LayoutDashboard } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'My Projects', path: '#', icon: <Folder className="w-5 h-5" /> },
    { name: 'Analytics', path: '#', icon: <BarChart className="w-5 h-5" /> },
    { name: 'API Keys', path: '#', icon: <Key className="w-5 h-5" /> },
    { name: 'Settings', path: '#', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 border-r border-white/5 bg-[#050505]/80 backdrop-blur-3xl hidden md:flex flex-col z-50">
      <div className="p-6 flex items-center gap-3 border-b border-white/5">
        <div className="bg-gradient-to-tr from-purple-500 to-[#66fcf1] p-[2px] rounded-xl shadow-[0_0_15px_rgba(102,252,241,0.3)]">
          <div className="bg-black p-2 rounded-lg">
            <Zap className="w-5 h-5 text-white" fill="currentColor" />
          </div>
        </div>
        <span className="text-xl font-black tracking-tight text-white">ClipGenius AI</span>
      </div>

      <div className="flex-1 py-8 px-4 flex flex-col gap-2">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-2">Main Menu</div>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 font-semibold ${
                isActive 
                  ? 'bg-purple-500/10 text-[#66fcf1] border border-purple-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.icon}
              {item.name}
              {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#66fcf1] shadow-[0_0_8px_#66fcf1]"></div>}
            </Link>
          );
        })}
      </div>

      <div className="p-6 border-t border-white/5">
        <div className="glass-panel p-4 rounded-2xl flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/20 blur-xl"></div>
          <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Plan</span>
          <span className="text-white font-bold">Enterprise AI</span>
          <div className="w-full h-1.5 bg-black rounded-full mt-2 overflow-hidden">
            <div className="w-[85%] h-full bg-gradient-to-r from-purple-500 to-[#66fcf1]"></div>
          </div>
          <span className="text-xs text-gray-400 mt-1">85% of GPU limits used</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
