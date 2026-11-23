import {
  ActivityProgressSummary,
  ActivityStatus,
  WeeklyActivity,
} from '../types/survey';

export const ACTIVITY_STATUSES: ActivityStatus[] = [
  'Not Started',
  'In Progress',
  'Completed',
];

export const DEFAULT_SIX_WEEK_ACTIVITIES: WeeklyActivity[] = [
  {
    weekNumber: 1,
    title: 'Topic Selection and Planning',
    description:
      'Defined the Community Service Project scope on Android smartphone usage across diverse demographic groups, set measurable objectives, and drafted the weekly execution plan.',
    activities: [
      'Selection of the project topic.',
      'Discussion of project objectives.',
      'Preparation of the project plan.',
      'Identification of different smartphone user groups.',
    ],
    startDate: '',
    endDate: '',
    status: 'Not Started',
    reflection: '',
    photos: [],
    updatedAt: '',
  },
  {
    weekNumber: 2,
    title: 'Research and Information Collection',
    description:
      'Conducted background study on Android operating system capabilities, common mobile application categories, usage trends, and digital safety concerns.',
    activities: [
      'Research about Android smartphones.',
      'Study of Android features and applications.',
      'Collection of information about smartphone usage.',
      'Understanding the benefits and challenges of smartphones.',
    ],
    startDate: '',
    endDate: '',
    status: 'Not Started',
    reflection: '',
    photos: [],
    updatedAt: '',
  },
  {
    weekNumber: 3,
    title: 'Understanding Smartphone Usage Patterns',
    description:
      'Analyzed how students, employees, business owners, homemakers, and senior citizens use Android devices daily and prepared the structured survey questionnaire.',
    activities: [
      'Study of smartphone usage among students, employees, business people, homemakers and senior citizens.',
      'Identification of commonly used applications.',
      'Understanding daily smartphone habits.',
      'Preparation of community survey questions.',
    ],
    startDate: '',
    endDate: '',
    status: 'Not Started',
    reflection: '',
    photos: [],
    updatedAt: '',
  },
  {
    weekNumber: 4,
    title: 'Community Interaction and Field Survey',
    description:
      'Engaged directly with community respondents across age groups, recorded real survey responses, and documented user-reported benefits and challenges.',
    activities: [
      'Interaction with people from different age groups.',
      'Conducting a community survey.',
      'Collecting information about smartphone usage habits.',
      "Understanding users' opinions, benefits and problems.",
      'Recording actual observations and feedback.',
    ],
    startDate: '',
    endDate: '',
    status: 'Not Started',
    reflection: '',
    photos: [],
    updatedAt: '',
  },
  {
    weekNumber: 5,
    title: 'Website Development and Documentation',
    description:
      'Built the interactive CSP research portal including the dashboard, validated survey form, Chart.js analytics, data table, CSV export, and documentation.',
    activities: [
      'Designing the website layout.',
      'Developing the homepage and project dashboard.',
      'Adding educational content and informative sections.',
      'Integrating survey forms, charts and quiz features.',
      'Preparing project documentation.',
    ],
    startDate: '',
    endDate: '',
    status: 'Not Started',
    reflection: '',
    photos: [],
    updatedAt: '',
  },
  {
    weekNumber: 6,
    title: 'Final Review and Project Presentation',
    description:
      'Reviewed all collected responses, verified website functionality, organized actual survey records and uploaded field photographs, and finalized the CSP presentation.',
    activities: [
      'Reviewing all project activities.',
      'Testing website functionality.',
      'Organizing actual survey responses and photographs.',
      'Completing project documentation.',
      'Preparing and presenting the final CSP project.',
    ],
    startDate: '',
    endDate: '',
    status: 'Not Started',
    reflection: '',
    photos: [],
    updatedAt: '',
  },
];

export function computeActivityProgress(weeks: WeeklyActivity[]): ActivityProgressSummary {
  const totalWeeks = weeks.length || 6;
  const completedCount = weeks.filter((w) => w.status === 'Completed').length;
  const inProgressCount = weeks.filter((w) => w.status === 'In Progress').length;
  const notStartedCount = Math.max(0, totalWeeks - completedCount - inProgressCount);
  const percentComplete = Math.round((completedCount / totalWeeks) * 100);

  let overallLabel: ActivityProgressSummary['overallLabel'] = 'Not Started';
  if (completedCount === totalWeeks && totalWeeks > 0) {
    overallLabel = 'Completed';
  } else if (completedCount > 0 || inProgressCount > 0) {
    overallLabel = 'In Progress';
  }

  return {
    totalWeeks,
    completedCount,
    inProgressCount,
    notStartedCount,
    percentComplete,
    overallLabel,
  };
}

export function validateWeeklyActivityUpdate(raw: unknown): {
  valid: boolean;
  error?: string;
  sanitized?: {
    title: string;
    description: string;
    activities: string[];
    startDate: string;
    endDate: string;
    status: ActivityStatus;
    reflection: string;
  };
} {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Activity payload must be a JSON object.' };
  }

  const record = raw as Record<string, unknown>;
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const description = typeof record.description === 'string' ? record.description.trim() : '';
  const startDate = typeof record.startDate === 'string' ? record.startDate.trim() : '';
  const endDate = typeof record.endDate === 'string' ? record.endDate.trim() : '';
  const reflection = typeof record.reflection === 'string' ? record.reflection.trim() : '';
  const status = record.status as ActivityStatus;

  if (title.length < 3 || title.length > 140) {
    return { valid: false, error: 'Week title must be between 3 and 140 characters.' };
  }
  if (description.length > 1500) {
    return { valid: false, error: 'Activity description must be 1,500 characters or fewer.' };
  }
  if (!ACTIVITY_STATUSES.includes(status)) {
    return { valid: false, error: 'Status must be Not Started, In Progress, or Completed.' };
  }

  const dateRegex = /^(\d{4}-\d{2}-\d{2})?$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return { valid: false, error: 'Dates must use YYYY-MM-DD format.' };
  }
  if (startDate && endDate && endDate < startDate) {
    return { valid: false, error: 'End date cannot be earlier than start date.' };
  }
  if (reflection.length > 2000) {
    return { valid: false, error: 'Reflection must be 2,000 characters or fewer.' };
  }

  let activities: string[] = [];
  if (Array.isArray(record.activities)) {
    activities = record.activities
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0)
      .slice(0, 12)
      .map((item) => item.slice(0, 240));
  }

  return {
    valid: true,
    sanitized: {
      title,
      description,
      activities,
      startDate,
      endDate,
      status,
      reflection,
    },
  };
}

const ALLOWED_IMAGE_DATA_URL = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i;
const MAX_PHOTO_DATA_URL_CHARS = 3_800_000; // ~2.8MB base64

export function validatePhotoUpload(raw: unknown): {
  valid: boolean;
  error?: string;
  sanitized?: {
    fileName: string;
    caption: string;
    dataUrl: string;
  };
} {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Photo upload payload must be an object.' };
  }
  const record = raw as Record<string, unknown>;
  const fileName =
    typeof record.fileName === 'string' && record.fileName.trim()
      ? record.fileName.trim().slice(0, 120)
      : 'field-photo.jpg';
  const caption = typeof record.caption === 'string' ? record.caption.trim().slice(0, 200) : '';
  const dataUrl = typeof record.dataUrl === 'string' ? record.dataUrl.trim() : '';

  if (!dataUrl || !ALLOWED_IMAGE_DATA_URL.test(dataUrl)) {
    return {
      valid: false,
      error: 'Only actual JPG, PNG, or WebP photograph files are supported.',
    };
  }
  if (dataUrl.length > MAX_PHOTO_DATA_URL_CHARS) {
    return {
      valid: false,
      error: 'Photograph size is too large. Please upload an image under 2.5 MB.',
    };
  }

  return {
    valid: true,
    sanitized: { fileName, caption, dataUrl },
  };
}
