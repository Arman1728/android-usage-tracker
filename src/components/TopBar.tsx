import React, { useState } from 'react';
import { CheckCircle2, Lock, Menu, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  SectionId,
  SecurityChallengeMode,
  SecurityProtectionItem,
} from '../types/survey';

interface TopBarProps {
  activeSection: SectionId;
  onOpenMobileMenu: () => void;
  onNavigate: (section: SectionId) => void;
  securityVerified: boolean;
  securityExpiresAt: number | null;
  securityMode: SecurityChallengeMode | null;
  protections: SecurityProtectionItem[];
  onLockAndReverify: () => void;
}

const SECTION_TITLES: Record<SectionId, string> = {
  home: 'Home Overview',
  about: 'About the Project',
  categories: 'User Categories',
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
  securityVerified,
  securityExpiresAt,
  securityMode,
  protections,
  onLockAndReverify,
}) => {
  const [statusOpen, setStatusOpen] = useState(false);

  const expiryText = securityExpiresAt
    ? new Date(securityExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

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
        <div className="theme-muted min-w-0 truncate text-sm">
          <span className="theme-heading hidden font-medium sm:inline">B.Tech CSP</span>
          <span className="mx-2 hidden opacity-40 sm:inline" aria-hidden="true">/</span>
          <span className="theme-heading truncate font-medium">{SECTION_TITLES[activeSection]}</span>
        </div>
      </div>

      <nav className="theme-muted hidden items-center gap-6 text-sm font-medium md:flex">
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

      <div className="relative flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={() => setStatusOpen((prev) => !prev)}
          aria-expanded={statusOpen}
          aria-label="Website security verification status"
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
            securityVerified
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200'
              : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200'
          }`}
        >
          {securityVerified ? (
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="hidden sm:inline">
            {securityVerified ? 'Security Verified' : 'Verify Session'}
          </span>
        </button>

        {statusOpen && (
          <div
            role="dialog"
            aria-label="Security verification details"
            className="theme-surface absolute right-0 top-12 z-40 w-80 rounded-lg border p-4 shadow-lg"
          >
            <div className="flex items-start justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
              <div>
                <p className="theme-heading text-xs font-bold">
                  {securityVerified ? 'Human Session Verified' : 'Verification Pending'}
                </p>
                <p className="theme-muted mt-0.5 text-[11px]">
                  {securityVerified
                    ? `Method: ${securityMode === 'math' ? 'Math Check' : 'Visual Code'} · Valid until ${expiryText}`
                    : 'Complete verification before submitting surveys or signing into Admin.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatusOpen(false)}
                className="theme-muted rounded px-1.5 py-0.5 text-xs hover:opacity-80"
              >
                Close
              </button>
            </div>

            <ul className="mt-3 space-y-2">
              {protections.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-[11px]">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="theme-heading font-medium">{item.label}</p>
                    <p className="theme-muted">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
              <button
                type="button"
                onClick={() => {
                  setStatusOpen(false);
                  onLockAndReverify();
                }}
                className="theme-surface inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold hover:opacity-90"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>{securityVerified ? 'Lock & Re-Verify Session' : 'Open Security Check'}</span>
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => onNavigate('survey')}
          className="theme-btn-primary rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          Take Survey
        </button>
      </div>
    </header>
  );
};
