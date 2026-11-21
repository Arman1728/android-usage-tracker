import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Download,
  Lock,
  LogOut,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  DatasetCounts,
  DatasetScope,
  ProjectSettings,
  SecurityChallengeMode,
  SecurityMetricsSnapshot,
  SecurityProtectionItem,
  SurveyResponse,
} from '../types/survey';
import { SecurityGate } from './SecurityGate';

interface AdminViewProps {
  responses: SurveyResponse[];
  counts: DatasetCounts;
  settings: ProjectSettings;
  onRefresh: () => Promise<void>;
  adminToken: string | null;
  onAdminTokenChange: (token: string | null) => void;
  securityToken: string | null;
  onSecurityTokenIssued: (result: {
    token: string;
    expiresAt: number;
    mode: SecurityChallengeMode;
    protections?: SecurityProtectionItem[];
  }) => void;
  onSecurityInvalidated: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  responses,
  counts,
  settings,
  onRefresh,
  adminToken,
  onAdminTokenChange,
  securityToken,
  onSecurityTokenIssued,
  onSecurityInvalidated,
}) => {
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportScope, setExportScope] = useState<DatasetScope>('all');

  const [collegeName, setCollegeName] = useState(settings.collegeName);
  const [department, setDepartment] = useState(settings.department);
  const [academicBatch, setAcademicBatch] = useState(settings.academicBatch);
  const [requireSiteGate, setRequireSiteGate] = useState<boolean>(settings.requireSiteGate);

  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetricsSnapshot | null>(null);
  const [protections, setProtections] = useState<SecurityProtectionItem[]>([]);

  useEffect(() => {
    setCollegeName(settings.collegeName);
    setDepartment(settings.department);
    setAcademicBatch(settings.academicBatch);
    setRequireSiteGate(settings.requireSiteGate);
  }, [
    settings.collegeName,
    settings.department,
    settings.academicBatch,
    settings.requireSiteGate,
  ]);

  const fetchSecurityTelemetry = useCallback(async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/security', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.status === 401) {
        onAdminTokenChange(null);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as {
        metrics: SecurityMetricsSnapshot;
        protections: SecurityProtectionItem[];
      };
      setSecurityMetrics(data.metrics);
      setProtections(data.protections || []);
    } catch {
      // Non-blocking metrics refresh
    }
  }, [adminToken, onAdminTokenChange]);

  useEffect(() => {
    if (adminToken) {
      void fetchSecurityTelemetry();
    } else {
      setSecurityMetrics(null);
    }
  }, [adminToken, fetchSecurityTelemetry]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!securityToken) {
      setAuthError('Please complete the human security verification check above before signing in.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-security-token': securityToken,
        },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (res.status === 403 && data.code === 'SECURITY_VERIFICATION_REQUIRED') {
        onSecurityInvalidated();
        setAuthError('Security verification expired. Please re-verify above and try again.');
        return;
      }
      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed.');
        return;
      }
      onAdminTokenChange(data.token);
      setPasscode('');
    } catch {
      setAuthError('Network error during sign in.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    if (adminToken) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      }).catch(() => {});
    }
    onAdminTokenChange(null);
    setStatusMessage(null);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ collegeName, department, academicBatch, requireSiteGate }),
      });
      if (res.status === 401) {
        void handleLogout();
        setAuthError('Admin session expired. Please sign in again.');
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setStatusMessage(data.error || 'Failed to update settings.');
        return;
      }
      setStatusMessage(
        `Saved settings for "${data.settings.collegeName}" (Entry Security Gate: ${
          data.settings.requireSiteGate ? 'Enabled' : 'Disabled'
        }).`
      );
      await onRefresh();
      await fetchSecurityTelemetry();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!adminToken) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/admin/responses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.status === 401) {
        void handleLogout();
        setAuthError('Admin session expired. Please sign in again.');
        return;
      }
      if (res.ok) {
        setStatusMessage(`Deleted survey record #${id}.`);
        await onRefresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreSamples = async () => {
    if (!adminToken) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/sample/restore', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.status === 401) {
        void handleLogout();
        return;
      }
      const data = await res.json();
      setStatusMessage(`Restored ${data.restoredCount} clearly labelled sample demo records.`);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleClearSamples = async () => {
    if (!adminToken) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/sample/clear', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.status === 401) {
        void handleLogout();
        return;
      }
      const data = await res.json();
      setStatusMessage(`Removed ${data.clearedCount} sample demo records. Real submissions preserved.`);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleAuthorizedCsvExport = async () => {
    if (!adminToken) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/admin/export/csv?scope=${exportScope}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.status === 401) {
        void handleLogout();
        setAuthError('Admin session expired. Please sign in again.');
        return;
      }
      if (!res.ok) {
        setStatusMessage('Failed to export CSV.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `admin-android-usage-survey-${exportScope}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatusMessage(`Downloaded CSV export (${exportScope} records).`);
    } finally {
      setBusy(false);
    }
  };

  if (!adminToken) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <section className="theme-surface rounded-lg border p-6 sm:p-8">
          <div className="theme-heading flex items-center gap-2">
            <Lock className="theme-accent-text h-5 w-5" />
            <h1 className="text-xl font-bold">Admin Survey Management</h1>
          </div>
          <p className="theme-muted mt-2 text-sm">
            Authorized researchers can review individual submissions, remove invalid entries, configure website security verification, update College/Institution details, and export all collected survey fields as CSV.
          </p>

          <div className="mt-5">
            {securityToken ? (
              <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Human Security Verification Passed · Brute-Force Protection Active</span>
              </div>
            ) : (
              <SecurityGate variant="inline" onVerified={onSecurityTokenIssued} />
            )}
          </div>

          <form onSubmit={handleLogin} className="mt-5 space-y-4">
            <div>
              <label htmlFor="admin-passcode" className="theme-heading block text-sm font-medium">
                Admin Passcode
              </label>
              <input
                id="admin-passcode"
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode"
                className="theme-surface mt-1.5 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
              />
              <p className="theme-muted mt-1.5 text-xs">
                CSP evaluation passcode: <code className="font-mono">12345</code>
              </p>
            </div>

            {authError && (
              <p role="alert" className="text-xs font-medium text-red-500">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !securityToken}
              className="theme-btn-primary w-full rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? 'Verifying...' : 'Sign In to Admin Panel'}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="theme-surface flex flex-col justify-between gap-4 rounded-lg border p-6 sm:flex-row sm:items-center">
        <div>
          <p className="theme-accent-text text-xs font-semibold tracking-wide">
            Authorized Workspace · SQLite Record & Security Management
          </p>
          <h1 className="theme-heading mt-1 text-2xl font-bold">Admin Panel</h1>
          <p className="theme-muted mt-1 text-sm">
            Database totals:{' '}
            <span className="theme-heading font-mono font-semibold tabular-nums">
              {counts.realCount}
            </span>{' '}
            real submission(s) ·{' '}
            <span className="theme-accent-text font-mono font-semibold tabular-nums">
              {counts.sampleCount}
            </span>{' '}
            sample demo record(s).
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="theme-surface inline-flex items-center gap-2 rounded-md border px-4 py-2 text-xs font-semibold hover:opacity-90 whitespace-nowrap shrink-0"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </section>

      {statusMessage && (
        <div
          role="status"
          className="theme-surface theme-heading rounded-lg border px-4 py-3 text-sm font-medium"
        >
          {statusMessage}
        </div>
      )}

      <section className="theme-surface rounded-lg border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="theme-accent-text h-4 w-4" />
            <h2 className="theme-heading text-base font-semibold">
              Website Security & Verification Monitor
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void fetchSecurityTelemetry()}
            className="theme-surface inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:opacity-90"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh Status</span>
          </button>
        </div>
        <p className="theme-muted mt-1 text-xs">
          Live server-enforced security verification metrics and active safeguards across survey submissions, AI chat, and admin routes.
        </p>

        {securityMetrics && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="theme-surface-muted rounded-md border p-3">
              <p className="theme-muted text-[11px] font-medium">Verified Sessions</p>
              <p className="theme-heading mt-1 font-mono text-xl font-semibold tabular-nums">
                {securityMetrics.verifiedSessions}
              </p>
            </div>
            <div className="theme-surface-muted rounded-md border p-3">
              <p className="theme-muted text-[11px] font-medium">Failed Challenges</p>
              <p className="theme-heading mt-1 font-mono text-xl font-semibold tabular-nums">
                {securityMetrics.failedChallenges}
              </p>
            </div>
            <div className="theme-surface-muted rounded-md border p-3">
              <p className="theme-muted text-[11px] font-medium">Blocked Bots</p>
              <p className="theme-heading mt-1 font-mono text-xl font-semibold tabular-nums">
                {securityMetrics.blockedBots}
              </p>
            </div>
            <div className="theme-surface-muted rounded-md border p-3">
              <p className="theme-muted text-[11px] font-medium">Rate-Limited Hits</p>
              <p className="theme-heading mt-1 font-mono text-xl font-semibold tabular-nums">
                {securityMetrics.rateLimitedRequests}
              </p>
            </div>
            <div className="theme-surface-muted rounded-md border p-3">
              <p className="theme-muted text-[11px] font-medium">Failed Admin Logins</p>
              <p className="theme-heading mt-1 font-mono text-xl font-semibold tabular-nums">
                {securityMetrics.failedAdminLogins}
              </p>
            </div>
          </div>
        )}

        {protections.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {protections.map((item) => (
              <div
                key={item.id}
                className="theme-surface-muted flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-xs"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="theme-heading font-semibold">{item.label}</p>
                  <p className="theme-muted mt-0.5">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="theme-surface rounded-lg border p-6">
        <div className="flex items-center gap-2">
          <Building2 className="theme-accent-text h-4 w-4" />
          <h2 className="theme-heading text-base font-semibold">
            College, Institution & Security Gate Settings
          </h2>
        </div>
        <p className="theme-muted mt-1 text-xs">
          Customize the college name, department, batch, and site-wide entry security verification requirement.
        </p>

        <form onSubmit={handleSaveSettings} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="college-name-input" className="theme-heading block text-xs font-medium">
              College Name
            </label>
            <input
              id="college-name-input"
              type="text"
              value={collegeName}
              onChange={(e) => setCollegeName(e.target.value)}
              className="theme-surface mt-1 block w-full rounded-md border px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label htmlFor="department-input" className="theme-heading block text-xs font-medium">
              Department
            </label>
            <input
              id="department-input"
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="theme-surface mt-1 block w-full rounded-md border px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label htmlFor="batch-input" className="theme-heading block text-xs font-medium">
              Academic Batch
            </label>
            <input
              id="batch-input"
              type="text"
              value={academicBatch}
              onChange={(e) => setAcademicBatch(e.target.value)}
              className="theme-surface mt-1 block w-full rounded-md border px-3 py-2 text-xs"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="theme-surface-muted flex cursor-pointer items-center justify-between gap-4 rounded-md border px-4 py-3 text-xs">
              <div>
                <p className="theme-heading font-semibold">
                  Require Website Entry Security Verification Gate
                </p>
                <p className="theme-muted mt-0.5">
                  When enabled, all new visitors must pass the human verification check before viewing the portal. Survey submissions and Admin sign-in remain protected either way.
                </p>
              </div>
              <input
                type="checkbox"
                checked={requireSiteGate}
                onChange={(e) => setRequireSiteGate(e.target.checked)}
                className="h-4 w-4 shrink-0 rounded"
              />
            </label>
          </div>

          <div className="sm:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="theme-btn-primary inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save College & Security Settings</span>
            </button>
          </div>
        </form>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="theme-surface rounded-lg border p-6">
          <h2 className="theme-heading text-base font-semibold">Export Collected Survey Data (CSV)</h2>
          <p className="theme-muted mt-1 text-xs">
            Download a complete CSV spreadsheet containing all 16 survey fields (including College / Institution).
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label htmlFor="admin-export-scope" className="sr-only">
              Export dataset scope
            </label>
            <select
              id="admin-export-scope"
              value={exportScope}
              onChange={(e) => setExportScope(e.target.value as DatasetScope)}
              className="theme-surface rounded-md border px-3 py-2 text-xs font-medium"
            >
              <option value="all">All Stored Records ({counts.total})</option>
              <option value="real">Real Submissions Only ({counts.realCount})</option>
              <option value="sample">Sample Demo Only ({counts.sampleCount})</option>
            </select>

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleAuthorizedCsvExport()}
              className="theme-btn-primary inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60 whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              <span>Export Survey Responses (CSV)</span>
            </button>
          </div>
        </section>

        <section className="theme-surface rounded-lg border p-6">
          <h2 className="theme-heading text-base font-semibold">Sample Demonstration Data Controls</h2>
          <p className="theme-muted mt-1 text-xs">
            Manage the 18 clearly labelled sample demonstration records without affecting actual survey submissions.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRestoreSamples()}
              className="theme-surface inline-flex items-center gap-2 rounded-md border px-4 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-60 whitespace-nowrap"
            >
              <RotateCcw className="theme-accent-text h-4 w-4" />
              <span>Restore Sample Demo Data</span>
            </button>
            <button
              type="button"
              disabled={busy || counts.sampleCount === 0}
              onClick={() => void handleClearSamples()}
              className="theme-surface inline-flex items-center gap-2 rounded-md border border-red-300 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40 whitespace-nowrap"
            >
              <Trash2 className="h-4 w-4" />
              <span>Clear Sample Demo Data</span>
            </button>
          </div>
        </section>
      </div>

      <section className="theme-surface rounded-lg border p-6">
        <h2 className="theme-heading text-base font-semibold">Manage Stored Responses</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="theme-surface-muted theme-muted border-b border-[var(--border-subtle)] text-xs font-semibold">
                <th className="px-3 py-2.5">ID</th>
                <th className="px-3 py-2.5">Source</th>
                <th className="px-3 py-2.5">Age / Gender</th>
                <th className="px-3 py-2.5">Occupation</th>
                <th className="px-3 py-2.5">College</th>
                <th className="px-3 py-2.5 text-right">Daily Hrs</th>
                <th className="px-3 py-2.5">Submitted</th>
                <th className="px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {responses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="theme-muted px-4 py-8 text-center text-sm">
                    No records currently stored in database.
                  </td>
                </tr>
              ) : (
                responses.map((row) => (
                  <tr key={row.id} className="hover:bg-[var(--bg-surface-muted)]">
                    <td className="theme-muted px-3 py-2.5 font-mono text-xs tabular-nums">
                      #{row.id}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {row.isSample ? (
                        <span className="theme-accent-text font-medium">Sample Demo</span>
                      ) : (
                        <span className="theme-heading font-semibold">Real Submission</span>
                      )}
                    </td>
                    <td className="theme-muted px-3 py-2.5 text-xs">
                      {row.ageGroup} · {row.gender}
                    </td>
                    <td className="theme-heading px-3 py-2.5 font-medium">{row.occupation}</td>
                    <td className="theme-muted max-w-[180px] truncate px-3 py-2.5 text-xs">
                      {row.collegeName}
                    </td>
                    <td className="theme-heading px-3 py-2.5 text-right font-mono tabular-nums">
                      {row.avgDailyHours.toFixed(1)}
                    </td>
                    <td className="theme-muted px-3 py-2.5 font-mono text-xs tabular-nums">
                      {row.createdAt.slice(0, 10)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDelete(row.id)}
                        aria-label={`Delete response #${row.id}`}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
