import React, { useEffect, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, X } from 'lucide-react';
import { apiFetch } from '../utils/apiClient';
import { validateChangePasswordInput } from '../utils/authLogic';

interface ChangePasswordModalProps {
  isOpen: boolean;
  username: string;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  username,
  onClose,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setSubmitting(false);
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setSuccessMessage(null);

    const check = validateChangePasswordInput({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!check.valid) {
      setError(check.error || 'Please check your password entries.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || 'Unable to update password.');
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage(data.message || 'Password updated successfully.');
    } catch {
      setError('Unable to reach the authentication server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="theme-surface w-full max-w-md overflow-hidden rounded-xl border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="theme-sidebar flex items-center justify-between gap-3 px-5 py-4 text-white">
          <div className="flex min-w-0 items-center gap-2.5">
            <KeyRound className="h-4 w-4 shrink-0 text-violet-300" />
            <div className="min-w-0">
              <h2 id="change-password-title" className="text-sm font-bold text-white">
                Change Password
              </h2>
              <p className="truncate text-[11px] text-slate-300">
                Account: {username}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close change password modal"
            className="rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6">
          <div>
            <label htmlFor="cp-current" className="theme-heading block text-xs font-semibold">
              Current Password
            </label>
            <div className="relative mt-1.5">
              <input
                id="cp-current"
                type={showCurrent ? 'text' : 'password'}
                autoComplete="current-password"
                autoFocus
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={submitting}
                placeholder="Enter current password"
                className="theme-surface block w-full rounded-md border py-2 pl-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((prev) => !prev)}
                aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                className="theme-muted absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium hover:opacity-80"
              >
                {showCurrent ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                <span>{showCurrent ? 'Hide' : 'Show'}</span>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="cp-new" className="theme-heading block text-xs font-semibold">
              New Password
            </label>
            <div className="relative mt-1.5">
              <input
                id="cp-new"
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={submitting}
                placeholder="Minimum 6 characters"
                className="theme-surface block w-full rounded-md border py-2 pl-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
              />
              <button
                type="button"
                onClick={() => setShowNew((prev) => !prev)}
                aria-label={showNew ? 'Hide new password' : 'Show new password'}
                className="theme-muted absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium hover:opacity-80"
              >
                {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                <span>{showNew ? 'Hide' : 'Show'}</span>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="cp-confirm" className="theme-heading block text-xs font-semibold">
              Confirm New Password
            </label>
            <div className="relative mt-1.5">
              <input
                id="cp-confirm"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting}
                placeholder="Re-enter new password"
                className="theme-surface block w-full rounded-md border py-2 pl-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                className="theme-muted absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium hover:opacity-80"
              >
                {showConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                <span>{showConfirm ? 'Hide' : 'Show'}</span>
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

          {successMessage && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="theme-surface rounded-md border px-3.5 py-2 text-xs font-semibold hover:opacity-85 disabled:opacity-50"
            >
              {successMessage ? 'Done' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="theme-btn-primary inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold transition-opacity disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
