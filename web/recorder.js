/**
 * The in-browser demo recorder.
 *
 * This produces SYNTHETIC data. It is not connected to a headset and never
 * will be: the real-hardware path is the desktop logger (logger.js), which
 * talks to the Crown and writes a CSV you then import here.
 *
 * The maths is the same low-pass filtered random walk that logger.js uses in
 * mock mode, so a demo session and a `npm run mock` session look alike. Every
 * row is stamped mode=mock and signal_quality=mock, and the app labels any
 * session made this way as synthetic wherever it appears.
 */

export function createDemoRecorder({ intervalMs = 1000, onRow } = {}) {
  let focus = 0.5;
  let calm = 0.5;
  let focusVel = 0;
  let calmVel = 0;
  let timer = null;
  const rows = [];

  function step() {
    focusVel = focusVel * 0.85 + (Math.random() - 0.5) * 0.05;
    calmVel = calmVel * 0.85 + (Math.random() - 0.5) * 0.05;
    focus = Math.max(0, Math.min(1, focus + focusVel));
    calm = Math.max(0, Math.min(1, calm + calmVel));

    const n = () => (Math.random() - 0.5) * 0.1;
    const beta = Math.max(0, 0.2 + focus * 0.7 + n());
    const gamma = Math.max(0, 0.15 + focus * 0.6 + n());
    const alpha = Math.max(0, 0.2 + calm * 0.7 + n());
    const theta = Math.max(0, 0.15 + calm * 0.6 + n());
    const delta = Math.max(0, 0.3 + (1 - focus) * 0.3 + n());

    const now = Date.now();
    const row = {
      timestamp_iso: new Date(now).toISOString(),
      epoch_ms: now,
      mode: "mock",
      focus,
      calm,
      alpha,
      beta,
      delta,
      theta,
      gamma,
      signal_quality: "mock",
    };
    rows.push(row);
    if (onRow) onRow(row, rows.length);
  }

  return {
    rows,
    start() {
      if (timer) return;
      step();
      timer = setInterval(step, intervalMs);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      return rows;
    },
    get running() {
      return timer !== null;
    },
  };
}
