import {
  AGE_GROUPS,
  AnalyticsSummary,
  CountMetric,
  DatasetScope,
  FindingsReport,
  GENDERS,
  GroupUsageMetric,
  OCCUPATIONS,
  PRIMARY_PURPOSES,
  PRIVACY_AWARENESS_LEVELS,
  SMARTPHONE_BRANDS,
  SurveyInput,
  SurveyResponse,
  USAGE_DURATIONS,
} from '../types/survey';

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateSurveyInput(input: Partial<SurveyInput>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.ageGroup || !AGE_GROUPS.includes(input.ageGroup as (typeof AGE_GROUPS)[number])) {
    errors.ageGroup = 'Please select a valid age group.';
  }

  if (input.gender && !GENDERS.includes(input.gender as (typeof GENDERS)[number])) {
    errors.gender = 'Please select a valid gender option.';
  }

  if (!input.occupation || !OCCUPATIONS.includes(input.occupation as (typeof OCCUPATIONS)[number])) {
    errors.occupation = 'Please select an occupation category.';
  }

  if (
    !input.smartphoneBrand ||
    !SMARTPHONE_BRANDS.includes(input.smartphoneBrand as (typeof SMARTPHONE_BRANDS)[number])
  ) {
    errors.smartphoneBrand = 'Please select your primary Android smartphone brand.';
  }

  if (
    !input.yearsOfUsage ||
    !USAGE_DURATIONS.includes(input.yearsOfUsage as (typeof USAGE_DURATIONS)[number])
  ) {
    errors.yearsOfUsage = 'Please select how many years you have used an Android smartphone.';
  }

  const daily = Number(input.avgDailyHours);
  if (
    input.avgDailyHours === undefined ||
    input.avgDailyHours === '' ||
    Number.isNaN(daily) ||
    daily < 0.5 ||
    daily > 24
  ) {
    errors.avgDailyHours = 'Average daily usage must be between 0.5 and 24 hours.';
  }

  if (!Array.isArray(input.frequentApps) || input.frequentApps.length === 0) {
    errors.frequentApps = 'Select at least one frequently used application.';
  }

  if (
    !input.primaryPurpose ||
    !PRIMARY_PURPOSES.includes(input.primaryPurpose as (typeof PRIMARY_PURPOSES)[number])
  ) {
    errors.primaryPurpose = 'Please select your primary purpose of smartphone usage.';
  }

  const eduWork = Number(input.eduWorkHours);
  if (
    input.eduWorkHours === undefined ||
    input.eduWorkHours === '' ||
    Number.isNaN(eduWork) ||
    eduWork < 0 ||
    eduWork > 24
  ) {
    errors.eduWorkHours = 'Daily educational or work usage must be between 0 and 24 hours.';
  }

  const entertainment = Number(input.entertainmentHours);
  if (
    input.entertainmentHours === undefined ||
    input.entertainmentHours === '' ||
    Number.isNaN(entertainment) ||
    entertainment < 0 ||
    entertainment > 24
  ) {
    errors.entertainmentHours = 'Daily entertainment usage must be between 0 and 24 hours.';
  }

  if (!Number.isNaN(daily) && !Number.isNaN(eduWork) && !Number.isNaN(entertainment)) {
    if (eduWork + entertainment > 24) {
      errors.entertainmentHours =
        'Combined educational/work and entertainment hours cannot exceed 24 hours per day.';
    }
  }

  if (
    !input.privacyAwareness ||
    !PRIVACY_AWARENESS_LEVELS.includes(
      input.privacyAwareness as (typeof PRIVACY_AWARENESS_LEVELS)[number]
    )
  ) {
    errors.privacyAwareness = 'Please select your level of smartphone privacy & security awareness.';
  }

  const opinion = typeof input.excessiveUsageOpinion === 'string' ? input.excessiveUsageOpinion.trim() : '';
  if (opinion.length < 10) {
    errors.excessiveUsageOpinion =
      'Please share a brief opinion (at least 10 characters) about smartphone benefits or excessive usage.';
  } else if (opinion.length > 600) {
    errors.excessiveUsageOpinion = 'Opinion text must be 600 characters or fewer.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

function roundToOne(num: number): number {
  return Math.round(num * 10) / 10;
}

function buildCountMetrics(counts: Map<string, number>, total: number): CountMetric[] {
  if (total === 0) return [];
  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      percentage: roundToOne((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildGroupMetrics(
  responses: SurveyResponse[],
  orderedLabels: readonly string[],
  getKey: (r: SurveyResponse) => string
): GroupUsageMetric[] {
  const buckets = new Map<
    string,
    { count: number; sumDaily: number; sumEduWork: number; sumEntertainment: number }
  >();

  for (const label of orderedLabels) {
    buckets.set(label, { count: 0, sumDaily: 0, sumEduWork: 0, sumEntertainment: 0 });
  }

  for (const row of responses) {
    const key = getKey(row);
    const bucket = buckets.get(key) ?? {
      count: 0,
      sumDaily: 0,
      sumEduWork: 0,
      sumEntertainment: 0,
    };
    bucket.count += 1;
    bucket.sumDaily += row.avgDailyHours;
    bucket.sumEduWork += row.eduWorkHours;
    bucket.sumEntertainment += row.entertainmentHours;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries()).map(([label, b]) => ({
    label,
    count: b.count,
    avgDailyHours: b.count > 0 ? roundToOne(b.sumDaily / b.count) : 0,
    avgEduWorkHours: b.count > 0 ? roundToOne(b.sumEduWork / b.count) : 0,
    avgEntertainmentHours: b.count > 0 ? roundToOne(b.sumEntertainment / b.count) : 0,
  }));
}

export function computeAnalytics(responses: SurveyResponse[]): AnalyticsSummary {
  const totalResponses = responses.length;
  const realResponses = responses.filter((r) => !r.isSample).length;
  const sampleResponses = responses.filter((r) => r.isSample).length;

  if (totalResponses === 0) {
    return {
      totalResponses: 0,
      realResponses: 0,
      sampleResponses: 0,
      avgDailyHours: 0,
      avgEduWorkHours: 0,
      avgEntertainmentHours: 0,
      mostCommonOccupation: null,
      topApplication: null,
      appsDistribution: [],
      usageByAgeGroup: buildGroupMetrics([], AGE_GROUPS, (r) => r.ageGroup),
      usageByOccupation: buildGroupMetrics([], OCCUPATIONS, (r) => r.occupation),
      purposeDistribution: [],
      privacyDistribution: [],
      brandDistribution: [],
    };
  }

  const sumDaily = responses.reduce((acc, r) => acc + r.avgDailyHours, 0);
  const sumEduWork = responses.reduce((acc, r) => acc + r.eduWorkHours, 0);
  const sumEnt = responses.reduce((acc, r) => acc + r.entertainmentHours, 0);

  const occCounts = new Map<string, number>();
  const appCounts = new Map<string, number>();
  const purposeCounts = new Map<string, number>();
  const privacyCounts = new Map<string, number>();
  const brandCounts = new Map<string, number>();

  for (const r of responses) {
    occCounts.set(r.occupation, (occCounts.get(r.occupation) ?? 0) + 1);
    purposeCounts.set(r.primaryPurpose, (purposeCounts.get(r.primaryPurpose) ?? 0) + 1);
    privacyCounts.set(r.privacyAwareness, (privacyCounts.get(r.privacyAwareness) ?? 0) + 1);
    brandCounts.set(r.smartphoneBrand, (brandCounts.get(r.smartphoneBrand) ?? 0) + 1);
    for (const app of r.frequentApps) {
      appCounts.set(app, (appCounts.get(app) ?? 0) + 1);
    }
  }

  const occMetrics = buildCountMetrics(occCounts, totalResponses);
  const appsDistribution = buildCountMetrics(appCounts, totalResponses);
  const purposeDistribution = buildCountMetrics(purposeCounts, totalResponses);
  const privacyDistribution = buildCountMetrics(privacyCounts, totalResponses);
  const brandDistribution = buildCountMetrics(brandCounts, totalResponses);

  return {
    totalResponses,
    realResponses,
    sampleResponses,
    avgDailyHours: roundToOne(sumDaily / totalResponses),
    avgEduWorkHours: roundToOne(sumEduWork / totalResponses),
    avgEntertainmentHours: roundToOne(sumEnt / totalResponses),
    mostCommonOccupation: occMetrics[0] ?? null,
    topApplication: appsDistribution[0] ?? null,
    appsDistribution,
    usageByAgeGroup: buildGroupMetrics(responses, AGE_GROUPS, (r) => r.ageGroup),
    usageByOccupation: buildGroupMetrics(responses, OCCUPATIONS, (r) => r.occupation),
    purposeDistribution,
    privacyDistribution,
    brandDistribution,
  };
}

export function generateFindings(responses: SurveyResponse[]): FindingsReport {
  if (responses.length === 0) {
    return {
      hasData: false,
      totalAnalyzed: 0,
      realCount: 0,
      sampleCount: 0,
      highestUsageOccupation: null,
      lowestUsageOccupation: null,
      highestUsageAgeGroup: null,
      lowestUsageAgeGroup: null,
      topApplications: [],
      leadingPurpose: null,
      secondaryPurpose: null,
      ageGroupComparisonSummary:
        'No survey responses are currently included in this view. Submit a survey response or include sample demonstration records to inspect live observations.',
      privacyHighPercentage: 0,
      privacyLowPercentage: 0,
      eduVsEntertainmentRatio: {
        avgEduWorkHours: 0,
        avgEntertainmentHours: 0,
        dominantFocus: 'Balanced',
      },
      sampleOpinions: [],
    };
  }

  const analytics = computeAnalytics(responses);
  const activeOccupations = analytics.usageByOccupation
    .filter((o) => o.count > 0)
    .sort((a, b) => b.avgDailyHours - a.avgDailyHours);
  const activeAges = analytics.usageByAgeGroup
    .filter((a) => a.count > 0)
    .sort((a, b) => b.avgDailyHours - a.avgDailyHours);

  const highestOcc = activeOccupations[0] ?? null;
  const lowestOcc = activeOccupations[activeOccupations.length - 1] ?? null;
  const highestAge = activeAges[0] ?? null;
  const lowestAge = activeAges[activeAges.length - 1] ?? null;

  let ageGroupComparisonSummary = '';
  if (highestAge && lowestAge && highestAge.label !== lowestAge.label) {
    const diff = roundToOne(highestAge.avgDailyHours - lowestAge.avgDailyHours);
    ageGroupComparisonSummary = `Respondents aged ${highestAge.label} report the highest daily screen time at ${highestAge.avgDailyHours} hrs/day (n=${highestAge.count}), which is ${diff} hrs/day higher than the ${lowestAge.label} group at ${lowestAge.avgDailyHours} hrs/day (n=${lowestAge.count}).`;
  } else if (highestAge) {
    ageGroupComparisonSummary = `All currently analyzed responses fall in the ${highestAge.label} age group, averaging ${highestAge.avgDailyHours} hrs/day across ${highestAge.count} respondent(s).`;
  }

  const highPrivacy = analytics.privacyDistribution.find((p) => p.label === 'High');
  const lowPrivacy = analytics.privacyDistribution.find((p) => p.label === 'Low');

  let dominantFocus: 'Educational / Work' | 'Entertainment' | 'Balanced' = 'Balanced';
  if (analytics.avgEduWorkHours - analytics.avgEntertainmentHours >= 0.4) {
    dominantFocus = 'Educational / Work';
  } else if (analytics.avgEntertainmentHours - analytics.avgEduWorkHours >= 0.4) {
    dominantFocus = 'Entertainment';
  }

  const sampleOpinions = responses.slice(0, 6).map((r) => ({
    id: r.id,
    occupation: r.occupation,
    ageGroup: r.ageGroup,
    isSample: r.isSample,
    opinion: r.excessiveUsageOpinion,
  }));

  return {
    hasData: true,
    totalAnalyzed: analytics.totalResponses,
    realCount: analytics.realResponses,
    sampleCount: analytics.sampleResponses,
    highestUsageOccupation: highestOcc,
    lowestUsageOccupation: lowestOcc,
    highestUsageAgeGroup: highestAge,
    lowestUsageAgeGroup: lowestAge,
    topApplications: analytics.appsDistribution.slice(0, 5),
    leadingPurpose: analytics.purposeDistribution[0] ?? null,
    secondaryPurpose: analytics.purposeDistribution[1] ?? null,
    ageGroupComparisonSummary,
    privacyHighPercentage: highPrivacy ? highPrivacy.percentage : 0,
    privacyLowPercentage: lowPrivacy ? lowPrivacy.percentage : 0,
    eduVsEntertainmentRatio: {
      avgEduWorkHours: analytics.avgEduWorkHours,
      avgEntertainmentHours: analytics.avgEntertainmentHours,
      dominantFocus,
    },
    sampleOpinions,
  };
}

export type SortField = 'id' | 'ageGroup' | 'occupation' | 'avgDailyHours' | 'privacyAwareness';
export type SortDirection = 'asc' | 'desc';

export interface TableQueryOptions {
  search: string;
  ageGroup: string;
  occupation: string;
  scope: DatasetScope;
  sortBy: SortField;
  sortDir: SortDirection;
  page: number;
  pageSize: number;
}

export function filterAndSortResponses(
  responses: SurveyResponse[],
  options: TableQueryOptions
): { items: SurveyResponse[]; totalFiltered: number; totalPages: number; currentPage: number } {
  const searchLower = options.search.trim().toLowerCase();

  const filtered = responses.filter((row) => {
    if (options.scope === 'real' && row.isSample) return false;
    if (options.scope === 'sample' && !row.isSample) return false;
    if (options.ageGroup !== 'All' && row.ageGroup !== options.ageGroup) return false;
    if (options.occupation !== 'All' && row.occupation !== options.occupation) return false;

    if (searchLower) {
      const haystack = [
        row.ageGroup,
        row.occupation,
        row.collegeName,
        row.smartphoneBrand,
        row.primaryPurpose,
        row.privacyAwareness,
        row.excessiveUsageOpinion,
        row.frequentApps.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(searchLower)) return false;
    }

    return true;
  });

  const dir = options.sortDir === 'asc' ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => {
    switch (options.sortBy) {
      case 'avgDailyHours':
        return (a.avgDailyHours - b.avgDailyHours) * dir;
      case 'ageGroup':
        return a.ageGroup.localeCompare(b.ageGroup) * dir;
      case 'occupation':
        return a.occupation.localeCompare(b.occupation) * dir;
      case 'privacyAwareness':
        return a.privacyAwareness.localeCompare(b.privacyAwareness) * dir;
      case 'id':
      default:
        return (a.id - b.id) * dir;
    }
  });

  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / options.pageSize));
  const currentPage = Math.min(Math.max(1, options.page), totalPages);
  const start = (currentPage - 1) * options.pageSize;
  const items = sorted.slice(start, start + options.pageSize);

  return { items, totalFiltered, totalPages, currentPage };
}

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeResponsesToCsv(responses: SurveyResponse[]): string {
  const headers = [
    'ID',
    'Data Source',
    'Age Group',
    'Gender',
    'Occupation',
    'College / Institution',
    'Smartphone Brand',
    'Years of Usage',
    'Avg Daily Hours',
    'Frequent Applications',
    'Primary Purpose',
    'Daily Edu/Work Hours',
    'Daily Entertainment Hours',
    'Privacy Awareness',
    'Opinion on Excessive Usage',
    'Submitted At',
  ];

  const rows = responses.map((r) => [
    r.id,
    r.isSample ? 'Sample Demo' : 'Real Submission',
    r.ageGroup,
    r.gender,
    r.occupation,
    r.collegeName || 'Community / General Respondent',
    r.smartphoneBrand,
    r.yearsOfUsage,
    r.avgDailyHours,
    r.frequentApps.join('; '),
    r.primaryPurpose,
    r.eduWorkHours,
    r.entertainmentHours,
    r.privacyAwareness,
    r.excessiveUsageOpinion,
    r.createdAt,
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}
