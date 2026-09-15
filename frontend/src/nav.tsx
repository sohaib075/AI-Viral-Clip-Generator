import type { ReactNode } from 'react';
import { LayoutDashboard, Folder, BarChart, Settings, Zap, BookOpen, Share2, ListVideo } from 'lucide-react';

export const GITHUB_URL = 'https://github.com/sohaib075/AI-Viral-Clip-Generator';

export type NavItem = {
  name: string;
  path: string;
  icon: ReactNode;
};

export const MAIN_NAV: NavItem[] = [
  { name: 'Dashboard', path: '/', icon: <LayoutDashboard className="w-[18px] h-[18px]" aria-hidden="true" /> },
  { name: 'Auto Editor', path: '/auto-edit', icon: <Zap className="w-[18px] h-[18px]" aria-hidden="true" /> },
  { name: 'Story to Video', path: '/story-to-video', icon: <BookOpen className="w-[18px] h-[18px]" aria-hidden="true" /> },
  { name: 'Projects', path: '/projects', icon: <Folder className="w-[18px] h-[18px]" aria-hidden="true" /> },
  { name: 'Accounts', path: '/accounts', icon: <Share2 className="w-[18px] h-[18px]" aria-hidden="true" /> },
  { name: 'Queue', path: '/queue', icon: <ListVideo className="w-[18px] h-[18px]" aria-hidden="true" /> },
  { name: 'Analytics', path: '/analytics', icon: <BarChart className="w-[18px] h-[18px]" aria-hidden="true" /> },
  { name: 'Settings', path: '/settings', icon: <Settings className="w-[18px] h-[18px]" aria-hidden="true" /> },
];
