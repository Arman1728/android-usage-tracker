import json
import os
import sqlite3
from datetime import datetime, timezone

DB_PATH = os.environ.get("FLASK_DB_PATH", os.path.join(os.path.dirname(__file__), "csp_survey.db"))

SAMPLE_DEMO_DATA = [
    ("18-24", "Female", "Student", "Xiaomi / Redmi", "3-5 years", 6.5, ["WhatsApp", "YouTube", "Instagram", "Google Classroom / Meet"], "Education & Learning", 3.0, 2.5, "Moderate", "Useful for recorded B.Tech lectures, though reels extend night usage."),
    ("18-24", "Male", "Student", "OnePlus", "3-5 years", 7.2, ["YouTube", "WhatsApp", "Instagram", "Gaming Apps"], "Entertainment & Media", 2.2, 3.8, "High", "Helpful for coding tutorials, but gaming makes study focus harder."),
    ("35-44", "Female", "Teacher", "Samsung", "6-8 years", 4.5, ["WhatsApp", "Google Classroom / Meet", "LinkedIn / Email", "Google Chrome"], "Work & Productivity", 3.0, 0.8, "High", "Essential for sharing notes; after-hours messages cause fatigue."),
    ("25-34", "Male", "Working Professional", "Google Pixel", "More than 8 years", 5.8, ["LinkedIn / Email", "WhatsApp", "UPI / Payment Apps", "Maps / Navigation"], "Work & Productivity", 3.5, 1.4, "High", "Indispensable for 2FA and commuting; requires digital wellbeing timers."),
    ("35-44", "Male", "Business Owner", "Vivo", "6-8 years", 6.2, ["WhatsApp", "UPI / Payment Apps", "Maps / Navigation", "Google Chrome"], "Business & Finance", 4.2, 1.0, "Moderate", "Runs shop billing and UPI tracking, though spam calls are frequent."),
    ("35-44", "Female", "Homemaker", "Xiaomi / Redmi", "3-5 years", 3.6, ["WhatsApp", "YouTube", "E-commerce / Shopping", "UPI / Payment Apps"], "Communication & Social", 0.8, 1.8, "Moderate", "Convenient for grocery orders and recipes; overuse causes neck strain."),
    ("60+", "Male", "Senior Citizen", "Samsung", "3-5 years", 2.4, ["WhatsApp", "YouTube", "News / Weather", "Maps / Navigation"], "Daily Utilities & Information", 0.4, 1.1, "Low", "Helpful for morning news and video calls, but suspicious links worry me."),
]


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS survey_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                age_group TEXT NOT NULL,
                gender TEXT NOT NULL DEFAULT 'Prefer not to say',
                occupation TEXT NOT NULL,
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
            )
            """
        )
        conn.execute(
            "CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
        )
        meta = conn.execute("SELECT value FROM app_meta WHERE key = 'seeded_once'").fetchone()
        if not meta:
            count = conn.execute("SELECT COUNT(*) AS c FROM survey_responses").fetchone()["c"]
            if count == 0:
                seed_sample_data(conn)
            conn.execute("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('seeded_once', '1')")
        conn.commit()


def seed_sample_data(conn):
    now = datetime.now(timezone.utc).isoformat()
    for row in SAMPLE_DEMO_DATA:
        conn.execute(
            """
            INSERT INTO survey_responses (
                age_group, gender, occupation, smartphone_brand, years_of_usage,
                avg_daily_hours, frequent_apps, primary_purpose, edu_work_hours,
                entertainment_hours, privacy_awareness, excessive_usage_opinion,
                is_sample, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            """,
            (
                row[0], row[1], row[2], row[3], row[4], row[5],
                json.dumps(row[6]), row[7], row[8], row[9], row[10], row[11], now
            ),
        )


def row_to_dict(row):
    return {
        "id": row["id"],
        "ageGroup": row["age_group"],
        "gender": row["gender"],
        "occupation": row["occupation"],
        "smartphoneBrand": row["smartphone_brand"],
        "yearsOfUsage": row["years_of_usage"],
        "avgDailyHours": float(row["avg_daily_hours"]),
        "frequentApps": json.loads(row["frequent_apps"]),
        "primaryPurpose": row["primary_purpose"],
        "eduWorkHours": float(row["edu_work_hours"]),
        "entertainmentHours": float(row["entertainment_hours"]),
        "privacyAwareness": row["privacy_awareness"],
        "excessiveUsageOpinion": row["excessive_usage_opinion"],
        "isSample": bool(row["is_sample"]),
        "createdAt": row["created_at"],
    }
