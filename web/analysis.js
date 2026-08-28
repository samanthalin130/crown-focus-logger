/**
 * Everything the app says about a session is computed here.
 *
 * No model, no network, no randomness: the same rows always give the same
 * numbers, and every claim on screen traces back to one of these fields.
 *
 * Two rules this file follows deliberately:
 *  1. Only rows with a usable signal quality are analysed. Bad contact is
 *     excluded rather than averaged in.
 *  2. There is no fixed "focused" threshold. Focus is scored against the
 *     person's own median in this session, because Crown scores are not
 *     comparable between people or between sittings.
 */

import { BANDS, isUsable } from "./schema.js";

export function mean(xs) {
  if (!xs.length) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Descriptive stats for one 0-1 score. */
function describe(xs) {
  const clean = xs.filter(Number.isFinite);
  if (!clean.length) return { n: 0, min: NaN, median: NaN, mean: NaN, max: NaN };
  return {
    n: clean.length,
    min: Math.min(...clean),
    median: median(clean),
    mean: mean(clean),
    max: Math.max(...clean),
  };
}

/**
 * Sampling interval and any breaks in the recording.
 * A gap is a step more than three times the typical one, which is what an
 * append to the same file after a pause looks like.
 */
function timing(rows) {
  if (rows.length < 2) return { typicalMs: NaN, gaps: [] };
  const steps = [];
  for (let i = 1; i < rows.length; i++) steps.push(rows[i].epoch_ms - rows[i - 1].epoch_ms);
  const typicalMs = median(steps);
  const gaps = [];
  for (let i = 1; i < rows.length; i++) {
    const d = rows[i].epoch_ms - rows[i - 1].epoch_ms;
    if (Number.isFinite(typicalMs) && typicalMs > 0 && d > typicalMs * 3) {
      gaps.push({ fromMs: rows[i - 1].epoch_ms, toMs: rows[i].epoch_ms, durationMs: d });
    }
  }
  return { typicalMs, gaps };
}

/**
 * Longest unbroken run of usable rows at or above the person's own median
 * focus for this session. Runs are broken by a gap in the recording, so a
 * stretch never spans a pause.
 */
function bestStretch(usable, threshold, typicalMs) {
  let best = null;
  let start = null;
  let prev = null;

  const close = (endRow) => {
    if (start === null || prev === null) return;
    const durationMs = prev.epoch_ms - start.epoch_ms;
    if (!best || durationMs > best.durationMs) {
      best = { startMs: start.epoch_ms, endMs: prev.epoch_ms, durationMs };
    }
  };

  for (const r of usable) {
    const broken =
      prev !== null &&
      Number.isFinite(typicalMs) &&
      typicalMs > 0 &&
      r.epoch_ms - prev.epoch_ms > typicalMs * 3;
    if (r.focus >= threshold && !broken) {
      if (start === null) start = r;
      prev = r;
    } else {
      close();
      start = r.focus >= threshold ? r : null;
      prev = start;
    }
  }
  close();
  return best;
}

/**
 * Analyse one session's rows.
 * Safe on empty or fully unusable input: fields come back NaN or null and the
 * caller decides what to show.
 */
export function analyse(rows) {
  const all = Array.isArray(rows) ? [...rows].sort((a, b) => a.epoch_ms - b.epoch_ms) : [];
  const usable = all.filter(isUsable);

  const startMs = all.length ? all[0].epoch_ms : NaN;
  const endMs = all.length ? all[all.length - 1].epoch_ms : NaN;
  const { typicalMs, gaps } = timing(all);

  const focus = describe(usable.map((r) => r.focus));
  const calm = describe(usable.map((r) => r.calm));

  const bands = {};
  for (const b of BANDS) bands[b] = mean(usable.map((r) => r[b]).filter(Number.isFinite));

  const threshold = focus.median;
  const aboveCount = Number.isFinite(threshold)
    ? usable.filter((r) => r.focus >= threshold).length
    : 0;

  // Which qualities actually appeared, so the UI can name the reason for lost rows.
  const qualityCounts = {};
  for (const r of all) {
    const q = String(r.signal_quality || "unknown").toLowerCase();
    qualityCounts[q] = (qualityCounts[q] || 0) + 1;
  }

  const modes = [...new Set(all.map((r) => String(r.mode || "unknown").toLowerCase()))];

  return {
    rowCount: all.length,
    usableCount: usable.length,
    coverage: all.length ? usable.length / all.length : NaN,
    qualityCounts,
    modes,
    isSynthetic: modes.length > 0 && modes.every((m) => m === "mock"),
    startMs,
    endMs,
    durationMs: all.length ? endMs - startMs : NaN,
    typicalMs,
    gaps,
    focus,
    calm,
    bands,
    threshold,
    aboveCount,
    aboveShare: usable.length ? aboveCount / usable.length : NaN,
    bestStretch: bestStretch(usable, threshold, typicalMs),
    series: usable.map((r) => ({ t: r.epoch_ms, focus: r.focus, calm: r.calm })),
  };
}
