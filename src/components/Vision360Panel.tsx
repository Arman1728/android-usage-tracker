import React, { useEffect, useState } from 'react';
import { Compass, Pause, Play, RotateCw } from 'lucide-react';
import { USER_CATEGORY_PROFILES } from '../data/sampleSeed';
import { AnalyticsSummary, Occupation, SurveyResponse } from '../types/survey';

interface Vision360PanelProps {
  analytics: AnalyticsSummary;
  responses: SurveyResponse[];
}

export const Vision360Panel: React.FC<Vision360PanelProps> = ({ analytics, responses }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [autoOrbit, setAutoOrbit] = useState(false);

  useEffect(() => {
    if (!autoOrbit) return;
    const timer = window.setInterval(() => {
      setSelectedIndex((prev) => (prev + 1) % USER_CATEGORY_PROFILES.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [autoOrbit]);

  const activeProfile = USER_CATEGORY_PROFILES[selectedIndex];
  const metric = analytics.usageByOccupation.find((m) => m.label === activeProfile.occupation);
  const categoryResponses = responses.filter(
    (r) => r.occupation === (activeProfile.occupation as Occupation)
  );
  const highPrivacyCount = categoryResponses.filter((r) => r.privacyAwareness === 'High').length;
  const highPrivacyPct =
    categoryResponses.length > 0
      ? Math.round((highPrivacyCount / categoryResponses.length) * 100)
      : 0;

  const angleDeg = selectedIndex * 60;
  const dailyPercent = metric ? Math.min(100, Math.round((metric.avgDailyHours / 10) * 100)) : 0;
  const circumference = 2 * Math.PI * 66;
  const dashOffset = circumference * (1 - dailyPercent / 100);

  return (
    <section
      aria-label="Vision 360 Demographic Explorer"
      className="theme-surface rounded-lg border p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="theme-accent-text h-4 w-4" />
            <p className="theme-accent-text text-xs font-semibold tracking-wide">
              Vision 360° Interactive Demographic Explorer
            </p>
          </div>
          <h2 className="theme-heading mt-1 text-lg font-semibold">
            360° Usage Perspective Across All 6 Community Groups
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoOrbit((prev) => !prev)}
            className="theme-surface inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:opacity-90 whitespace-nowrap"
          >
            {autoOrbit ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span>{autoOrbit ? 'Pause Orbit' : 'Auto-Orbit 360°'}</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedIndex((prev) => (prev + 1) % USER_CATEGORY_PROFILES.length)}
            className="theme-surface inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:opacity-90 whitespace-nowrap"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Next Sector</span>
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
        <div className="flex flex-col items-center justify-center lg:col-span-5">
          <div className="relative flex h-64 w-64 items-center justify-center">
            <svg viewBox="0 0 240 240" className="h-full w-full" aria-hidden="true">
              <circle
                cx="120"
                cy="120"
                r="96"
                fill="none"
                stroke="var(--border-subtle)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <circle
                cx="120"
                cy="120"
                r="66"
                fill="none"
                stroke="var(--border-subtle)"
                strokeWidth="8"
              />
              <circle
                cx="120"
                cy="120"
                r="66"
                fill="none"
                stroke="var(--accent-secondary)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 120 120)"
                style={{ transition: 'stroke-dashoffset 450ms cubic-bezier(0.16, 1, 0.3, 1)' }}
              />
              <g
                style={{
                  transform: `rotate(${angleDeg}deg)`,
                  transformOrigin: '120px 120px',
                  transition: 'transform 450ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <line
                  x1="120"
                  y1="120"
                  x2="120"
                  y2="24"
                  stroke="var(--accent-secondary)"
                  strokeWidth="2"
                />
                <circle cx="120" cy="24" r="5" fill="var(--accent-secondary)" />
              </g>
            </svg>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="theme-muted font-mono text-[11px] uppercase tabular-nums">
                {angleDeg}° Sector
              </span>
              <span className="theme-heading mt-0.5 font-mono text-2xl font-bold tabular-nums">
                {metric && metric.count > 0 ? `${metric.avgDailyHours}h` : '—'}
              </span>
              <span className="theme-muted text-[11px]">avg / day</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {USER_CATEGORY_PROFILES.map((profile, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={profile.occupation}
                  type="button"
                  onClick={() => {
                    setAutoOrbit(false);
                    setSelectedIndex(idx);
                  }}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'theme-accent-bg'
                      : 'theme-surface-muted theme-muted border border-[var(--border-subtle)] hover:opacity-90'
                  }`}
                >
                  {profile.occupation}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7">
          <div key={activeProfile.occupation} className="section-enter space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="theme-heading text-xl font-bold">{activeProfile.occupation}</h3>
                <p className="theme-muted text-xs">
                  Typical Age Band: {activeProfile.ageTypical}
                </p>
              </div>
              <p className="theme-accent-text font-mono text-xs font-semibold tabular-nums">
                {metric ? `${metric.count} surveyed record(s)` : '0 records'}
              </p>
            </div>

            <p className="theme-muted text-sm leading-relaxed">{activeProfile.summary}</p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="theme-surface-muted rounded-md border p-3">
                <p className="theme-muted text-[11px] font-medium">Edu / Work Avg</p>
                <p className="theme-heading mt-1 font-mono text-lg font-semibold tabular-nums">
                  {metric && metric.count > 0 ? `${metric.avgEduWorkHours} hrs` : '—'}
                </p>
              </div>
              <div className="theme-surface-muted rounded-md border p-3">
                <p className="theme-muted text-[11px] font-medium">Entertainment Avg</p>
                <p className="theme-heading mt-1 font-mono text-lg font-semibold tabular-nums">
                  {metric && metric.count > 0 ? `${metric.avgEntertainmentHours} hrs` : '—'}
                </p>
              </div>
              <div className="theme-surface-muted rounded-md border p-3">
                <p className="theme-muted text-[11px] font-medium">High Privacy Awareness</p>
                <p className="theme-heading mt-1 font-mono text-lg font-semibold tabular-nums">
                  {categoryResponses.length > 0 ? `${highPrivacyPct}%` : '—'}
                </p>
              </div>
            </div>

            <div className="border-t border-[var(--border-subtle)] pt-3 text-xs">
              <p className="theme-heading font-semibold">Primary Apps & Key Challenge</p>
              <p className="theme-muted mt-1">
                {activeProfile.commonApps.join(', ')} — {activeProfile.keyChallenge}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
