import React, { useMemo } from 'react';
import { ChartConfiguration } from 'chart.js/auto';
import {
  AnalyticsSummary,
  DatasetCounts,
  DatasetScope,
  SectionId,
  ThemeId,
} from '../types/survey';
import { ChartCard } from './ChartCard';

interface AnalyticsViewProps {
  analytics: AnalyticsSummary;
  counts: DatasetCounts;
  scope: DatasetScope;
  onScopeChange: (scope: DatasetScope) => void;
  onNavigate: (section: SectionId) => void;
  theme: ThemeId;
}

const CHART_PALETTE = [
  '#0F2547',
  '#6D28D9',
  '#2563EB',
  '#A855F7',
  '#475569',
  '#0284C7',
  '#94A3B8',
];

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  analytics,
  counts,
  scope,
  onScopeChange,
  onNavigate,
  theme,
}) => {
  const hasData = analytics.totalResponses > 0;
  const isDark = theme === 'dark';
  const tickColor = isDark ? '#CBD5E1' : '#475569';
  const gridColor = isDark ? '#1E293B' : '#F1F5F9';
  const borderColor = isDark ? '#111827' : '#FFFFFF';
  const primaryBarColor =
    theme === 'emerald'
      ? '#065F46'
      : theme === 'indigo'
      ? '#312E81'
      : isDark
      ? '#6366F1'
      : '#1E3A8A';
  const secondaryBarColor =
    theme === 'emerald' ? '#0D9488' : isDark ? '#A78BFA' : '#6D28D9';

  const appsChartConfig = useMemo<ChartConfiguration>(
    () => ({
      type: 'bar',
      data: {
        labels: analytics.appsDistribution.map((a) => a.label),
        datasets: [
          {
            label: 'Respondents Using App',
            data: analytics.appsDistribution.map((a) => a.count),
            backgroundColor: primaryBarColor,
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { precision: 0, color: tickColor },
            grid: { color: gridColor },
          },
          y: {
            ticks: { color: tickColor },
            grid: { display: false },
          },
        },
      },
    }),
    [analytics.appsDistribution, primaryBarColor, tickColor, gridColor]
  );

  const ageChartConfig = useMemo<ChartConfiguration>(
    () => ({
      type: 'bar',
      data: {
        labels: analytics.usageByAgeGroup.map((g) => g.label),
        datasets: [
          {
            label: 'Avg Daily Hours',
            data: analytics.usageByAgeGroup.map((g) => g.avgDailyHours),
            backgroundColor: secondaryBarColor,
            borderRadius: 4,
          },
          {
            label: 'Avg Edu/Work Hours',
            data: analytics.usageByAgeGroup.map((g) => g.avgEduWorkHours),
            backgroundColor: primaryBarColor,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: tickColor } },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Hours / Day', color: tickColor },
            ticks: { color: tickColor },
            grid: { color: gridColor },
          },
          x: {
            ticks: { color: tickColor },
            grid: { display: false },
          },
        },
      },
    }),
    [analytics.usageByAgeGroup, primaryBarColor, secondaryBarColor, tickColor, gridColor]
  );

  const occupationChartConfig = useMemo<ChartConfiguration>(
    () => ({
      type: 'bar',
      data: {
        labels: analytics.usageByOccupation.map((o) => o.label),
        datasets: [
          {
            label: 'Avg Daily Hours',
            data: analytics.usageByOccupation.map((o) => o.avgDailyHours),
            backgroundColor: primaryBarColor,
            borderRadius: 4,
          },
          {
            label: 'Avg Entertainment Hours',
            data: analytics.usageByOccupation.map((o) => o.avgEntertainmentHours),
            backgroundColor: secondaryBarColor,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: tickColor } },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Hours / Day', color: tickColor },
            ticks: { color: tickColor },
            grid: { color: gridColor },
          },
          x: {
            ticks: { color: tickColor },
            grid: { display: false },
          },
        },
      },
    }),
    [analytics.usageByOccupation, primaryBarColor, secondaryBarColor, tickColor, gridColor]
  );

  const purposeChartConfig = useMemo<ChartConfiguration>(
    () => ({
      type: 'doughnut',
      data: {
        labels: analytics.purposeDistribution.map((p) => p.label),
        datasets: [
          {
            data: analytics.purposeDistribution.map((p) => p.count),
            backgroundColor: CHART_PALETTE,
            borderWidth: 2,
            borderColor,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: tickColor } },
        },
      },
    }),
    [analytics.purposeDistribution, borderColor, tickColor]
  );

  const privacyChartConfig = useMemo<ChartConfiguration>(
    () => ({
      type: 'pie',
      data: {
        labels: analytics.privacyDistribution.map((p) => `${p.label} Awareness`),
        datasets: [
          {
            data: analytics.privacyDistribution.map((p) => p.count),
            backgroundColor: [primaryBarColor, secondaryBarColor, '#94A3B8'],
            borderWidth: 2,
            borderColor,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: tickColor } },
        },
      },
    }),
    [analytics.privacyDistribution, primaryBarColor, secondaryBarColor, borderColor, tickColor]
  );

  return (
    <div className="space-y-6">
      <section className="theme-surface flex flex-col justify-between gap-4 rounded-lg border p-6 sm:flex-row sm:items-center">
        <div>
          <p className="theme-accent-text text-xs font-semibold tracking-wide">
            Live SQLite Aggregation · Chart.js Visualizations
          </p>
          <h1 className="theme-heading mt-1 text-2xl font-bold">Analytics Dashboard</h1>
          <p className="theme-muted mt-1 text-sm">
            Currently analyzing{' '}
            <span className="theme-heading font-mono font-semibold tabular-nums">
              {analytics.totalResponses}
            </span>{' '}
            records ({analytics.realResponses} real submissions · {analytics.sampleResponses} sample demo records).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="theme-surface-muted flex items-center gap-1 rounded-md border p-1">
            <button
              type="button"
              onClick={() => onScopeChange('all')}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                scope === 'all'
                  ? 'theme-btn-primary shadow-xs'
                  : 'theme-muted hover:opacity-90'
              }`}
            >
              All ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => onScopeChange('real')}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                scope === 'real'
                  ? 'theme-btn-primary shadow-xs'
                  : 'theme-muted hover:opacity-90'
              }`}
            >
              Real Only ({counts.realCount})
            </button>
          </div>
        </div>
      </section>

      {!hasData && (
        <div className="theme-surface flex flex-col items-start justify-between gap-4 rounded-lg border p-6 sm:flex-row sm:items-center">
          <div>
            <p className="theme-heading text-sm font-semibold">
              No real survey submissions recorded yet
            </p>
            <p className="theme-muted mt-1 text-xs">
              Submit the first live survey entry or switch to &ldquo;All&rdquo; to inspect the clearly labelled sample demonstration dataset.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('survey')}
              className="theme-btn-primary rounded-md px-4 py-2 text-xs font-semibold whitespace-nowrap"
            >
              Submit First Survey
            </button>
            <button
              type="button"
              onClick={() => onScopeChange('all')}
              className="theme-surface rounded-md border px-4 py-2 text-xs font-semibold hover:opacity-90 whitespace-nowrap"
            >
              Show Sample Demo
            </button>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="theme-surface rounded-lg border p-5">
          <p className="theme-muted text-xs font-medium">Total Analyzed Responses</p>
          <p className="theme-heading mt-2 font-mono text-3xl font-semibold tabular-nums">
            {analytics.totalResponses}
          </p>
          <p className="theme-muted mt-1 text-xs">
            {analytics.realResponses} real · {analytics.sampleResponses} sample demo
          </p>
        </div>

        <div className="theme-surface rounded-lg border p-5">
          <p className="theme-muted text-xs font-medium">Avg. Daily Smartphone Usage</p>
          <p className="theme-accent-text mt-2 font-mono text-3xl font-semibold tabular-nums">
            {hasData ? `${analytics.avgDailyHours} hrs` : '—'}
          </p>
          <p className="theme-muted mt-1 text-xs">
            Edu/Work {analytics.avgEduWorkHours} hrs · Ent {analytics.avgEntertainmentHours} hrs
          </p>
        </div>

        <div className="theme-surface rounded-lg border p-5">
          <p className="theme-muted text-xs font-medium">Most Common Occupation</p>
          <p className="theme-heading mt-2 truncate text-xl font-semibold">
            {analytics.mostCommonOccupation ? analytics.mostCommonOccupation.label : '—'}
          </p>
          <p className="theme-muted mt-1 font-mono text-xs tabular-nums">
            {analytics.mostCommonOccupation
              ? `${analytics.mostCommonOccupation.count} respondents (${analytics.mostCommonOccupation.percentage}%)`
              : 'No data'}
          </p>
        </div>

        <div className="theme-surface rounded-lg border p-5">
          <p className="theme-muted text-xs font-medium">Top Used Application</p>
          <p className="theme-heading mt-2 truncate text-xl font-semibold">
            {analytics.topApplication ? analytics.topApplication.label : '—'}
          </p>
          <p className="theme-muted mt-1 font-mono text-xs tabular-nums">
            {analytics.topApplication
              ? `${analytics.topApplication.count} mentions (${analytics.topApplication.percentage}%)`
              : 'No data'}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Most Frequently Used Applications"
          subtitle="Number of respondents selecting each Android application"
          config={appsChartConfig}
          testId="chart-apps"
          hasData={hasData}
          theme={theme}
        />
        <ChartCard
          title="Main Reasons for Smartphone Usage"
          subtitle="Distribution of respondents by primary purpose"
          config={purposeChartConfig}
          testId="chart-purpose"
          hasData={hasData}
          theme={theme}
        />
        <ChartCard
          title="Usage Comparison by Age Group"
          subtitle="Average total daily hours vs educational/work hours"
          config={ageChartConfig}
          testId="chart-age"
          hasData={hasData}
          theme={theme}
        />
        <ChartCard
          title="Usage Comparison by Occupation"
          subtitle="Average total daily hours vs entertainment hours"
          config={occupationChartConfig}
          testId="chart-occupation"
          hasData={hasData}
          theme={theme}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <ChartCard
            title="Privacy & Security Awareness"
            subtitle="Self-reported awareness of permissions, 2FA, and updates"
            config={privacyChartConfig}
            testId="chart-privacy"
            hasData={hasData}
            theme={theme}
          />
        </div>
        <section className="theme-surface rounded-lg border p-5 lg:col-span-7">
          <h2 className="theme-heading text-base font-semibold">Device Brand Distribution</h2>
          <p className="theme-muted mt-0.5 text-xs">
            Observed Android hardware share across analyzed respondents
          </p>
          {hasData ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="theme-muted border-b border-[var(--border-subtle)] text-xs font-semibold">
                    <th className="py-2 pr-4">Android Brand</th>
                    <th className="py-2 pr-4 text-right">Respondents</th>
                    <th className="py-2 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {analytics.brandDistribution.map((b) => (
                    <tr key={b.label}>
                      <td className="theme-heading py-2.5 pr-4 font-medium">{b.label}</td>
                      <td className="theme-muted py-2.5 pr-4 text-right font-mono tabular-nums">
                        {b.count}
                      </td>
                      <td className="theme-muted py-2.5 text-right font-mono tabular-nums">
                        {b.percentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="theme-muted mt-6 text-sm">No device records to display.</p>
          )}
        </section>
      </div>
    </div>
  );
};
