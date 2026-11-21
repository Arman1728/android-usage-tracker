import React from 'react';
import { ProjectSettings, SectionId, TEAM_MEMBERS } from '../types/survey';

interface AboutViewProps {
  settings: ProjectSettings;
  onNavigate: (section: SectionId) => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ settings, onNavigate }) => {
  return (
    <div className="space-y-6">
      <section className="theme-surface rounded-lg border p-6 sm:p-8">
        <p className="theme-accent-text text-xs font-semibold tracking-wide">
          Research Background & Methodology · {settings.collegeName}
        </p>
        <h1 className="theme-heading mt-2 text-2xl font-bold sm:text-3xl">
          About the Community Service Project
        </h1>
        <p className="theme-muted mt-3 max-w-3xl text-sm leading-relaxed sm:text-base">
          Android smartphones represent the primary computing and internet-access device across urban, semi-urban, and rural households. Because device adoption spans students, educators, professionals, small business owners, homemakers, and senior citizens, usage patterns and digital risks differ sharply across demographics.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="theme-surface rounded-lg border p-6">
          <h2 className="theme-heading text-base font-semibold">01. Introduction to Android Usage</h2>
          <p className="theme-muted mt-2 text-sm leading-relaxed">
            The availability of affordable Android hardware and low-cost mobile data has transformed smartphones from communication tools into essential platforms for education, digital payments (UPI), remote work, civic services, and media consumption. Understanding how different groups navigate this ecosystem helps identify productivity gains as well as screen-time and security gaps.
          </p>
        </section>

        <section className="theme-surface rounded-lg border p-6">
          <h2 className="theme-heading text-base font-semibold">02. Need for the Study</h2>
          <p className="theme-muted mt-2 text-sm leading-relaxed">
            General screen-time averages often hide critical differences between productive usage (such as online classes, business invoicing, or navigation) and passive entertainment. A structured community survey is needed to measure real usage habits, quantify privacy awareness gaps, and inform practical digital literacy outreach.
          </p>
        </section>

        <section className="theme-surface rounded-lg border p-6">
          <h2 className="theme-heading text-base font-semibold">03. Main Objectives</h2>
          <ul className="theme-muted mt-3 space-y-2 text-sm">
            <li>• Compare average daily smartphone usage across six age groups and six occupations.</li>
            <li>• Determine the balance between educational/work usage and entertainment usage.</li>
            <li>• Catalog the most widely relied-upon Android applications and device brands.</li>
            <li>• Assess community awareness of privacy permissions, two-factor authentication, and online scams.</li>
          </ul>
        </section>

        <section className="theme-surface rounded-lg border p-6">
          <h2 className="theme-heading text-base font-semibold">04. Scope of the Project</h2>
          <p className="theme-muted mt-2 text-sm leading-relaxed">
            The study focuses exclusively on active Android smartphone users across local neighborhoods, participating engineering colleges, workplaces, and households. Data is gathered voluntarily without collecting personally identifiable names, phone numbers, or sensitive device identifiers, ensuring anonymous and ethical academic reporting.
          </p>
        </section>

        <section className="theme-surface rounded-lg border p-6">
          <h2 className="theme-heading text-base font-semibold">05. Survey Methodology</h2>
          <p className="theme-muted mt-2 text-sm leading-relaxed">
            Primary data is collected via a standardized structured questionnaire capturing demographic category, college/institution affiliation, device brand, usage tenure, quantitative daily hours, frequent applications, primary purpose, security awareness, and qualitative opinion. Every submission is validated and persisted in a relational SQLite database for live statistical aggregation.
          </p>
        </section>

        <section className="theme-surface rounded-lg border p-6">
          <h2 className="theme-heading text-base font-semibold">06. Target Population & Research Team</h2>
          <p className="theme-muted mt-2 text-sm leading-relaxed">
            Conducted by B.Tech students at {settings.collegeName}, {settings.department}:{' '}
            {TEAM_MEMBERS.map((m) => `${m.name} - ${m.rollNumber}`).join(', ')}. Target respondents span Students (13–24), Teachers, Working Professionals, Business Owners, Homemakers, and Senior Citizens (60+).
          </p>
        </section>
      </div>

      <div className="theme-surface flex flex-wrap items-center justify-between gap-4 rounded-lg border px-6 py-4">
        <p className="theme-muted text-sm">
          Ready to examine the six community groups or contribute a field response?
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('categories')}
            className="theme-surface rounded-md border px-4 py-2 text-xs font-semibold hover:opacity-90 whitespace-nowrap"
          >
            View User Categories
          </button>
          <button
            type="button"
            onClick={() => onNavigate('survey')}
            className="theme-btn-primary rounded-md px-4 py-2 text-xs font-semibold whitespace-nowrap"
          >
            Open Survey Form
          </button>
        </div>
      </div>
    </div>
  );
};
