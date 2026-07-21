const fs = require("fs");
const path = require("path");

const MODE = (process.env.MODE || "mock").toLowerCase();
const LOG_INTERVAL_MS = parseInt(process.env.LOG_INTERVAL_MS || "2000", 10);
const OUT_FILE = process.env.OUT_FILE || "focus-log.csv";
const DURATION_SEC = parseInt(process.env.DURATION_SEC || "0", 10);

const CSV_HEADER =
  "timestamp_iso,epoch_ms,mode,focus,calm,alpha,beta,delta,theta,gamma,signal_quality\n";

const outPath = path.resolve(OUT_FILE);
const fileExisted = fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
const out = fs.createWriteStream(outPath, { flags: "a" });
if (!fileExisted) out.write(CSV_HEADER);

let rowsWritten = 0;
let stopping = false;

function focusBar(focus) {
  const width = 20;
  const filled = Math.max(0, Math.min(width, Math.round(focus * width)));
  return "[" + "#".repeat(filled) + "-".repeat(width - filled) + "]";
}

function printStatus(focus, calm) {
  const line = `${focusBar(focus)} focus ${(focus * 100).toFixed(0)}%  calm ${(calm * 100).toFixed(0)}%   rows=${rowsWritten}`;
  process.stdout.write("\r" + line.padEnd(70));
}

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
  printStatus(focus, calm);
}

function shutdown() {
  if (stopping) return;
  stopping = true;
  process.stdout.write("\n");
  out.end(() => {
    console.log(`Saved ${rowsWritten} rows to ${outPath}`);
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);

if (DURATION_SEC > 0) {
  setTimeout(shutdown, DURATION_SEC * 1000);
}

// ---------------- MOCK MODE ----------------
function runMock() {
  console.log(`Crown Focus Logger — MOCK mode (interval ${LOG_INTERVAL_MS}ms)`);

  // Smooth drifting focus/calm via low-pass filtered random walks.
  let focus = 0.5;
  let calm = 0.5;
  let focusVel = 0;
  let calmVel = 0;

  function step() {
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

    writeRow({
      focus,
      calm,
      alpha,
      beta,
      delta,
      theta,
      gamma,
      signalQuality: "mock",
    });
  }

  step();
  setInterval(step, LOG_INTERVAL_MS);
}

// ---------------- LIVE MODE ----------------
async function runLive() {
  require("dotenv").config();
  const { Neurosity } = require("@neurosity/sdk");

  const email = process.env.NEUROSITY_EMAIL;
  const password = process.env.NEUROSITY_PASSWORD;
  const deviceId = process.env.NEUROSITY_DEVICE_ID;

  if (!email || !password) {
    console.error("LIVE mode requires NEUROSITY_EMAIL and NEUROSITY_PASSWORD in .env");
    process.exit(1);
  }

  const neurosity = new Neurosity(deviceId ? { deviceId } : {});
  console.log("Crown Focus Logger — LIVE mode: logging in...");
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

  neurosity.focus().subscribe((m) => {
    if (m && typeof m.probability === "number") latest.focus = m.probability;
  });

  neurosity.calm().subscribe((m) => {
    if (m && typeof m.probability === "number") latest.calm = m.probability;
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
    const statuses = Object.values(sq).map((c) => (c && c.status) || "unknown");
    if (statuses.includes("bad")) latest.signalQuality = "bad";
    else if (statuses.includes("noContact")) latest.signalQuality = "noContact";
    else if (statuses.every((s) => s === "great")) latest.signalQuality = "great";
    else if (statuses.some((s) => s === "good" || s === "great")) latest.signalQuality = "good";
    else latest.signalQuality = statuses[0] || "unknown";
  });

  setInterval(() => writeRow({ ...latest }), LOG_INTERVAL_MS);
}

if (MODE === "live") {
  runLive().catch((err) => {
    console.error("LIVE mode failed:", err);
    process.exit(1);
  });
} else {
  runMock();
}
