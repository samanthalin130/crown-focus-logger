/**
 * The CSV format, in one place.
 *
 * These eleven columns are what logger.js writes and what crown-debrief reads.
 * Treat them as frozen. A twelfth column, person_id, is optional: crown-debrief
 * writes it, this logger does not, and both sides tolerate its absence.
 *
 * Runs unchanged in the browser and in Node.
 */

export const COLUMNS = [
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

export const BANDS = ["delta", "theta", "alpha", "beta", "gamma"];

const NUMERIC = new Set(["epoch_ms", "focus", "calm", ...BANDS]);

/** Signal-quality labels worth trusting. "mock" is synthetic but internally consistent. */
export const USABLE_QUALITY = new Set(["great", "good", "mock"]);

export function isUsable(row) {
  return USABLE_QUALITY.has(String(row.signal_quality).toLowerCase());
}

/**
 * Parse a Crown log CSV into row objects.
 * Tolerant on purpose: unknown columns are kept, missing ones are filled,
 * unreadable lines are skipped and counted rather than thrown.
 * Returns { rows, warnings }.
 */
export function parseCsv(text) {
  const warnings = [];
  const lines = String(text)
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");

  if (lines.length === 0) return { rows: [], warnings: ["That file is empty."] };

  const header = splitLine(lines[0]).map((h) => h.trim());
  if (!header.includes("focus")) {
    return {
      rows: [],
      warnings: ["That does not look like a Crown log. No 'focus' column in the first line."],
    };
  }
  for (const needed of ["calm", "signal_quality"]) {
    if (!header.includes(needed)) warnings.push(`No '${needed}' column. Filling it in as blank.`);
  }

  const rows = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const parts = splitLine(lines[i]);
    if (parts.length < 3) {
      skipped++;
      continue;
    }
    const row = {};
    header.forEach((key, j) => {
      const raw = parts[j] === undefined ? "" : parts[j].trim();
      // Number("") is 0, not NaN. Without this guard a blank focus cell
      // becomes a real-looking 0.0 reading and a blank epoch_ms becomes 1970.
      row[key] = NUMERIC.has(key) ? (raw === "" ? NaN : Number(raw)) : raw;
    });

    // Older or hand-edited files may carry only the ISO timestamp.
    if (!Number.isFinite(row.epoch_ms)) {
      const t = Date.parse(row.timestamp_iso);
      if (Number.isFinite(t)) row.epoch_ms = t;
    }
    if (!Number.isFinite(row.epoch_ms) || !Number.isFinite(row.focus)) {
      skipped++;
      continue;
    }

    if (!row.timestamp_iso) row.timestamp_iso = new Date(row.epoch_ms).toISOString();
    row.signal_quality = row.signal_quality || "unknown";
    row.mode = row.mode || "unknown";
    for (const b of BANDS) if (!Number.isFinite(row[b])) row[b] = NaN;
    rows.push(row);
  }

  if (skipped > 0) warnings.push(`${skipped} line(s) were unreadable and were left out.`);
  if (rows.length === 0) warnings.push("No readable rows in that file.");

  rows.sort((a, b) => a.epoch_ms - b.epoch_ms);
  return { rows, warnings };
}

function splitLine(line) {
  // Our writer never quotes, but be safe about files that came back from Excel.
  if (!line.includes('"')) return line.split(",");
  const out = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Serialise rows back to the exact format logger.js writes. */
export function toCsv(rows) {
  const head = COLUMNS.join(",");
  const body = rows.map((r) =>
    COLUMNS.map((c) => {
      const v = r[c];
      if (v === undefined || v === null || (typeof v === "number" && !Number.isFinite(v))) return "";
      return typeof v === "number" && c !== "epoch_ms" ? v.toFixed(4) : String(v);
    }).join(","),
  );
  return [head, ...body].join("\n") + "\n";
}
