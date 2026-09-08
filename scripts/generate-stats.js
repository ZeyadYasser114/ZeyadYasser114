"use strict";

/**
 * Self-hosted replacement for github-readme-stats / streak-stats.
 *
 * Everything is pulled directly from the official GitHub GraphQL API using
 * a token you provide (see SETUP.md) and rendered locally to plain SVG.
 * Nothing here depends on a third-party rendering service being online.
 *
 * Output:
 *   assets/stats.svg   -- stars, commits, PRs, issues, reviews, repos
 *   assets/langs.svg   -- top languages by bytes across your own repos
 *   assets/streak.svg  -- current streak / longest streak / total contributions
 */

const fs = require("fs");
const path = require("path");
const { graphql: baseGraphql } = require("@octokit/graphql");
const { cardFrame, statRow, langBar, THEME } = require("./lib/svg");
const LANG_COLORS = require("./lib/langColors");

const USERNAME = process.env.GH_USERNAME || process.env.GITHUB_REPOSITORY_OWNER;
const TOKEN = process.env.GH_PAT || process.env.GITHUB_TOKEN;

if (!USERNAME) {
  console.error("Missing GH_USERNAME (or GITHUB_REPOSITORY_OWNER) env var.");
  process.exit(1);
}
if (!TOKEN) {
  console.error("Missing GH_PAT (or GITHUB_TOKEN) env var.");
  process.exit(1);
}

const graphql = baseGraphql.defaults({
  headers: { authorization: `token ${TOKEN}` },
});

const OUT_DIR = path.join(__dirname, "..", "assets");

async function getContributionYears() {
  const q = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection { contributionYears }
      }
    }`;
  const res = await graphql(q, { login: USERNAME });
  return res.user.contributionsCollection.contributionYears;
}

async function getYearContributions(year) {
  const from = `${year}-01-01T00:00:00Z`;
  const to = `${year}-12-31T23:59:59Z`;
  const q = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          totalCommitContributions
          totalIssueContributions
          totalPullRequestContributions
          totalPullRequestReviewContributions
          restrictedContributionsCount
          contributionCalendar {
            weeks { contributionDays { date contributionCount } }
          }
        }
      }
    }`;
  const res = await graphql(q, { login: USERNAME, from, to });
  return res.user.contributionsCollection;
}

async function getOwnedRepos() {
  const repos = [];
  let after = null;
  const q = `
    query($login: String!, $after: String) {
      user(login: $login) {
        repositories(first: 100, after: $after, ownerAffiliations: [OWNER], isFork: false, privacy: PUBLIC) {
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes {
            name
            stargazerCount
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
              edges { size node { name color } }
            }
          }
        }
      }
    }`;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await graphql(q, { login: USERNAME, after });
    const conn = res.user.repositories;
    repos.push(...conn.nodes);
    if (!conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return repos;
}

function computeStreaks(calendars) {
  // Flatten every contributionDay across the calendars we fetched, sorted
  // ascending by date, then walk from "today" backwards.
  const days = [];
  for (const cal of calendars) {
    for (const week of cal.weeks) {
      for (const day of week.contributionDays) {
        days.push({ date: day.date, count: day.contributionCount });
      }
    }
  }
  days.sort((a, b) => (a.date < b.date ? -1 : 1));

  let longest = 0;
  let running = 0;
  for (const d of days) {
    if (d.count > 0) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }

  // Current streak: walk backward from the most recent day with data.
  let current = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (days[i].count > 0) {
      current += 1;
    } else {
      // Allow "today" to be a zero-contribution in-progress day without
      // breaking the streak, but any earlier zero day ends it.
      if (i === days.length - 1) continue;
      break;
    }
  }

  const total = days.reduce((sum, d) => sum + d.count, 0);
  return { current, longest, total };
}

function buildStatsSvg({ totals, totalStars, repoCount }) {
  const width = 480;
  const height = 220;
  const rows = [
    ["Total Stars", totalStars.toLocaleString()],
    ["Total Commits", totals.commits.toLocaleString()],
    ["Public Repositories", repoCount.toLocaleString()],
    ["Pull Requests", totals.prs.toLocaleString()],
    ["Issues Opened", totals.issues.toLocaleString()],
    ["Code Reviews", totals.reviews.toLocaleString()],
  ];
  let y = 68;
  const body = rows
    .map((r) => {
      const line = statRow({ x: 20, y, label: r[0], value: r[1], width: width - 40 });
      y += 24;
      return line;
    })
    .join("");
  return cardFrame({ width, height, title: "$ github-stats --user " + USERNAME, body });
}

function buildLangsSvg(langBytes) {
  const width = 480;
  const entries = Object.entries(langBytes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const totalBytes = entries.reduce((s, [, v]) => s + v, 0) || 1;
  const height = 60 + entries.length * 34;

  let y = 66;
  const body = entries
    .map(([name, bytes]) => {
      const pct = (bytes / totalBytes) * 100;
      const color = LANG_COLORS[name] || THEME.accent;
      const label = `<text x="20" y="${y}" class="label">${name}</text>` +
        `<text x="460" y="${y}" text-anchor="end" class="mono">${pct.toFixed(1)}%</text>`;
      const bar = langBar({ x: 20, y: y + 8, width: 440, pct, color });
      y += 34;
      return label + bar;
    })
    .join("");
  return cardFrame({ width, height, title: "$ top-languages --user " + USERNAME, body });
}

function buildStreakSvg({ current, longest, total }) {
  const width = 480;
  const height = 150;
  const cols = [
    { label: "Current Streak", value: `${current} day${current === 1 ? "" : "s"}` },
    { label: "Longest Streak", value: `${longest} day${longest === 1 ? "" : "s"}` },
    { label: "Total Contributions", value: total.toLocaleString() },
  ];
  const colWidth = (width - 40) / cols.length;
  const body = cols
    .map((c, i) => {
      const cx = 20 + colWidth * i + colWidth / 2;
      return `
      <text x="${cx}" y="80" text-anchor="middle" class="value" font-size="20" fill="${THEME.accent}">${c.value}</text>
      <text x="${cx}" y="102" text-anchor="middle" class="label">${c.label}</text>`;
    })
    .join("");
  const dividers = cols
    .slice(1)
    .map((_, i) => {
      const x = 20 + colWidth * (i + 1);
      return `<line x1="${x}" y1="60" x2="${x}" y2="115" stroke="${THEME.border}" stroke-width="1"/>`;
    })
    .join("");
  return cardFrame({ width, height, title: "$ streak --user " + USERNAME, body: body + dividers });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const years = await getContributionYears();

  const totals = { commits: 0, prs: 0, issues: 0, reviews: 0 };
  const calendars = [];

  // Full history for lifetime totals; only the most recent two years are
  // needed for a meaningful streak calculation, but fetching all of them
  // costs nothing extra since we're already paging by year.
  for (const year of years) {
    const c = await getYearContributions(year);
    totals.commits += c.totalCommitContributions + c.restrictedContributionsCount;
    totals.prs += c.totalPullRequestContributions;
    totals.issues += c.totalIssueContributions;
    totals.reviews += c.totalPullRequestReviewContributions;
    calendars.push(c.contributionCalendar);
  }

  const streaks = computeStreaks(calendars);

  const repos = await getOwnedRepos();
  const totalStars = repos.reduce((sum, r) => sum + r.stargazerCount, 0);
  const langBytes = {};
  for (const repo of repos) {
    for (const edge of repo.languages.edges) {
      langBytes[edge.node.name] = (langBytes[edge.node.name] || 0) + edge.size;
    }
  }

  fs.writeFileSync(
    path.join(OUT_DIR, "stats.svg"),
    buildStatsSvg({ totals, totalStars, repoCount: repos.length })
  );
  fs.writeFileSync(path.join(OUT_DIR, "langs.svg"), buildLangsSvg(langBytes));
  fs.writeFileSync(path.join(OUT_DIR, "streak.svg"), buildStreakSvg(streaks));

  console.log("Wrote assets/stats.svg, assets/langs.svg, assets/streak.svg");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
