import { useEffect, useState } from 'react';
import { Play, Menu, X, LayoutDashboard, Folder, BarChart, Settings, Zap, BookOpen, Share2, ListVideo } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const GITHUB_URL = 'https://github.com/sohaib075/AI-Viral-Clip-Generator';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close the mobile menu after navigating (including back/forward)
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-5 h-5" aria-hidden="true" /> },
    { name: 'Auto Video Editor', path: '/auto-edit', icon: <Zap className="w-5 h-5" aria-hidden="true" /> },
    { name: 'Story to Video', path: '/story-to-video', icon: <BookOpen className="w-5 h-5" aria-hidden="true" /> },
    { name: 'My Projects', path: '/projects', icon: <Folder className="w-5 h-5" aria-hidden="true" /> },
    { name: 'Social Accounts', path: '/accounts', icon: <Share2 className="w-5 h-5" aria-hidden="true" /> },
    { name: 'Publishing Queue', path: '/queue', icon: <ListVideo className="w-5 h-5" aria-hidden="true" /> },
    { name: 'Analytics', path: '/analytics', icon: <BarChart className="w-5 h-5" aria-hidden="true" /> },
    { name: 'Settings', path: '/settings', icon: <Settings className="w-5 h-5" aria-hidden="true" /> },
  ];

  return (
    <>
      <nav className="w-full relative z-40 px-6 py-4 md:px-8 md:py-6 flex justify-between items-center border-b border-white/5 bg-black/50 backdrop-blur-md">
        <Link to="/" className="flex items-center gap-3 cursor-pointer md:hidden">
          <div className="bg-white/10 p-[1px] rounded-lg">
            <div className="bg-black p-1.5 rounded-md">
              <Play className="w-4 h-4 text-white" fill="currentColor" aria-hidden="true" />
            </div>
          </div>
          <span className="text-xl font-bold tracking-tight text-white">ClipGenius</span>
        </Link>

        {/* Empty div to keep right-side aligned when logo is hidden on desktop (since it's in sidebar) */}
        <div className="hidden md:block"></div>

        <div className="hidden md:flex gap-6 items-center">
          <Link to="/how-it-works" className="text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200">How It Works</Link>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200">GitHub</a>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          type="button"
          className="md:hidden text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
        </button>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div id="mobile-menu" className="absolute top-[72px] left-0 w-full bg-black/95 backdrop-blur-3xl border-b border-white/10 z-30 md:hidden flex flex-col p-4 animate-fade-in-up">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-4 py-4 rounded-xl transition-all duration-300 font-semibold mb-2 ${
                  isActive
                    ? 'bg-white/10 text-white border border-white/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.icon}
                <span className="text-base">{item.name}</span>
              </Link>
            );
          })}
          <div className="h-[1px] bg-white/10 my-2"></div>
          <Link to="/how-it-works" className="px-4 py-3 text-gray-300 font-medium">How It Works</Link>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="px-4 py-3 text-gray-300 font-medium">GitHub</a>
        </div>
      )}
    </>
  );
};

export default Navbar;
