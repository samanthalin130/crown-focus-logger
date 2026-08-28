/**
 * Zero-dependency test runner. Run with: npm test
 *
 * Covers the two modules that decide what the user sees: the CSV format and
 * the analysis. The IndexedDB store and the UI are not covered here; see the
 * "What a professional should verify next" section of the README.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { COLUMNS, parseCsv, toCsv, isUsable } from "../web/schema.js";
import { analyse, mean, median } from "../web/analysis.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let passed = 0;
const failures = [];

function t(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL ${name}`);
    console.log(`       ${err.message}`);
  }
}

function ok(v, msg = "expected truthy") {
  if (!v) throw new Error(msg);
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function near(a, b, tol = 1e-6, msg) {
  if (!(Math.abs(a - b) <= tol)) throw new Error(msg || `expected ~${b}, got ${a}`);
}
function section(name) {
  console.log(`\n${name}`);
}

// ---------- fixtures ----------
const HEADER = COLUMNS.join(",");

function row(epoch, focus, calm, quality = "great", mode = "live") {
  return [
    new Date(epoch).toISOString(),
    epoch,
    mode,
    focus.toFixed(4),
    calm.toFixed(4),
    "0.5000",
    "0.4000",
    "0.3000",
    "0.2000",
    "0.1000",
    quality,
  ].join(",");
}

function csvOf(...rows) {
  return HEADER + "\n" + rows.join("\n") + "\n";
}

// ---------- schema ----------
section("CSV format");

t("parses a well-formed log", () => {
  const { rows, warnings } = parseCsv(csvOf(row(1000, 0.5, 0.5), row(3000, 0.6, 0.4)));
  eq(rows.length, 2);
  eq(warnings.length, 0);
  eq(rows[0].epoch_ms, 1000);
  near(rows[1].focus, 0.6);
  eq(rows[0].signal_quality, "great");
});

t("numeric columns come back as numbers, not strings", () => {
  const { rows } = parseCsv(csvOf(row(1000, 0.5, 0.5)));
  for (const k of ["epoch_ms", "focus", "calm", "alpha", "beta", "delta", "theta", "gamma"]) {
    eq(typeof rows[0][k], "number", `${k} should be a number`);
  }
});

t("rows always come back in time order", () => {
  const { rows } = parseCsv(csvOf(row(5000, 0.5, 0.5), row(1000, 0.5, 0.5), row(3000, 0.5, 0.5)));
  ok(rows.every((r, i) => i === 0 || r.epoch_ms >= rows[i - 1].epoch_ms));
});

t("a file with no focus column is rejected, not half-read", () => {
  const { rows, warnings } = parseCsv("a,b,c\n1,2,3\n");
  eq(rows.length, 0);
  ok(warnings[0].includes("does not look like a Crown log"));
});

t("an empty file is reported, not crashed on", () => {
  const { rows, warnings } = parseCsv("");
  eq(rows.length, 0);
  eq(warnings.length, 1);
});

t("unreadable lines are skipped and counted", () => {
  const { rows, warnings } = parseCsv(csvOf(row(1000, 0.5, 0.5)) + "garbage\n,,\n");
  eq(rows.length, 1);
  ok(warnings.some((w) => w.includes("unreadable")));
});

t("epoch_ms is recovered from the ISO timestamp when missing", () => {
  const text = "timestamp_iso,epoch_ms,mode,focus,calm,signal_quality\n2026-01-01T00:00:00.000Z,,mock,0.5,0.5,mock\n";
  const { rows } = parseCsv(text);
  eq(rows.length, 1);
  eq(rows[0].epoch_ms, Date.parse("2026-01-01T00:00:00.000Z"));
});

t("quoted fields from a spreadsheet round trip survive", () => {
  const text = `${HEADER}\n"2026-01-01T00:00:00.000Z","1000","mock","0.5","0.5","0.5","0.4","0.3","0.2","0.1","mock"\n`;
  const { rows } = parseCsv(text);
  eq(rows.length, 1);
  near(rows[0].focus, 0.5);
});

t("toCsv writes the frozen header and reparses to the same values", () => {
  const { rows } = parseCsv(csvOf(row(1000, 0.5, 0.5), row(3000, 0.6, 0.4)));
  const out = toCsv(rows);
  eq(out.split("\n")[0], HEADER);
  const { rows: again } = parseCsv(out);
  eq(again.length, rows.length);
  near(again[1].focus, rows[1].focus);
  eq(again[1].epoch_ms, rows[1].epoch_ms);
});

t("only great, good and mock count as usable", () => {
  eq(isUsable({ signal_quality: "great" }), true);
  eq(isUsable({ signal_quality: "good" }), true);
  eq(isUsable({ signal_quality: "mock" }), true);
  eq(isUsable({ signal_quality: "bad" }), false);
  eq(isUsable({ signal_quality: "noContact" }), false);
  eq(isUsable({ signal_quality: "unknown" }), false);
});

// ---------- analysis ----------
section("Analysis");

t("mean and median behave on simple input", () => {
  near(mean([1, 2, 3]), 2);
  near(median([1, 2, 3]), 2);
  near(median([1, 2, 3, 4]), 2.5);
});

t("empty input does not throw", () => {
  const a = analyse([]);
  eq(a.rowCount, 0);
  eq(a.usableCount, 0);
  eq(a.bestStretch, null);
});

t("bad-signal rows are excluded from every statistic", () => {
  const { rows } = parseCsv(
    csvOf(
      row(1000, 0.9, 0.9, "bad"),
      row(3000, 0.4, 0.4, "great"),
      row(5000, 0.6, 0.6, "great"),
    ),
  );
  const a = analyse(rows);
  eq(a.rowCount, 3);
  eq(a.usableCount, 2);
  near(a.coverage, 2 / 3);
  near(a.focus.max, 0.6, 1e-4, "the 0.9 bad-signal row must not be the max");
});

t("coverage counts every quality label that appeared", () => {
  const { rows } = parseCsv(
    csvOf(row(1000, 0.5, 0.5, "bad"), row(3000, 0.5, 0.5, "great"), row(5000, 0.5, 0.5, "great")),
  );
  const a = analyse(rows);
  eq(a.qualityCounts.great, 2);
  eq(a.qualityCounts.bad, 1);
});

t("a mock-only file is flagged synthetic", () => {
  const { rows } = parseCsv(csvOf(row(1000, 0.5, 0.5, "mock", "mock")));
  eq(analyse(rows).isSynthetic, true);
});

t("a live file is not flagged synthetic", () => {
  const { rows } = parseCsv(csvOf(row(1000, 0.5, 0.5, "great", "live")));
  eq(analyse(rows).isSynthetic, false);
});

t("the typical interval is the median step, not the average", () => {
  const { rows } = parseCsv(
    csvOf(row(0, 0.5, 0.5), row(2000, 0.5, 0.5), row(4000, 0.5, 0.5), row(600000, 0.5, 0.5)),
  );
  const a = analyse(rows);
  near(a.typicalMs, 2000, 1, "one ten-minute pause must not drag the interval up");
});

t("a pause in the recording is reported as a gap", () => {
  const { rows } = parseCsv(
    csvOf(row(0, 0.5, 0.5), row(2000, 0.5, 0.5), row(60000, 0.5, 0.5), row(62000, 0.5, 0.5)),
  );
  const a = analyse(rows);
  eq(a.gaps.length, 1);
  eq(a.gaps[0].durationMs, 58000);
});

t("the best stretch is the longest run at or above the personal median", () => {
  // focus: 0.1 0.1 0.9 0.9 0.9 0.1 0.9  -> median 0.9, longest run is rows 3-5
  const { rows } = parseCsv(
    csvOf(
      row(0, 0.1, 0.5),
      row(2000, 0.1, 0.5),
      row(4000, 0.9, 0.5),
      row(6000, 0.9, 0.5),
      row(8000, 0.9, 0.5),
      row(10000, 0.1, 0.5),
      row(12000, 0.9, 0.5),
    ),
  );
  const a = analyse(rows);
  near(a.threshold, 0.9, 1e-4);
  eq(a.bestStretch.startMs, 4000);
  eq(a.bestStretch.endMs, 8000);
  eq(a.bestStretch.durationMs, 4000);
});

t("a stretch never spans a pause in the recording", () => {
  const { rows } = parseCsv(
    csvOf(row(0, 0.9, 0.5), row(2000, 0.9, 0.5), row(600000, 0.9, 0.5), row(602000, 0.9, 0.5)),
  );
  const a = analyse(rows);
  eq(a.bestStretch.durationMs, 2000, "the ten-minute pause must break the run");
});

t("no threshold is invented when nothing is usable", () => {
  const { rows } = parseCsv(csvOf(row(0, 0.9, 0.9, "bad"), row(2000, 0.9, 0.9, "noContact")));
  const a = analyse(rows);
  eq(a.usableCount, 0);
  ok(Number.isNaN(a.threshold));
  eq(a.bestStretch, null);
});

t("band powers average only over usable rows", () => {
  const { rows } = parseCsv(csvOf(row(0, 0.5, 0.5, "great"), row(2000, 0.5, 0.5, "bad")));
  const a = analyse(rows);
  near(a.bands.alpha, 0.5, 1e-4);
});

// ---------- logger CLI, end to end ----------
section("Logger CLI");

const tmp = mkdtempSync(join(tmpdir(), "cfl-test-"));

t("mock mode writes a well-formed log this app can read back", () => {
  const outFile = join(tmp, "out.csv");
  execFileSync(process.execPath, ["logger.js"], {
    cwd: ROOT,
    env: { ...process.env, MODE: "mock", LOG_INTERVAL_MS: "50", DURATION_SEC: "1", OUT_FILE: outFile },
    stdio: "pipe",
  });
  const { rows, warnings } = parseCsv(readFileSync(outFile, "utf8"));
  eq(warnings.length, 0);
  ok(rows.length >= 5, `expected several rows, got ${rows.length}`);
  eq(rows[0].mode, "mock");
  eq(rows[0].signal_quality, "mock");
  ok(analyse(rows).usableCount === rows.length, "every mock row should be usable");
});

t("a second run appends without repeating the header", () => {
  const outFile = join(tmp, "append.csv");
  const env = { ...process.env, MODE: "mock", LOG_INTERVAL_MS: "50", DURATION_SEC: "1", OUT_FILE: outFile };
  execFileSync(process.execPath, ["logger.js"], { cwd: ROOT, env, stdio: "pipe" });
  const firstCount = parseCsv(readFileSync(outFile, "utf8")).rows.length;
  execFileSync(process.execPath, ["logger.js"], { cwd: ROOT, env, stdio: "pipe" });
  const text = readFileSync(outFile, "utf8");
  eq(text.split("\n").filter((l) => l.startsWith("timestamp_iso")).length, 1);
  ok(parseCsv(text).rows.length > firstCount);
});

t("it refuses to append to a file with a different header", () => {
  const outFile = join(tmp, "foreign.csv");
  writeFileSync(outFile, "a,b,c\n1,2,3\n");
  let failed = false;
  let stderr = "";
  try {
    execFileSync(process.execPath, ["logger.js"], {
      cwd: ROOT,
      env: { ...process.env, MODE: "mock", DURATION_SEC: "1", OUT_FILE: outFile },
      stdio: "pipe",
    });
  } catch (err) {
    failed = true;
    stderr = String(err.stderr || "");
  }
  ok(failed, "expected a non-zero exit");
  ok(stderr.includes("Refusing to append"));
  eq(readFileSync(outFile, "utf8"), "a,b,c\n1,2,3\n", "the existing file must be untouched");
});

t("live mode reaches the credential check, so the SDK actually loads", () => {
  // Regression test for @neurosity/sdk shipping "type": "module" with a
  // CommonJS require entry point, which made every live run die on import.
  let stderr = "";
  try {
    execFileSync(process.execPath, ["logger.js"], {
      cwd: ROOT,
      env: { ...process.env, MODE: "live", NEUROSITY_EMAIL: "", NEUROSITY_PASSWORD: "", OUT_FILE: join(tmp, "live.csv") },
      stdio: "pipe",
    });
  } catch (err) {
    stderr = String(err.stderr || "");
  }
  ok(stderr.includes("NEUROSITY_EMAIL"), `expected the credential message, got: ${stderr.slice(0, 200)}`);
  ok(!stderr.includes("exports is not defined"), "the SDK import regressed to CommonJS");
});

t("a bad interval is rejected before anything is written", () => {
  let stderr = "";
  try {
    execFileSync(process.execPath, ["logger.js"], {
      cwd: ROOT,
      env: { ...process.env, LOG_INTERVAL_MS: "abc", OUT_FILE: join(tmp, "never.csv") },
      stdio: "pipe",
    });
  } catch (err) {
    stderr = String(err.stderr || "");
  }
  ok(stderr.includes("Bad LOG_INTERVAL_MS"));
});

rmSync(tmp, { recursive: true, force: true });

// ---------- result ----------
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
