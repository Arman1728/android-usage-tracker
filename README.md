# Android Phone Usage by Different People — B.Tech Community Service Project (CSP)

A full-stack research, survey collection, SQLite database, and Chart.js analytics portal designed for a B.Tech Community Service Project studying Android smartphone usage across six demographic categories.

## Project Structure

This workspace provides **both** the live TypeScript/Express/React/SQLite web portal (configured for port `3000`) **and** a matching standalone Python Flask + SQLite implementation (`flask_app/`) for local VS Code academic submission:

```text
├── server.ts                  # Express + SQLite + Vite live full-stack server (port 3000)
├── server/db.ts               # SQLite schema & clearly labelled sample demo seed logic
├── src/
│   ├── components/            # Modular views (Home, About, Categories, Survey, Analytics, Table, Findings, Recommendations, Conclusion, Admin)
│   ├── utils/surveyLogic.ts   # Pure validation, analytics aggregation, findings synthesis & CSV export
│   └── data/sampleSeed.ts     # Category profiles & 18 labelled sample demonstration records
├── flask_app/                 # Standalone Python Flask + SQLite + HTML/CSS/JS + Chart.js deliverable
│   ├── app.py                 # Flask backend, REST endpoints, admin auth & CSV export
│   ├── database.py            # Python sqlite3 schema & sample demonstration seed
│   ├── templates/index.html   # Responsive HTML/Chart.js frontend
│   └── static/                # CSS and vanilla JavaScript frontend
├── requirements.txt           # Python Flask dependencies
└── package.json               # Node/Vite/Express dependencies
```

## Key Features

- **10 Complete Research Sections**: Home, About Project, User Categories, Survey Form, Analytics Dashboard, Data Table, Findings & Observations, Recommendations, Conclusion, and Admin Section.
- **12-Field Validated Survey Form**: Age group, optional gender, occupation, smartphone brand, years of usage, average daily usage hours, multi-select frequent apps, primary purpose, daily educational/work hours, entertainment hours, privacy & security awareness, and open-ended opinion.
- **Real vs. Sample Data Separation**: Real user submissions (`is_sample = 0`) are tracked separately from the 18 clearly labelled Sample Demonstration records (`is_sample = 1`) so demonstration data is never misrepresented as real field data.
- **Live Chart.js Analytics**: Interactive bar, doughnut, and pie charts updating dynamically from SQLite records.
- **Structured Data Table**: Search, Age Group filter, Occupation filter, Data Source filter, multi-column sorting, pagination, row inspection, and CSV export.
- **Authorized Admin Section**: Passcode-protected management (`12345` default, configurable via `ADMIN_PASSCODE`) to inspect/delete records, restore/clear sample demonstration data, and export all collected survey responses as CSV.

---

## Option A: Running the Node / Express / React Portal in VS Code

1. Open the project folder in **VS Code**.
2. Open the integrated terminal (`Ctrl + \``) and install dependencies:
   ```bash
   npm install
   ```
3. Start the full-stack server on port `3000`:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000` in your browser.
5. Run unit tests for validation, analytics, findings, and CSV export:
   ```bash
   npx tsx --test src/utils/surveyLogic.test.ts
   ```

---

## Option B: Running the Python Flask + SQLite Version in VS Code

1. Open the project folder in **VS Code**.
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # Windows PowerShell:
   .venv\Scripts\Activate.ps1
   # macOS / Linux:
   source .venv/bin/activate
   ```
3. Install Python dependencies from `requirements.txt`:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the Flask server:
   ```bash
   python flask_app/app.py
   ```
5. Open `http://127.0.0.1:5000` in your browser.
6. Default Admin passcode: `12345` (override by setting the `ADMIN_PASSCODE` environment variable).

---

## Option C: Production Build & Pushing to GitHub

1. Build the production frontend bundle and start the production Express + SQLite server:
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```
2. Push this project to your GitHub account from your terminal after downloading/opening the folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Android Phone Usage CSP Research Portal"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
