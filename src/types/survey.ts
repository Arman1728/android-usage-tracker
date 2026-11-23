export const AGE_GROUPS = [
  '13-17',
  '18-24',
  '25-34',
  '35-44',
  '45-59',
  '60+',
] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number];

export const GENDERS = [
  'Prefer not to say',
  'Female',
  'Male',
  'Non-binary',
] as const;

export type Gender = (typeof GENDERS)[number];

export const OCCUPATIONS = [
  'Student',
  'Teacher',
  'Working Professional',
  'Business Owner',
  'Homemaker',
  'Senior Citizen',
] as const;

export type Occupation = (typeof OCCUPATIONS)[number];

export const SMARTPHONE_BRANDS = [
  'Samsung',
  'Xiaomi / Redmi',
  'OnePlus',
  'Realme',
  'Vivo',
  'Oppo',
  'Google Pixel',
  'Motorola',
  'Other',
] as const;

export type SmartphoneBrand = (typeof SMARTPHONE_BRANDS)[number];

export const USAGE_DURATIONS = [
  'Less than 1 year',
  '1-2 years',
  '3-5 years',
  '6-8 years',
  'More than 8 years',
] as const;

export type UsageDuration = (typeof USAGE_DURATIONS)[number];

export const APPLICATION_OPTIONS = [
  'WhatsApp',
  'YouTube',
  'Instagram',
  'Google Chrome',
  'UPI / Payment Apps',
  'Google Classroom / Meet',
  'LinkedIn / Email',
  'News / Weather',
  'Maps / Navigation',
  'Gaming Apps',
  'E-commerce / Shopping',
] as const;

export type AppOption = (typeof APPLICATION_OPTIONS)[number];

export const PRIMARY_PURPOSES = [
  'Education & Learning',
  'Work & Productivity',
  'Communication & Social',
  'Entertainment & Media',
  'Business & Finance',
  'Daily Utilities & Information',
] as const;

export type PrimaryPurpose = (typeof PRIMARY_PURPOSES)[number];

export const PRIVACY_AWARENESS_LEVELS = [
  'High',
  'Moderate',
  'Low',
] as const;

export type PrivacyAwareness = (typeof PRIVACY_AWARENESS_LEVELS)[number];

export const PRIVACY_AWARENESS_LABELS: Record<PrivacyAwareness, string> = {
  High: 'High — Uses 2FA, reviews app permissions & installs updates',
  Moderate: 'Moderate — Uses screen lock & avoids unknown APKs',
  Low: 'Low — Rarely checks permissions or security settings',
};

export const COLLEGE_OPTIONS = [
  'Community / General Respondent',
  'Sree Venkateswara College of Engineering',
  'JNTUA College of Engineering (CSE)',
  'Sree Vidyanikethan Engineering College',
  'Annamacharya Institute of Technology & Sciences',
  'Madanapalle Institute of Technology & Science',
  'Other College / Institution',
] as const;

export type ThemeId = 'classic' | 'dark' | 'emerald' | 'indigo';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  swatchPrimary: string;
  swatchAccent: string;
  isDark: boolean;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'classic', label: 'Navy', swatchPrimary: '#0F2547', swatchAccent: '#6D28D9', isDark: false },
  { id: 'dark', label: 'Dark Slate', swatchPrimary: '#0F172A', swatchAccent: '#7C3AED', isDark: true },
  { id: 'emerald', label: 'Emerald', swatchPrimary: '#064E3B', swatchAccent: '#0D9488', isDark: false },
  { id: 'indigo', label: 'Indigo', swatchPrimary: '#1E1B4B', swatchAccent: '#4F46E5', isDark: false },
];

export interface TeamMember {
  name: string;
  rollNumber: string;
}

export const TEAM_MEMBERS: TeamMember[] = [
  { name: 'Syed Saad Arman', rollNumber: '24JNA05648' },
  { name: 'P Dinesh', rollNumber: '24JNA05608' },
  { name: 'P Om Sai Teja', rollNumber: '24JNA05605' },
  { name: 'R Rami Reddy Ramu', rollNumber: '24JNA05631' },
  { name: 'S Mohesh', rollNumber: '24JNA05659' },
];

export interface ProjectSettings {
  collegeName: string;
  department: string;
  academicBatch: string;
  requireSiteGate: boolean;
}

export type SecurityChallengeMode = 'code' | 'math';

export interface SecurityChallengeToken {
  ch: string;
  tilt: number;
}

export interface SecurityChallenge {
  challengeId: string;
  mode: SecurityChallengeMode;
  prompt: string;
  tokens: SecurityChallengeToken[];
  expiresInSeconds: number;
}

export interface SecurityProtectionItem {
  id: string;
  label: string;
  detail: string;
  active: boolean;
}

export interface SecurityStatusResponse {
  verified: boolean;
  requireSiteGate: boolean;
  expiresAt: number | null;
  mode: SecurityChallengeMode | null;
  protections: SecurityProtectionItem[];
}

export interface SecurityMetricsSnapshot {
  verifiedSessions: number;
  failedChallenges: number;
  blockedBots: number;
  rateLimitedRequests: number;
  failedAdminLogins: number;
  activeAdminSessions: number;
  pendingChallenges: number;
}

export interface SurveyInput {
  ageGroup: string;
  gender?: string;
  occupation: string;
  collegeName?: string;
  smartphoneBrand: string;
  yearsOfUsage: string;
  avgDailyHours: number | string;
  frequentApps: string[];
  primaryPurpose: string;
  eduWorkHours: number | string;
  entertainmentHours: number | string;
  privacyAwareness: string;
  excessiveUsageOpinion: string;
}

export interface SurveyResponse {
  id: number;
  ageGroup: AgeGroup;
  gender: Gender;
  occupation: Occupation;
  collegeName: string;
  smartphoneBrand: SmartphoneBrand;
  yearsOfUsage: UsageDuration;
  avgDailyHours: number;
  frequentApps: string[];
  primaryPurpose: PrimaryPurpose;
  eduWorkHours: number;
  entertainmentHours: number;
  privacyAwareness: PrivacyAwareness;
  excessiveUsageOpinion: string;
  isSample: boolean;
  createdAt: string;
}

export interface DatasetCounts {
  total: number;
  realCount: number;
  sampleCount: number;
}

export type DatasetScope = 'all' | 'real' | 'sample';

export interface GroupUsageMetric {
  label: string;
  count: number;
  avgDailyHours: number;
  avgEduWorkHours: number;
  avgEntertainmentHours: number;
}

export interface CountMetric {
  label: string;
  count: number;
  percentage: number;
}

export interface AnalyticsSummary {
  totalResponses: number;
  realResponses: number;
  sampleResponses: number;
  avgDailyHours: number;
  avgEduWorkHours: number;
  avgEntertainmentHours: number;
  mostCommonOccupation: { label: string; count: number; percentage: number } | null;
  topApplication: { label: string; count: number; percentage: number } | null;
  appsDistribution: CountMetric[];
  usageByAgeGroup: GroupUsageMetric[];
  usageByOccupation: GroupUsageMetric[];
  purposeDistribution: CountMetric[];
  privacyDistribution: CountMetric[];
  brandDistribution: CountMetric[];
}

export interface FindingsReport {
  hasData: boolean;
  totalAnalyzed: number;
  realCount: number;
  sampleCount: number;
  highestUsageOccupation: GroupUsageMetric | null;
  lowestUsageOccupation: GroupUsageMetric | null;
  highestUsageAgeGroup: GroupUsageMetric | null;
  lowestUsageAgeGroup: GroupUsageMetric | null;
  topApplications: CountMetric[];
  leadingPurpose: CountMetric | null;
  secondaryPurpose: CountMetric | null;
  ageGroupComparisonSummary: string;
  privacyHighPercentage: number;
  privacyLowPercentage: number;
  eduVsEntertainmentRatio: {
    avgEduWorkHours: number;
    avgEntertainmentHours: number;
    dominantFocus: 'Educational / Work' | 'Entertainment' | 'Balanced';
  };
  sampleOpinions: Array<{
    id: number;
    occupation: string;
    ageGroup: string;
    isSample: boolean;
    opinion: string;
  }>;
}

export type SectionId =
  | 'home'
  | 'about'
  | 'categories'
  | 'activity'
  | 'survey'
  | 'analytics'
  | 'table'
  | 'findings'
  | 'recommendations'
  | 'conclusion'
  | 'assistant'
  | 'admin';

export type ActivityStatus = 'Not Started' | 'In Progress' | 'Completed';

export interface WeeklyPhoto {
  id: string;
  fileName: string;
  caption: string;
  dataUrl: string;
  uploadedAt: string;
}

export interface WeeklyActivity {
  weekNumber: number;
  title: string;
  description: string;
  activities: string[];
  startDate: string;
  endDate: string;
  status: ActivityStatus;
  reflection: string;
  photos: WeeklyPhoto[];
  updatedAt: string;
}

export interface ActivityProgressSummary {
  totalWeeks: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  percentComplete: number;
  overallLabel: 'Not Started' | 'In Progress' | 'Completed';
}

export interface UserCategoryProfile {
  occupation: Occupation;
  ageTypical: string;
  summary: string;
  usageHabits: string[];
  primaryPurposes: string[];
  commonApps: string[];
  keyChallenge: string;
}

export const CHAT_BOARD_ROLES = [
  'Student',
  'Faculty',
  'Community Respondent',
  'CSP Team',
  'Visitor',
] as const;

export type ChatBoardRole = (typeof CHAT_BOARD_ROLES)[number];

export interface ChatBoardMessage {
  id: number;
  senderName: string;
  roleTag: ChatBoardRole;
  message: string;
  createdAt: string;
}
