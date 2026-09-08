"use strict";

/**
 * Tiny, dependency-free SVG helpers used to render the profile stat cards.
 * Everything here is plain string templating on purpose — no headless
 * browser, no external rendering API, nothing that can go down or rate-limit.
 *
 * Theme matches the existing README palette (bg_color=080808,
 * title_color=ffffff, text_color=cccccc, dates=888888, stroke=1a1a1a).
 */

const THEME = {
  bg: "#080808",
  bgAlt: "#101010",
  border: "#1a1a1a",
  accent: "#ffffff",
  accentDim: "#555555",
  text: "#cccccc",
  textDim: "#888888",
  font: "'JetBrains Mono','Consolas','SFMono-Regular',Menlo,monospace",
};

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Wraps card content in the shared frame: rounded rect, border, title bar. */
function cardFrame({ width, height, title, body }) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(
    title
  )}">
  <style>
    .title { font: 600 15px ${THEME.font}; fill: ${THEME.accent}; }
    .label { font: 400 12.5px ${THEME.font}; fill: ${THEME.textDim}; }
    .value { font: 600 13px ${THEME.font}; fill: ${THEME.text}; }
    .mono  { font: 400 11.5px ${THEME.font}; fill: ${THEME.textDim}; }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10"
        fill="${THEME.bg}" stroke="${THEME.border}" />
  <line x1="20" y1="42" x2="${width - 20}" y2="42" stroke="${THEME.border}" stroke-width="1"/>
  <text x="20" y="28" class="title">${escapeXml(title)}</text>
  <circle cx="${width - 30}" cy="22" r="4" fill="${THEME.accentDim}"/>
  <circle cx="${width - 42}" cy="22" r="4" fill="${THEME.accentDim}" opacity="0.6"/>
  <circle cx="${width - 54}" cy="22" r="4" fill="${THEME.accentDim}" opacity="0.3"/>
  ${body}
</svg>`;
}

/** A single "label ......... value" row, dot-leader style like a terminal. */
function statRow({ x, y, label, value, width }) {
  return `
  <text x="${x}" y="${y}" class="label">${escapeXml(label)}</text>
  <text x="${x + width}" y="${y}" text-anchor="end" class="value">${escapeXml(
    value
  )}</text>`;
}

/** Horizontal bar used on the languages card. */
function langBar({ x, y, width, pct, color }) {
  const filled = Math.max(2, Math.round((width * pct) / 100));
  return `
  <rect x="${x}" y="${y}" width="${width}" height="6" rx="3" fill="${THEME.bgAlt}" stroke="${THEME.border}"/>
  <rect x="${x}" y="${y}" width="${filled}" height="6" rx="3" fill="${color}"/>`;
}

module.exports = { THEME, escapeXml, cardFrame, statRow, langBar };
