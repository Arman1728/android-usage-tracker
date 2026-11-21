import React from 'react';
import { USER_CATEGORY_PROFILES } from '../data/sampleSeed';
import { AnalyticsSummary, DatasetScope, SectionId } from '../types/survey';

interface CategoriesViewProps {
  analytics: AnalyticsSummary;
  scope: DatasetScope;
  onScopeChange: (scope: DatasetScope) => void;
  onNavigate: (section: SectionId) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  analytics,
  scope,
  onScopeChange,
  onNavigate,
}) => {
  return (
    <div className="space-y-6">
      <section className="theme-surface flex flex-col justify-between gap-4 rounded-lg border p-6 sm:flex-row sm:items-center">
        <div>
          <p className="theme-accent-text text-xs font-semibold tracking-wide">
            Demographic Segmentation · 6 Respondent Groups
          </p>
          <h1 className="theme-heading mt-1 text-2xl font-bold">User Categories</h1>
          <p className="theme-muted mt-1 text-sm">
            Observed Android usage habits, common purposes, and frequent applications across six community groups.
          </p>
        </div>

        <div className="theme-surface-muted flex items-center gap-1 rounded-md border p-1 shrink-0">
          <button
            type="button"
            onClick={() => onScopeChange('all')}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              scope === 'all' ? 'theme-btn-primary shadow-xs' : 'theme-muted hover:opacity-90'
            }`}
          >
            All (Incl. Sample)
          </button>
          <button
            type="button"
            onClick={() => onScopeChange('real')}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              scope === 'real' ? 'theme-btn-primary shadow-xs' : 'theme-muted hover:opacity-90'
            }`}
          >
            Real Only
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {USER_CATEGORY_PROFILES.map((profile) => {
          const liveMetric = analytics.usageByOccupation.find(
            (m) => m.label === profile.occupation
          );
          return (
            <article
              key={profile.occupation}
              className="theme-surface flex flex-col justify-between rounded-lg border p-6"
            >
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border-subtle)] pb-4">
                  <div>
                    <h2 className="theme-heading text-lg font-semibold">{profile.occupation}</h2>
                    <p className="theme-muted mt-0.5 text-xs">
                      Typical age range: {profile.ageTypical}
                    </p>
                  </div>
                  <div className="theme-muted text-right font-mono text-xs tabular-nums">
                    {liveMetric && liveMetric.count > 0 ? (
                      <span>
                        n={liveMetric.count} · {liveMetric.avgDailyHours} hrs/day avg
                      </span>
                    ) : (
                      <span>No entries in current filter</span>
                    )}
                  </div>
                </div>

                <p className="theme-muted mt-4 text-sm leading-relaxed">{profile.summary}</p>

                <div className="mt-4 space-y-3">
                  <div>
                    <h3 className="theme-heading text-xs font-semibold">Typical Usage Habits</h3>
                    <ul className="theme-muted mt-1.5 space-y-1 text-xs leading-relaxed">
                      {profile.usageHabits.map((habit, idx) => (
                        <li key={idx}>• {habit}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                    <div>
                      <h3 className="theme-heading text-xs font-semibold">Primary Purposes</h3>
                      <p className="theme-muted mt-1 text-xs">
                        {profile.primaryPurposes.join(' · ')}
                      </p>
                    </div>
                    <div>
                      <h3 className="theme-heading text-xs font-semibold">Frequent Applications</h3>
                      <p className="theme-muted mt-1 text-xs">
                        {profile.commonApps.join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="theme-muted mt-5 border-t border-[var(--border-subtle)] pt-3 text-xs">
                <span className="theme-heading font-semibold">Observed challenge: </span>
                {profile.keyChallenge}
              </div>
            </article>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onNavigate('survey')}
          className="theme-btn-primary rounded-md px-5 py-2.5 text-sm font-semibold whitespace-nowrap"
        >
          Contribute a Survey Response
        </button>
      </div>
    </div>
  );
};
