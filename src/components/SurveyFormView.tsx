import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import {
  AGE_GROUPS,
  APPLICATION_OPTIONS,
  COLLEGE_OPTIONS,
  GENDERS,
  OCCUPATIONS,
  PRIMARY_PURPOSES,
  PRIVACY_AWARENESS_LABELS,
  PRIVACY_AWARENESS_LEVELS,
  SectionId,
  SMARTPHONE_BRANDS,
  SurveyInput,
  USAGE_DURATIONS,
} from '../types/survey';
import { apiFetch } from '../utils/apiClient';
import { validateSurveyInput } from '../utils/surveyLogic';

interface SurveyFormViewProps {
  onSubmitted: () => Promise<void>;
  onNavigate: (section: SectionId) => void;
}

const INITIAL_FORM: SurveyInput = {
  ageGroup: '',
  gender: 'Prefer not to say',
  occupation: '',
  collegeName: 'Community / General Respondent',
  smartphoneBrand: '',
  yearsOfUsage: '',
  avgDailyHours: '',
  frequentApps: [],
  primaryPurpose: '',
  eduWorkHours: '',
  entertainmentHours: '',
  privacyAwareness: '',
  excessiveUsageOpinion: '',
};

export const SurveyFormView: React.FC<SurveyFormViewProps> = ({
  onSubmitted,
  onNavigate,
}) => {
  const [form, setForm] = useState<SurveyInput>(INITIAL_FORM);
  const [customCollege, setCustomCollege] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const toggleApp = (app: string) => {
    setForm((prev) => {
      const exists = prev.frequentApps.includes(app);
      const nextApps = exists
        ? prev.frequentApps.filter((a) => a !== app)
        : [...prev.frequentApps, app];
      return { ...prev, frequentApps: nextApps };
    });
    if (errors.frequentApps) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.frequentApps;
        return copy;
      });
    }
  };

  const updateField = <K extends keyof SurveyInput>(field: K, value: SurveyInput[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSubmittedSuccess(false);

    const effectiveCollege =
      form.collegeName === 'Other College / Institution' && customCollege.trim()
        ? customCollege.trim()
        : form.collegeName;

    const payload: SurveyInput = { ...form, collegeName: effectiveCollege };
    const validation = validateSurveyInput(payload);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...payload, _hp: honeypot }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        setServerError(data.error || 'Could not submit survey response.');
        return;
      }

      setForm(INITIAL_FORM);
      setCustomCollege('');
      setHoneypot('');
      setErrors({});
      setSubmittedSuccess(true);
      await onSubmitted();
    } catch {
      setServerError('Network error while saving your response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="theme-surface rounded-lg border p-6">
        <p className="theme-accent-text text-xs font-semibold tracking-wide">
          Primary Field Data Collection · Anonymous Questionnaire
        </p>
        <h1 className="theme-heading mt-1 text-2xl font-bold">
          Android Smartphone Usage Survey
        </h1>
        <p className="theme-muted mt-2 text-sm">
          All submitted responses are stored directly in the SQLite research database as real survey entries and automatically update the analytics dashboard, data table, and findings.
        </p>
      </section>

      {submittedSuccess && (
        <div
          role="status"
          className="flex flex-col justify-between gap-4 rounded-lg border border-emerald-300 bg-emerald-50 p-5 text-emerald-950 sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <p className="text-sm font-semibold">Survey response recorded in database</p>
              <p className="mt-0.5 text-xs text-emerald-800">
                Your entry has been saved as an actual survey submission and all charts have been recalculated.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="rounded-md bg-emerald-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-900 whitespace-nowrap"
            >
              View Analytics
            </button>
            <button
              type="button"
              onClick={() => onNavigate('table')}
              className="rounded-md border border-emerald-400 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 whitespace-nowrap"
            >
              View Data Table
            </button>
          </div>
        </div>
      )}

      {serverError && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {serverError}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="theme-surface space-y-6 rounded-lg border p-6 sm:p-8"
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="ageGroup" className="theme-heading block text-sm font-medium">
              1. Age Group <span className="text-red-500">*</span>
            </label>
            <select
              id="ageGroup"
              value={form.ageGroup}
              onChange={(e) => updateField('ageGroup', e.target.value)}
              className="theme-surface mt-1.5 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
            >
              <option value="">Select age group</option>
              {AGE_GROUPS.map((age) => (
                <option key={age} value={age}>
                  {age} years
                </option>
              ))}
            </select>
            {errors.ageGroup && <p className="mt-1 text-xs text-red-500">{errors.ageGroup}</p>}
          </div>

          <div>
            <label htmlFor="gender" className="theme-heading block text-sm font-medium">
              2. Gender (Optional)
            </label>
            <select
              id="gender"
              value={form.gender}
              onChange={(e) => updateField('gender', e.target.value)}
              className="theme-surface mt-1.5 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
            >
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            {errors.gender && <p className="mt-1 text-xs text-red-500">{errors.gender}</p>}
          </div>

          <div>
            <label htmlFor="occupation" className="theme-heading block text-sm font-medium">
              3. Occupation <span className="text-red-500">*</span>
            </label>
            <select
              id="occupation"
              value={form.occupation}
              onChange={(e) => updateField('occupation', e.target.value)}
              className="theme-surface mt-1.5 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
            >
              <option value="">Select occupation</option>
              {OCCUPATIONS.map((occ) => (
                <option key={occ} value={occ}>
                  {occ}
                </option>
              ))}
            </select>
            {errors.occupation && <p className="mt-1 text-xs text-red-500">{errors.occupation}</p>}
          </div>

          <div>
            <label htmlFor="collegeName" className="theme-heading block text-sm font-medium">
              College / Institution (Optional)
            </label>
            <select
              id="collegeName"
              value={form.collegeName}
              onChange={(e) => updateField('collegeName', e.target.value)}
              className="theme-surface mt-1.5 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
            >
              {COLLEGE_OPTIONS.map((college) => (
                <option key={college} value={college}>
                  {college}
                </option>
              ))}
            </select>
            {form.collegeName === 'Other College / Institution' && (
              <input
                type="text"
                placeholder="Enter college or institution name"
                value={customCollege}
                onChange={(e) => setCustomCollege(e.target.value)}
                className="theme-surface mt-2 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
              />
            )}
          </div>

          <div>
            <label htmlFor="smartphoneBrand" className="theme-heading block text-sm font-medium">
              4. Android Smartphone Brand <span className="text-red-500">*</span>
            </label>
            <select
              id="smartphoneBrand"
              value={form.smartphoneBrand}
              onChange={(e) => updateField('smartphoneBrand', e.target.value)}
              className="theme-surface mt-1.5 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
            >
              <option value="">Select brand</option>
              {SMARTPHONE_BRANDS.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
            {errors.smartphoneBrand && (
              <p className="mt-1 text-xs text-red-500">{errors.smartphoneBrand}</p>
            )}
          </div>

          <div>
            <label htmlFor="yearsOfUsage" className="theme-heading block text-sm font-medium">
              5. Years of Smartphone Usage <span className="text-red-500">*</span>
            </label>
            <select
              id="yearsOfUsage"
              value={form.yearsOfUsage}
              onChange={(e) => updateField('yearsOfUsage', e.target.value)}
              className="theme-surface mt-1.5 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
            >
              <option value="">Select duration</option>
              {USAGE_DURATIONS.map((dur) => (
                <option key={dur} value={dur}>
                  {dur}
                </option>
              ))}
            </select>
            {errors.yearsOfUsage && (
              <p className="mt-1 text-xs text-red-500">{errors.yearsOfUsage}</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="avgDailyHours" className="theme-heading block text-sm font-medium">
              6. Average Daily Usage (Hours) <span className="text-red-500">*</span>
            </label>
            <input
              id="avgDailyHours"
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              placeholder="e.g. 5.5"
              value={form.avgDailyHours}
              onChange={(e) => updateField('avgDailyHours', e.target.value)}
              className="theme-surface mt-1.5 block w-full rounded-md border px-3 py-2 font-mono text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)] sm:max-w-xs"
            />
            {errors.avgDailyHours && (
              <p className="mt-1 text-xs text-red-500">{errors.avgDailyHours}</p>
            )}
          </div>
        </div>

        <fieldset className="border-t border-[var(--border-subtle)] pt-5">
          <legend className="theme-heading text-sm font-medium">
            7. Most Frequently Used Applications <span className="text-red-500">*</span>
          </legend>
          <p className="theme-muted mt-0.5 text-xs">Select all applications you use regularly.</p>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {APPLICATION_OPTIONS.map((app) => {
              const checked = form.frequentApps.includes(app);
              return (
                <label
                  key={app}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors ${
                    checked
                      ? 'border-[var(--accent-secondary)] bg-[var(--accent-soft)] font-medium'
                      : 'theme-surface hover:opacity-90'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleApp(app)}
                    className="h-4 w-4 rounded"
                  />
                  <span className="truncate">{app}</span>
                </label>
              );
            })}
          </div>
          {errors.frequentApps && (
            <p className="mt-1.5 text-xs text-red-500">{errors.frequentApps}</p>
          )}
        </fieldset>

        <div className="grid grid-cols-1 gap-5 border-t border-[var(--border-subtle)] pt-5 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label htmlFor="primaryPurpose" className="theme-heading block text-sm font-medium">
              8. Primary Purpose <span className="text-red-500">*</span>
            </label>
            <select
              id="primaryPurpose"
              value={form.primaryPurpose}
              onChange={(e) => updateField('primaryPurpose', e.target.value)}
              className="theme-surface mt-1.5 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
            >
              <option value="">Select purpose</option>
              {PRIMARY_PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {errors.primaryPurpose && (
              <p className="mt-1 text-xs text-red-500">{errors.primaryPurpose}</p>
            )}
          </div>

          <div>
            <label htmlFor="eduWorkHours" className="theme-heading block text-sm font-medium">
              9. Daily Edu / Work Usage (hrs) <span className="text-red-500">*</span>
            </label>
            <input
              id="eduWorkHours"
              type="number"
              min="0"
              max="24"
              step="0.5"
              placeholder="e.g. 2.5"
              value={form.eduWorkHours}
              onChange={(e) => updateField('eduWorkHours', e.target.value)}
              className="theme-surface mt-1.5 block w-full rounded-md border px-3 py-2 font-mono text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
            />
            {errors.eduWorkHours && (
              <p className="mt-1 text-xs text-red-500">{errors.eduWorkHours}</p>
            )}
          </div>

          <div>
            <label htmlFor="entertainmentHours" className="theme-heading block text-sm font-medium">
              10. Entertainment Usage (hrs) <span className="text-red-500">*</span>
            </label>
            <input
              id="entertainmentHours"
              type="number"
              min="0"
              max="24"
              step="0.5"
              placeholder="e.g. 2.0"
              value={form.entertainmentHours}
              onChange={(e) => updateField('entertainmentHours', e.target.value)}
              className="theme-surface mt-1.5 block w-full rounded-md border px-3 py-2 font-mono text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
            />
            {errors.entertainmentHours && (
              <p className="mt-1 text-xs text-red-500">{errors.entertainmentHours}</p>
            )}
          </div>
        </div>

        <fieldset className="border-t border-[var(--border-subtle)] pt-5">
          <legend className="theme-heading text-sm font-medium">
            11. Awareness of Smartphone Privacy & Security <span className="text-red-500">*</span>
          </legend>
          <div className="mt-3 space-y-2">
            {PRIVACY_AWARENESS_LEVELS.map((level) => {
              const selected = form.privacyAwareness === level;
              return (
                <label
                  key={level}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border px-3.5 py-2.5 text-sm transition-colors ${
                    selected
                      ? 'border-[var(--accent-secondary)] bg-[var(--accent-soft)] font-medium'
                      : 'theme-surface hover:opacity-90'
                  }`}
                >
                  <input
                    type="radio"
                    name="privacyAwareness"
                    value={level}
                    checked={selected}
                    onChange={(e) => updateField('privacyAwareness', e.target.value)}
                    className="h-4 w-4"
                  />
                  <span>{PRIVACY_AWARENESS_LABELS[level]}</span>
                </label>
              );
            })}
          </div>
          {errors.privacyAwareness && (
            <p className="mt-1.5 text-xs text-red-500">{errors.privacyAwareness}</p>
          )}
        </fieldset>

        <div className="border-t border-[var(--border-subtle)] pt-5">
          <label htmlFor="excessiveUsageOpinion" className="theme-heading block text-sm font-medium">
            12. Opinion on Excessive Smartphone Usage & Key Benefits/Challenges{' '}
            <span className="text-red-500">*</span>
          </label>
          <textarea
            id="excessiveUsageOpinion"
            rows={3}
            maxLength={600}
            placeholder="Share how Android usage helps your work/study and any concerns about excessive screen time or privacy..."
            value={form.excessiveUsageOpinion}
            onChange={(e) => updateField('excessiveUsageOpinion', e.target.value)}
            className="theme-surface mt-1.5 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-secondary)]"
          />
          <div className="theme-muted mt-1 flex items-center justify-between text-xs">
            <span>
              {errors.excessiveUsageOpinion ? (
                <span className="text-red-500">{errors.excessiveUsageOpinion}</span>
              ) : (
                'Minimum 10 characters'
              )}
            </span>
            <span className="font-mono tabular-nums">{form.excessiveUsageOpinion.length}/600</span>
          </div>
        </div>

        {/* Honeypot anti-bot field */}
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="survey-hp-field">Leave empty</label>
          <input
            id="survey-hp-field"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border-subtle)] pt-5">
          <button
            type="button"
            onClick={() => {
              setForm(INITIAL_FORM);
              setCustomCollege('');
              setErrors({});
              setServerError(null);
            }}
            className="theme-surface rounded-md border px-4 py-2 text-sm font-medium hover:opacity-90 whitespace-nowrap"
          >
            Reset Form
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="theme-btn-primary rounded-md px-6 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {submitting ? 'Submitting...' : 'Submit Survey Response'}
          </button>
        </div>
      </form>
    </div>
  );
};
