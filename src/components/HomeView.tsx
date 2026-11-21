import React from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  ClipboardList,
  FileSearch,
  Table2,
  Users,
} from 'lucide-react';
import {
  AnalyticsSummary,
  DatasetCounts,
  ProjectSettings,
  SectionId,
  SurveyResponse,
  TEAM_MEMBERS,
} from '../types/survey';
import { Vision360Panel } from './Vision360Panel';

interface HomeViewProps {
  counts: DatasetCounts;
  realAnalytics: AnalyticsSummary;
  allAnalytics: AnalyticsSummary;
  allResponses: SurveyResponse[];
  settings: ProjectSettings;
  onNavigate: (section: SectionId) => void;
}

const OBJECTIVES = [
  'Measure daily Android smartphone usage hours across distinct age groups and occupational categories.',
  'Identify the most frequently used applications and primary usage purposes (education, work, business, communication, entertainment).',
  'Evaluate respondent awareness regarding Android app permissions, security hygiene, and digital privacy.',
  'Synthesize community-grounded observations and practical digital wellbeing recommendations from verified survey data.',
];

export const HomeView: React.FC<HomeViewProps> = ({
  counts,
  realAnalytics,
  allAnalytics,
  allResponses,
  settings,
  onNavigate,
}) => {
  return (
    <div className="space-y-8">
      <section className="theme-surface rounded-lg border p-6 sm:p-8">
        <div className="theme-accent-text flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide">
          <span>B.Tech Community Service Project (CSP)</span>
          <span aria-hidden="true">·</span>
          <span>Vision 360° Research Portal</span>
          <span aria-hidden="true">·</span>
          <span>{settings.collegeName}</span>
        </div>

        <h1 className="theme-heading mt-2 max-w-3xl text-2xl font-bold tracking-tight sm:text-4xl [text-wrap:balance]">
          Android Phone Usage by Different People
        </h1>
        <p className="theme-muted mt-4 max-w-3xl text-base leading-relaxed">
          This research portal collects, validates, stores, and analyzes real-world survey responses on how individuals from different age groups and professions use Android smartphones in daily life. Submitted responses are stored persistently in SQLite and reflected live across analytics charts, data tables, and evidence-based findings.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('survey')}
            className="theme-btn-primary inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <span>Submit Survey Response</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('analytics')}
            className="theme-surface inline-flex items-center gap-2 rounded-md border px-5 py-2.5 text-sm font-semibold transition-colors hover:opacity-90 whitespace-nowrap"
          >
            <BarChart3 className="theme-accent-text h-4 w-4" />
            <span>Open Analytics Dashboard</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('assistant')}
            className="theme-surface inline-flex items-center gap-2 rounded-md border px-5 py-2.5 text-sm font-semibold transition-colors hover:opacity-90 whitespace-nowrap"
          >
            <Bot className="theme-accent-text h-4 w-4" />
            <span>Ask AI Research Bot</span>
          </button>
        </div>
      </section>

      <section aria-label="Survey Response Counters" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="theme-surface rounded-lg border p-5">
          <p className="theme-muted text-xs font-medium">Actual Survey Responses</p>
          <p className="theme-heading mt-2 font-mono text-3xl font-semibold tabular-nums">
            {counts.realCount}
          </p>
          <p className="theme-muted mt-1 text-xs">Submitted via live survey form</p>
        </div>

        <div className="theme-surface rounded-lg border p-5">
          <p className="theme-muted text-xs font-medium">Sample Demo Records</p>
          <p className="theme-accent-text mt-2 font-mono text-3xl font-semibold tabular-nums">
            {counts.sampleCount}
          </p>
          <p className="theme-muted mt-1 text-xs">Clearly labelled demonstration dataset</p>
        </div>

        <div className="theme-surface rounded-lg border p-5">
          <p className="theme-muted text-xs font-medium">Avg. Daily Usage (Real)</p>
          <p className="theme-heading mt-2 font-mono text-3xl font-semibold tabular-nums">
            {counts.realCount > 0 ? `${realAnalytics.avgDailyHours} hrs` : '—'}
          </p>
          <p className="theme-muted mt-1 text-xs">
            {counts.realCount > 0 ? 'Calculated from actual submissions' : 'Awaiting first real submission'}
          </p>
        </div>

        <div className="theme-surface rounded-lg border p-5">
          <p className="theme-muted text-xs font-medium">Studied Categories</p>
          <p className="theme-heading mt-2 font-mono text-3xl font-semibold tabular-nums">6</p>
          <p className="theme-muted mt-1 text-xs">Students to Senior Citizens</p>
        </div>
      </section>

      <Vision360Panel analytics={allAnalytics} responses={allResponses} />

      <section className="theme-surface rounded-lg border p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="theme-accent-text h-4 w-4" />
              <p className="theme-accent-text text-xs font-semibold tracking-wide">
                {settings.academicBatch}
              </p>
            </div>
            <h2 className="theme-heading mt-1 text-lg font-semibold">
              Project Team & Institution Attribution
            </h2>
            <p className="theme-muted mt-0.5 text-sm">
              {settings.collegeName} · {settings.department}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className="theme-surface rounded-md border px-3 py-1.5 text-xs font-medium hover:opacity-90 whitespace-nowrap"
          >
            Edit College Name in Admin
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="theme-surface-muted border-b border-[var(--border-subtle)] text-xs font-semibold">
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Student Name</th>
                <th className="px-3 py-2.5">Roll Number</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {TEAM_MEMBERS.map((member, index) => (
                <tr key={member.rollNumber}>
                  <td className="theme-muted px-3 py-2.5 font-mono text-xs tabular-nums">
                    0{index + 1}
                  </td>
                  <td className="theme-heading px-3 py-2.5 font-semibold">{member.name}</td>
                  <td className="theme-accent-text px-3 py-2.5 font-mono text-xs font-semibold tabular-nums">
                    {member.rollNumber}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="theme-surface rounded-lg border p-6 lg:col-span-7">
          <h2 className="theme-heading text-lg font-semibold">Project Objectives</h2>
          <p className="theme-muted mt-1 text-sm">
            Core research milestones guiding field data collection and analysis.
          </p>
          <ol className="mt-5 space-y-3">
            {OBJECTIVES.map((objective, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 border-b border-[var(--border-subtle)] pb-3 last:border-b-0 last:pb-0"
              >
                <span className="theme-accent-text font-mono text-xs font-semibold pt-0.5 tabular-nums">
                  0{idx + 1}.
                </span>
                <span className="theme-muted text-sm leading-relaxed">{objective}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="theme-surface rounded-lg border p-6 lg:col-span-5">
          <h2 className="theme-heading text-lg font-semibold">Explore Research Sections</h2>
          <p className="theme-muted mt-1 text-sm">
            Navigate directly to study documentation, data collection, or reporting views.
          </p>
          <div className="mt-4 divide-y divide-[var(--border-subtle)]">
            {[
              { id: 'about' as SectionId, title: 'About the Project', desc: 'Need, scope, methodology & target population', icon: BookOpen },
              { id: 'categories' as SectionId, title: 'User Categories', desc: '6 demographic profiles & typical usage habits', icon: Users },
              { id: 'survey' as SectionId, title: 'Survey Questionnaire', desc: '12-field validated Android usage survey', icon: ClipboardList },
              { id: 'table' as SectionId, title: 'Data Table & CSV Export', desc: 'Search, filter, sort & export collected responses', icon: Table2 },
              { id: 'findings' as SectionId, title: 'Findings & Observations', desc: 'Evidence summary computed from stored data', icon: FileSearch },
              { id: 'assistant' as SectionId, title: 'AI Research Bot', desc: 'Ask Gemini AI about survey metrics and findings', icon: Bot },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-3 text-left transition-colors hover:bg-[var(--bg-surface-muted)]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon className="theme-accent-text h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="theme-heading text-sm font-medium">{item.title}</p>
                      <p className="theme-muted truncate text-xs">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="theme-muted h-4 w-4 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
