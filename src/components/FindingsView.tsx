import React from 'react';
import { DatasetCounts, DatasetScope, FindingsReport, SectionId } from '../types/survey';

interface FindingsViewProps {
  findings: FindingsReport;
  counts: DatasetCounts;
  scope: DatasetScope;
  onScopeChange: (scope: DatasetScope) => void;
  onNavigate: (section: SectionId) => void;
}

export const FindingsView: React.FC<FindingsViewProps> = ({
  findings,
  counts,
  scope,
  onScopeChange,
  onNavigate,
}) => {
  return (
    <div className="space-y-6">
      <section className="theme-surface flex flex-col justify-between gap-4 rounded-lg border p-6 sm:flex-row sm:items-center">
        <div>
          <p className="theme-accent-text text-xs font-semibold tracking-wide">
            Evidence-Driven Synthesis · Computed Strictly from Stored Data
          </p>
          <h1 className="theme-heading mt-1 text-2xl font-bold">Findings & Observations</h1>
          <p className="theme-muted mt-1 text-sm">
            All metrics and conclusions below are generated directly from{' '}
            <span className="theme-heading font-mono font-semibold tabular-nums">
              {findings.totalAnalyzed}
            </span>{' '}
            stored response(s) ({findings.realCount} real · {findings.sampleCount} sample demo).
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
            All ({counts.total})
          </button>
          <button
            type="button"
            onClick={() => onScopeChange('real')}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              scope === 'real' ? 'theme-btn-primary shadow-xs' : 'theme-muted hover:opacity-90'
            }`}
          >
            Real Only ({counts.realCount})
          </button>
        </div>
      </section>

      {!findings.hasData ? (
        <section className="theme-surface rounded-lg border p-8 text-center">
          <h2 className="theme-heading text-lg font-semibold">
            No Survey Data Available in Current View
          </h2>
          <p className="theme-muted mx-auto mt-2 max-w-xl text-sm">
            {findings.ageGroupComparisonSummary}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('survey')}
              className="theme-btn-primary rounded-md px-4 py-2 text-xs font-semibold"
            >
              Submit Survey Response
            </button>
            <button
              type="button"
              onClick={() => onScopeChange('all')}
              className="theme-surface rounded-md border px-4 py-2 text-xs font-semibold hover:opacity-90"
            >
              Include Sample Demo Data
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="theme-surface rounded-lg border p-6">
              <h2 className="theme-heading text-base font-semibold">
                01. Highest & Lowest Usage Categories
              </h2>
              <p className="theme-muted mt-2 text-sm leading-relaxed">
                {findings.highestUsageOccupation ? (
                  <>
                    Among analyzed occupations,{' '}
                    <span className="theme-heading font-semibold">
                      {findings.highestUsageOccupation.label}
                    </span>{' '}
                    respondents record the highest average daily screen time at{' '}
                    <span className="theme-accent-text font-mono font-semibold tabular-nums">
                      {findings.highestUsageOccupation.avgDailyHours} hrs/day
                    </span>{' '}
                    (n={findings.highestUsageOccupation.count}).
                    {findings.lowestUsageOccupation &&
                      findings.lowestUsageOccupation.label !==
                        findings.highestUsageOccupation.label && (
                        <>
                          {' '}
                          In contrast,{' '}
                          <span className="theme-heading font-semibold">
                            {findings.lowestUsageOccupation.label}
                          </span>{' '}
                          respondents report the lowest daily average at{' '}
                          <span className="theme-heading font-mono font-semibold tabular-nums">
                            {findings.lowestUsageOccupation.avgDailyHours} hrs/day
                          </span>{' '}
                          (n={findings.lowestUsageOccupation.count}).
                        </>
                      )}
                  </>
                ) : (
                  'Insufficient occupational records.'
                )}
              </p>
            </section>

            <section className="theme-surface rounded-lg border p-6">
              <h2 className="theme-heading text-base font-semibold">
                02. Most Popular Android Applications
              </h2>
              <p className="theme-muted mt-2 text-sm leading-relaxed">
                The top applications cited by respondents reflect daily communication, video learning, and digital utility habits:
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {findings.topApplications.map((app) => (
                  <li key={app.label} className="theme-muted flex items-center justify-between">
                    <span>{app.label}</span>
                    <span className="theme-heading font-mono text-xs font-semibold tabular-nums">
                      {app.count} / {findings.totalAnalyzed} ({app.percentage}%)
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="theme-surface rounded-lg border p-6">
              <h2 className="theme-heading text-base font-semibold">
                03. Main Purposes & Functional Balance
              </h2>
              <p className="theme-muted mt-2 text-sm leading-relaxed">
                {findings.leadingPurpose && (
                  <>
                    The primary reason selected most frequently is{' '}
                    <span className="theme-heading font-semibold">
                      {findings.leadingPurpose.label}
                    </span>{' '}
                    ({findings.leadingPurpose.percentage}% of respondents)
                    {findings.secondaryPurpose && (
                      <>
                        , followed by{' '}
                        <span className="theme-heading font-semibold">
                          {findings.secondaryPurpose.label}
                        </span>{' '}
                        ({findings.secondaryPurpose.percentage}%)
                      </>
                    )}
                    .
                  </>
                )}{' '}
                Across the dataset, educational/work usage averages{' '}
                <span className="theme-heading font-mono font-semibold tabular-nums">
                  {findings.eduVsEntertainmentRatio.avgEduWorkHours} hrs/day
                </span>{' '}
                versus{' '}
                <span className="theme-heading font-mono font-semibold tabular-nums">
                  {findings.eduVsEntertainmentRatio.avgEntertainmentHours} hrs/day
                </span>{' '}
                for entertainment ({findings.eduVsEntertainmentRatio.dominantFocus} focus overall).
              </p>
            </section>

            <section className="theme-surface rounded-lg border p-6">
              <h2 className="theme-heading text-base font-semibold">
                04. Differences Across Age Groups & Privacy Awareness
              </h2>
              <p className="theme-muted mt-2 text-sm leading-relaxed">
                {findings.ageGroupComparisonSummary}
              </p>
              <p className="theme-muted mt-3 text-sm leading-relaxed">
                Regarding digital security,{' '}
                <span className="theme-heading font-mono font-semibold tabular-nums">
                  {findings.privacyHighPercentage}%
                </span>{' '}
                report High privacy awareness, while{' '}
                <span className="theme-accent-text font-mono font-semibold tabular-nums">
                  {findings.privacyLowPercentage}%
                </span>{' '}
                report Low awareness—highlighting clear opportunities for targeted community cybersecurity outreach.
              </p>
            </section>
          </div>

          <section className="theme-surface rounded-lg border p-6">
            <h2 className="theme-heading text-base font-semibold">
              05. Benefits & Challenges Reported by Respondents
            </h2>
            <p className="theme-muted mt-1 text-xs">
              Direct qualitative observations submitted in the questionnaire (with data source clearly noted).
            </p>
            <div className="mt-4 divide-y divide-[var(--border-subtle)]">
              {findings.sampleOpinions.map((item) => (
                <div key={item.id} className="py-3">
                  <div className="theme-muted flex flex-wrap items-center gap-2 text-xs">
                    <span className="theme-heading font-semibold">{item.occupation}</span>
                    <span aria-hidden="true">·</span>
                    <span>Age {item.ageGroup}</span>
                    <span aria-hidden="true">·</span>
                    <span className={item.isSample ? 'theme-accent-text' : 'theme-heading font-medium'}>
                      {item.isSample ? 'Sample Demo' : 'Real Submission'}
                    </span>
                  </div>
                  <p className="theme-muted mt-1 text-sm">&ldquo;{item.opinion}&rdquo;</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
