import React from 'react';
import {
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  Home,
  Palette,
  ShieldAlert,
  ShieldCheck,
  Table2,
  Users,
  X,
} from 'lucide-react';
import { DatasetCounts, SectionId, THEME_OPTIONS, ThemeId } from '../types/survey';

interface SidebarProps {
  activeSection: SectionId;
  onNavigate: (section: SectionId) => void;
  counts: DatasetCounts;
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'Overview' | 'Research & Data' | 'Synthesis & Admin';
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, group: 'Overview' },
  { id: 'about', label: 'About Project', icon: BookOpen, group: 'Overview' },
  { id: 'categories', label: 'User Categories', icon: Users, group: 'Overview' },
  { id: 'survey', label: 'Survey Form', icon: ClipboardList, group: 'Research & Data' },
  { id: 'analytics', label: 'Analytics Dashboard', icon: BarChart3, group: 'Research & Data' },
  { id: 'table', label: 'Data Table', icon: Table2, group: 'Research & Data' },
  { id: 'findings', label: 'Findings & Observations', icon: FileSearch, group: 'Synthesis & Admin' },
  { id: 'recommendations', label: 'Recommendations', icon: ShieldCheck, group: 'Synthesis & Admin' },
  { id: 'conclusion', label: 'Conclusion', icon: CheckCircle2, group: 'Synthesis & Admin' },
  { id: 'assistant', label: 'AI Research Bot', icon: Bot, group: 'Synthesis & Admin' },
  { id: 'admin', label: 'Admin Section', icon: ShieldAlert, group: 'Synthesis & Admin' },
];

const GROUPS: NavItem['group'][] = ['Overview', 'Research & Data', 'Synthesis & Admin'];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onNavigate,
  counts,
  theme,
  onThemeChange,
  mobileOpen,
  onCloseMobile,
}) => {
  const handleSelect = (id: SectionId) => {
    onNavigate(id);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="theme-sidebar flex h-full flex-col text-slate-100">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-sm font-semibold tracking-tight text-white">Android Usage CSP</p>
          <p className="text-xs text-slate-300">Vision 360° Research</p>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav aria-label="Primary research navigation" className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {GROUPS.map((group) => (
            <div key={group}>
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-wide text-slate-400">
                {group}
              </p>
              <ul className="space-y-1">
                {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors whitespace-nowrap ${
                          isActive
                            ? 'theme-accent-bg'
                            : 'text-slate-200 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
          <Palette className="h-3.5 w-3.5" />
          <span>Interface Theme</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5" role="group" aria-label="Theme selector">
          {THEME_OPTIONS.map((opt) => {
            const active = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onThemeChange(opt.id)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white text-slate-900'
                    : 'bg-white/10 text-slate-200 hover:bg-white/20'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm border border-white/30"
                  style={{ backgroundColor: opt.swatchAccent }}
                  aria-hidden="true"
                />
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-white/10 px-5 py-3 text-xs text-slate-300">
        <div className="flex items-center justify-between">
          <span>Real submissions</span>
          <span className="font-mono font-semibold text-white tabular-nums">{counts.realCount}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span>Sample demo rows</span>
          <span className="font-mono text-slate-300 tabular-nums">{counts.sampleCount}</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-[var(--border-subtle)] lg:block">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 w-64 max-w-[80vw]">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
