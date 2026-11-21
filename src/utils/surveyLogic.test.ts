import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAnalytics,
  filterAndSortResponses,
  generateFindings,
  serializeResponsesToCsv,
  validateSurveyInput,
} from './surveyLogic';
import { SurveyResponse } from '../types/survey';

const sampleRows: SurveyResponse[] = [
  {
    id: 1,
    ageGroup: '18-24',
    gender: 'Female',
    occupation: 'Student',
    collegeName: 'JNTUA College of Engineering (CSE)',
    smartphoneBrand: 'Xiaomi / Redmi',
    yearsOfUsage: '3-5 years',
    avgDailyHours: 6.5,
    frequentApps: ['WhatsApp', 'YouTube', 'Google Classroom / Meet'],
    primaryPurpose: 'Education & Learning',
    eduWorkHours: 3.5,
    entertainmentHours: 2.0,
    privacyAwareness: 'Moderate',
    excessiveUsageOpinion: 'Very useful for online lectures and project notes.',
    isSample: false,
    createdAt: '2026-11-17T08:00:00.000Z',
  },
  {
    id: 2,
    ageGroup: '60+',
    gender: 'Male',
    occupation: 'Senior Citizen',
    collegeName: 'Community / General Respondent',
    smartphoneBrand: 'Samsung',
    yearsOfUsage: '1-2 years',
    avgDailyHours: 2.5,
    frequentApps: ['WhatsApp', 'News / Weather'],
    primaryPurpose: 'Communication & Social',
    eduWorkHours: 0.5,
    entertainmentHours: 1.0,
    privacyAwareness: 'Low',
    excessiveUsageOpinion: 'Good for calling family, but spam links are risky.',
    isSample: true,
    createdAt: '2026-11-17T08:05:00.000Z',
  },
];

test('validateSurveyInput rejects empty or invalid submissions', () => {
  const result = validateSurveyInput({
    ageGroup: '',
    occupation: '',
    frequentApps: [],
    avgDailyHours: 30,
    eduWorkHours: 15,
    entertainmentHours: 12,
    excessiveUsageOpinion: 'short',
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.ageGroup);
  assert.ok(result.errors.occupation);
  assert.ok(result.errors.avgDailyHours);
  assert.ok(result.errors.frequentApps);
  assert.ok(result.errors.entertainmentHours);
  assert.ok(result.errors.excessiveUsageOpinion);
});

test('validateSurveyInput accepts complete valid payload', () => {
  const result = validateSurveyInput({
    ageGroup: '25-34',
    gender: 'Prefer not to say',
    occupation: 'Working Professional',
    smartphoneBrand: 'Samsung',
    yearsOfUsage: '6-8 years',
    avgDailyHours: 5.5,
    frequentApps: ['WhatsApp', 'LinkedIn / Email'],
    primaryPurpose: 'Work & Productivity',
    eduWorkHours: 3.5,
    entertainmentHours: 1.5,
    privacyAwareness: 'High',
    excessiveUsageOpinion: 'Helps with remote collaboration, though notifications need muting after work.',
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
});

test('computeAnalytics calculates real vs sample counts and averages accurately', () => {
  const summary = computeAnalytics(sampleRows);
  assert.equal(summary.totalResponses, 2);
  assert.equal(summary.realResponses, 1);
  assert.equal(summary.sampleResponses, 1);
  assert.equal(summary.avgDailyHours, 4.5);
  assert.equal(summary.topApplication?.label, 'WhatsApp');
  assert.equal(summary.topApplication?.count, 2);
  assert.equal(summary.topApplication?.percentage, 100);
});

test('generateFindings handles empty datasets without inventing findings', () => {
  const report = generateFindings([]);
  assert.equal(report.hasData, false);
  assert.equal(report.totalAnalyzed, 0);
  assert.equal(report.highestUsageOccupation, null);
  assert.equal(report.topApplications.length, 0);
});

test('generateFindings computes category extremes from live rows', () => {
  const report = generateFindings(sampleRows);
  assert.equal(report.hasData, true);
  assert.equal(report.highestUsageOccupation?.label, 'Student');
  assert.equal(report.lowestUsageOccupation?.label, 'Senior Citizen');
  assert.equal(report.eduVsEntertainmentRatio.dominantFocus, 'Educational / Work');
});

test('filterAndSortResponses filters by scope, search, and paginates', () => {
  const res = filterAndSortResponses(sampleRows, {
    search: 'samsung',
    ageGroup: 'All',
    occupation: 'All',
    scope: 'all',
    sortBy: 'id',
    sortDir: 'asc',
    page: 1,
    pageSize: 10,
  });
  assert.equal(res.totalFiltered, 1);
  assert.equal(res.items[0].id, 2);

  const realOnly = filterAndSortResponses(sampleRows, {
    search: '',
    ageGroup: 'All',
    occupation: 'All',
    scope: 'real',
    sortBy: 'id',
    sortDir: 'asc',
    page: 1,
    pageSize: 10,
  });
  assert.equal(realOnly.totalFiltered, 1);
  assert.equal(realOnly.items[0].isSample, false);
});

test('serializeResponsesToCsv formats headers and escapes commas/quotes', () => {
  const csv = serializeResponsesToCsv(sampleRows);
  const lines = csv.split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^ID,Data Source,Age Group/);
  assert.match(lines[1], /Real Submission/);
  assert.match(lines[2], /"Good for calling family, but spam links are risky\."/);
});
