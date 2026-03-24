/* ============================================================
   WLOS Stakeholder Dashboard — App Logic
   ============================================================ */

const D = DASHBOARD_DATA;

/* ── UTILS ─────────────────────────────────────────────── */
function statusLabel(s) {
  return { "on-track": "On Track", "at-risk": "At Risk", "blocked": "Blocked",
           "completed": "Completed", "not-started": "Not Started" }[s] || s;
}

function fmt(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function initiativeName(id) {
  const i = D.initiatives.find(x => x.id === id);
  return i ? i.name : id;
}

function daysUntil(dateStr) {
  const now = new Date();
  now.setHours(0,0,0,0);
  const t = new Date(dateStr + "T00:00:00");
  return Math.round((t - now) / 86400000);
}

/* ── HEADER & META ──────────────────────────────────────── */
function initMeta() {
  const badge = document.getElementById("overallHealthBadge");
  const s = D.meta.overallStatus;
  badge.className = `health-badge ${s}`;
  badge.querySelector(".health-label").textContent = statusLabel(s);

  document.getElementById("lastUpdated").textContent = `Last updated: ${fmt(D.meta.lastUpdated)}`;
  document.getElementById("footerDate").textContent = `Q: ${D.meta.quarter}`;
}

/* ── TAB NAVIGATION ──────────────────────────────────────── */
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });
}

/* ── KPI CARDS ───────────────────────────────────────────── */
function renderKPIs() {
  const grid = document.getElementById("kpiGrid");
  grid.innerHTML = D.kpis.map(k => `
    <div class="kpi-card" style="--accent:${k.accent}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
      <div class="kpi-trend ${k.dir}">${k.dir === "up" ? "↑" : k.dir === "down" ? "↓" : "→"} ${k.trend}</div>
    </div>
  `).join("");
}

/* ── INITIATIVE BARS (Overview tab) ────────────────────────── */
function renderInitiativeBarsOverview() {
  const el = document.getElementById("initiativeBarsOverview");
  el.innerHTML = D.initiatives.map(i => `
    <div class="initiative-bar-row">
      <div class="initiative-bar-label">
        <span class="initiative-bar-name">${i.name}</span>
        <span class="initiative-bar-pct">${i.progress}%</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill ${i.status}" style="width:${i.progress}%"></div>
      </div>
      <div class="initiative-bar-status">
        <span class="status-badge ${i.status}">${statusLabel(i.status)}</span>
      </div>
    </div>
  `).join("");
}

/* ── EPIC STATUS DONUT CHART ─────────────────────────────── */
function renderEpicDonut() {
  const counts = { "on-track": 0, "at-risk": 0, "blocked": 0, "completed": 0, "not-started": 0 };
  D.epics.forEach(e => counts[e.status]++);

  const labels   = ["On Track", "At Risk", "Blocked", "Completed", "Not Started"];
  const values   = [counts["on-track"], counts["at-risk"], counts["blocked"], counts["completed"], counts["not-started"]];
  const colors   = ["#36B37E", "#FF991F", "#DE350B", "#6554C0", "#97A0AF"];
  const statuses = ["on-track", "at-risk", "blocked", "completed", "not-started"];

  const ctx = document.getElementById("epicStatusChart").getContext("2d");
  new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: "#fff" }] },
    options: {
      cutout: "68%",
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} epics` }
      }},
    }
  });

  const legend = document.getElementById("donutLegend");
  legend.innerHTML = statuses.map((s, i) => values[i] > 0 ? `
    <div class="legend-item">
      <div class="legend-dot" style="background:${colors[i]}"></div>
      <span class="legend-label">${labels[i]}</span>
      <span class="legend-count">${values[i]}</span>
    </div>
  ` : "").join("");
}

/* ── MILESTONES ──────────────────────────────────────────── */
function renderMilestones() {
  const el = document.getElementById("milestoneStrip");
  const sorted = [...D.milestones].sort((a, b) => new Date(a.date) - new Date(b.date));
  el.innerHTML = sorted.map(m => {
    const d = daysUntil(m.date);
    let typeClass = m.type;
    let dLabel = d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "Today" : `in ${d}d`;
    return `
      <div class="milestone-card ${typeClass}">
        <div class="milestone-date">${fmt(m.date)} &middot; ${dLabel}</div>
        <div class="milestone-name">${m.name}</div>
        <div class="milestone-owner">${m.owner}</div>
      </div>
    `;
  }).join("");
}

/* ── INITIATIVE CARDS (Initiatives tab) ─────────────────── */
function renderInitiativeCards() {
  const container = document.getElementById("initiativeCards");
  container.innerHTML = D.initiatives.map(init => {
    const epics = D.epics.filter(e => init.epicIds.includes(e.id));
    const done  = epics.filter(e => e.status === "completed").length;

    const epicsHtml = epics.map(e => `
      <div class="init-epic-row">
        <span class="init-epic-name">${e.name}</span>
        <div class="init-epic-bar"><div class="init-epic-fill" style="width:${e.progress}%"></div></div>
        <span class="init-epic-pct">${e.progress}%</span>
        <span class="status-badge ${e.status}" style="font-size:.68rem;padding:.15rem .45rem">${statusLabel(e.status)}</span>
      </div>
    `).join("");

    return `
      <div class="init-card">
        <div class="init-card-header">
          <div class="init-card-title">${init.name}</div>
          <span class="status-badge ${init.status}">${statusLabel(init.status)}</span>
        </div>
        <div class="init-card-desc">${init.desc}</div>

        <div class="init-stats">
          <div class="init-stat-item">
            <div class="init-stat-num">${init.progress}%</div>
            <div class="init-stat-lbl">Progress</div>
          </div>
          <div class="init-stat-item">
            <div class="init-stat-num">${done}/${epics.length}</div>
            <div class="init-stat-lbl">Epics Done</div>
          </div>
          <div class="init-stat-item">
            <div class="init-stat-num">${init.owner.split(" ")[0]}</div>
            <div class="init-stat-lbl">Owner</div>
          </div>
        </div>

        <div class="card-header" style="margin-top:.25rem">
          <span style="font-size:.78rem;font-weight:700;color:var(--text-secondary)">EPICS</span>
          <span style="font-size:.75rem;color:var(--text-muted)">${fmt(init.startDate)} → ${fmt(init.endDate)}</span>
        </div>
        <div class="init-epics">${epicsHtml}</div>
      </div>
    `;
  }).join("");
}

/* ── EPICS TABLE ─────────────────────────────────────────── */
function renderEpicsTable() {
  const tbody = document.getElementById("epicsTableBody");
  tbody.innerHTML = D.epics.map(e => `
    <tr data-status="${e.status}">
      <td class="epic-name">${e.name}</td>
      <td style="font-size:.82rem;color:var(--text-secondary)">${initiativeName(e.initiative)}</td>
      <td class="epic-owner">${e.owner}</td>
      <td><span class="status-badge ${e.status}">${statusLabel(e.status)}</span></td>
      <td>
        <div class="epic-progress-wrap">
          <div class="epic-progress-bar">
            <div class="epic-progress-fill" style="width:${e.progress}%;background:${progressColor(e.status)}"></div>
          </div>
          <span class="epic-progress-pct">${e.progress}%</span>
        </div>
      </td>
      <td class="epic-date">${fmt(e.targetDate)}</td>
    </tr>
  `).join("");
}

function progressColor(status) {
  return { "on-track": "#36B37E", "at-risk": "#FF991F", "blocked": "#DE350B",
           "completed": "#6554C0", "not-started": "#97A0AF" }[status] || "#0052CC";
}

function initEpicsFilter() {
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const filter = btn.dataset.filter;
      document.querySelectorAll("#epicsTableBody tr").forEach(row => {
        row.classList.toggle("hidden", filter !== "all" && row.dataset.status !== filter);
      });
    });
  });
}

/* ── RISKS & BLOCKERS ────────────────────────────────────── */
function renderRisks() {
  document.getElementById("blockerCount").textContent = D.blockers.length;
  document.getElementById("riskCount").textContent = D.risks.length;

  document.getElementById("blockersList").innerHTML = D.blockers.map(b => `
    <div class="blocker-item">
      <div class="risk-icon blocked">🚫</div>
      <div class="risk-body">
        <div class="risk-title">${b.title}</div>
        <div class="risk-detail">${b.detail}</div>
        <div class="risk-meta">Epic: ${b.epic} &middot; Owner: ${b.owner} &middot; Since: ${fmt(b.since)}</div>
        <div class="risk-meta" style="margin-top:.3rem;color:#974F0C;font-weight:600">Action: ${b.action}</div>
      </div>
    </div>
  `).join("");

  document.getElementById("risksList").innerHTML = D.risks.map(r => `
    <div class="risk-item">
      <div class="risk-icon at-risk">⚠️</div>
      <div class="risk-body">
        <div class="risk-title">${r.title}</div>
        <div class="risk-detail">${r.detail}</div>
        <div class="risk-meta">Epic: ${r.epic} &middot; Owner: ${r.owner} &middot; Severity: <strong>${r.severity}</strong></div>
      </div>
    </div>
  `).join("");
}

/* ── UPDATES FEED ────────────────────────────────────────── */
function renderUpdates() {
  document.getElementById("updatesFeed").innerHTML = D.updates.map(u => `
    <div class="update-item">
      <div class="update-avatar">${u.author}</div>
      <div class="update-body">
        <div class="update-text">${u.text}</div>
        <div class="update-time">${u.name} &middot; ${u.time}</div>
      </div>
    </div>
  `).join("");
}

/* ── GANTT CHART ─────────────────────────────────────────── */
function renderGantt() {
  const { months, rows, startMonth } = D.gantt;
  const totalMonths = months.length;

  // Parse the gantt's start point (e.g. "2026-01" → year 2026, month index 0)
  const [startYear, startMonthIdx] = startMonth
    ? [parseInt(startMonth.slice(0,4),10), parseInt(startMonth.slice(5,7),10) - 1]
    : [new Date().getFullYear(), 0];

  // Convert a date string to a 0–1 fraction within the gantt's month range
  function dateFrac(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    // Total months elapsed from the gantt start to this date
    const monthsElapsed = (d.getFullYear() - startYear) * 12 + (d.getMonth() - startMonthIdx)
                        + d.getDate() / 31;
    return monthsElapsed / totalMonths;
  }

  // Today's position
  const todayFrac = Math.min(1, Math.max(0, dateFrac(new Date().toISOString().slice(0,10))));

  const container = document.getElementById("ganttChart");
  let html = `<div class="gantt-container">`;

  // Month header
  html += `<div class="gantt-header">${months.map(m => `<div class="gantt-month">${m}</div>`).join("")}</div>`;

  rows.forEach(row => {
    const leftPct  = Math.max(0,   dateFrac(row.start) * 100);
    const rightPct = Math.min(100, dateFrac(row.end)   * 100);
    const widthPct = Math.max(2,   rightPct - leftPct);

    html += `
      <div class="gantt-row">
        <div class="gantt-label">${row.label}</div>
        <div class="gantt-lane">
          <div class="gantt-bar ${row.status}"
               style="left:${leftPct.toFixed(1)}%;width:${widthPct.toFixed(1)}%"
               title="${row.label}: ${row.start} → ${row.end}">
            ${row.label.startsWith("  ") ? "" : row.label}
          </div>
          <div class="gantt-today-line" style="left:${(todayFrac * 100).toFixed(1)}%">
            <div class="gantt-today-label">Today</div>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

/* ── BOOTSTRAP ───────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  initMeta();
  initTabs();
  renderKPIs();
  renderInitiativeBarsOverview();
  renderEpicDonut();
  renderMilestones();
  renderInitiativeCards();
  renderEpicsTable();
  initEpicsFilter();
  renderRisks();
  renderUpdates();
  renderGantt();
});
