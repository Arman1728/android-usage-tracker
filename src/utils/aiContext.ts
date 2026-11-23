import {
  DatasetCounts,
  DatasetScope,
  ProjectSettings,
  SurveyResponse,
  TEAM_MEMBERS,
} from '../types/survey';
import { computeAnalytics, generateFindings } from './surveyLogic';

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface ValidatedChatPayload {
  message: string;
  history: ChatTurn[];
  scope: DatasetScope;
}

export function validateChatPayload(raw: unknown): {
  valid: boolean;
  error?: string;
  payload?: ValidatedChatPayload;
} {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }

  const record = raw as Record<string, unknown>;
  const message = typeof record.message === 'string' ? record.message.trim() : '';

  if (!message) {
    return { valid: false, error: 'Please enter a question for the AI Research Bot.' };
  }
  if (message.length > 1000) {
    return { valid: false, error: 'Question must be 1,000 characters or fewer.' };
  }

  const rawScope = record.scope;
  const scope: DatasetScope =
    rawScope === 'real' || rawScope === 'sample' || rawScope === 'all' ? rawScope : 'all';

  const history: ChatTurn[] = [];
  if (Array.isArray(record.history)) {
    for (const item of record.history.slice(-10)) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;
      const role = entry.role === 'user' || entry.role === 'model' ? entry.role : null;
      const text = typeof entry.text === 'string' ? entry.text.trim().slice(0, 2000) : '';
      if (role && text) {
        history.push({ role, text });
      }
    }
  }

  return {
    valid: true,
    payload: { message, history, scope },
  };
}

export function buildResearchContextSummary(
  responses: SurveyResponse[],
  counts: DatasetCounts,
  settings: ProjectSettings,
  scope: DatasetScope
): string {
  const analytics = computeAnalytics(responses);
  const findings = generateFindings(responses);

  const teamLine = TEAM_MEMBERS.map((m) => `${m.name} - ${m.rollNumber}`).join(', ');
  const scopeLabel =
    scope === 'real'
      ? 'Real Survey Submissions Only'
      : scope === 'sample'
      ? 'Sample Demo Records Only'
      : 'Combined Dataset (Real + Sample Demo)';

  const lines: string[] = [
    `Project Title: Android Phone Usage by Different People (B.Tech Community Service Project)`,
    `Institution: ${settings.collegeName} | ${settings.department} | ${settings.academicBatch}`,
    `Project Team: ${teamLine}`,
    `Active Dataset Scope: ${scopeLabel}`,
    `Global Database Counts: ${counts.total} total (${counts.realCount} real user submissions, ${counts.sampleCount} sample demo records)`,
    `Analyzed Records in Scope: ${analytics.totalResponses}`,
  ];

  if (!findings.hasData || analytics.totalResponses === 0) {
    lines.push(
      'Data Status: Zero records match the active scope. Do not invent statistics; explain that no responses exist in this scope yet and encourage submitting a response via the Survey Form.'
    );
    return lines.join('\n');
  }

  lines.push(
    `Average Daily Usage: ${analytics.avgDailyHours} hrs/day (Edu/Work: ${analytics.avgEduWorkHours} hrs/day, Entertainment: ${analytics.avgEntertainmentHours} hrs/day, Dominant Focus: ${findings.eduVsEntertainmentRatio.dominantFocus})`,
    `Most Common Occupation: ${
      analytics.mostCommonOccupation
        ? `${analytics.mostCommonOccupation.label} (${analytics.mostCommonOccupation.count} responses, ${analytics.mostCommonOccupation.percentage}%)`
        : 'N/A'
    }`,
    `Top Application Overall: ${
      analytics.topApplication
        ? `${analytics.topApplication.label} (${analytics.topApplication.count} mentions, ${analytics.topApplication.percentage}% of respondents)`
        : 'N/A'
    }`
  );

  const ageBreakdown = analytics.usageByAgeGroup
    .filter((g) => g.count > 0)
    .map(
      (g) =>
        `${g.label}: n=${g.count}, avg=${g.avgDailyHours}h/day (edu/work=${g.avgEduWorkHours}h, ent=${g.avgEntertainmentHours}h)`
    )
    .join('; ');
  if (ageBreakdown) lines.push(`Usage by Age Group: ${ageBreakdown}`);

  const occBreakdown = analytics.usageByOccupation
    .filter((o) => o.count > 0)
    .map(
      (o) =>
        `${o.label}: n=${o.count}, avg=${o.avgDailyHours}h/day (edu/work=${o.avgEduWorkHours}h, ent=${o.avgEntertainmentHours}h)`
    )
    .join('; ');
  if (occBreakdown) lines.push(`Usage by Occupation: ${occBreakdown}`);

  const topApps = analytics.appsDistribution
    .slice(0, 6)
    .map((a) => `${a.label} (${a.percentage}%)`)
    .join(', ');
  if (topApps) lines.push(`Top Applications: ${topApps}`);

  const purposes = analytics.purposeDistribution
    .map((p) => `${p.label} (${p.percentage}%)`)
    .join(', ');
  if (purposes) lines.push(`Primary Purposes: ${purposes}`);

  const privacy = analytics.privacyDistribution
    .map((p) => `${p.label} (${p.percentage}%)`)
    .join(', ');
  if (privacy) lines.push(`Privacy & Security Awareness: ${privacy}`);

  const brands = analytics.brandDistribution
    .slice(0, 6)
    .map((b) => `${b.label} (${b.percentage}%)`)
    .join(', ');
  if (brands) lines.push(`Smartphone Brands: ${brands}`);

  if (findings.sampleOpinions.length > 0) {
    const opinionLines = findings.sampleOpinions
      .slice(0, 5)
      .map(
        (o) =>
          `- [${o.isSample ? 'Sample' : 'Real'}, ${o.occupation}, Age ${o.ageGroup}]: "${o.opinion}"`
      );
    lines.push('Recent Respondent Opinions:', ...opinionLines);
  }

  return lines.join('\n');
}

export function buildSystemInstruction(contextSummary: string): string {
  return [
    'You are the AI Research Bot for the B.Tech Community Service Project (CSP) portal "Android Phone Usage by Different People".',
    'Your role is to help students, faculty, and reviewers explore the survey methodology, user categories, live SQLite survey statistics, privacy awareness trends, and practical digital wellbeing recommendations.',
    'Rules:',
    '1. Ground every numeric claim strictly in the Live Research Context provided below. Never fabricate or extrapolate unrecorded survey numbers.',
    '2. Clearly note whether statistics reflect Real Submissions Only, Sample Demo Records Only, or the Combined Dataset based on the active scope.',
    '3. Keep responses concise, structured with clean plain-text headings and hyphen bullets (- ) where helpful, without markdown asterisks (** or *) or hash headings (###), written in an objective academic/research tone.',
    '4. When listing project team members, always format them cleanly as "Name - RollNumber" without parentheses or extra role labels.',
    '',
    '=== LIVE RESEARCH CONTEXT ===',
    contextSummary,
  ].join('\n');
}
