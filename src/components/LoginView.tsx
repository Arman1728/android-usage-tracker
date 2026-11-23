import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from 'lucide-react';
import { AuthSessionStatus } from '../types/survey';
import { apiFetch } from '../utils/apiClient';

interface LoginViewProps {
  hasUsers?: boolean;
  collegeName?: string;
  expiredMessage?: string | null;
  onAuthenticated: (session: AuthSessionStatus) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  collegeName = 'Sree Venkateswara College of Engineering',
  expiredMessage = null,
  onAuthenticated,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(expiredMessage);

  useEffect(() => {
    setError(expiredMessage);
  }, [expiredMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitting(true);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: identifier.trim(), password }),
      });

      const data = (await res.json()) as AuthSessionStatus & { error?: string };
      if (!res.ok || !data.authenticated || !data.user) {
        setError(data.error || 'Invalid username/email or password');
        return;
      }

      setPassword('');
      onAuthenticated(data);
    } catch {
      setError('Unable to reach the authentication server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] px-4 py-10 text-[var(--text-body)] flex items-center justify-center">
      <main className="theme-surface w-full max-w-md overflow-hidden rounded-xl border shadow-lg">
        <div className="theme-sidebar px-6 py-6 text-white">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-violet-300">
            <Lock className="h-4 w-4 shrink-0" />
            <span>Secure Authentication Required</span>
          </div>
          <h1 className="mt-2 text-xl font-bold leading-snug text-white">
            Android Phone Usage Research Portal
          </h1>
          <p className="mt-1 text-xs text-slate-300">
            B.Tech Community Service Project (CSP) · {collegeName}
          </p>
        </div>

        <div className="p-6 sm:p-7 space-y-5">
          <div>
            <h2 className="theme-heading text-base font-bold">Log In</h2>
            <p className="theme-muted mt-1 text-xs leading-relaxed">
              Log in with your portal username or email address. New visitors can enter their email and set a password directly.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-identifier" className="theme-heading block text-xs font-semibold">
                Username or Email
              </label>
              <div className="relative mt-1.5">
                <User className="theme-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <input
                  id="login-identifier"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={submitting}
                  placeholder="Enter username or email"
                  className="theme-surface block w-full rounded-md border py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="theme-heading block text-xs font-semibold">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  placeholder="Enter password"
                  className="theme-surface block w-full rounded-md border py-2.5 pl-3 pr-20 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="theme-muted absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium hover:opacity-80"
                >
                  {showPassword ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      <span>Show</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-800"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="theme-btn-primary inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Log In</span>
                </>
              )}
            </button>
          </form>

          <div className="theme-muted flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-[var(--border-subtle)] pt-4 text-[11px]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>HTTP-only encrypted session</span>
            </span>
            <span>Auto-expires on inactivity</span>
          </div>
        </div>
      </main>
    </div>
  );
};
