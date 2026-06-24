import React from 'react';
import { Play, Menu, X, LayoutDashboard, Folder, BarChart, Key, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'My Projects', path: '/projects', icon: <Folder className="w-5 h-5" /> },
    { name: 'Analytics', path: '/analytics', icon: <BarChart className="w-5 h-5" /> },
    { name: 'Settings', path: '/settings', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <>
      <nav className="w-full relative z-40 px-6 py-4 md:px-8 md:py-6 flex justify-between items-center border-b border-white/20 glass-panel">
        <Link to="/" className="flex items-center gap-3 cursor-pointer">
          <div className="bg-white p-[2px] rounded-xl shadow-[0_0_15px_rgba(255,255,255,0.5)]">
            <div className="bg-black p-2 rounded-lg">
              <Play className="w-4 h-4 md:w-5 md:h-5 text-white" fill="currentColor" />
            </div>
          </div>
          <span className="text-xl md:text-2xl font-black tracking-tight text-white drop-shadow-md">ClipGenius AI</span>
        </Link>
        <div className="hidden md:flex gap-6">
          <Link to="/how-it-works" className="text-sm font-bold text-white/90 hover:text-white transition-colors duration-200">How it works</Link>
          <a href="#" className="text-sm font-bold text-white/90 hover:text-white transition-colors duration-200">GitHub</a>
        </div>
        
        {/* Mobile Menu Toggle */}
        <button 
          className="md:hidden text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="absolute top-[72px] left-0 w-full bg-[#050505]/95 backdrop-blur-3xl border-b border-white/10 z-30 md:hidden flex flex-col p-4 animate-fade-in-up">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.name}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-4 rounded-xl transition-all duration-300 font-semibold mb-2 ${
                  isActive 
                    ? 'bg-purple-500/10 text-[#66fcf1] border border-purple-500/20' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.icon}
                <span className="text-lg">{item.name}</span>
              </Link>
            );
          })}
          <div className="h-[1px] bg-white/10 my-2"></div>
          <Link to="/how-it-works" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-white font-bold">How it works</Link>
          <a href="#" className="px-4 py-3 text-white font-bold">GitHub</a>
        </div>
      )}
    </>
  );
};

export default Navbar;
