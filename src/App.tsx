import { useCallback, useEffect, useMemo, useState } from 'react';
import { AboutView } from './components/AboutView';
import { AdminView } from './components/AdminView';
import { AiBotView } from './components/AiBotView';
import { AnalyticsView } from './components/AnalyticsView';
import { CategoriesView } from './components/CategoriesView';
import { ConclusionView } from './components/ConclusionView';
import { DataTableView } from './components/DataTableView';
import { FindingsView } from './components/FindingsView';
import { HomeView } from './components/HomeView';
import { RecommendationsView } from './components/RecommendationsView';
import { SecurityGate } from './components/SecurityGate';
import { Sidebar } from './components/Sidebar';
import { SurveyFormView } from './components/SurveyFormView';
import { TopBar } from './components/TopBar';
import {
  DatasetCounts,
  DatasetScope,
  ProjectSettings,
  SectionId,
  SecurityChallengeMode,
  SecurityProtectionItem,
  SecurityStatusResponse,
  SurveyResponse,
  TEAM_MEMBERS,
  THEME_OPTIONS,
  ThemeId,
} from './types/survey';
import { computeAnalytics, generateFindings } from './utils/surveyLogic';

const VALID_SECTIONS: SectionId[] = [
  'home',
  'about',
  'categories',
  'survey',
  'analytics',
  'table',
  'findings',
  'recommendations',
  'conclusion',
  'assistant',
  'admin',
];

const DEFAULT_SETTINGS: ProjectSettings = {
  collegeName: 'Sree Venkateswara College of Engineering',
  department: 'Department of Computer Science & Engineering (B.Tech CSE)',
  academicBatch: '2024–2028 · Community Service Project (CSP)',
  requireSiteGate: true,
};

function getInitialSection(): SectionId {
  const hash = window.location.hash.replace('#', '') as SectionId;
  return VALID_SECTIONS.includes(hash) ? hash : 'home';
}

function getInitialTheme(): ThemeId {
  const saved = localStorage.getItem('csp_theme') as ThemeId | null;
  if (saved && THEME_OPTIONS.some((t) => t.id === saved)) {
    return saved;
  }
  return 'classic';
}

export default function App() {
  const [activeSection, setActiveSection] = useState<SectionId>(getInitialSection);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(getInitialTheme);

  // Security verification & admin session tokens kept strictly in React memory
  const [securityChecking, setSecurityChecking] = useState(true);
  const [requireSiteGate, setRequireSiteGate] = useState(true);
  const [securityToken, setSecurityToken] = useState<string | null>(null);
  const [securityExpiresAt, setSecurityExpiresAt] = useState<number | null>(null);
  const [securityMode, setSecurityMode] = useState<SecurityChallengeMode | null>(null);
  const [protections, setProtections] = useState<SecurityProtectionItem[]>([]);
  const [forceGateVisible, setForceGateVisible] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  const [allResponses, setAllResponses] = useState<SurveyResponse[]>([]);
  const [counts, setCounts] = useState<DatasetCounts>({
    total: 0,
    realCount: 0,
    sampleCount: 0,
  });
  const [settings, setSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS);
  const [scope, setScope] = useState<DatasetScope>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('csp_theme', theme);
  }, [theme]);

  useEffect(() => {
    let active = true;
    const initSecurity = async () => {
      try {
        const [statusRes, settingsRes] = await Promise.all([
          fetch('/api/security/status'),
          fetch('/api/settings'),
        ]);
        if (!active) return;

        if (statusRes.ok) {
          const status = (await statusRes.json()) as SecurityStatusResponse;
          setRequireSiteGate(status.requireSiteGate);
          setProtections(status.protections || []);
        }
        if (settingsRes.ok) {
          const settingsData = (await settingsRes.json()) as { settings?: ProjectSettings };
          if (settingsData.settings) {
            setSettings(settingsData.settings);
            setRequireSiteGate(settingsData.settings.requireSiteGate);
          }
        }
      } catch {
        // Default safely to gate required if status check fails temporarily
      } finally {
        if (active) setSecurityChecking(false);
      }
    };
    void initSecurity();
    return () => {
      active = false;
    };
  }, []);

  const fetchSurveyData = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch('/api/responses?scope=all');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setAllResponses(data.responses || []);
      setCounts(data.counts || { total: 0, realCount: 0, sampleCount: 0 });
      if (data.settings) {
        setSettings(data.settings);
        setRequireSiteGate(Boolean(data.settings.requireSiteGate));
      }
    } catch {
      setLoadError('Unable to load survey dataset from the backend server.');
    } finally {
      setLoading(false);
    }
  }, []);

  const gateBlocked = (requireSiteGate && !securityToken) || forceGateVisible;

  useEffect(() => {
    if (!securityChecking && !gateBlocked) {
      void fetchSurveyData();
    }
  }, [securityChecking, gateBlocked, fetchSurveyData]);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '') as SectionId;
      if (VALID_SECTIONS.includes(hash)) {
        setActiveSection(hash);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleSecurityVerified = useCallback(
    (result: {
      token: string;
      expiresAt: number;
      mode: SecurityChallengeMode;
      protections?: SecurityProtectionItem[];
    }) => {
      setSecurityToken(result.token);
      setSecurityExpiresAt(result.expiresAt);
      setSecurityMode(result.mode);
      if (result.protections) {
        setProtections(result.protections);
      }
      setForceGateVisible(false);
    },
    []
  );

  const handleSecurityInvalidated = useCallback(() => {
    setSecurityToken(null);
    setSecurityExpiresAt(null);
    setSecurityMode(null);
  }, []);

  const handleLockAndReverify = useCallback(async () => {
    if (securityToken) {
      await fetch('/api/security/revoke', {
        method: 'POST',
        headers: { 'x-security-token': securityToken },
      }).catch(() => {});
    }
    if (adminToken) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      }).catch(() => {});
    }
    setSecurityToken(null);
    setSecurityExpiresAt(null);
    setSecurityMode(null);
    setAdminToken(null);
    setForceGateVisible(true);
  }, [securityToken, adminToken]);

  const handleNavigate = (section: SectionId) => {
    setActiveSection(section);
    if (window.location.hash !== `#${section}`) {
      window.location.hash = section;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const scopedResponses = useMemo(() => {
    if (scope === 'real') return allResponses.filter((r) => !r.isSample);
    if (scope === 'sample') return allResponses.filter((r) => r.isSample);
    return allResponses;
  }, [allResponses, scope]);

  const realOnlyResponses = useMemo(
    () => allResponses.filter((r) => !r.isSample),
    [allResponses]
  );

  const realAnalytics = useMemo(
    () => computeAnalytics(realOnlyResponses),
    [realOnlyResponses]
  );

  const allAnalytics = useMemo(
    () => computeAnalytics(allResponses),
    [allResponses]
  );

  const scopedAnalytics = useMemo(
    () => computeAnalytics(scopedResponses),
    [scopedResponses]
  );

  const scopedFindings = useMemo(
    () => generateFindings(scopedResponses),
    [scopedResponses]
  );

  if (securityChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] px-4 text-[var(--text-body)]">
        <div className="theme-surface rounded-lg border px-6 py-4 text-sm font-medium">
          Initializing security verification...
        </div>
      </div>
    );
  }

  if (gateBlocked) {
    return (
      <SecurityGate
        variant="fullscreen"
        collegeName={settings.collegeName}
        protections={protections}
        onVerified={handleSecurityVerified}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-canvas)] text-[var(--text-body)]">
      <Sidebar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        counts={counts}
        theme={theme}
        onThemeChange={setTheme}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          activeSection={activeSection}
          onOpenMobileMenu={() => setMobileOpen(true)}
          onNavigate={handleNavigate}
          securityVerified={Boolean(securityToken)}
          securityExpiresAt={securityExpiresAt}
          securityMode={securityMode}
          protections={protections}
          onLockAndReverify={() => void handleLockAndReverify()}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {loadError && (
            <div
              role="alert"
              className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => void fetchSurveyData()}
                className="rounded border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              <div className="theme-surface h-36 animate-pulse rounded-lg border" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div className="theme-surface h-28 animate-pulse rounded-lg border" />
                <div className="theme-surface h-28 animate-pulse rounded-lg border" />
                <div className="theme-surface h-28 animate-pulse rounded-lg border" />
                <div className="theme-surface h-28 animate-pulse rounded-lg border" />
              </div>
            </div>
          ) : (
            <div key={activeSection} className="section-enter">
              {activeSection === 'home' && (
                <HomeView
                  counts={counts}
                  realAnalytics={realAnalytics}
                  allAnalytics={allAnalytics}
                  allResponses={allResponses}
                  settings={settings}
                  onNavigate={handleNavigate}
                />
              )}
              {activeSection === 'about' && (
                <AboutView settings={settings} onNavigate={handleNavigate} />
              )}
              {activeSection === 'categories' && (
                <CategoriesView
                  analytics={scopedAnalytics}
                  scope={scope}
                  onScopeChange={setScope}
                  onNavigate={handleNavigate}
                />
              )}
              {activeSection === 'survey' && (
                <SurveyFormView
                  onSubmitted={fetchSurveyData}
                  onNavigate={handleNavigate}
                  securityToken={securityToken}
                  onSecurityTokenIssued={handleSecurityVerified}
                  onSecurityInvalidated={handleSecurityInvalidated}
                />
              )}
              {activeSection === 'analytics' && (
                <AnalyticsView
                  analytics={scopedAnalytics}
                  counts={counts}
                  scope={scope}
                  onScopeChange={setScope}
                  onNavigate={handleNavigate}
                  theme={theme}
                />
              )}
              {activeSection === 'table' && (
                <DataTableView
                  responses={allResponses}
                  scope={scope}
                  onScopeChange={setScope}
                />
              )}
              {activeSection === 'findings' && (
                <FindingsView
                  findings={scopedFindings}
                  counts={counts}
                  scope={scope}
                  onScopeChange={setScope}
                  onNavigate={handleNavigate}
                />
              )}
              {activeSection === 'recommendations' && <RecommendationsView />}
              {activeSection === 'conclusion' && (
                <ConclusionView
                  findings={scopedFindings}
                  settings={settings}
                  onNavigate={handleNavigate}
                />
              )}
              {activeSection === 'assistant' && (
                <AiBotView
                  counts={counts}
                  scope={scope}
                  onScopeChange={setScope}
                  securityToken={securityToken}
                  onSecurityTokenIssued={handleSecurityVerified}
                  onSecurityInvalidated={handleSecurityInvalidated}
                />
              )}
              {activeSection === 'admin' && (
                <AdminView
                  responses={allResponses}
                  counts={counts}
                  settings={settings}
                  onRefresh={fetchSurveyData}
                  adminToken={adminToken}
                  onAdminTokenChange={setAdminToken}
                  securityToken={securityToken}
                  onSecurityTokenIssued={handleSecurityVerified}
                  onSecurityInvalidated={handleSecurityInvalidated}
                />
              )}
            </div>
          )}
        </main>

        <footer className="theme-surface theme-muted border-t px-6 py-4 text-xs">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <span>
              {settings.collegeName} · {settings.department}
            </span>
            <span>
              Team: {TEAM_MEMBERS.map((m) => `${m.name} - ${m.rollNumber}`).join(', ')}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
