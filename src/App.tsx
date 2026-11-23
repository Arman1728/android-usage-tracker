import { useCallback, useEffect, useMemo, useState } from 'react';
import { AboutView } from './components/AboutView';
import { AdminView } from './components/AdminView';
import { AiBotView } from './components/AiBotView';
import { AnalyticsView } from './components/AnalyticsView';
import { CategoriesView } from './components/CategoriesView';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { ChatBoardWidget } from './components/ChatBoardWidget';
import { ConclusionView } from './components/ConclusionView';
import { DataTableView } from './components/DataTableView';
import { FindingsView } from './components/FindingsView';
import { HomeView } from './components/HomeView';
import { LoginView } from './components/LoginView';
import { MyActivityView } from './components/MyActivityView';
import { RecommendationsView } from './components/RecommendationsView';
import { Sidebar } from './components/Sidebar';
import { SurveyFormView } from './components/SurveyFormView';
import { TopBar } from './components/TopBar';
import {
  ActivityProgressSummary,
  AuthSessionStatus,
  AuthUser,
  DatasetCounts,
  DatasetScope,
  ProjectSettings,
  SectionId,
  SurveyResponse,
  TEAM_MEMBERS,
  THEME_OPTIONS,
  ThemeId,
  WeeklyActivity,
} from './types/survey';
import { computeActivityProgress, DEFAULT_SIX_WEEK_ACTIVITIES } from './utils/activityLogic';
import { AUTH_EXPIRED_EVENT, apiFetch } from './utils/apiClient';
import { computeAnalytics, generateFindings } from './utils/surveyLogic';

const VALID_SECTIONS: SectionId[] = [
  'home',
  'about',
  'categories',
  'activity',
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
  requireSiteGate: false,
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

  // Portal user authentication state (session backed by HTTP-only server cookie)
  const [authChecking, setAuthChecking] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authHasUsers, setAuthHasUsers] = useState(true);
  const [authIdleTimeoutMs, setAuthIdleTimeoutMs] = useState(30 * 60 * 1000);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const [allResponses, setAllResponses] = useState<SurveyResponse[]>([]);
  const [counts, setCounts] = useState<DatasetCounts>({
    total: 0,
    realCount: 0,
    sampleCount: 0,
  });
  const [settings, setSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS);
  const [weeklyActivities, setWeeklyActivities] = useState<WeeklyActivity[]>(
    DEFAULT_SIX_WEEK_ACTIVITIES
  );
  const [activitySummary, setActivitySummary] = useState<ActivityProgressSummary>(() =>
    computeActivityProgress(DEFAULT_SIX_WEEK_ACTIVITIES)
  );
  const [scope, setScope] = useState<DatasetScope>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('csp_theme', theme);
  }, [theme]);

  const clearClientSessionState = useCallback((notice: string | null = null) => {
    setAuthUser(null);
    setAdminToken(null);
    setChangePasswordOpen(false);
    setAllResponses([]);
    setCounts({ total: 0, realCount: 0, sampleCount: 0 });
    setLoading(true);
    setAuthNotice(notice);
    setActiveSection('home');
    if (window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  const handleLogout = useCallback(
    async (notice: string | null = null) => {
      if (adminToken) {
        await apiFetch('/api/admin/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
        }).catch(() => {});
      }
      await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      clearClientSessionState(notice);
    },
    [adminToken, clearClientSessionState]
  );

  // Verify HTTP-only cookie session on initial load
  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      try {
        const res = await apiFetch('/api/auth/session');
        if (!active) return;
        if (res.ok) {
          const data = (await res.json()) as AuthSessionStatus;
          setAuthHasUsers(Boolean(data.hasUsers));
          if (data.idleTimeoutMs) {
            setAuthIdleTimeoutMs(data.idleTimeoutMs);
          }
          if (data.authenticated && data.user) {
            setAuthUser(data.user);
          } else {
            setAuthUser(null);
          }
        }
      } catch {
        if (active) setAuthUser(null);
      } finally {
        if (active) setAuthChecking(false);
      }
    };
    void checkSession();
    return () => {
      active = false;
    };
  }, []);

  // Listen for global 401 AUTH_REQUIRED expirations
  useEffect(() => {
    const onExpired = () => {
      clearClientSessionState('Your session expired due to inactivity. Please log in again.');
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [clearClientSessionState]);

  // Automatic inactivity timeout & sliding activity ping while logged in
  useEffect(() => {
    if (!authUser) return;
    let lastActivityAt = Date.now();
    let lastPingAt = Date.now();

    const recordActivity = () => {
      const now = Date.now();
      lastActivityAt = now;
      if (now - lastPingAt >= 60_000) {
        lastPingAt = now;
        void apiFetch('/api/auth/ping', { method: 'POST' }).catch(() => {});
      }
    };

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll'];
    for (const evt of events) {
      window.addEventListener(evt, recordActivity, { passive: true });
    }

    const timer = window.setInterval(() => {
      if (Date.now() - lastActivityAt >= authIdleTimeoutMs) {
        void handleLogout('Your session expired due to inactivity. Please log in again.');
      }
    }, 15_000);

    return () => {
      for (const evt of events) {
        window.removeEventListener(evt, recordActivity);
      }
      window.clearInterval(timer);
    };
  }, [authUser, authIdleTimeoutMs, handleLogout]);

  const fetchSurveyData = useCallback(async () => {
    if (!authUser) return;
    try {
      setLoadError(null);
      const [res, activityRes] = await Promise.all([
        apiFetch('/api/responses?scope=all'),
        apiFetch('/api/activity'),
      ]);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setAllResponses(data.responses || []);
      setCounts(data.counts || { total: 0, realCount: 0, sampleCount: 0 });
      if (data.settings) {
        setSettings(data.settings);
      }
      if (activityRes.ok) {
        const actData = (await activityRes.json()) as {
          weeks?: WeeklyActivity[];
          summary?: ActivityProgressSummary;
        };
        if (Array.isArray(actData.weeks) && actData.weeks.length > 0) {
          setWeeklyActivities(actData.weeks);
          setActivitySummary(actData.summary || computeActivityProgress(actData.weeks));
        }
      }
    } catch {
      setLoadError('Unable to load survey dataset from the backend server.');
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (authUser) {
      void fetchSurveyData();
    }
  }, [authUser, fetchSurveyData]);

  useEffect(() => {
    const onHashChange = () => {
      if (!authUser) return;
      const hash = window.location.hash.replace('#', '') as SectionId;
      if (VALID_SECTIONS.includes(hash)) {
        setActiveSection(hash);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [authUser]);

  const handleAuthSuccess = useCallback((session: AuthSessionStatus) => {
    setAuthHasUsers(true);
    setAuthNotice(null);
    if (session.idleTimeoutMs) {
      setAuthIdleTimeoutMs(session.idleTimeoutMs);
    }
    setAuthUser(session.user);
    setActiveSection('home');
    window.location.hash = 'home';
  }, []);

  const handleNavigate = (section: SectionId) => {
    if (!authUser) return;
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

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] px-4 text-[var(--text-body)]">
        <div className="theme-surface rounded-lg border px-6 py-4 text-sm font-medium">
          Checking authentication session...
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <LoginView
        hasUsers={authHasUsers}
        collegeName={settings.collegeName}
        expiredMessage={authNotice}
        onAuthenticated={handleAuthSuccess}
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
        authUser={authUser}
        onOpenChangePassword={() => setChangePasswordOpen(true)}
        onLogout={() => void handleLogout(null)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          activeSection={activeSection}
          onOpenMobileMenu={() => setMobileOpen(true)}
          onNavigate={handleNavigate}
          authUser={authUser}
          onOpenChangePassword={() => setChangePasswordOpen(true)}
          onLogout={() => void handleLogout(null)}
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
              {activeSection === 'activity' && (
                <MyActivityView
                  weeks={weeklyActivities}
                  summary={activitySummary}
                  settings={settings}
                  onActivitiesUpdated={(weeks, summary) => {
                    setWeeklyActivities(weeks);
                    setActivitySummary(summary);
                  }}
                />
              )}
              {activeSection === 'survey' && (
                <SurveyFormView
                  onSubmitted={fetchSurveyData}
                  onNavigate={handleNavigate}
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

      <ChatBoardWidget
        counts={counts}
        scope={scope}
        adminToken={adminToken}
        onNavigate={handleNavigate}
      />

      <ChangePasswordModal
        isOpen={changePasswordOpen}
        username={authUser.username}
        onClose={() => setChangePasswordOpen(false)}
      />
    </div>
  );
}
