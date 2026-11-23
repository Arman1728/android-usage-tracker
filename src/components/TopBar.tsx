import React from 'react';
import { KeyRound, LogOut, Menu, User } from 'lucide-react';
import { AuthUser, SectionId } from '../types/survey';

interface TopBarProps {
  activeSection: SectionId;
  onOpenMobileMenu: () => void;
  onNavigate: (section: SectionId) => void;
  authUser: AuthUser;
  onOpenChangePassword: () => void;
  onLogout: () => void;
}

const SECTION_TITLES: Record<SectionId, string> = {
  home: 'Home Overview',
  about: 'About the Project',
  categories: 'User Categories',
  activity: 'My Activity · Six-Week CSP',
  survey: 'Survey Questionnaire',
  analytics: 'Analytics Dashboard',
  table: 'Collected Data Table',
  findings: 'Findings & Observations',
  recommendations: 'Recommendations',
  conclusion: 'Conclusion',
  assistant: 'AI Research Bot',
  admin: 'Admin Management',
};

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onOpenMobileMenu,
  onNavigate,
  authUser,
  onOpenChangePassword,
  onLogout,
}) => {
  return (
    <header className="theme-surface sticky top-0 z-30 flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="theme-surface rounded-md border p-2 hover:opacity-80 lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="theme-muted min-w-0 truncate text-sm whitespace-nowrap">
          <span className="theme-heading hidden font-medium xl:inline">B.Tech CSP</span>
          <span className="mx-2 hidden opacity-40 xl:inline" aria-hidden="true">/</span>
          <span className="theme-heading font-medium">{SECTION_TITLES[activeSection]}</span>
        </div>
      </div>

      <nav className="theme-muted hidden items-center gap-3.5 text-sm font-medium md:flex xl:gap-5">
        <button
          type="button"
          onClick={() => onNavigate('activity')}
          className="whitespace-nowrap shrink-0 hover:underline underline-offset-4"
        >
          My Activity
        </button>
        <button
          type="button"
          onClick={() => onNavigate('analytics')}
          className="whitespace-nowrap shrink-0 hover:underline underline-offset-4"
        >
          Analytics
        </button>
        <button
          type="button"
          onClick={() => onNavigate('table')}
          className="whitespace-nowrap shrink-0 hover:underline underline-offset-4"
        >
          Data Table
        </button>
        <button
          type="button"
          onClick={() => onNavigate('findings')}
          className="whitespace-nowrap shrink-0 hover:underline underline-offset-4"
        >
          Findings
        </button>
        <button
          type="button"
          onClick={() => onNavigate('assistant')}
          className="whitespace-nowrap shrink-0 hover:underline underline-offset-4"
        >
          AI Bot
        </button>
        <button
          type="button"
          onClick={() => onNavigate('admin')}
          className="whitespace-nowrap shrink-0 hover:underline underline-offset-4"
        >
          Admin
        </button>
      </nav>

      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={() => onNavigate('survey')}
          className="theme-btn-primary rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          Take Survey
        </button>

        <div className="theme-surface-muted hidden items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs sm:inline-flex">
          <User className="theme-accent-text h-3.5 w-3.5 shrink-0" />
          <span className="theme-heading max-w-[140px] truncate font-medium">
            {authUser.username}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenChangePassword}
          aria-label="Change Password"
          title="Change Password"
          className="theme-surface inline-flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-semibold hover:opacity-85 whitespace-nowrap shrink-0"
        >
          <KeyRound className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden xl:inline">Change Password</span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          aria-label="Logout"
          className="theme-surface inline-flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-semibold hover:opacity-85 whitespace-nowrap shrink-0"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};
