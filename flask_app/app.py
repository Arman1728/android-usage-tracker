import csv
import io
import json
import os
import secrets
from datetime import datetime, timezone
from functools import wraps
from flask import Flask, Response, jsonify, render_template, request
from database import get_connection, init_db, row_to_dict, seed_sample_data

app = Flask(__name__)
ADMIN_PASSCODE = os.environ.get("ADMIN_PASSCODE", "12345")
ACTIVE_TOKENS = set()

VALID_AGES = {"13-17", "18-24", "25-34", "35-44", "45-59", "60+"}
VALID_OCCUPATIONS = {
    "Student",
    "Teacher",
    "Working Professional",
    "Business Owner",
    "Homemaker",
    "Senior Citizen",
}
VALID_PRIVACY = {"High", "Moderate", "Low"}


def require_admin(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = request.headers.get("x-admin-token", "")
        if not token or token not in ACTIVE_TOKENS:
            return jsonify({"error": "Admin authentication required."}), 401
        return fn(*args, **kwargs)
    return wrapper


def validate_payload(data):
    errors = {}
    if data.get("ageGroup") not in VALID_AGES:
        errors["ageGroup"] = "Select a valid age group."
    if data.get("occupation") not in VALID_OCCUPATIONS:
        errors["occupation"] = "Select a valid occupation."
    if not data.get("smartphoneBrand"):
        errors["smartphoneBrand"] = "Select a smartphone brand."
    if not data.get("yearsOfUsage"):
        errors["yearsOfUsage"] = "Select usage duration."
    try:
        daily = float(data.get("avgDailyHours", -1))
        if daily < 0.5 or daily > 24:
            errors["avgDailyHours"] = "Average daily hours must be between 0.5 and 24."
    except (TypeError, ValueError):
        errors["avgDailyHours"] = "Enter a valid number."
    apps = data.get("frequentApps") or []
    if not isinstance(apps, list) or len(apps) == 0:
        errors["frequentApps"] = "Select at least one application."
    if not data.get("primaryPurpose"):
        errors["primaryPurpose"] = "Select a primary purpose."
    try:
        edu = float(data.get("eduWorkHours", -1))
        ent = float(data.get("entertainmentHours", -1))
        if edu < 0 or edu > 24:
            errors["eduWorkHours"] = "Must be between 0 and 24."
        if ent < 0 or ent > 24:
            errors["entertainmentHours"] = "Must be between 0 and 24."
        if edu + ent > 24:
            errors["entertainmentHours"] = "Combined hours cannot exceed 24."
    except (TypeError, ValueError):
        errors["eduWorkHours"] = "Enter valid numeric hours."
    if data.get("privacyAwareness") not in VALID_PRIVACY:
        errors["privacyAwareness"] = "Select privacy awareness level."
    opinion = (data.get("excessiveUsageOpinion") or "").strip()
    if len(opinion) < 10:
        errors["excessiveUsageOpinion"] = "Provide at least 10 characters."
    return errors


def build_csv(rows):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Data Source", "Age Group", "Gender", "Occupation", "Smartphone Brand",
        "Years of Usage", "Avg Daily Hours", "Frequent Applications", "Primary Purpose",
        "Daily Edu/Work Hours", "Daily Entertainment Hours", "Privacy Awareness",
        "Opinion on Excessive Usage", "Submitted At"
    ])
    for r in rows:
        writer.writerow([
            r["id"],
            "Sample Demo" if r["isSample"] else "Real Submission",
            r["ageGroup"],
            r["gender"],
            r["occupation"],
            r["smartphoneBrand"],
            r["yearsOfUsage"],
            r["avgDailyHours"],
            "; ".join(r["frequentApps"]),
            r["primaryPurpose"],
            r["eduWorkHours"],
            r["entertainmentHours"],
            r["privacyAwareness"],
            r["excessiveUsageOpinion"],
            r["createdAt"],
        ])
    return output.getvalue()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/responses", methods=["GET"])
def get_responses():
    scope = request.args.get("scope", "all")
    query = "SELECT * FROM survey_responses"
    if scope == "real":
        query += " WHERE is_sample = 0"
    elif scope == "sample":
        query += " WHERE is_sample = 1"
    query += " ORDER BY id DESC"

    with get_connection() as conn:
        rows = [row_to_dict(r) for r in conn.execute(query).fetchall()]
        counts_row = conn.execute(
            """
            SELECT COUNT(*) AS total,
                   COALESCE(SUM(CASE WHEN is_sample = 0 THEN 1 ELSE 0 END), 0) AS realCount,
                   COALESCE(SUM(CASE WHEN is_sample = 1 THEN 1 ELSE 0 END), 0) AS sampleCount
            FROM survey_responses
            """
        ).fetchone()
    return jsonify({
        "responses": rows,
        "counts": {
            "total": counts_row["total"],
            "realCount": counts_row["realCount"],
            "sampleCount": counts_row["sampleCount"],
        },
    })


@app.route("/api/responses", methods=["POST"])
def create_response():
    data = request.get_json(silent=True) or {}
    errors = validate_payload(data)
    if errors:
        return jsonify({"error": "Validation failed", "errors": errors}), 400

    now = datetime.now(timezone.utc).isoformat()
    gender = data.get("gender") or "Prefer not to say"
    with get_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO survey_responses (
                age_group, gender, occupation, smartphone_brand, years_of_usage,
                avg_daily_hours, frequent_apps, primary_purpose, edu_work_hours,
                entertainment_hours, privacy_awareness, excessive_usage_opinion,
                is_sample, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
            """,
            (
                data["ageGroup"], gender, data["occupation"], data["smartphoneBrand"],
                data["yearsOfUsage"], float(data["avgDailyHours"]),
                json.dumps(data["frequentApps"]), data["primaryPurpose"],
                float(data["eduWorkHours"]), float(data["entertainmentHours"]),
                data["privacyAwareness"], data["excessiveUsageOpinion"].strip(), now,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM survey_responses WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify({"record": row_to_dict(row)}), 201


@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json(silent=True) or {}
    if data.get("passcode") != ADMIN_PASSCODE:
        return jsonify({"error": "Invalid admin passcode."}), 401
    token = secrets.token_hex(24)
    ACTIVE_TOKENS.add(token)
    return jsonify({"token": token})


@app.route("/api/admin/responses/<int:record_id>", methods=["DELETE"])
@require_admin
def admin_delete(record_id):
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM survey_responses WHERE id = ?", (record_id,))
        conn.commit()
        if cur.rowcount == 0:
            return jsonify({"error": "Record not found."}), 404
    return jsonify({"deletedId": record_id})


@app.route("/api/admin/sample/restore", methods=["POST"])
@require_admin
def admin_restore_samples():
    with get_connection() as conn:
        conn.execute("DELETE FROM survey_responses WHERE is_sample = 1")
        seed_sample_data(conn)
        conn.commit()
    return jsonify({"ok": True})


@app.route("/api/admin/export/csv", methods=["GET"])
@require_admin
def admin_export_csv():
    scope = request.args.get("scope", "all")
    query = "SELECT * FROM survey_responses"
    if scope == "real":
        query += " WHERE is_sample = 0"
    elif scope == "sample":
        query += " WHERE is_sample = 1"
    query += " ORDER BY id DESC"

    with get_connection() as conn:
        rows = [row_to_dict(r) for r in conn.execute(query).fetchall()]
    csv_text = build_csv(rows)
    return Response(
        csv_text,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename=android-survey-{scope}.csv"},
    )


if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=5000, debug=True)
