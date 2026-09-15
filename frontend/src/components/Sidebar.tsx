import { Link, useLocation } from 'react-router-dom';
import { MAIN_NAV } from '../nav';

const Sidebar = () => {
  const location = useLocation();

  return (
    <aside className="w-60 h-screen fixed left-0 top-0 border-r border-[var(--color-border)] bg-[var(--color-canvas)] hidden md:flex flex-col z-50">
      <Link to="/" className="px-6 py-7 flex items-center gap-3 group">
        <img src="/logo.png" alt="" className="w-8 h-8 rounded-md" />
        <span className="font-display text-lg font-bold tracking-tight text-[var(--color-ink)] group-hover:text-white transition-colors">
          ClipGenius
        </span>
      </Link>

      <nav className="flex-1 px-3 pb-6 flex flex-col gap-0.5 overflow-y-auto" aria-label="Main">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-faint)]">
          Workspace
        </p>
        {MAIN_NAV.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-white/[0.03]'
              }`}
            >
              {item.icon}
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-5 border-t border-[var(--color-border)]">
        <p className="text-[11px] text-[var(--color-faint)] leading-relaxed">
          Turn long videos into short, captioned clips ready to publish.
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
