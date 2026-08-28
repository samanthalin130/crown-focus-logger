/**
 * Crown Focus Logger
 *
 * Records focus, calm and five EEG band powers from a Neurosity Crown to a CSV
 * file on this machine. Runs against real hardware (MODE=live) or against
 * synthetic data (MODE=mock) so the pipeline can be developed with no headset.
 *
 * This file is deliberately dependency-free at the top level and self-contained:
 * it is vendored as a single file by other projects (crown-debrief carries it as
 * collector/logger.js), so it must never require a sibling file from this repo.
 * The column list below is duplicated in web/schema.js and documented in
 * docs/SCHEMA.md; if you change one, change all three.
 */

const fs = require("fs");
const path = require("path");

// ---------------- SCHEMA ----------------
// Frozen. crown-debrief/core/csv.js parses exactly these columns.
const COLUMNS = [
  "timestamp_iso",
  "epoch_ms",
  "mode",
  "focus",
  "calm",
  "alpha",
  "beta",
  "delta",
  "theta",
  "gamma",
  "signal_quality",
];
const CSV_HEADER = COLUMNS.join(",") + "\n";

// ---------------- CONFIG ----------------
function intFromEnv(name, fallback, min) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min) {
    console.error(`Bad ${name}="${raw}". Expected a whole number >= ${min}.`);
    process.exit(1);
  }
  return n;
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Crown Focus Logger

  node logger.js                      record synthetic data (no headset needed)
  MODE=live node logger.js            record from a real Neurosity Crown

Environment variables (all optional except the live-mode credentials):

  MODE              mock | live                     default: mock
  LOG_INTERVAL_MS   milliseconds between rows       default: 2000
  OUT_FILE          output path                     default: focus-log.csv
  DURATION_SEC      auto-stop after N seconds       default: 0 (until Ctrl+C)

  NEUROSITY_EMAIL       required for MODE=live
  NEUROSITY_PASSWORD    required for MODE=live
  NEUROSITY_DEVICE_ID   optional, only if your account has several devices

Columns written: ${COLUMNS.join(", ")}
See docs/SCHEMA.md for what each column means.`);
  process.exit(0);
}

const MODE = (process.env.MODE || "mock").toLowerCase();
const LOG_INTERVAL_MS = intFromEnv("LOG_INTERVAL_MS", 2000, 50);
const OUT_FILE = process.env.OUT_FILE || "focus-log.csv";
const DURATION_SEC = intFromEnv("DURATION_SEC", 0, 0);

if (MODE !== "mock" && MODE !== "live") {
  console.error(`Bad MODE="${MODE}". Expected "mock" or "live".`);
  process.exit(1);
}

// ---------------- OUTPUT FILE ----------------
const outPath = path.resolve(OUT_FILE);

// Appending rows under a header that does not match this schema silently
// corrupts the log, and the corruption only shows up later during analysis.
// Refuse instead, with an instruction the user can act on.
if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
  const firstLine = fs.readFileSync(outPath, "utf8").split("\n", 1)[0].trim();
  if (firstLine !== CSV_HEADER.trim()) {
    console.error(
      `${outPath} already exists but its header does not match this schema.\n` +
        `  found:    ${firstLine}\n` +
        `  expected: ${CSV_HEADER.trim()}\n` +
        `Refusing to append. Set OUT_FILE to a different path, or move that file aside.`,
    );
    process.exit(1);
  }
}

const fileExisted = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
const out = fs.createWriteStream(outPath, { flags: "a" });
if (!fileExisted) out.write(CSV_HEADER);

let rowsWritten = 0;
let stopping = false;

// ---------------- TERMINAL READOUT ----------------
function focusBar(focus) {
  const width = 20;
  const filled = Math.max(0, Math.min(width, Math.round(focus * width)));
  return "[" + "#".repeat(filled) + "-".repeat(width - filled) + "]";
}

function printStatus(focus, calm, quality) {
  const line =
    `${focusBar(focus)} focus ${(focus * 100).toFixed(0)}%  ` +
    `calm ${(calm * 100).toFixed(0)}%  signal ${quality}  rows=${rowsWritten}`;
  process.stdout.write("\r" + line.padEnd(78));
}

function printWaiting(what) {
  process.stdout.write("\r" + `Waiting for ${what}...`.padEnd(78));
}

// ---------------- WRITING ----------------
function writeRow({ focus, calm, alpha, beta, delta, theta, gamma, signalQuality }) {
  const now = new Date();
  const row =
    [
      now.toISOString(),
      now.getTime(),
      MODE,
      focus.toFixed(4),
      calm.toFixed(4),
      alpha.toFixed(4),
      beta.toFixed(4),
      delta.toFixed(4),
      theta.toFixed(4),
      gamma.toFixed(4),
      signalQuality,
    ].join(",") + "\n";
  out.write(row);
  rowsWritten++;
  printStatus(focus, calm, signalQuality);
}

function shutdown() {
  if (stopping) return;
  stopping = true;
  process.stdout.write("\n");
  out.end(() => {
    if (rowsWritten === 0) {
      console.log(`No rows written. ${outPath} is unchanged or empty.`);
    } else {
      console.log(`Saved ${rowsWritten} rows to ${outPath}`);
    }
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

if (DURATION_SEC > 0) {
  setTimeout(shutdown, DURATION_SEC * 1000);
}

// ---------------- MOCK MODE ----------------
function runMock() {
  console.log(
    `Crown Focus Logger, MOCK mode. Interval ${LOG_INTERVAL_MS}ms. Writing to ${outPath}`,
  );
  console.log("Rows are labelled mode=mock and signal_quality=mock. This is synthetic data.");

  // Smooth drifting focus/calm via low-pass filtered random walks.
  let focus = 0.5;
  let calm = 0.5;
  let focusVel = 0;
  let calmVel = 0;

  function step() {
    if (stopping) return;
    focusVel = focusVel * 0.85 + (Math.random() - 0.5) * 0.05;
    calmVel = calmVel * 0.85 + (Math.random() - 0.5) * 0.05;
    focus = Math.max(0, Math.min(1, focus + focusVel));
    calm = Math.max(0, Math.min(1, calm + calmVel));

    // Band powers loosely tracking states, with a bit of noise.
    const n = () => (Math.random() - 0.5) * 0.1;
    const beta = Math.max(0, 0.2 + focus * 0.7 + n());
    const gamma = Math.max(0, 0.15 + focus * 0.6 + n());
    const alpha = Math.max(0, 0.2 + calm * 0.7 + n());
    const theta = Math.max(0, 0.15 + calm * 0.6 + n());
    const delta = Math.max(0, 0.3 + (1 - focus) * 0.3 + n());

    writeRow({ focus, calm, alpha, beta, delta, theta, gamma, signalQuality: "mock" });
  }

  step();
  setInterval(step, LOG_INTERVAL_MS);
}

// ---------------- LIVE MODE ----------------
async function runLive() {
  // @neurosity/sdk 7.x ships "type": "module" with a CommonJS require entry
  // point, so require() of it throws "exports is not defined in ES module
  // scope". Dynamic import loads the ESM build and works from this CJS file.
  const dotenv = await import("dotenv");
  dotenv.config();
  const { Neurosity } = await import("@neurosity/sdk");

  const email = process.env.NEUROSITY_EMAIL;
  const password = process.env.NEUROSITY_PASSWORD;
  const deviceId = process.env.NEUROSITY_DEVICE_ID;

  if (!email || !password) {
    console.error(
      "LIVE mode needs NEUROSITY_EMAIL and NEUROSITY_PASSWORD.\n" +
        "Copy .env.example to .env and fill them in, then run npm run live again.",
    );
    process.exit(1);
  }

  const neurosity = new Neurosity(deviceId ? { deviceId } : {});
  console.log(`Crown Focus Logger, LIVE mode. Writing to ${outPath}`);
  console.log("Logging in...");
  await neurosity.login({ email, password });
  console.log("Logged in. Subscribing to streams...");

  const latest = {
    focus: 0,
    calm: 0,
    alpha: 0,
    beta: 0,
    delta: 0,
    theta: 0,
    gamma: 0,
    signalQuality: "unknown",
  };

  // The write timer starts before any stream has delivered a value. Without
  // this guard the first rows are focus=0, calm=0, which look like real
  // readings but are just the initial state of the object above.
  const seen = { focus: false, calm: false };
  let announcedReady = false;

  neurosity.focus().subscribe((m) => {
    if (m && typeof m.probability === "number") {
      latest.focus = m.probability;
      seen.focus = true;
    }
  });

  neurosity.calm().subscribe((m) => {
    if (m && typeof m.probability === "number") {
      latest.calm = m.probability;
      seen.calm = true;
    }
  });

  neurosity.brainwaves("powerByBand").subscribe((bw) => {
    if (!bw || !bw.data) return;
    const avg = (arr) =>
      Array.isArray(arr) && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    latest.alpha = avg(bw.data.alpha);
    latest.beta = avg(bw.data.beta);
    latest.delta = avg(bw.data.delta);
    latest.theta = avg(bw.data.theta);
    latest.gamma = avg(bw.data.gamma);
  });

  neurosity.signalQuality().subscribe((sq) => {
    if (!sq) return;
    // Collapse eight electrodes to the worst one, so a single loose sensor is
    // never hidden by seven good ones.
    const statuses = Object.values(sq).map((c) => (c && c.status) || "unknown");
    if (statuses.includes("noContact")) latest.signalQuality = "noContact";
    else if (statuses.includes("bad")) latest.signalQuality = "bad";
    else if (statuses.every((s) => s === "great")) latest.signalQuality = "great";
    else if (statuses.some((s) => s === "good" || s === "great")) latest.signalQuality = "good";
    else latest.signalQuality = statuses[0] || "unknown";
  });

  setInterval(() => {
    if (stopping) return;
    if (!seen.focus || !seen.calm) {
      printWaiting("the first focus and calm readings");
      return;
    }
    if (!announcedReady) {
      announcedReady = true;
      process.stdout.write("\r" + "Streams live. Recording.".padEnd(78) + "\n");
    }
    writeRow({ ...latest });
  }, LOG_INTERVAL_MS);
}

if (MODE === "live") {
  runLive().catch((err) => {
    console.error("\nLIVE mode failed:", err && err.message ? err.message : err);
    process.exit(1);
  });
} else {
  runMock();
}
