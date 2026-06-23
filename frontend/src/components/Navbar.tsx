import React from 'react';
import { Play } from 'lucide-react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="w-full relative z-10 px-8 py-6 flex justify-between items-center border-b border-white/20 glass-panel">
      <Link to="/" className="flex items-center gap-3 cursor-pointer">
        <div className="bg-white p-[2px] rounded-xl shadow-[0_0_15px_rgba(255,255,255,0.5)]">
          <div className="bg-black p-2 rounded-lg">
            <Play className="w-5 h-5 text-white" fill="currentColor" />
          </div>
        </div>
        <span className="text-2xl font-black tracking-tight text-white drop-shadow-md">ClipGenius AI</span>
      </Link>
      <div className="flex gap-6">
        <Link to="/how-it-works" className="text-sm font-bold text-white/90 hover:text-white transition-colors duration-200">How it works</Link>
        <a href="#" className="text-sm font-bold text-white/90 hover:text-white transition-colors duration-200">GitHub</a>
      </div>
    </nav>
  );
};

export default Navbar;
