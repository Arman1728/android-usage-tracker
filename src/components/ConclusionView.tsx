import React from 'react';
import { FindingsReport, ProjectSettings, SectionId, TEAM_MEMBERS } from '../types/survey';

interface ConclusionViewProps {
  findings: FindingsReport;
  settings: ProjectSettings;
  onNavigate: (section: SectionId) => void;
}

export const ConclusionView: React.FC<ConclusionViewProps> = ({
  findings,
  settings,
  onNavigate,
}) => {
  return (
    <div className="space-y-6">
      <section className="theme-surface rounded-lg border p-6 sm:p-8">
        <p className="theme-accent-text text-xs font-semibold tracking-wide">
          Project Synthesis · {settings.collegeName}
        </p>
        <h1 className="theme-heading mt-2 text-2xl font-bold sm:text-3xl">Conclusion</h1>

        <div className="theme-muted mt-4 space-y-4 text-sm leading-relaxed sm:text-base">
          <p>
            The Community Service Project &ldquo;Android Phone Usage by Different People&rdquo; demonstrates that Android smartphones are no longer uniform entertainment devices—they serve fundamentally different roles depending on age, occupation, and digital familiarity.
          </p>

          {findings.hasData ? (
            <p>
              Across the{' '}
              <span className="theme-heading font-mono font-semibold tabular-nums">
                {findings.totalAnalyzed}
              </span>{' '}
              currently analyzed response(s) ({findings.realCount} real submission(s) and{' '}
              {findings.sampleCount} sample demo record(s)),{' '}
              {findings.highestUsageOccupation && (
                <>
                  <span className="theme-heading font-semibold">
                    {findings.highestUsageOccupation.label}
                  </span>{' '}
                  respondents report the highest daily screen time (
                  <span className="theme-heading font-mono font-semibold tabular-nums">
                    {findings.highestUsageOccupation.avgDailyHours} hrs/day
                  </span>
                  ),{' '}
                </>
              )}
              {findings.leadingPurpose && (
                <>
                  with{' '}
                  <span className="theme-heading font-semibold">
                    {findings.leadingPurpose.label}
                  </span>{' '}
                  leading as the primary purpose ({findings.leadingPurpose.percentage}%),{' '}
                </>
              )}
              and{' '}
              <span className="theme-accent-text font-mono font-semibold tabular-nums">
                {findings.privacyHighPercentage}%
              </span>{' '}
              indicating high awareness of smartphone privacy and security practices.
            </p>
          ) : (
            <p>
              No survey responses are selected in the current view. Once field submissions are collected via the questionnaire, this summary automatically incorporates live statistical totals.
            </p>
          )}

          <p>
            Understanding these demographic variations is essential for designing meaningful community digital-literacy initiatives. Submitted as part of our B.Tech CSE Community Service Project by{' '}
            {TEAM_MEMBERS.map((m) => `${m.name} - ${m.rollNumber}`).join(', ')}.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-5">
          <button
            type="button"
            onClick={() => onNavigate('survey')}
            className="theme-btn-primary rounded-md px-4 py-2 text-xs font-semibold"
          >
            Add Another Response
          </button>
          <button
            type="button"
            onClick={() => onNavigate('analytics')}
            className="theme-surface rounded-md border px-4 py-2 text-xs font-semibold hover:opacity-90"
          >
            Review Analytics Charts
          </button>
          <button
            type="button"
            onClick={() => onNavigate('recommendations')}
            className="theme-surface rounded-md border px-4 py-2 text-xs font-semibold hover:opacity-90"
          >
            View Recommendations
          </button>
        </div>
      </section>
    </div>
  );
};
