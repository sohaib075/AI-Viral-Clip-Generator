import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { GITHUB_URL, MAIN_NAV } from '../nav';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      <header className="w-full relative z-40 px-5 py-4 md:px-8 flex justify-between items-center border-b border-[var(--color-border)] bg-[var(--color-canvas)]/90 backdrop-blur-sm">
        <Link to="/" className="flex items-center gap-2.5 md:hidden">
          <img src="/logo.png" alt="" className="w-7 h-7 rounded-md" />
          <span className="font-display text-lg font-bold tracking-tight text-[var(--color-ink)]">ClipGenius</span>
        </Link>

        <div className="hidden md:flex items-center gap-1 ml-auto">
          <Link to="/how-it-works" className="btn-ghost">How it works</Link>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost">GitHub</a>
        </div>

        <button
          type="button"
          className="md:hidden p-2 rounded-lg text-[var(--color-ink)] hover:bg-white/5"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
        </button>
      </header>

      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="absolute top-[65px] left-0 w-full bg-[var(--color-surface)] border-b border-[var(--color-border)] z-30 md:hidden flex flex-col p-3 animate-fade-in"
        >
          {MAIN_NAV.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium mb-0.5 ${
                  isActive
                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                    : 'text-[var(--color-muted)]'
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            );
          })}
          <div className="h-px bg-[var(--color-border)] my-2" />
          <Link to="/how-it-works" className="px-4 py-3 text-[var(--color-muted)] font-medium">How it works</Link>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="px-4 py-3 text-[var(--color-muted)] font-medium">GitHub</a>
        </div>
      )}
    </>
  );
};

export default Navbar;
