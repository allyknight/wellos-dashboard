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
      ['summary', 'status', 'assignee', 'duedate', 'description'],
    );
    console.log(`  ✓ ${jiraInitiatives.length} initiative(s) found`);
  } catch {
    console.log('  ℹ  No "Initiative" issue type — epics will be grouped by label');
  }

  // ── 3. Fetch all Epics ────────────────────────────────────────────────────
  const jiraEpics = await searchAll(
    `project = ${PROJECT} AND issuetype = Epic ORDER BY created ASC`,
    // customfield_10014 = Epic Name (classic projects)
    // customfield_10016 = Story Points / Sprint (varies by instance)
    ['summary', 'status', 'assignee', 'duedate', 'parent', 'customfield_10014', 'labels'],
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

    return {
      id:          issue.key,
      name:        issue.fields.summary,
      initiative:  initiativeId,
      owner:       issue.fields?.assignee?.displayName || 'Unassigned',
      status:      mapStatus(issue),
      progress,
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

      return {
        id:        issue.key,
        name:      issue.fields.summary,
        desc,
        status,
        progress,
        owner:     issue.fields?.assignee?.displayName || 'Unassigned',
        startDate: null,
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

  // ── 9. Assemble final payload ─────────────────────────────────────────────
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
    gantt:      manual.gantt      || { startMonth: '2026-01', months: [], rows: [] },
  };

  // ── 10. Write data.js ─────────────────────────────────────────────────────
  const banner = `/* ⚡ Auto-generated by scripts/sync-jira.js on ${today}\n   Do not edit this file directly — edit data-manual.json for manual sections. */`;
  const output = `${banner}\nconst DASHBOARD_DATA = ${JSON.stringify(payload, null, 2)};\n`;

  const outPath = resolve(__dirname, '..', 'data.js');
  writeFileSync(outPath, output, 'utf8');

  console.log(`\n✅  data.js updated`);
  console.log(`   ${initiatives.length} initiative(s)  |  ${epics.length} epic(s)  |  ${updates.length} update(s)`);
  console.log(`   Overall: ${overallPct}%  |  Status: ${overallStatus}`);
}

main().catch(err => {
  console.error('\n❌  Sync failed:', err.message);
  process.exit(1);
});
