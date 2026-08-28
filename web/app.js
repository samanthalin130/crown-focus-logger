/**
 * Crown Focus Logger, browser app.
 *
 * Three steps: record or import, keep, read back. Every byte stays in this
 * browser. Nothing in this file, or in anything it imports, makes a network
 * request.
 */

import { parseCsv, toCsv, COLUMNS } from "./schema.js";
import { analyse } from "./analysis.js";
import { timelineSvg, bandsSvg, qualityBar } from "./charts.js";
import { createDemoRecorder } from "./recorder.js";
import * as store from "./store.js";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------------- formatting ----------------
function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "--";
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}
const fmtClock = (ms) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDate = (ms) =>
  new Date(ms).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const pct = (v) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : "--");
const score = (v) => (Number.isFinite(v) ? v.toFixed(2) : "--");
const fmtBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

// ---------------- tabs ----------------
const TABS = ["record", "log", "read"];
function showTab(name) {
  for (const t of TABS) {
    $(`tab-${t}`).setAttribute("aria-selected", String(t === name));
    $(`view-${t}`).hidden = t !== name;
  }
  if (name === "log") renderLog();
}
for (const t of TABS) $(`tab-${t}`).addEventListener("click", () => showTab(t));

// ---------------- saving a session ----------------
function sessionTitle(rows, source) {
  const when = rows.length ? fmtDate(rows[0].epoch_ms) : fmtDate(Date.now());
  return `${source === "demo" ? "Demo session" : "Session"}, ${when}`;
}

async function saveSession({ rows, source, title, warnings = [] }) {
  const session = {
    id: store.newId(),
    title: title || sessionTitle(rows, source),
    createdMs: rows.length ? rows[0].epoch_ms : Date.now(),
    savedMs: Date.now(),
    source,
    rows,
    warnings,
  };
  await store.putSession(session);
  return session;
}

// ---------------- demo recorder ----------------
let recorder = null;
let recStart = 0;
let tick = null;

$("btn-start").addEventListener("click", () => {
  if (recorder && recorder.running) return;
  recStart = Date.now();
  recorder = createDemoRecorder({
    intervalMs: 1000,
    onRow: (row, n) => {
      $("focusval").textContent = row.focus.toFixed(2);
      $("calmval").textContent = row.calm.toFixed(2);
      $("focusfill").style.width = `${(row.focus * 100).toFixed(1)}%`;
      $("calmfill").style.width = `${(row.calm * 100).toFixed(1)}%`;
      $("recstatus").textContent = `Recording. ${n} row${n === 1 ? "" : "s"} so far.`;
    },
  });
  recorder.start();
  tick = setInterval(() => {
    const s = Math.floor((Date.now() - recStart) / 1000);
    $("elapsed").textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }, 500);
  $("btn-start").disabled = true;
  $("btn-stop").disabled = false;
});

$("btn-stop").addEventListener("click", async () => {
  if (!recorder) return;
  const rows = recorder.stop();
  clearInterval(tick);
  $("btn-start").disabled = false;
  $("btn-stop").disabled = true;

  if (rows.length < 2) {
    $("recstatus").textContent = "Too short to save. Let it run for a few seconds.";
    recorder = null;
    return;
  }
  const session = await saveSession({ rows: [...rows], source: "demo" });
  recorder = null;
  $("recstatus").textContent = `Saved ${rows.length} rows.`;
  openSession(session.id);
});

// ---------------- import ----------------
$("btn-import").addEventListener("click", () => $("fileinput").click());
$("btn-import2").addEventListener("click", () => $("fileinput").click());

$("fileinput").addEventListener("change", async (e) => {
  const files = [...(e.target.files || [])];
  e.target.value = "";
  let added = 0;
  const problems = [];

  for (const file of files) {
    const text = await file.text();
    try {
      if (file.name.toLowerCase().endsWith(".json")) {
        added += await importBackup(text);
      } else {
        const { rows, warnings } = parseCsv(text);
        if (!rows.length) {
          problems.push(`${file.name}: ${warnings[0] || "nothing readable in it."}`);
          continue;
        }
        await saveSession({ rows, source: "imported", title: `${file.name}, ${fmtDate(rows[0].epoch_ms)}`, warnings });
        added++;
      }
    } catch (err) {
      problems.push(`${file.name}: ${err.message}`);
    }
  }

  if (problems.length) alert(`Could not read:\n\n${problems.join("\n")}`);
  if (added) {
    showTab("log");
  }
});

async function importBackup(text) {
  const data = JSON.parse(text);
  const sessions = Array.isArray(data) ? data : data.sessions;
  if (!Array.isArray(sessions)) throw new Error("that JSON is not a log backup.");
  let n = 0;
  for (const s of sessions) {
    if (!s || !Array.isArray(s.rows)) continue;
    await store.putSession({ ...s, id: s.id || store.newId() });
    n++;
  }
  if (!n) throw new Error("that backup has no sessions in it.");
  return n;
}

$("btn-sample").addEventListener("click", async () => {
  try {
    // Resolved against this module, not the page URL, so it still works when
    // the app is served from /logger/ on the Astro site while the page is /logger.
    const res = await fetch(new URL("./sample-session.csv", import.meta.url));
    if (!res.ok) throw new Error(`the example file is not here (${res.status}).`);
    const { rows, warnings } = parseCsv(await res.text());
    const session = await saveSession({
      rows,
      source: "imported",
      title: `Example session, ${fmtDate(rows[0].epoch_ms)}`,
      warnings,
    });
    openSession(session.id);
  } catch (err) {
    alert(`Could not load the example session: ${err.message}`);
  }
});

// ---------------- download helpers ----------------
function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

async function exportSessionCsv(id) {
  const s = await store.getSession(id);
  if (!s) return;
  download(`${slug(s.title) || "session"}.csv`, toCsv(s.rows), "text/csv");
}

$("btn-exportall").addEventListener("click", async () => {
  const sessions = await store.listSessions();
  if (!sessions.length) {
    alert("There is nothing in your log yet.");
    return;
  }
  const backup = {
    format: "crown-focus-logger/backup",
    version: 1,
    exportedIso: new Date().toISOString(),
    columns: COLUMNS,
    sessions,
  };
  download(`crown-focus-log-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), "application/json");
});

$("btn-deleteall").addEventListener("click", async () => {
  const sessions = await store.listSessions();
  if (!sessions.length) {
    alert("There is nothing to delete.");
    return;
  }
  if (!confirm(`Delete all ${sessions.length} session(s) permanently? Export a backup first if you want to keep them. This cannot be undone.`)) return;
  await store.deleteAll();
  renderLog();
});

// ---------------- the log list ----------------
async function renderLog() {
  const sessions = await store.listSessions();
  const list = $("slist");

  $("storesize").textContent = sessions.length
    ? `${sessions.length} session${sessions.length === 1 ? "" : "s"}, about ${fmtBytes(await store.approximateBytes())} in this browser.`
    : "";

  if (!sessions.length) {
    list.innerHTML = `<div class="card"><p class="empty">Nothing here yet. Record a demo session, load the example, or import a CSV from the desktop logger.</p></div>`;
    return;
  }

  list.innerHTML = sessions
    .map((s) => {
      const a = analyse(s.rows);
      return `<div class="srow">
        <div class="stitle">
          <b>${esc(s.title)}</b>
          <span>${a.rowCount} rows &middot; ${fmtDuration(a.durationMs)} &middot; ${pct(a.coverage)} usable signal</span>
        </div>
        <span class="tag ${a.isSynthetic ? "synthetic" : "real"}">${a.isSynthetic ? "synthetic" : "recorded"}</span>
        <span class="sstat">focus ${score(a.focus.median)}</span>
        <div class="btnrow">
          <button class="btn primary" data-open="${esc(s.id)}">Read it back</button>
          <button class="btn" data-csv="${esc(s.id)}">CSV</button>
          <button class="btn danger" data-del="${esc(s.id)}">Delete</button>
        </div>
      </div>`;
    })
    .join("");

  list.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openSession(b.dataset.open)));
  list.querySelectorAll("[data-csv]").forEach((b) => b.addEventListener("click", () => exportSessionCsv(b.dataset.csv)));
  list.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm("Delete this session permanently? This cannot be undone.")) return;
      await store.deleteSession(b.dataset.del);
      renderLog();
    }),
  );
}

// ---------------- reading one session back ----------------
async function openSession(id) {
  const s = await store.getSession(id);
  if (!s) return;
  const a = analyse(s.rows);

  const stretch = a.bestStretch
    ? `${fmtDuration(a.bestStretch.durationMs)}`
    : "none";
  const stretchSub = a.bestStretch
    ? `from ${fmtClock(a.bestStretch.startMs)} to ${fmtClock(a.bestStretch.endMs)}`
    : "no run long enough to report";

  const lost = a.rowCount - a.usableCount;

  $("readbody").innerHTML = `
    <h2>${esc(s.title)}</h2>
    <p class="slede">
      ${a.isSynthetic ? "<b>This is synthetic data.</b> It was made up, not measured. " : ""}
      Recorded ${fmtDate(a.startMs)}, one reading about every ${Number.isFinite(a.typicalMs) ? (a.typicalMs / 1000).toFixed(1) : "?"} seconds.
    </p>

    <div class="tkgrid">
      <div class="tk"><span class="n">Length</span><b class="big">${fmtDuration(a.durationMs)}</b><span class="sub">${a.rowCount} readings</span></div>
      <div class="tk"><span class="n">Usable signal</span><b class="big">${pct(a.coverage)}</b><span class="sub">${lost > 0 ? `${lost} reading${lost === 1 ? "" : "s"} left out` : "nothing left out"}</span></div>
      <div class="tk"><span class="n">Your focus range</span><b class="big">${score(a.focus.min)} to ${score(a.focus.max)}</b><span class="sub">middle of your range: ${score(a.focus.median)}</span></div>
      <div class="tk"><span class="n">Longest good stretch</span><b class="big">${stretch}</b><span class="sub">${stretchSub}</span></div>
    </div>

    <div class="card">
      <span class="k">Focus and calm across the session</span>
      ${timelineSvg(a)}
      <div class="legend">
        <span><i class="focus"></i>Focus</span>
        <span><i class="calm"></i>Calm</span>
        <span><i class="thresh"></i>Your median focus (${score(a.threshold)})</span>
        <span>Shaded band: your longest stretch at or above it</span>
      </div>
    </div>

    <div class="cards2">
      <div class="card">
        <span class="k">Average band power, usable rows only</span>
        ${bandsSvg(a)}
        <p class="empty" style="margin-top:12px">Averaged across the eight electrodes by the recorder, then across this session. Relative, not absolute: compare bands within a session, not between sessions.</p>
      </div>
      <div class="card">
        <span class="k">The session in numbers</span>
        <table class="meta">
          <tr><td>Readings recorded</td><td>${a.rowCount}</td></tr>
          <tr><td>Readings used</td><td>${a.usableCount}</td></tr>
          <tr><td>Focus, middle of range</td><td>${score(a.focus.median)}</td></tr>
          <tr><td>Focus, average</td><td>${score(a.focus.mean)}</td></tr>
          <tr><td>Calm, middle of range</td><td>${score(a.calm.median)}</td></tr>
          <tr><td>Time at or above your median focus</td><td>${pct(a.aboveShare)}</td></tr>
          <tr><td>Breaks in the recording</td><td>${a.gaps.length}${a.gaps.length ? `, longest ${fmtDuration(Math.max(...a.gaps.map((g) => g.durationMs)))}` : ""}</td></tr>
        </table>
      </div>
    </div>

    <div class="card">
      <span class="k">Sensor contact across the recording</span>
      ${qualityBar(a)}
      <p class="empty" style="margin-top:12px">Only <b>great</b>, <b>good</b> and <b>mock</b> readings are used in the numbers above. A loose electrode produces confident-looking values that mean nothing, so those rows are left out rather than averaged in.</p>
    </div>

    <div class="limitnote">
      <span class="tag2">What these numbers are not</span>
      <p>Focus and calm are the output of Neurosity's models, not measurements of your brain. They are a probability between 0 and 1, and they are not comparable between people or reliably between sittings, which is why nothing here uses a fixed threshold. Everything above is scored against your own range in this one session.</p>
      <p>This is a prototype. It reports what is in your file and nothing more. It does not diagnose anything, and it is not a medical device.</p>
    </div>

    ${(s.warnings || []).length ? `<div class="warn"><b>When this file was read:</b> ${s.warnings.map(esc).join(" ")}</div>` : ""}

    <div class="btnrow" style="margin-top:18px">
      <button class="btn primary" id="btn-thiscsv">Export this session as CSV</button>
      <button class="btn" id="btn-backtolog">Back to your log</button>
    </div>
  `;

  $("btn-thiscsv").addEventListener("click", () => exportSessionCsv(s.id));
  $("btn-backtolog").addEventListener("click", () => showTab("log"));
  showTab("read");
}

// ---------------- boot ----------------
(async function boot() {
  const state = await store.init();
  if (!state.persistent) {
    $("storewarn").classList.remove("hide");
    $("storewarnmsg").textContent = `This browser will not let the page save anything to disk (${state.reason}).`;
  }
  await renderLog();
  console.log("[CrownFocusLogger] ready. Storage:", state.persistent ? "IndexedDB" : "memory only");
})();
