let adminToken = "";
let occChart = null;
let purposeChart = null;

async function loadData() {
  const res = await fetch("/api/responses?scope=all");
  const data = await res.json();
  document.getElementById("real-count").textContent = data.counts.realCount;
  document.getElementById("sample-count").textContent = data.counts.sampleCount;

  const rows = data.responses || [];
  const avg = rows.length
    ? (rows.reduce((sum, r) => sum + r.avgDailyHours, 0) / rows.length).toFixed(1)
    : "0";
  document.getElementById("avg-hours").textContent = `${avg} hrs`;

  const tbody = document.getElementById("table-body");
  tbody.innerHTML = rows
    .map(
      (r) => `<tr>
        <td>#${r.id}</td>
        <td>${r.isSample ? "Sample Demo" : "Real Submission"}</td>
        <td>${r.ageGroup}</td>
        <td>${r.occupation}</td>
        <td>${r.smartphoneBrand}</td>
        <td>${r.avgDailyHours}</td>
        <td>${r.primaryPurpose}</td>
      </tr>`
    )
    .join("");

  renderCharts(rows);
}

function renderCharts(rows) {
  const occTotals = {};
  const occCounts = {};
  const purposeCounts = {};
  for (const r of rows) {
    occTotals[r.occupation] = (occTotals[r.occupation] || 0) + r.avgDailyHours;
    occCounts[r.occupation] = (occCounts[r.occupation] || 0) + 1;
    purposeCounts[r.primaryPurpose] = (purposeCounts[r.primaryPurpose] || 0) + 1;
  }

  const occLabels = Object.keys(occTotals);
  const occAvg = occLabels.map((k) => +(occTotals[k] / occCounts[k]).toFixed(1));

  if (occChart) occChart.destroy();
  occChart = new Chart(document.getElementById("occChart"), {
    type: "bar",
    data: {
      labels: occLabels,
      datasets: [{ label: "Avg Daily Hours", data: occAvg, backgroundColor: "#0f2547" }],
    },
  });

  if (purposeChart) purposeChart.destroy();
  purposeChart = new Chart(document.getElementById("purposeChart"), {
    type: "doughnut",
    data: {
      labels: Object.keys(purposeCounts),
      datasets: [{ data: Object.values(purposeCounts), backgroundColor: ["#0f2547", "#6d28d9", "#1e40af", "#7c3aed", "#3b82f6", "#475569"] }],
    },
  });
}

document.getElementById("survey-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = {
    ageGroup: fd.get("ageGroup"),
    gender: fd.get("gender"),
    occupation: fd.get("occupation"),
    smartphoneBrand: fd.get("smartphoneBrand"),
    yearsOfUsage: fd.get("yearsOfUsage"),
    avgDailyHours: Number(fd.get("avgDailyHours")),
    frequentApps: fd.getAll("frequentApps"),
    primaryPurpose: fd.get("primaryPurpose"),
    eduWorkHours: Number(fd.get("eduWorkHours")),
    entertainmentHours: Number(fd.get("entertainmentHours")),
    privacyAwareness: fd.get("privacyAwareness"),
    excessiveUsageOpinion: fd.get("excessiveUsageOpinion"),
  };
  const res = await fetch("/api/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const statusEl = document.getElementById("form-status");
  if (res.ok) {
    statusEl.textContent = "Survey response saved to SQLite database.";
    e.target.reset();
    await loadData();
  } else {
    const err = await res.json();
    statusEl.textContent = err.error || "Please verify all required fields.";
  }
});

document.getElementById("admin-login-btn").addEventListener("click", async () => {
  const passcode = document.getElementById("admin-passcode").value;
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passcode }),
  });
  if (res.ok) {
    const data = await res.json();
    adminToken = data.token;
    document.getElementById("admin-login").hidden = true;
    document.getElementById("admin-panel").hidden = false;
  }
});

document.getElementById("admin-export-btn").addEventListener("click", async () => {
  const res = await fetch("/api/admin/export/csv?scope=all", {
    headers: { "x-admin-token": adminToken },
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "android-survey-all.csv";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("admin-restore-btn").addEventListener("click", async () => {
  await fetch("/api/admin/sample/restore", {
    method: "POST",
    headers: { "x-admin-token": adminToken },
  });
  await loadData();
});

loadData();
