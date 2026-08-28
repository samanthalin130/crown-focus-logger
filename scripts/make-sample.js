/**
 * Writes web/sample-session.csv: about 25 minutes of synthetic data with a
 * believable shape (a warm-up, a good stretch, a dip, a recovery) and a patch
 * of bad signal, so the browser app can be demonstrated with no headset.
 *
 * Every row is labelled mode=mock. Nothing here is a real reading.
 *
 * Run with: npm run sample
 */

const fs = require("node:fs");
const path = require("node:path");

const OUT = path.resolve(__dirname, "..", "web", "sample-session.csv");
const INTERVAL_MS = 2000;
const MINUTES = 25;
const ROWS = (MINUTES * 60 * 1000) / INTERVAL_MS;

// Fixed seed, so the sample file is the same every time it is regenerated.
let seed = 20260828;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}

const header =
  "timestamp_iso,epoch_ms,mode,focus,calm,alpha,beta,delta,theta,gamma,signal_quality";
const lines = [header];

// A fixed start time keeps the file stable between runs.
const start = Date.parse("2026-08-20T09:30:00.000Z");
const clamp = (v) => Math.max(0, Math.min(1, v));

for (let i = 0; i < ROWS; i++) {
  const t = start + i * INTERVAL_MS;
  const p = i / ROWS;

  // Warm up, hold a good stretch, dip around two thirds, partly recover.
  let base = 0.3 + 0.45 * Math.min(1, p / 0.18);
  if (p > 0.62 && p < 0.78) base -= 0.3;
  if (p >= 0.78) base -= 0.12;
  const focus = clamp(base + (rand() - 0.5) * 0.12);
  const calm = clamp(0.55 - (focus - 0.5) * 0.35 + (rand() - 0.5) * 0.12);

  const n = () => (rand() - 0.5) * 0.08;
  const beta = Math.max(0, 0.2 + focus * 0.7 + n());
  const gamma = Math.max(0, 0.15 + focus * 0.6 + n());
  const alpha = Math.max(0, 0.2 + calm * 0.7 + n());
  const theta = Math.max(0, 0.15 + calm * 0.6 + n());
  const delta = Math.max(0, 0.3 + (1 - focus) * 0.3 + n());

  // A stretch of bad contact, so the coverage figure has something to report.
  const quality = p > 0.4 && p < 0.46 ? "bad" : "mock";

  lines.push(
    [
      new Date(t).toISOString(),
      t,
      "mock",
      focus.toFixed(4),
      calm.toFixed(4),
      alpha.toFixed(4),
      beta.toFixed(4),
      delta.toFixed(4),
      theta.toFixed(4),
      gamma.toFixed(4),
      quality,
    ].join(","),
  );
}

fs.writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`Wrote ${ROWS} synthetic rows to ${OUT}`);
