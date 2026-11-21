import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { SAMPLE_DEMO_RECORDS } from '../src/data/sampleSeed';
import {
  AgeGroup,
  DatasetCounts,
  DatasetScope,
  Gender,
  Occupation,
  PrimaryPurpose,
  PrivacyAwareness,
  ProjectSettings,
  SmartphoneBrand,
  SurveyInput,
  SurveyResponse,
  UsageDuration,
} from '../src/types/survey';

const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), 'survey_data.db');

let db: DatabaseSync | null = null;

interface RawDbRow {
  id: number;
  age_group: string;
  gender: string;
  occupation: string;
  college_name: string;
  smartphone_brand: string;
  years_of_usage: string;
  avg_daily_hours: number;
  frequent_apps: string;
  primary_purpose: string;
  edu_work_hours: number;
  entertainment_hours: number;
  privacy_awareness: string;
  excessive_usage_opinion: string;
  is_sample: number;
  created_at: string;
}

const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  collegeName: 'Sree Venkateswara College of Engineering',
  department: 'Department of Computer Science & Engineering (B.Tech CSE)',
  academicBatch: '2024–2028 · Community Service Project (CSP)',
  requireSiteGate: true,
};

function mapRow(row: RawDbRow): SurveyResponse {
  let apps: string[] = [];
  try {
    const parsed = JSON.parse(row.frequent_apps);
    if (Array.isArray(parsed)) {
      apps = parsed.map(String);
    }
  } catch {
    apps = [];
  }

  return {
    id: row.id,
    ageGroup: row.age_group as AgeGroup,
    gender: row.gender as Gender,
    occupation: row.occupation as Occupation,
    collegeName: row.college_name || 'Community / General Respondent',
    smartphoneBrand: row.smartphone_brand as SmartphoneBrand,
    yearsOfUsage: row.years_of_usage as UsageDuration,
    avgDailyHours: Number(row.avg_daily_hours),
    frequentApps: apps,
    primaryPurpose: row.primary_purpose as PrimaryPurpose,
    eduWorkHours: Number(row.edu_work_hours),
    entertainmentHours: Number(row.entertainment_hours),
    privacyAwareness: row.privacy_awareness as PrivacyAwareness,
    excessiveUsageOpinion: row.excessive_usage_opinion,
    isSample: row.is_sample === 1,
    createdAt: row.created_at,
  };
}

export function getDb(): DatabaseSync {
  if (db) return db;

  db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS survey_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      age_group TEXT NOT NULL,
      gender TEXT NOT NULL DEFAULT 'Prefer not to say',
      occupation TEXT NOT NULL,
      college_name TEXT NOT NULL DEFAULT 'Community / General Respondent',
      smartphone_brand TEXT NOT NULL,
      years_of_usage TEXT NOT NULL,
      avg_daily_hours REAL NOT NULL,
      frequent_apps TEXT NOT NULL,
      primary_purpose TEXT NOT NULL,
      edu_work_hours REAL NOT NULL,
      entertainment_hours REAL NOT NULL,
      privacy_awareness TEXT NOT NULL,
      excessive_usage_opinion TEXT NOT NULL,
      is_sample INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Safe migration for existing SQLite files created before college_name column
  const columns = db.prepare('PRAGMA table_info(survey_responses)').all() as Array<{
    name: string;
  }>;
  if (!columns.some((c) => c.name === 'college_name')) {
    db.exec(
      "ALTER TABLE survey_responses ADD COLUMN college_name TEXT NOT NULL DEFAULT 'Community / General Respondent'"
    );
  }

  const seededMeta = db
    .prepare("SELECT value FROM app_meta WHERE key = 'sample_seeded_once'")
    .get() as { value: string } | undefined;

  if (!seededMeta) {
    const countRow = db.prepare('SELECT COUNT(*) as cnt FROM survey_responses').get() as {
      cnt: number;
    };
    if (countRow.cnt === 0) {
      seedSampleRecordsInternal(db);
    }
    db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('sample_seeded_once', '1')").run();
  }

  const collegeMigrated = db
    .prepare("SELECT value FROM app_meta WHERE key = 'college_updated_svce'")
    .get() as { value: string } | undefined;

  if (!collegeMigrated) {
    db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('project_settings', ?)").run(
      JSON.stringify(DEFAULT_PROJECT_SETTINGS)
    );
    db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('college_updated_svce', '1')").run();
  }

  return db;
}

function seedSampleRecordsInternal(database: DatabaseSync): number {
  const insert = database.prepare(`
    INSERT INTO survey_responses (
      age_group, gender, occupation, college_name, smartphone_brand, years_of_usage,
      avg_daily_hours, frequent_apps, primary_purpose, edu_work_hours,
      entertainment_hours, privacy_awareness, excessive_usage_opinion,
      is_sample, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);

  const baseTime = Date.UTC(2026, 10, 10, 9, 0, 0);
  let inserted = 0;

  for (let i = 0; i < SAMPLE_DEMO_RECORDS.length; i++) {
    const rec = SAMPLE_DEMO_RECORDS[i];
    const timestamp = new Date(baseTime + i * 3600_000).toISOString();
    insert.run(
      rec.ageGroup,
      rec.gender || 'Prefer not to say',
      rec.occupation,
      rec.collegeName || 'Community / General Respondent',
      rec.smartphoneBrand,
      rec.yearsOfUsage,
      Number(rec.avgDailyHours),
      JSON.stringify(rec.frequentApps),
      rec.primaryPurpose,
      Number(rec.eduWorkHours),
      Number(rec.entertainmentHours),
      rec.privacyAwareness,
      rec.excessiveUsageOpinion.trim(),
      timestamp
    );
    inserted += 1;
  }

  return inserted;
}

export function getProjectSettings(): ProjectSettings {
  const database = getDb();
  const row = database
    .prepare("SELECT value FROM app_meta WHERE key = 'project_settings'")
    .get() as { value: string } | undefined;

  if (!row) return DEFAULT_PROJECT_SETTINGS;
  try {
    const parsed = JSON.parse(row.value) as Partial<ProjectSettings>;
    return {
      collegeName: parsed.collegeName?.trim() || DEFAULT_PROJECT_SETTINGS.collegeName,
      department: parsed.department?.trim() || DEFAULT_PROJECT_SETTINGS.department,
      academicBatch: parsed.academicBatch?.trim() || DEFAULT_PROJECT_SETTINGS.academicBatch,
      requireSiteGate:
        typeof parsed.requireSiteGate === 'boolean'
          ? parsed.requireSiteGate
          : DEFAULT_PROJECT_SETTINGS.requireSiteGate,
    };
  } catch {
    return DEFAULT_PROJECT_SETTINGS;
  }
}

export function updateProjectSettings(settings: ProjectSettings): ProjectSettings {
  const database = getDb();
  const clean: ProjectSettings = {
    collegeName: settings.collegeName.trim() || DEFAULT_PROJECT_SETTINGS.collegeName,
    department: settings.department.trim() || DEFAULT_PROJECT_SETTINGS.department,
    academicBatch: settings.academicBatch.trim() || DEFAULT_PROJECT_SETTINGS.academicBatch,
    requireSiteGate: Boolean(settings.requireSiteGate),
  };
  database
    .prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('project_settings', ?)")
    .run(JSON.stringify(clean));
  return clean;
}

export function getCounts(): DatasetCounts {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN is_sample = 0 THEN 1 ELSE 0 END), 0) as realCount,
        COALESCE(SUM(CASE WHEN is_sample = 1 THEN 1 ELSE 0 END), 0) as sampleCount
      FROM survey_responses`
    )
    .get() as { total: number; realCount: number; sampleCount: number };

  return {
    total: Number(row.total),
    realCount: Number(row.realCount),
    sampleCount: Number(row.sampleCount),
  };
}

export function getResponses(scope: DatasetScope = 'all'): SurveyResponse[] {
  const database = getDb();
  let query = 'SELECT * FROM survey_responses';
  if (scope === 'real') {
    query += ' WHERE is_sample = 0';
  } else if (scope === 'sample') {
    query += ' WHERE is_sample = 1';
  }
  query += ' ORDER BY id DESC';

  const rows = database.prepare(query).all() as unknown as RawDbRow[];
  return rows.map(mapRow);
}

export function insertSurveyResponse(input: SurveyInput, isSample = false): SurveyResponse {
  const database = getDb();
  const createdAt = new Date().toISOString();
  const gender = input.gender && input.gender.trim() ? input.gender : 'Prefer not to say';
  const collegeName =
    input.collegeName && input.collegeName.trim()
      ? input.collegeName.trim().slice(0, 120)
      : 'Community / General Respondent';

  const result = database
    .prepare(
      `INSERT INTO survey_responses (
        age_group, gender, occupation, college_name, smartphone_brand, years_of_usage,
        avg_daily_hours, frequent_apps, primary_purpose, edu_work_hours,
        entertainment_hours, privacy_awareness, excessive_usage_opinion,
        is_sample, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.ageGroup,
      gender,
      input.occupation,
      collegeName,
      input.smartphoneBrand,
      input.yearsOfUsage,
      Number(input.avgDailyHours),
      JSON.stringify(input.frequentApps),
      input.primaryPurpose,
      Number(input.eduWorkHours),
      Number(input.entertainmentHours),
      input.privacyAwareness,
      input.excessiveUsageOpinion.trim(),
      isSample ? 1 : 0,
      createdAt
    );

  const inserted = database
    .prepare('SELECT * FROM survey_responses WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as unknown as RawDbRow;

  return mapRow(inserted);
}

export function deleteResponseById(id: number): boolean {
  const database = getDb();
  const result = database.prepare('DELETE FROM survey_responses WHERE id = ?').run(id);
  return Number(result.changes) > 0;
}

export function clearSampleResponses(): number {
  const database = getDb();
  const result = database.prepare('DELETE FROM survey_responses WHERE is_sample = 1').run();
  return Number(result.changes);
}

export function restoreSampleResponses(): number {
  const database = getDb();
  database.prepare('DELETE FROM survey_responses WHERE is_sample = 1').run();
  return seedSampleRecordsInternal(database);
}
