import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  SecurityChallenge,
  SecurityChallengeMode,
  SecurityProtectionItem,
} from '../types/survey';

interface SecurityGateProps {
  variant?: 'fullscreen' | 'inline';
  collegeName?: string;
  protections?: SecurityProtectionItem[];
  onVerified: (result: {
    token: string;
    expiresAt: number;
    mode: SecurityChallengeMode;
    protections?: SecurityProtectionItem[];
  }) => void;
}

export const SecurityGate: React.FC<SecurityGateProps> = ({
  variant = 'fullscreen',
  collegeName = 'Sree Venkateswara College of Engineering',
  protections = [],
  onVerified,
}) => {
  const [mode, setMode] = useState<SecurityChallengeMode>('code');
  const [challenge, setChallenge] = useState<SecurityChallenge | null>(null);
  const [answer, setAnswer] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [loadingChallenge, setLoadingChallenge] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChallenge = useCallback(async (targetMode: SecurityChallengeMode) => {
    setLoadingChallenge(true);
    setError(null);
    try {
      const res = await fetch(`/api/security/challenge?mode=${targetMode}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as SecurityChallenge;
      setChallenge(data);
      setAnswer('');
    } catch {
      setError('Unable to load security challenge from the server. Please refresh.');
    } finally {
      setLoadingChallenge(false);
    }
  }, []);

  useEffect(() => {
    void loadChallenge(mode);
  }, [mode, loadChallenge]);

  const handleToggleMode = () => {
    const nextMode: SecurityChallengeMode = mode === 'code' ? 'math' : 'code';
    setMode(nextMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge || submitting) return;
    if (!answer.trim()) {
      setError('Please enter the verification answer.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/security/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          answer: answer.trim(),
          website: honeypot,
        }),
      });
      const data = (await res.json()) as {
        verified?: boolean;
        token?: string;
        expiresAt?: number;
        mode?: SecurityChallengeMode;
        protections?: SecurityProtectionItem[];
        error?: string;
      };

      if (!res.ok || !data.verified || !data.token || !data.expiresAt) {
        setError(data.error || 'Verification failed. Please solve the new challenge.');
        await loadChallenge(mode);
        return;
      }

      onVerified({
        token: data.token,
        expiresAt: data.expiresAt,
        mode: data.mode || mode,
        protections: data.protections,
      });
    } catch {
      setError('Network error during security verification. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const challengeBox = (
    <div className="space-y-4">
      <div className="theme-surface-muted rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="theme-heading text-xs font-semibold">
            {mode === 'code' ? 'Visual Verification Code' : 'Quick Arithmetic Check'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleMode}
              disabled={loadingChallenge || submitting}
              className="theme-surface rounded border px-2.5 py-1 text-[11px] font-medium hover:opacity-85 disabled:opacity-50 whitespace-nowrap"
            >
              {mode === 'code' ? 'Switch to Math Check' : 'Switch to Code Check'}
            </button>
            <button
              type="button"
              onClick={() => void loadChallenge(mode)}
              disabled={loadingChallenge || submitting}
              aria-label="Refresh security challenge"
              className="theme-surface inline-flex items-center gap-1 rounded border px-2.5 py-1 text-[11px] font-medium hover:opacity-85 disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`h-3 w-3 ${loadingChallenge ? 'animate-spin' : ''}`} />
              <span>New</span>
            </button>
          </div>
        </div>

        <div
          data-testid="security-challenge-display"
          className="theme-surface mt-3 flex min-h-[72px] items-center justify-center rounded-md border px-4 py-3 select-none"
        >
          {loadingChallenge || !challenge ? (
            <span className="theme-muted text-xs font-medium">Generating verification challenge...</span>
          ) : challenge.mode === 'math' ? (
            <span className="theme-heading font-mono text-2xl font-bold tracking-wide tabular-nums">
              {challenge.prompt}
            </span>
          ) : (
            <div className="flex items-center gap-2.5" aria-label="Security code characters">
              {challenge.tokens.map((tok, index) => (
                <span
                  key={`${challenge.challengeId}-${index}`}
                  style={{ transform: `rotate(${tok.tilt}deg)` }}
                  className="theme-surface-muted theme-heading inline-flex h-11 w-10 items-center justify-center rounded border font-mono text-xl font-bold shadow-xs"
                >
                  {tok.ch}
                </span>
              ))}
            </div>
          )}
        </div>

        <p className="theme-muted mt-2 text-xs">
          {challenge?.mode === 'math'
            ? 'Solve the simple addition problem above to confirm you are a real visitor.'
            : 'Type the 5 characters displayed above (case-insensitive).'}
        </p>
      </div>

      {/* Honeypot trap for automated bots */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor={`security-website-hp-${variant}`}>Leave this field empty</label>
        <input
          id={`security-website-hp-${variant}`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div>
        <label
          htmlFor={`security-answer-${variant}`}
          className="theme-heading block text-xs font-semibold"
        >
          Enter Verification Answer
        </label>
        <div className="mt-1.5 flex flex-col gap-2.5 sm:flex-row">
          <input
            id={`security-answer-${variant}`}
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              if (error) setError(null);
            }}
            placeholder={mode === 'math' ? 'Enter sum (e.g. 14)' : 'Enter 5-character code'}
            className="theme-surface flex-1 rounded-md border px-3.5 py-2.5 font-mono text-sm tracking-wider focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
          />
          <button
            type="submit"
            disabled={loadingChallenge || submitting || !challenge}
            className="theme-btn-primary inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>
              {submitting
                ? 'Verifying...'
                : variant === 'fullscreen'
                ? 'Verify & Enter Website'
                : 'Verify Session'}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );

  if (variant === 'inline') {
    return (
      <div className="theme-surface-muted rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="theme-accent-text h-4 w-4" />
          <p className="theme-heading text-sm font-semibold">
            Security Verification Required Before Continuing
          </p>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          {challengeBox}
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] px-4 py-10 text-[var(--text-body)]">
      <main className="theme-surface w-full max-w-lg rounded-xl border p-6 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="theme-accent-text flex items-center gap-1.5 text-xs font-semibold tracking-wide">
              <ShieldCheck className="h-4 w-4" />
              <span>Website Security Verification</span>
            </div>
            <h1 className="theme-heading mt-1.5 text-xl font-bold sm:text-2xl">
              Android Phone Usage by Different People
            </h1>
            <p className="theme-muted mt-0.5 text-xs">
              B.Tech Community Service Project (CSP) · {collegeName}
            </p>
          </div>
          <div className="theme-surface-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border">
            <Lock className="theme-accent-text h-5 w-5" />
          </div>
        </div>

        <p className="theme-muted mt-4 text-sm leading-relaxed">
          Please complete this quick human verification check before entering the research portal. This protects survey data integrity, analytics accuracy, and admin endpoints from automated bots.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-5">
          {challengeBox}
        </form>

        <div className="mt-6 border-t border-[var(--border-subtle)] pt-4">
          <p className="theme-heading text-xs font-semibold">Active Website Protections</p>
          <ul className="mt-2 space-y-1.5">
            {(protections.length > 0
              ? protections.slice(0, 3)
              : [
                  {
                    id: 'hmac',
                    label: 'Server-Signed HMAC-SHA256 Session Tokens',
                    detail: '',
                    active: true,
                  },
                  {
                    id: 'rate',
                    label: 'API Rate Limiting & Brute-Force Lockout',
                    detail: '',
                    active: true,
                  },
                  {
                    id: 'sql',
                    label: 'Parameterized SQLite Queries & Bot Traps',
                    detail: '',
                    active: true,
                  },
                ]
            ).map((item) => (
              <li key={item.id} className="theme-muted flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
};
