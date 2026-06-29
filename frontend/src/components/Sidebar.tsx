import { Home, Folder, BarChart, Settings, Zap, Key, LayoutDashboard, BookOpen } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
    { name: 'Story to Video', path: '/story-to-video', icon: <BookOpen className="w-[18px] h-[18px]" /> },
    { name: 'My Projects', path: '/projects', icon: <Folder className="w-[18px] h-[18px]" /> },
    { name: 'Social Accounts', path: '/accounts', icon: <Key className="w-[18px] h-[18px]" /> },
    { name: 'Publishing Queue', path: '/queue', icon: <BarChart className="w-[18px] h-[18px]" /> },
    { name: 'Analytics', path: '/analytics', icon: <BarChart className="w-[18px] h-[18px]" /> },
    { name: 'Settings', path: '/settings', icon: <Settings className="w-[18px] h-[18px]" /> },
  ];

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 border-r border-white/5 bg-black/90 backdrop-blur-3xl hidden md:flex flex-col z-50">
      <div className="p-8 flex items-center gap-3">
        <div className="bg-gradient-to-tr from-[#66fcf1]/20 to-white/5 p-[1px] rounded-xl shadow-[0_0_15px_rgba(102,252,241,0.2)]">
          <div className="bg-black p-1 rounded-[11px]">
            <img src="/logo.png" alt="Logo" className="w-7 h-7 rounded-lg" />
          </div>
        </div>
        <span className="text-xl font-bold tracking-tight text-white">ClipGenius</span>
      </div>

      <div className="flex-1 py-4 px-4 flex flex-col gap-1.5">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3 px-3">Menu</div>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 text-sm font-medium ${
                isActive 
                  ? 'bg-white/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.icon}
              {item.name}
            </Link>
          );
        })}
      </div>

    </aside>
  );
};

export default Sidebar;
