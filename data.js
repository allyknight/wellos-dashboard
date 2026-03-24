/* ============================================================
   WLOS Program Data
   ─────────────────────────────────────────────────────────────
   Edit this file to update the dashboard with real project data.
   All dates use ISO 8601 format: "YYYY-MM-DD"
   Status values: "on-track" | "at-risk" | "blocked" | "completed" | "not-started"
   ============================================================ */

const DASHBOARD_DATA = {

  /* ── META ─────────────────────────────────────────────── */
  meta: {
    programName:  "WLOS Program",
    organization: "RVO Health",
    overallStatus: "on-track",           // drives header health badge
    lastUpdated:  "2026-03-21",
    programLead:  "Alex Knight",
    quarter:      "Q1–Q2 2026",
  },

  /* ── KPI CARDS ────────────────────────────────────────── */
  kpis: [
    {
      label:  "Overall Progress",
      value:  "48%",
      sub:    "Across all initiatives",
      trend:  "+6% vs last month",
      dir:    "up",
      accent: "#0052CC",
    },
    {
      label:  "Epics On Track",
      value:  "11",
      sub:    "of 18 total epics",
      trend:  "2 completed this sprint",
      dir:    "up",
      accent: "#36B37E",
    },
    {
      label:  "At Risk",
      value:  "4",
      sub:    "Epics need attention",
      trend:  "1 new since last review",
      dir:    "down",
      accent: "#FF991F",
    },
    {
      label:  "Active Blockers",
      value:  "2",
      sub:    "Escalation required",
      trend:  "Same as last week",
      dir:    "flat",
      accent: "#DE350B",
    },
    {
      label:  "Sprints Remaining",
      value:  "8",
      sub:    "Until Q2 target",
      trend:  "On schedule",
      dir:    "flat",
      accent: "#6554C0",
    },
  ],

  /* ── INITIATIVES ──────────────────────────────────────── */
  initiatives: [
    {
      id:     "INIT-01",
      name:   "Member Personalization Engine",
      desc:   "Build a recommendation system that tailors weight-loss plans, content, and coaching nudges to each member's progress, preferences, and behavior signals.",
      status: "on-track",
      progress: 62,
      owner:  "Sarah Chen",
      startDate: "2026-01-06",
      endDate:   "2026-06-30",
      epicIds: ["E-01", "E-02", "E-03", "E-04"],
    },
    {
      id:     "INIT-02",
      name:   "Provider & Care Team Integration",
      desc:   "Connect members with their healthcare providers by surfacing structured data, clinical notes, and check-in summaries directly within the WLOS platform.",
      status: "at-risk",
      progress: 38,
      owner:  "Marcus Webb",
      startDate: "2026-01-20",
      endDate:   "2026-07-31",
      epicIds: ["E-05", "E-06", "E-07"],
    },
    {
      id:     "INIT-03",
      name:   "GLP-1 Member Support",
      desc:   "Deliver a guided, medication-aware experience for members using GLP-1 medications—side-effect tracking, nutrition guidance, and progress milestones.",
      status: "on-track",
      progress: 55,
      owner:  "Jamie Torres",
      startDate: "2026-02-03",
      endDate:   "2026-06-15",
      epicIds: ["E-08", "E-09", "E-10", "E-11"],
    },
    {
      id:     "INIT-04",
      name:   "Data & Analytics Foundation",
      desc:   "Establish a reliable, privacy-compliant data pipeline and self-service analytics layer to power real-time reporting for product, clinical, and business teams.",
      status: "on-track",
      progress: 71,
      owner:  "Priya Nair",
      startDate: "2025-11-01",
      endDate:   "2026-04-30",
      epicIds: ["E-12", "E-13", "E-14"],
    },
    {
      id:     "INIT-05",
      name:   "Mobile App Revamp",
      desc:   "Redesign the WLOS iOS and Android apps for improved engagement, accessibility, and performance—including a refreshed home dashboard and onboarding flow.",
      status: "blocked",
      progress: 25,
      owner:  "Devon Park",
      startDate: "2026-02-17",
      endDate:   "2026-09-30",
      epicIds: ["E-15", "E-16", "E-17", "E-18"],
    },
  ],

  /* ── EPICS ────────────────────────────────────────────── */
  epics: [
    // INIT-01: Member Personalization
    { id: "E-01", name: "Behavioral Signals Pipeline",       initiative: "INIT-01", owner: "Sarah Chen",   status: "completed",   progress: 100, targetDate: "2026-02-28" },
    { id: "E-02", name: "Recommendation Algorithm v1",       initiative: "INIT-01", owner: "Raj Patel",    status: "on-track",    progress: 70,  targetDate: "2026-04-30" },
    { id: "E-03", name: "Personalized Content Feed",         initiative: "INIT-01", owner: "Mei Lin",      status: "on-track",    progress: 55,  targetDate: "2026-05-31" },
    { id: "E-04", name: "Coaching Nudge Engine",             initiative: "INIT-01", owner: "Tom Reyes",    status: "at-risk",     progress: 30,  targetDate: "2026-06-15" },

    // INIT-02: Provider Integration
    { id: "E-05", name: "EHR Data Ingestion Layer",          initiative: "INIT-02", owner: "Marcus Webb",  status: "at-risk",     progress: 40,  targetDate: "2026-04-15" },
    { id: "E-06", name: "Provider Portal Prototype",         initiative: "INIT-02", owner: "Lena Scott",   status: "not-started", progress: 0,   targetDate: "2026-06-30" },
    { id: "E-07", name: "Care Summary Export (HL7 FHIR)",    initiative: "INIT-02", owner: "Marcus Webb",  status: "blocked",     progress: 15,  targetDate: "2026-05-01" },

    // INIT-03: GLP-1 Support
    { id: "E-08", name: "Medication Tracking Module",        initiative: "INIT-03", owner: "Jamie Torres", status: "completed",   progress: 100, targetDate: "2026-03-07" },
    { id: "E-09", name: "Side-Effect Symptom Logger",        initiative: "INIT-03", owner: "Aisha Grant",  status: "on-track",    progress: 75,  targetDate: "2026-04-01" },
    { id: "E-10", name: "GLP-1 Nutrition Content Library",   initiative: "INIT-03", owner: "Jamie Torres", status: "on-track",    progress: 60,  targetDate: "2026-04-30" },
    { id: "E-11", name: "Progress Milestone Celebrations",   initiative: "INIT-03", owner: "Mei Lin",      status: "at-risk",     progress: 20,  targetDate: "2026-05-15" },

    // INIT-04: Data Foundation
    { id: "E-12", name: "Event Streaming Infrastructure",    initiative: "INIT-04", owner: "Priya Nair",   status: "completed",   progress: 100, targetDate: "2026-01-31" },
    { id: "E-13", name: "Member Data Warehouse (Phase 1)",   initiative: "INIT-04", owner: "Priya Nair",   status: "on-track",    progress: 85,  targetDate: "2026-03-31" },
    { id: "E-14", name: "Self-Service Analytics Dashboard",  initiative: "INIT-04", owner: "Cole Nash",    status: "on-track",    progress: 65,  targetDate: "2026-04-30" },

    // INIT-05: Mobile Revamp
    { id: "E-15", name: "Design System Update",              initiative: "INIT-05", owner: "Devon Park",   status: "on-track",    progress: 50,  targetDate: "2026-04-30" },
    { id: "E-16", name: "Home Dashboard Redesign",           initiative: "INIT-05", owner: "Devon Park",   status: "at-risk",     progress: 30,  targetDate: "2026-06-15" },
    { id: "E-17", name: "Onboarding Flow Revamp",            initiative: "INIT-05", owner: "Kim Russo",    status: "blocked",     progress: 10,  targetDate: "2026-07-31" },
    { id: "E-18", name: "Accessibility Compliance (WCAG 2.2)",initiative:"INIT-05", owner: "Devon Park",   status: "not-started", progress: 0,   targetDate: "2026-08-31" },
  ],

  /* ── MILESTONES ───────────────────────────────────────── */
  milestones: [
    { name: "Data Warehouse Phase 1 Complete", date: "2026-03-31", owner: "Priya Nair",   type: "upcoming" },
    { name: "GLP-1 Side-Effect Logger Launch",  date: "2026-04-01", owner: "Aisha Grant",  type: "upcoming" },
    { name: "Recommendation Algorithm Beta",    date: "2026-04-30", owner: "Raj Patel",    type: "future"   },
    { name: "EHR Ingestion Layer — Go/No-Go",   date: "2026-04-15", owner: "Marcus Webb",  type: "upcoming" },
    { name: "Mobile Design System Handoff",     date: "2026-04-30", owner: "Devon Park",   type: "future"   },
    { name: "GLP-1 Content Library Launch",     date: "2026-04-30", owner: "Jamie Torres", type: "future"   },
    { name: "Self-Service Analytics v1",        date: "2026-04-30", owner: "Cole Nash",    type: "future"   },
    { name: "Personalized Content Feed Beta",   date: "2026-05-31", owner: "Mei Lin",      type: "future"   },
  ],

  /* ── BLOCKERS ─────────────────────────────────────────── */
  blockers: [
    {
      title:  "FHIR API contract not finalized with partner EHR vendor",
      detail: "The HL7 FHIR endpoint spec is still pending sign-off from a third-party EHR vendor. This is blocking E-07 (Care Summary Export) and delaying E-05.",
      epic:   "E-07",
      owner:  "Marcus Webb",
      since:  "2026-03-10",
      action: "Escalated to VP Engineering — review call scheduled Mar 28",
    },
    {
      title:  "Mobile app design system approval stuck in brand review",
      detail: "Updated component library is awaiting brand team sign-off before engineering can begin implementation. E-17 (Onboarding) cannot start until unblocked.",
      epic:   "E-17",
      owner:  "Devon Park",
      since:  "2026-03-17",
      action: "Brand review scheduled for Mar 25 — decision expected same day",
    },
  ],

  /* ── RISKS ────────────────────────────────────────────── */
  risks: [
    {
      title:  "Coaching Nudge Engine scope creep risk",
      detail: "ML model requirements have grown beyond original spec. May need to defer v1 features to hit the June 15 target.",
      epic:   "E-04",
      owner:  "Tom Reyes",
      severity: "high",
    },
    {
      title:  "GLP-1 Milestone feature dependency on Behavioral Signals",
      detail: "Progress Milestone Celebrations (E-11) needs output from the Recommendation Algorithm (E-02). If E-02 slips, E-11 is at risk.",
      epic:   "E-11",
      owner:  "Jamie Torres",
      severity: "medium",
    },
    {
      title:  "EHR Data Ingestion requires HIPAA security review",
      detail: "Security review for the new data ingestion layer has not yet been scheduled. Could add 2–3 weeks to the timeline if not prioritized soon.",
      epic:   "E-05",
      owner:  "Marcus Webb",
      severity: "high",
    },
    {
      title:  "Mobile Home Dashboard resource gap",
      detail: "One senior mobile engineer is on leave until April 14. Capacity is reduced and the June 15 target for E-16 is at risk.",
      epic:   "E-16",
      owner:  "Devon Park",
      severity: "medium",
    },
  ],

  /* ── UPDATES ──────────────────────────────────────────── */
  updates: [
    { author: "PrN", name: "Priya Nair",   time: "Mar 21",  text: "<strong>Data Warehouse Phase 1</strong> is 85% complete and on track for March 31 delivery. All critical partitions tested." },
    { author: "JT",  name: "Jamie Torres", time: "Mar 20",  text: "<strong>Medication Tracking Module (E-08)</strong> shipped to production. Member adoption tracking will begin next sprint." },
    { author: "MW",  name: "Marcus Webb",  time: "Mar 19",  text: "<strong>FHIR blocker</strong> escalated to VP Engineering. Vendor call scheduled for March 28 to resolve contract terms." },
    { author: "DP",  name: "Devon Park",   time: "Mar 18",  text: "<strong>Design System Update</strong> is progressing well. Component library 50% complete, targeting April 30 handoff." },
    { author: "SC",  name: "Sarah Chen",   time: "Mar 17",  text: "<strong>Behavioral Signals Pipeline (E-01)</strong> marked complete. Integration tests passed; data flowing to downstream consumers." },
    { author: "AG",  name: "Aisha Grant",  time: "Mar 14",  text: "<strong>Side-Effect Logger</strong> user research complete. Final designs approved; development 75% done." },
  ],

  /* ── GANTT / TIMELINE ─────────────────────────────────── */
  gantt: {
    startMonth: "2026-01",   // first column month
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    rows: [
      { label: "Personalization Engine",    start: "2026-01-06", end: "2026-06-30", status: "on-track" },
      { label: "  › Behavioral Signals",    start: "2026-01-06", end: "2026-02-28", status: "completed" },
      { label: "  › Recommendation Algo",  start: "2026-02-01", end: "2026-04-30", status: "on-track" },
      { label: "  › Coaching Nudge Engine", start: "2026-03-01", end: "2026-06-15", status: "at-risk" },
      { label: "Provider Integration",      start: "2026-01-20", end: "2026-07-31", status: "at-risk" },
      { label: "  › EHR Ingestion",         start: "2026-01-20", end: "2026-04-15", status: "at-risk" },
      { label: "  › Care Summary (FHIR)",   start: "2026-02-01", end: "2026-05-01", status: "blocked" },
      { label: "GLP-1 Support",             start: "2026-02-03", end: "2026-06-15", status: "on-track" },
      { label: "  › Medication Tracking",   start: "2026-02-03", end: "2026-03-07", status: "completed" },
      { label: "  › Side-Effect Logger",    start: "2026-02-17", end: "2026-04-01", status: "on-track" },
      { label: "Data Foundation",           start: "2025-11-01", end: "2026-04-30", status: "on-track" },
      { label: "  › Data Warehouse Ph.1",   start: "2025-11-01", end: "2026-03-31", status: "on-track" },
      { label: "  › Self-Service Analytics",start: "2026-02-01", end: "2026-04-30", status: "on-track" },
      { label: "Mobile App Revamp",         start: "2026-02-17", end: "2026-09-30", status: "blocked" },
      { label: "  › Design System",         start: "2026-02-17", end: "2026-04-30", status: "on-track" },
      { label: "  › Onboarding Revamp",     start: "2026-04-01", end: "2026-07-31", status: "blocked" },
    ],
  },

};
