#!/usr/bin/env node
/**
 * sync-jira.js
 *
 * Fetches live epic + initiative data from the WLOS Jira project,
 * merges it with manually maintained content in data-manual.json,
 * and writes a fresh data.js for the stakeholder dashboard.
 *
 * Required environment variables:
 *   JIRA_EMAIL      – your Atlassian account email
 *   JIRA_API_TOKEN  – your Atlassian API token
 *
 * Optional (defaults shown):
 *   JIRA_BASE_URL   – https://rvohealth.atlassian.net
 *   JIRA_PROJECT    – WLOS
 */

'use strict';

const { readFileSync, writeFileSync } = require('fs');
const { resolve }                     = require('path');

// ── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.JIRA_BASE_URL || 'https://rvohealth.atlassian.net').replace(/\/$/, '');
const PROJECT  = process.env.JIRA_PROJECT   || 'WLOS';
const EMAIL    = process.env.JIRA_EMAIL;
const TOKEN    = process.env.JIRA_API_TOKEN;

if (!EMAIL || !TOKEN) {
  console.error('❌  Missing JIRA_EMAIL or JIRA_API_TOKEN environment variables.');
  process.exit(1);
}

const AUTH_HEADER = 'Basic ' + Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');

// ── Jira API helpers ─────────────────────────────────────────────────────────

async function jiraGet(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const res = await fetch(url.toString(), {
    headers: { Authorization: AUTH_HEADER, Accept: 'application/json' },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jira ${res.status} on ${path}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Pages through all results for a JQL query, handling Jira's 100-issue cap.
 */
async function searchAll(jql, fields, maxTotal = 500) {
  const issues    = [];
  const pageSize  = 100;
  let   startAt   = 0;

  while (issues.length < maxTotal) {
    const data = await jiraGet('/rest/api/3/search', {
      jql,
      fields: fields.join(','),
      maxResults: pageSize,
      startAt,
    });

    const page = data.issues || [];
    issues.push(...page);
    startAt += page.length;

    if (startAt >= data.total || page.length === 0) break;
  }

  return issues;
}

// ── Status mapping ────────────────────────────────────────────────────────────

function mapStatus(issue) {
  const catKey = (issue.fields?.status?.statusCategory?.key || '').toLowerCase();
  const name   = (issue.fields?.status?.name || '').toLowerCase();

  if (name.includes('block') || name.includes('impediment')) return 'blocked';
  if (catKey === 'done')         return 'completed';
  if (catKey === 'indeterminate') {
    if (name.includes('risk') || name.includes('delay') || name.includes('hold')) return 'at-risk';
    return 'on-track';
  }
  return 'not-started';
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function isoDate(str) {
  if (!str) return null;
  return str.split('T')[0]; // "YYYY-MM-DD"
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0].replace(/-/g, '/'); // Jira date format
}

function shortDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Gantt builder ─────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Builds the gantt section from live Jira dates.
 *
 * Layout: one initiative header row (spanning its earliest→latest epic),
 * followed by indented sub-rows for each epic in that initiative.
 *
 * Date sourcing priority for each epic:
 *   startDate  → epic's startdate / customfield_10015 from Jira
 *   targetDate → epic's duedate from Jira
 *   fallback   → derived from sibling epics or initiative bounds
 *
 * Falls back to manual.gantt when no epics have any dates at all.
 */
function buildGantt(initiatives, epics, jiraInitiatives, manual) {
  const year       = new Date().getFullYear();
  const yearStr    = String(year);
  const fallbackS  = `${yearStr}-01-01`;
  const fallbackE  = `${yearStr}-12-31`;

  // Check whether Jira gave us any real dates to work with
  const hasDates = epics.some(e => e.startDate || e.targetDate);
  if (!hasDates) {
    console.log('  ℹ  No start/end dates found on epics — using manual gantt');
    return manual.gantt || { startMonth: `${yearStr}-01`, months: MONTH_NAMES, rows: [] };
  }

  const rows = [];

  initiatives.forEach(init => {
    const myEpics = epics.filter(e => init.epicIds.includes(e.id));
    if (myEpics.length === 0) return;

    // Collect all known dates across this initiative's epics
    const allStarts = myEpics.map(e => e.startDate).filter(Boolean).sort();
    const allEnds   = myEpics.map(e => e.targetDate).filter(Boolean).sort();

    // Initiative's own Jira dates (if it exists as an issue type)
    const jiraInit   = jiraInitiatives.find(i => i.key === init.id);
    const initStart  = isoDate(jiraInit?.fields?.startdate || jiraInit?.fields?.customfield_10015);
    const initEnd    = isoDate(jiraInit?.fields?.duedate);

    const rowStart = initStart || allStarts[0]              || fallbackS;
    const rowEnd   = initEnd   || allEnds[allEnds.length-1] || fallbackE;

    // Initiative header row
    rows.push({ label: init.name, start: rowStart, end: rowEnd, status: init.status });

    // Epic sub-rows — fill in missing dates from siblings
    const siblingStart = allStarts[0]              || rowStart;
    const siblingEnd   = allEnds[allEnds.length-1] || rowEnd;

    myEpics.forEach(epic => {
      rows.push({
        label:  `  › ${epic.name}`,
        start:  epic.startDate  || siblingStart,
        end:    epic.targetDate || siblingEnd,
        status: epic.status,
      });
    });
  });

  // Determine visible month range (cover all row dates, minimum full current year)
  const allDates = rows.flatMap(r => [r.start, r.end]).filter(Boolean).sort();
  const minDate  = allDates[0]                    || fallbackS;
  const maxDate  = allDates[allDates.length - 1]  || fallbackE;

  const startYear  = parseInt(minDate.slice(0, 4), 10);
  const endYear    = parseInt(maxDate.slice(0, 4), 10);
  const startMonth = parseInt(minDate.slice(5, 7), 10) - 1; // 0-based
  const endMonth   = parseInt(maxDate.slice(5, 7), 10) - 1;

  // Build the months array spanning min→max (capped at 24 months for readability)
  const months = [];
  let y = startYear, m = startMonth;
  while ((y < endYear || (y === endYear && m <= endMonth)) && months.length < 24) {
    months.push(MONTH_NAMES[m]);
    m++;
    if (m > 11) { m = 0; y++; }
  }

  return {
    startMonth: `${startYear}-${String(startMonth + 1).padStart(2, '0')}`,
    months,
    rows,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🔄  Syncing Jira project ${PROJECT} from ${BASE_URL}…`);

  // ── 1. Load manual overrides ──────────────────────────────────────────────
  const manualPath = resolve(__dirname, '..', 'data-manual.json');
  const manual     = JSON.parse(readFileSync(manualPath, 'utf8'));

  // ── 2. Fetch Initiatives (may not exist as an issue type — handled below) ─
  let jiraInitiatives = [];
  try {
    jiraInitiatives = await searchAll(
      `project = ${PROJECT} AND issuetype = Initiative ORDER BY created ASC`,
      // startdate = standard start date field; customfield_10015 = common alternate
      ['summary', 'status', 'assignee', 'duedate', 'startdate', 'customfield_10015', 'description'],
    );
    console.log(`  ✓ ${jiraInitiatives.length} initiative(s) found`);
  } catch {
    console.log('  ℹ  No "Initiative" issue type — epics will be grouped by label');
  }

  // ── 3. Fetch all Epics ────────────────────────────────────────────────────
  const jiraEpics = await searchAll(
    `project = ${PROJECT} AND issuetype = Epic ORDER BY created ASC`,
    // startdate / customfield_10015 = start date (varies by Jira instance)
    // customfield_10014 = Epic Name (classic projects)
    ['summary', 'status', 'assignee', 'duedate', 'startdate', 'customfield_10015',
     'parent', 'customfield_10014', 'labels'],
  );
  console.log(`  ✓ ${jiraEpics.length} epic(s) found`);

  // ── 4. Bulk-fetch all child stories to compute epic progress ─────────────
  //   In classic projects stories link to epics via the "Epic Link" custom field.
  //   In next-gen (team-managed) projects they use the "parent" field instead.
  //   We request both and fall back gracefully.
  let allStories = [];
  try {
    allStories = await searchAll(
      `project = ${PROJECT} AND issuetype not in (Epic, Initiative, Sub-task) ORDER BY created ASC`,
      ['status', 'parent', 'customfield_10014'],
      1000,
    );
    console.log(`  ✓ ${allStories.length} story/task(s) found for progress calculation`);
  } catch (err) {
    console.warn('  ⚠  Could not fetch child stories:', err.message);
  }

  // Build  epicKey → { total, done }
  const progressMap = {};
  allStories.forEach(story => {
    // next-gen uses parent.key; classic uses customfield_10014 (Epic Link key)
    const epicKey = story.fields?.parent?.key || story.fields?.customfield_10014;
    if (!epicKey) return;
    if (!progressMap[epicKey]) progressMap[epicKey] = { total: 0, done: 0 };
    progressMap[epicKey].total++;
    if (story.fields?.status?.statusCategory?.key === 'done') {
      progressMap[epicKey].done++;
    }
  });

  // ── 5. Fetch recent activity for the updates feed (last 14 days) ──────────
  let updates = manual.updates || [];
  try {
    const recentIssues = await searchAll(
      `project = ${PROJECT} AND updated >= "${daysAgo(14)}" AND issuetype != Sub-task ORDER BY updated DESC`,
      ['summary', 'status', 'assignee', 'updated', 'issuetype'],
      50,
    );

    if (recentIssues.length > 0) {
      updates = recentIssues.slice(0, 6).map(issue => {
        const name     = issue.fields?.assignee?.displayName || 'Team';
        const initials = name.split(' ').map(n => n[0]).join('').slice(0, 3).toUpperCase();
        const updated  = isoDate(issue.fields?.updated);
        return {
          author: initials,
          name,
          time:   shortDate(updated),
          text:   `<strong>${issue.fields.summary}</strong> status changed to <strong>${issue.fields?.status?.name}</strong>`,
        };
      });
      console.log(`  ✓ ${updates.length} recent update(s) fetched`);
    }
  } catch (err) {
    console.warn('  ⚠  Could not fetch recent activity:', err.message);
  }

  // ── 6. Build dashboard epics ──────────────────────────────────────────────
  const epics = jiraEpics.map(issue => {
    const prog     = progressMap[issue.key];
    const progress = prog && prog.total > 0
      ? Math.round((prog.done / prog.total) * 100)
      : (issue.fields?.status?.statusCategory?.key === 'done' ? 100 : 0);

    // Link epic to its parent initiative (next-gen) or first label (classic fallback)
    const parentKey    = issue.fields?.parent?.key;
    const initiativeId = jiraInitiatives.some(i => i.key === parentKey)
      ? parentKey
      : (issue.fields?.labels?.[0] || 'UNGROUPED');

    // Start date: prefer standard field, fall back to common custom field
    const startDate = isoDate(issue.fields?.startdate || issue.fields?.customfield_10015);

    return {
      id:          issue.key,
      name:        issue.fields.summary,
      initiative:  initiativeId,
      owner:       issue.fields?.assignee?.displayName || 'Unassigned',
      status:      mapStatus(issue),
      progress,
      startDate,
      targetDate:  isoDate(issue.fields?.duedate),
    };
  });

  // ── 7. Build dashboard initiatives ───────────────────────────────────────
  let initiatives;

  if (jiraInitiatives.length > 0) {
    initiatives = jiraInitiatives.map(issue => {
      const epicIds   = epics.filter(e => e.initiative === issue.key).map(e => e.id);
      const myEpics   = epics.filter(e => epicIds.includes(e.id));
      const progress  = myEpics.length
        ? Math.round(myEpics.reduce((s, e) => s + e.progress, 0) / myEpics.length)
        : 0;

      const hasBlocked = myEpics.some(e => e.status === 'blocked');
      const hasAtRisk  = myEpics.some(e => e.status === 'at-risk');
      const allDone    = myEpics.length > 0 && myEpics.every(e => e.status === 'completed');
      const status     = hasBlocked ? 'blocked'
                       : hasAtRisk  ? 'at-risk'
                       : allDone    ? 'completed'
                       : mapStatus(issue);

      // Extract plain-text description from Atlassian Document Format (ADF)
      let desc = '';
      try {
        desc = issue.fields?.description?.content?.[0]?.content
          ?.map(n => n.text || '').join('') || '';
      } catch { /* no description */ }

      const startDate = isoDate(issue.fields?.startdate || issue.fields?.customfield_10015);

      return {
        id:        issue.key,
        name:      issue.fields.summary,
        desc,
        status,
        progress,
        owner:     issue.fields?.assignee?.displayName || 'Unassigned',
        startDate,
        endDate:   isoDate(issue.fields?.duedate),
        epicIds,
      };
    });
  } else {
    // No Initiative issue type — create one synthetic initiative per unique label group,
    // or one "All Epics" initiative if no labels exist.
    const groups = {};
    epics.forEach(e => {
      const g = e.initiative === 'UNGROUPED' ? 'Program Epics' : e.initiative;
      if (!groups[g]) groups[g] = [];
      groups[g].push(e);
    });

    initiatives = Object.entries(groups).map(([groupName, groupEpics], i) => {
      const progress = groupEpics.length
        ? Math.round(groupEpics.reduce((s, e) => s + e.progress, 0) / groupEpics.length)
        : 0;
      const hasBlocked = groupEpics.some(e => e.status === 'blocked');
      const hasAtRisk  = groupEpics.some(e => e.status === 'at-risk');
      const id = `INIT-${String(i + 1).padStart(2, '0')}`;

      groupEpics.forEach(e => (e.initiative = id));

      return {
        id,
        name:      groupName,
        desc:      '',
        status:    hasBlocked ? 'blocked' : hasAtRisk ? 'at-risk' : 'on-track',
        progress,
        owner:     manual.meta.programLead,
        startDate: null,
        endDate:   null,
        epicIds:   groupEpics.map(e => e.id),
      };
    });
  }

  // ── 8. Compute KPIs ───────────────────────────────────────────────────────
  const total      = epics.length;
  const onTrack    = epics.filter(e => e.status === 'on-track').length;
  const atRisk     = epics.filter(e => e.status === 'at-risk').length;
  const blocked    = epics.filter(e => e.status === 'blocked').length;
  const done       = epics.filter(e => e.status === 'completed').length;
  const overallPct = total
    ? Math.round(epics.reduce((s, e) => s + e.progress, 0) / total)
    : 0;

  const kpis = [
    {
      label:  'Overall Progress',
      value:  `${overallPct}%`,
      sub:    'Across all initiatives',
      trend:  `${done} epic${done !== 1 ? 's' : ''} completed`,
      dir:    overallPct >= 50 ? 'up' : 'flat',
      accent: '#0052CC',
    },
    {
      label:  'Epics On Track',
      value:  String(onTrack),
      sub:    `of ${total} total epics`,
      trend:  `${done} completed this program`,
      dir:    'up',
      accent: '#36B37E',
    },
    {
      label:  'At Risk',
      value:  String(atRisk),
      sub:    'Epics need attention',
      trend:  atRisk > 0 ? 'Review recommended' : 'All clear',
      dir:    atRisk > 0 ? 'down' : 'up',
      accent: '#FF991F',
    },
    {
      label:  'Active Blockers',
      value:  String(blocked),
      sub:    blocked > 0 ? 'Escalation required' : 'No blockers',
      trend:  blocked > 0 ? 'Action needed' : 'Great shape',
      dir:    blocked > 0 ? 'down' : 'up',
      accent: '#DE350B',
    },
  ];

  const overallStatus = blocked > 2 ? 'blocked'
                      : atRisk  > 3 ? 'at-risk'
                      : 'on-track';

  // ── 9. Build Gantt from live Jira dates ───────────────────────────────────
  const gantt = buildGantt(initiatives, epics, jiraInitiatives, manual);
  console.log(`  ✓ Gantt built — ${gantt.rows.length} row(s)`);

  // ── 10. Assemble final payload ────────────────────────────────────────────
  const today   = new Date().toISOString().split('T')[0];
  const payload = {
    meta: {
      ...manual.meta,
      overallStatus,
      lastUpdated: today,
    },
    kpis,
    initiatives,
    epics,
    milestones: manual.milestones || [],
    blockers:   manual.blockers   || [],
    risks:      manual.risks      || [],
    updates,
    gantt,
  };

  // ── 12. Write data.js ────────────────────────────────────────────────────
  const banner = `/* ⚡ Auto-generated by scripts/sync-jira.js on ${today}\n   Do not edit this file directly — edit data-manual.json for manual sections. */`;
  const output = `${banner}\nconst DASHBOARD_DATA = ${JSON.stringify(payload, null, 2)};\n`;

  const outPath = resolve(__dirname, '..', 'data.js');
  writeFileSync(outPath, output, 'utf8');

  console.log(`\n✅  data.js updated`);
  console.log(`   ${initiatives.length} initiative(s)  |  ${epics.length} epic(s)  |  ${gantt.rows.length} gantt row(s)`);
  console.log(`   Overall: ${overallPct}%  |  Status: ${overallStatus}`);
}

main().catch(err => {
  console.error('\n❌  Sync failed:', err.message);
  process.exit(1);
});
