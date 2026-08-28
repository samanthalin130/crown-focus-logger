/**
 * Charts, drawn as inline SVG strings.
 *
 * No charting library. These are small enough to read, they inherit the page's
 * colors through CSS custom properties, and they scale without a build step.
 */

import { BANDS } from "./schema.js";

const W = 800;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 40 };

/** Keep the polyline honest but small: average within buckets rather than dropping points. */
function downsample(points, maxPoints = 400) {
  if (points.length <= maxPoints) return points;
  const bucket = Math.ceil(points.length / maxPoints);
  const out = [];
  for (let i = 0; i < points.length; i += bucket) {
    const slice = points.slice(i, i + bucket);
    const avg = (key) => slice.reduce((a, p) => a + p[key], 0) / slice.length;
    out.push({ t: slice[0].t, focus: avg("focus"), calm: avg("calm") });
  }
  return out;
}

function clockLabel(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Focus and calm against the clock, with the session's own median focus
 * marked. Returns an empty-state message when there is nothing usable.
 */
export function timelineSvg(analysis) {
  const pts = downsample(analysis.series || []);
  if (pts.length < 2) {
    return `<p class="empty">Not enough usable readings to draw a line. ${
      analysis.rowCount > 0
        ? "Every row in this session was recorded with poor sensor contact."
        : "This session has no rows."
    }</p>`;
  }

  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const span = Math.max(1, t1 - t0);
  const x = (t) => PAD.left + ((t - t0) / span) * (W - PAD.left - PAD.right);
  const y = (v) => PAD.top + (1 - v) * (H - PAD.top - PAD.bottom);

  const line = (key) => pts.map((p) => `${x(p.t).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");

  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map(
      (v) =>
        `<line class="grid" x1="${PAD.left}" y1="${y(v).toFixed(1)}" x2="${W - PAD.right}" y2="${y(v).toFixed(1)}"/>` +
        `<text class="axis" x="${PAD.left - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v.toFixed(2)}</text>`,
    )
    .join("");

  const threshold = Number.isFinite(analysis.threshold)
    ? `<line class="thresh" x1="${PAD.left}" y1="${y(analysis.threshold).toFixed(1)}" x2="${W - PAD.right}" y2="${y(analysis.threshold).toFixed(1)}"/>`
    : "";

  // Shade the best stretch so the number in the card has something to point at.
  let stretch = "";
  const bs = analysis.bestStretch;
  if (bs && bs.durationMs > 0) {
    const sx = x(Math.max(t0, bs.startMs));
    const ex = x(Math.min(t1, bs.endMs));
    if (ex > sx) {
      stretch = `<rect class="stretch" x="${sx.toFixed(1)}" y="${PAD.top}" width="${(ex - sx).toFixed(1)}" height="${H - PAD.top - PAD.bottom}"/>`;
    }
  }

  const ticks = [0, 0.5, 1]
    .map((f) => {
      const t = t0 + span * f;
      const anchor = f === 0 ? "start" : f === 1 ? "end" : "middle";
      return `<text class="axis" x="${x(t).toFixed(1)}" y="${H - 8}" text-anchor="${anchor}">${clockLabel(t)}</text>`;
    })
    .join("");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"
    aria-label="Focus and calm over the session, both scored 0 to 1.">
    ${stretch}${grid}${threshold}${ticks}
    <polyline class="series calm" points="${line("calm")}"/>
    <polyline class="series focus" points="${line("focus")}"/>
  </svg>`;
}

/** Average band power across the usable rows, as a row of bars. */
export function bandsSvg(analysis) {
  const values = BANDS.map((b) => ({ band: b, v: analysis.bands[b] })).filter((d) =>
    Number.isFinite(d.v),
  );
  if (!values.length) return `<p class="empty">No usable band readings in this session.</p>`;

  const max = Math.max(...values.map((d) => d.v)) || 1;
  return `<div class="bandrows">${values
    .map(
      (d) => `<div class="bandrow">
        <span class="bandname t-${d.band}">${d.band}</span>
        <span class="bandtrack"><span class="bandfill t-bg-${d.band}" style="width:${((d.v / max) * 100).toFixed(1)}%"></span></span>
        <span class="bandval">${d.v.toFixed(3)}</span>
      </div>`,
    )
    .join("")}</div>`;
}

/** How the recording split by sensor contact. */
export function qualityBar(analysis) {
  const total = analysis.rowCount || 1;
  const order = ["great", "good", "mock", "unknown", "bad", "nocontact"];
  const entries = Object.entries(analysis.qualityCounts || {}).sort(
    (a, b) => order.indexOf(a[0]) - order.indexOf(b[0]),
  );
  if (!entries.length) return "";
  return `<div class="qbar">${entries
    .map(
      ([q, n]) =>
        `<span class="qseg q-${q}" style="width:${((n / total) * 100).toFixed(2)}%" title="${q}: ${n} rows"></span>`,
    )
    .join("")}</div>
    <div class="qkey">${entries
      .map(
        ([q, n]) =>
          `<span class="qkeyitem"><i class="qdot q-${q}"></i>${q} <b>${((n / total) * 100).toFixed(0)}%</b></span>`,
      )
      .join("")}</div>`;
}
