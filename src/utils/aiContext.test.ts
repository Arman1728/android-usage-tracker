import assert from 'node:assert/strict';
import test from 'node:test';
import { SAMPLE_DEMO_RECORDS } from '../data/sampleSeed';
import { ProjectSettings, SurveyResponse } from '../types/survey';
import {
  buildResearchContextSummary,
  buildSystemInstruction,
  validateChatPayload,
} from './aiContext';

const TEST_SETTINGS: ProjectSettings = {
  collegeName: 'JNTUA College of Engineering',
  department: 'Department of CSE',
  academicBatch: '2024-2028 CSP',
  requireSiteGate: true,
};

function makeSampleResponses(): SurveyResponse[] {
  return SAMPLE_DEMO_RECORDS.slice(0, 4).map((item, idx) => ({
    id: idx + 1,
    ageGroup: item.ageGroup as SurveyResponse['ageGroup'],
    gender: (item.gender || 'Prefer not to say') as SurveyResponse['gender'],
    occupation: item.occupation as SurveyResponse['occupation'],
    collegeName: item.collegeName || 'Community / General Respondent',
    smartphoneBrand: item.smartphoneBrand as SurveyResponse['smartphoneBrand'],
    yearsOfUsage: item.yearsOfUsage as SurveyResponse['yearsOfUsage'],
    avgDailyHours: Number(item.avgDailyHours),
    frequentApps: item.frequentApps,
    primaryPurpose: item.primaryPurpose as SurveyResponse['primaryPurpose'],
    eduWorkHours: Number(item.eduWorkHours),
    entertainmentHours: Number(item.entertainmentHours),
    privacyAwareness: item.privacyAwareness as SurveyResponse['privacyAwareness'],
    excessiveUsageOpinion: item.excessiveUsageOpinion,
    isSample: true,
    createdAt: '2026-11-10T09:00:00.000Z',
  }));
}

test('validateChatPayload rejects empty or oversized messages and sanitizes history', () => {
  assert.equal(validateChatPayload(null).valid, false);
  assert.equal(validateChatPayload({ message: '   ' }).valid, false);
  assert.equal(validateChatPayload({ message: 'x'.repeat(1001) }).valid, false);

  const ok = validateChatPayload({
    message: 'Which group has highest screen time?',
    scope: 'real',
    history: [
      { role: 'user', text: 'Hello' },
      { role: 'invalid', text: 'Ignore me' },
      { role: 'model', text: 'Hi there' },
    ],
  });

  assert.equal(ok.valid, true);
  assert.equal(ok.payload?.scope, 'real');
  assert.equal(ok.payload?.history.length, 2);
});

test('buildResearchContextSummary handles empty scope without inventing metrics', () => {
  const summary = buildResearchContextSummary(
    [],
    { total: 18, realCount: 0, sampleCount: 18 },
    TEST_SETTINGS,
    'real'
  );

  assert.match(summary, /Zero records match the active scope/);
  assert.match(summary, /Syed Saad Arman - 24JNA05648/);
  assert.doesNotMatch(summary, /\(24JNA05648\)/);
});

test('buildResearchContextSummary and buildSystemInstruction include live analytics', () => {
  const responses = makeSampleResponses();
  const summary = buildResearchContextSummary(
    responses,
    { total: 4, realCount: 0, sampleCount: 4 },
    TEST_SETTINGS,
    'all'
  );
  const instruction = buildSystemInstruction(summary);

  assert.match(instruction, /Analyzed Records in Scope: 4/);
  assert.match(instruction, /Average Daily Usage:/);
  assert.match(instruction, /Usage by Occupation:/);
  assert.match(instruction, /without parentheses/);
});
