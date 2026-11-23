import React, { useRef, useState } from 'react';
import { apiFetch } from '../utils/apiClient';
import {
  Award,
  Calendar,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Code2,
  Compass,
  Edit3,
  ImagePlus,
  Plus,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  ActivityProgressSummary,
  ActivityStatus,
  ProjectSettings,
  WeeklyActivity,
  WeeklyPhoto,
} from '../types/survey';
import { ACTIVITY_STATUSES } from '../utils/activityLogic';

interface MyActivityViewProps {
  weeks: WeeklyActivity[];
  summary: ActivityProgressSummary;
  settings: ProjectSettings;
  onActivitiesUpdated: (weeks: WeeklyActivity[], summary: ActivityProgressSummary) => void;
}

const WEEK_ICONS: Record<number, React.ComponentType<{ className?: string }>> = {
  1: Compass,
  2: Search,
  3: Users,
  4: ClipboardCheck,
  5: Code2,
  6: Award,
};

interface EditDraft {
  title: string;
  description: string;
  activities: string[];
  startDate: string;
  endDate: string;
  status: ActivityStatus;
  reflection: string;
}

function getStatusClasses(status: ActivityStatus): {
  badge: string;
  node: string;
  dot: string;
} {
  if (status === 'Completed') {
    return {
      badge: 'border-emerald-300 bg-emerald-50 text-emerald-800',
      node: 'border-emerald-600 bg-emerald-600 text-white',
      dot: 'bg-emerald-600',
    };
  }
  if (status === 'In Progress') {
    return {
      badge: 'border-blue-300 bg-blue-50 text-blue-800',
      node: 'border-blue-600 bg-blue-600 text-white',
      dot: 'bg-blue-600',
    };
  }
  return {
    badge: 'border-slate-300 bg-slate-100 text-slate-700',
    node: 'border-slate-300 bg-white text-slate-600',
    dot: 'bg-slate-400',
  };
}

function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(dt.getTime())) return isoDate;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const MyActivityView: React.FC<MyActivityViewProps> = ({
  weeks,
  summary,
  settings,
  onActivitiesUpdated,
}) => {
  const [editingWeek, setEditingWeek] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [savingWeek, setSavingWeek] = useState<number | null>(null);
  const [uploadingWeek, setUploadingWeek] = useState<number | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [photoCaptions, setPhotoCaptions] = useState<Record<number, string>>({});
  const [weekMessages, setWeekMessages] = useState<
    Record<number, { type: 'success' | 'error'; text: string }>
  >({});
  const [statusFilter, setStatusFilter] = useState<'All' | ActivityStatus>('All');
  const [lightboxPhoto, setLightboxPhoto] = useState<{
    weekNumber: number;
    photo: WeeklyPhoto;
  } | null>(null);

  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const totalPhotos = weeks.reduce((sum, w) => sum + w.photos.length, 0);

  const filteredWeeks =
    statusFilter === 'All' ? weeks : weeks.filter((w) => w.status === statusFilter);

  const setWeekBanner = (weekNumber: number, type: 'success' | 'error', text: string) => {
    setWeekMessages((prev) => ({ ...prev, [weekNumber]: { type, text } }));
  };

  const clearWeekBanner = (weekNumber: number) => {
    setWeekMessages((prev) => {
      const next = { ...prev };
      delete next[weekNumber];
      return next;
    });
  };

  const startEditing = (week: WeeklyActivity) => {
    clearWeekBanner(week.weekNumber);
    setEditingWeek(week.weekNumber);
    setDraft({
      title: week.title,
      description: week.description,
      activities: week.activities.length > 0 ? [...week.activities] : [''],
      startDate: week.startDate,
      endDate: week.endDate,
      status: week.status,
      reflection: week.reflection,
    });
  };

  const cancelEditing = () => {
    setEditingWeek(null);
    setDraft(null);
  };

  const handleSaveWeek = async (weekNumber: number) => {
    if (!draft) return;

    clearWeekBanner(weekNumber);
    setSavingWeek(weekNumber);

    try {
      const cleanedActivities = draft.activities.map((a) => a.trim()).filter(Boolean);
      const res = await apiFetch(`/api/activity/${weekNumber}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: draft.title.trim(),
          description: draft.description.trim(),
          activities: cleanedActivities,
          startDate: draft.startDate,
          endDate: draft.endDate,
          status: draft.status,
          reflection: draft.reflection.trim(),
        }),
      });

      const data = (await res.json()) as {
        weeks?: WeeklyActivity[];
        summary?: ActivityProgressSummary;
        error?: string;
        code?: string;
      };

      if (!res.ok || !data.weeks || !data.summary) {
        setWeekBanner(weekNumber, 'error', data.error || 'Failed to save weekly activity.');
        return;
      }

      onActivitiesUpdated(data.weeks, data.summary);
      setEditingWeek(null);
      setDraft(null);
      setWeekBanner(weekNumber, 'success', `Week ${weekNumber} activity details saved.`);
    } catch {
      setWeekBanner(weekNumber, 'error', 'Network error while saving weekly activity.');
    } finally {
      setSavingWeek(null);
    }
  };

  const handlePhotoFileSelected = async (
    weekNumber: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setWeekBanner(weekNumber, 'error', 'Only JPG, PNG, or WebP photograph files are allowed.');
      return;
    }

    if (file.size > 2_500_000) {
      setWeekBanner(
        weekNumber,
        'error',
        'Selected photograph exceeds 2.5 MB. Please choose a smaller image file.'
      );
      return;
    }

    clearWeekBanner(weekNumber);
    setUploadingWeek(weekNumber);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed reading image file.'));
        reader.readAsDataURL(file);
      });

      const caption = (photoCaptions[weekNumber] || '').trim();
      const res = await apiFetch(`/api/activity/${weekNumber}/photos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          caption,
          dataUrl,
        }),
      });

      const data = (await res.json()) as {
        weeks?: WeeklyActivity[];
        summary?: ActivityProgressSummary;
        error?: string;
        code?: string;
      };

      if (!res.ok || !data.weeks || !data.summary) {
        setWeekBanner(weekNumber, 'error', data.error || 'Unable to upload photograph.');
        return;
      }

      onActivitiesUpdated(data.weeks, data.summary);
      setPhotoCaptions((prev) => ({ ...prev, [weekNumber]: '' }));
      setWeekBanner(
        weekNumber,
        'success',
        `Actual photograph "${file.name}" attached to Week ${weekNumber}.`
      );
    } catch {
      setWeekBanner(weekNumber, 'error', 'Could not read or upload the selected photograph.');
    } finally {
      setUploadingWeek(null);
    }
  };

  const handleDeletePhoto = async (weekNumber: number, photoId: string) => {
    clearWeekBanner(weekNumber);
    setDeletingPhotoId(photoId);

    try {
      const res = await apiFetch(
        `/api/activity/${weekNumber}/photos/${encodeURIComponent(photoId)}`,
        {
          method: 'DELETE',
        }
      );

      const data = (await res.json()) as {
        weeks?: WeeklyActivity[];
        summary?: ActivityProgressSummary;
        error?: string;
        code?: string;
      };

      if (!res.ok || !data.weeks || !data.summary) {
        setWeekBanner(weekNumber, 'error', data.error || 'Failed to delete photograph.');
        return;
      }

      onActivitiesUpdated(data.weeks, data.summary);
      if (lightboxPhoto?.photo.id === photoId) {
        setLightboxPhoto(null);
      }
      setWeekBanner(weekNumber, 'success', 'Photograph removed.');
    } catch {
      setWeekBanner(weekNumber, 'error', 'Network error while removing photograph.');
    } finally {
      setDeletingPhotoId(null);
    }
  };

  const overallBadgeClasses = getStatusClasses(summary.overallLabel).badge;

  return (
    <div className="space-y-6">
      {/* Header & Overall CSP Progress Indicator */}
      <section className="theme-surface rounded-xl border p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="theme-accent-text flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide">
              <span>Community Service Project (CSP) Logbook</span>
              <span aria-hidden="true">·</span>
              <span>{settings.collegeName}</span>
            </div>
            <h1 className="theme-heading mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
              My Activity – Six-Week CSP Journey
            </h1>
            <p className="theme-muted mt-2 text-sm leading-relaxed">
              Interactive six-week project execution tracker for{' '}
              <strong className="theme-heading font-semibold">
                &ldquo;Android Phone Usage by Different People.&rdquo;
              </strong>{' '}
              Update weekly dates, activity details, progress statuses, learning reflections, and upload actual field photographs separately for each week.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold ${overallBadgeClasses}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Project Status: {summary.overallLabel}</span>
            </span>
            <p className="theme-muted text-xs">
              Progress updates strictly reflect your saved weekly statuses.
            </p>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="theme-surface-muted mt-6 rounded-lg border p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="theme-heading text-sm font-semibold">
                Overall Six-Week Completion Progress
              </p>
              <p className="theme-muted mt-0.5 text-xs">
                {summary.completedCount} of {summary.totalWeeks} weeks marked Completed ·{' '}
                {summary.inProgressCount} In Progress · {summary.notStartedCount} Not Started
              </p>
            </div>
            <span className="theme-accent-text font-mono text-xl font-bold tabular-nums">
              {summary.percentComplete}%
            </span>
          </div>

          <div
            className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800"
            role="progressbar"
            aria-valuenow={summary.percentComplete}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Overall six-week CSP completion progress"
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${summary.percentComplete}%`,
                backgroundColor: 'var(--accent-secondary)',
              }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="theme-surface rounded-md border px-3.5 py-2.5">
              <p className="theme-muted text-[11px] font-medium">Completed Weeks</p>
              <p className="mt-0.5 font-mono text-lg font-bold text-emerald-700 tabular-nums">
                {summary.completedCount} / {summary.totalWeeks}
              </p>
            </div>
            <div className="theme-surface rounded-md border px-3.5 py-2.5">
              <p className="theme-muted text-[11px] font-medium">In Progress</p>
              <p className="mt-0.5 font-mono text-lg font-bold text-blue-700 tabular-nums">
                {summary.inProgressCount}
              </p>
            </div>
            <div className="theme-surface rounded-md border px-3.5 py-2.5">
              <p className="theme-muted text-[11px] font-medium">Not Started</p>
              <p className="theme-heading mt-0.5 font-mono text-lg font-bold tabular-nums">
                {summary.notStartedCount}
              </p>
            </div>
            <div className="theme-surface rounded-md border px-3.5 py-2.5">
              <p className="theme-muted text-[11px] font-medium">Uploaded Field Photos</p>
              <p className="theme-accent-text mt-0.5 font-mono text-lg font-bold tabular-nums">
                {totalPhotos}
              </p>
            </div>
          </div>
        </div>

        {/* Status Filter Bar */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div
            className="theme-surface-muted inline-flex flex-wrap rounded-md border p-1 text-xs font-medium"
            role="group"
            aria-label="Filter weekly activities by status"
          >
            {(['All', ...ACTIVITY_STATUSES] as const).map((statusOption) => {
              const active = statusFilter === statusOption;
              return (
                <button
                  key={statusOption}
                  type="button"
                  onClick={() => setStatusFilter(statusOption)}
                  aria-pressed={active}
                  className={`rounded px-3 py-1.5 transition-colors whitespace-nowrap ${
                    active ? 'theme-accent-bg font-semibold' : 'theme-muted hover:opacity-80'
                  }`}
                >
                  {statusOption === 'All' ? `All Weeks (${weeks.length})` : statusOption}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {weeks.map((w) => (
              <a
                key={w.weekNumber}
                href={`#csp-week-${w.weekNumber}`}
                onClick={(e) => {
                  e.preventDefault();
                  setStatusFilter('All');
                  document
                    .getElementById(`csp-week-${w.weekNumber}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="theme-surface-muted rounded border px-2.5 py-1 font-mono font-semibold hover:opacity-80"
              >
                W{w.weekNumber}
              </a>
            ))}
          </div>
        </div>
      </section>


      {/* Vertical Six-Week Timeline */}
      <section aria-label="Six-Week CSP Timeline" className="relative space-y-6">
        {filteredWeeks.length === 0 ? (
          <div className="theme-surface rounded-xl border p-8 text-center">
            <p className="theme-heading text-sm font-semibold">
              No weeks match the &ldquo;{statusFilter}&rdquo; filter.
            </p>
            <button
              type="button"
              onClick={() => setStatusFilter('All')}
              className="theme-btn-primary mt-3 rounded-md px-4 py-2 text-xs font-semibold"
            >
              Show All Six Weeks
            </button>
          </div>
        ) : (
          filteredWeeks.map((week, idx) => {
            const Icon = WEEK_ICONS[week.weekNumber] || Compass;
            const styles = getStatusClasses(week.status);
            const isEditing = editingWeek === week.weekNumber && draft !== null;
            const isLast = idx === filteredWeeks.length - 1;
            const banner = weekMessages[week.weekNumber];

            return (
              <div
                key={week.weekNumber}
                id={`csp-week-${week.weekNumber}`}
                className="relative flex gap-4 sm:gap-6"
              >
                {/* Vertical Timeline Column (Desktop & Tablet) */}
                <div className="hidden sm:flex flex-col items-center">
                  <div
                    className={`z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 shadow-sm transition-colors ${styles.node}`}
                    aria-hidden="true"
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {!isLast && (
                    <div
                      className="mt-2 w-0.5 flex-1 bg-slate-300/80 dark:bg-slate-700"
                      aria-hidden="true"
                    />
                  )}
                </div>

                {/* Weekly Activity Card */}
                <article className="theme-surface flex-1 rounded-xl border p-5 sm:p-6 transition-shadow duration-200 hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border sm:hidden ${styles.node}`}
                        aria-hidden="true"
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="theme-accent-text font-mono text-xs font-bold tracking-wide uppercase">
                            Week {week.weekNumber}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-[11px] font-semibold ${styles.badge}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${styles.dot}`}
                              aria-hidden="true"
                            />
                            {week.status}
                          </span>
                        </div>
                        <h2 className="theme-heading mt-1 text-lg font-bold sm:text-xl">
                          Week {week.weekNumber} – {week.title}
                        </h2>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!isEditing ? (
                        <button
                          type="button"
                          onClick={() => startEditing(week)}
                          className="theme-surface-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold hover:opacity-85 whitespace-nowrap"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Edit Activity</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={savingWeek === week.weekNumber}
                            onClick={() => void handleSaveWeek(week.weekNumber)}
                            className="theme-btn-primary inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold disabled:opacity-60 whitespace-nowrap"
                          >
                            <Save className="h-3.5 w-3.5" />
                            <span>
                              {savingWeek === week.weekNumber ? 'Saving...' : 'Save Changes'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="theme-surface inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold hover:opacity-85 whitespace-nowrap"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Cancel</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {banner && (
                    <div
                      role={banner.type === 'error' ? 'alert' : 'status'}
                      className={`mt-4 flex items-center justify-between gap-2 rounded-md border px-3.5 py-2.5 text-xs font-medium ${
                        banner.type === 'error'
                          ? 'border-red-300 bg-red-50 text-red-800'
                          : 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      }`}
                    >
                      <span>{banner.text}</span>
                      <button
                        type="button"
                        onClick={() => clearWeekBanner(week.weekNumber)}
                        className="underline underline-offset-2 opacity-80 hover:opacity-100"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {isEditing && draft ? (
                    <div className="mt-5 space-y-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="md:col-span-2">
                          <label className="theme-heading block text-xs font-semibold">
                            Week Title
                          </label>
                          <input
                            type="text"
                            value={draft.title}
                            maxLength={140}
                            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                            className="theme-surface mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
                          />
                        </div>
                        <div>
                          <label className="theme-heading block text-xs font-semibold">
                            Progress Status
                          </label>
                          <select
                            value={draft.status}
                            onChange={(e) =>
                              setDraft({ ...draft, status: e.target.value as ActivityStatus })
                            }
                            className="theme-surface mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
                          >
                            {ACTIVITY_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="theme-heading block text-xs font-semibold">
                            Start Date
                          </label>
                          <input
                            type="date"
                            value={draft.startDate}
                            onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                            className="theme-surface mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
                          />
                        </div>
                        <div>
                          <label className="theme-heading block text-xs font-semibold">
                            End Date
                          </label>
                          <input
                            type="date"
                            value={draft.endDate}
                            onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
                            className="theme-surface mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="theme-heading block text-xs font-semibold">
                          Weekly Activity Summary / Description
                        </label>
                        <textarea
                          rows={3}
                          value={draft.description}
                          maxLength={1500}
                          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                          className="theme-surface mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <label className="theme-heading text-xs font-semibold">
                            Editable Activity Tasks
                          </label>
                          <button
                            type="button"
                            disabled={draft.activities.length >= 12}
                            onClick={() =>
                              setDraft({ ...draft, activities: [...draft.activities, ''] })
                            }
                            className="theme-surface-muted inline-flex items-center gap-1 rounded border px-2.5 py-1 text-[11px] font-semibold hover:opacity-85 disabled:opacity-50"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Task</span>
                          </button>
                        </div>
                        <div className="mt-2 space-y-2">
                          {draft.activities.map((item, itemIdx) => (
                            <div key={itemIdx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={item}
                                maxLength={240}
                                placeholder={`Activity task ${itemIdx + 1}`}
                                onChange={(e) => {
                                  const next = [...draft.activities];
                                  next[itemIdx] = e.target.value;
                                  setDraft({ ...draft, activities: next });
                                }}
                                className="theme-surface flex-1 rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
                              />
                              <button
                                type="button"
                                aria-label={`Remove task ${itemIdx + 1}`}
                                onClick={() => {
                                  const next = draft.activities.filter((_, i) => i !== itemIdx);
                                  setDraft({
                                    ...draft,
                                    activities: next.length > 0 ? next : [''],
                                  });
                                }}
                                className="theme-surface rounded-md border p-2 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="theme-heading block text-xs font-semibold">
                          Learning Experience &amp; Student Reflection
                        </label>
                        <textarea
                          rows={3}
                          value={draft.reflection}
                          maxLength={2000}
                          placeholder="Record your actual observations, challenges faced, and key takeaways for this week..."
                          onChange={(e) => setDraft({ ...draft, reflection: e.target.value })}
                          className="theme-surface mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-5">
                      {/* Schedule & Last Updated Bar */}
                      <div className="theme-surface-muted flex flex-wrap items-center justify-between gap-2 rounded-md border px-3.5 py-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          <Calendar className="theme-accent-text h-3.5 w-3.5 shrink-0" />
                          <span className="theme-heading font-medium">
                            {week.startDate || week.endDate
                              ? `${formatDateDisplay(week.startDate) || 'Start TBD'} — ${
                                  formatDateDisplay(week.endDate) || 'End TBD'
                                }`
                              : 'Start & end dates not yet recorded'}
                          </span>
                        </div>
                        {week.updatedAt && (
                          <span className="theme-muted inline-flex items-center gap-1 text-[11px]">
                            <Clock3 className="h-3 w-3" />
                            <span>
                              Updated {new Date(week.updatedAt).toLocaleDateString('en-IN')}
                            </span>
                          </span>
                        )}
                      </div>

                      {/* Description & Activities Grid */}
                      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                        <div className="space-y-4 lg:col-span-7">
                          <div>
                            <h3 className="theme-heading text-xs font-semibold tracking-wide uppercase">
                              Activity Overview
                            </h3>
                            <p className="theme-muted mt-1.5 text-sm leading-relaxed">
                              {week.description || 'No description added yet.'}
                            </p>
                          </div>

                          <div>
                            <h3 className="theme-heading text-xs font-semibold tracking-wide uppercase">
                              Planned &amp; Executed Tasks
                            </h3>
                            <ul className="mt-2 space-y-1.5">
                              {week.activities.map((task, taskIdx) => (
                                <li
                                  key={taskIdx}
                                  className="theme-body flex items-start gap-2.5 text-sm"
                                >
                                  <span
                                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: 'var(--accent-secondary)' }}
                                    aria-hidden="true"
                                  />
                                  <span>{task}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Weekly Learning Reflection */}
                        <div className="lg:col-span-5">
                          <div className="theme-surface-muted h-full rounded-lg border p-4">
                            <h3 className="theme-heading text-xs font-semibold tracking-wide uppercase">
                              Learning Experience &amp; Reflection
                            </h3>
                            {week.reflection ? (
                              <p className="theme-body mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                                {week.reflection}
                              </p>
                            ) : (
                              <p className="theme-muted mt-2 text-xs italic leading-relaxed">
                                No reflection recorded yet. Click &ldquo;Edit Activity&rdquo; to add your actual learning experience and observations for Week {week.weekNumber}.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Separate Actual Photograph Upload Section per Week */}
                      <div className="border-t border-[var(--border-subtle)] pt-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Camera className="theme-accent-text h-4 w-4" />
                            <h3 className="theme-heading text-xs font-semibold tracking-wide uppercase">
                              Week {week.weekNumber} Actual Field Photographs ({week.photos.length}/6)
                            </h3>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={photoCaptions[week.weekNumber] || ''}
                              maxLength={120}
                              placeholder="Optional photo caption..."
                              onChange={(e) =>
                                setPhotoCaptions((prev) => ({
                                  ...prev,
                                  [week.weekNumber]: e.target.value,
                                }))
                              }
                              className="theme-surface rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
                            />
                            <input
                              ref={(el) => {
                                fileInputRefs.current[week.weekNumber] = el;
                              }}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => void handlePhotoFileSelected(week.weekNumber, e)}
                            />
                            <button
                              type="button"
                              disabled={
                                uploadingWeek === week.weekNumber || week.photos.length >= 6
                              }
                              onClick={() => fileInputRefs.current[week.weekNumber]?.click()}
                              className="theme-btn-primary inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-55 whitespace-nowrap"
                            >
                              <ImagePlus className="h-3.5 w-3.5" />
                              <span>
                                {uploadingWeek === week.weekNumber
                                  ? 'Uploading...'
                                  : 'Upload Actual Photo'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {week.photos.length === 0 ? (
                          <div className="theme-surface-muted mt-3 rounded-lg border border-dashed px-4 py-5 text-center">
                            <p className="theme-muted text-xs">
                              No actual photographs uploaded for Week {week.weekNumber} yet. Only authentic project or field-visit photographs you upload appear here.
                            </p>
                          </div>
                        ) : (
                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                            {week.photos.map((photo) => (
                              <div
                                key={photo.id}
                                className="theme-surface-muted overflow-hidden rounded-lg border"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLightboxPhoto({ weekNumber: week.weekNumber, photo })
                                  }
                                  className="block w-full overflow-hidden bg-slate-100 focus:outline-none"
                                >
                                  <img
                                    src={photo.dataUrl}
                                    alt={photo.caption || `Week ${week.weekNumber} CSP photograph`}
                                    className="h-40 w-full object-cover transition-transform duration-200 hover:scale-[1.02]"
                                  />
                                </button>
                                <div className="flex items-start justify-between gap-2 p-2.5">
                                  <div className="min-w-0">
                                    <p className="theme-heading truncate text-xs font-medium">
                                      {photo.caption || photo.fileName}
                                    </p>
                                    <p className="theme-muted truncate text-[10px]">
                                      Uploaded{' '}
                                      {new Date(photo.uploadedAt).toLocaleDateString('en-IN')}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={deletingPhotoId === photo.id}
                                    onClick={() => void handleDeletePhoto(week.weekNumber, photo.id)}
                                    aria-label={`Delete photograph ${photo.fileName}`}
                                    className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              </div>
            );
          })
        )}
      </section>

      {/* Lightbox Modal for Uploaded Photographs */}
      {lightboxPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Week ${lightboxPhoto.weekNumber} photograph preview`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="theme-surface max-h-[90vh] max-w-3xl overflow-hidden rounded-xl border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-4 py-3">
              <div className="min-w-0">
                <p className="theme-heading truncate text-sm font-semibold">
                  Week {lightboxPhoto.weekNumber} ·{' '}
                  {lightboxPhoto.photo.caption || lightboxPhoto.photo.fileName}
                </p>
                <p className="theme-muted text-xs">
                  {lightboxPhoto.photo.fileName} · Uploaded{' '}
                  {new Date(lightboxPhoto.photo.uploadedAt).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                aria-label="Close photograph preview"
                className="theme-surface-muted rounded-md border p-1.5 hover:opacity-80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex max-h-[75vh] items-center justify-center bg-slate-950/5 p-3">
              <img
                src={lightboxPhoto.photo.dataUrl}
                alt={lightboxPhoto.photo.caption || lightboxPhoto.photo.fileName}
                className="max-h-[70vh] w-auto rounded object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
