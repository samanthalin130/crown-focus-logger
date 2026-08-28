# What a professional should verify or refine next

Ordered by how much damage getting it wrong would do.

## Verify first

1. **Run live mode against a physical Crown.** This is the one thing I could not
   do. The SDK import bug is fixed and tested (the suite proves the module loads
   and the credential check is reached), but the stream subscriptions themselves
   are unchanged code that has not been exercised against hardware in this pass.
   Check specifically: that `focus()` and `calm()` emit objects with a
   `probability` field on SDK 7.5.x, that `brainwaves("powerByBand")` still
   returns `data.alpha` as an eight-element array, and that `signalQuality()`
   returns an object whose values carry a `status` string. All four assumptions
   are load-bearing and all four are silent failures if the SDK shape changed:
   you get a file full of zeros, not an error.

2. **Confirm the warm-up guard does not stall.** Live mode now refuses to write
   until both focus and calm have emitted at least once. If either stream never
   emits on a real device, the logger waits forever and writes nothing. It says
   so on screen, but a timeout that gives up and tells the user why would be
   better.

3. **Test IndexedDB on the deployed origin.** It works locally. Netlify, Safari
   private windows, and iOS Safari all behave differently, and Safari evicts
   IndexedDB after seven days without interaction. The app falls back to memory
   and warns, but the seven-day eviction is silent and would look like data loss.

4. **Fix the vendored copy in `crown-debrief`.** It carries this logger as
   `collector/logger.js` from before the SDK fix, so its live mode has the same
   broken `require`. Same one-line fix.

## Refine when there is time

5. **No browser tests.** The suite covers `schema.js`, `analysis.js` and the CLI.
   `app.js`, `store.js` and `charts.js` are untested. `store.js` is the risky one:
   IndexedDB transaction handling is easy to get subtly wrong, and my `tx()`
   helper resolves on `oncomplete` with a slightly awkward result unwrap that
   would benefit from a proper test rather than a reading.

6. **The schema has no version field.** Every consumer assumes eleven columns in
   a fixed order. Adding a `format_version` column now, while there are only two
   consumers, costs almost nothing and makes any future change survivable.

7. **One file equals one session is an assumption, not a fact.** `logger.js`
   appends, so a file can hold several sittings. The app reports the pauses
   rather than splitting on them. Splitting would be more useful and is not hard;
   it just needs a decision about what counts as a session boundary.

8. **The median as a personal baseline is weak on short sessions.** A five-minute
   recording may not contain enough variation for its median to mean anything,
   and the "longest good stretch" figure then reports noise. A minimum-length
   guard, or a wider baseline computed across several of the user's sessions,
   would be more honest. `crown-debrief` already does baseline work worth
   borrowing here.

9. **Band power is averaged across all eight electrodes before it is written.**
   That discards any spatial information permanently, at write time. If
   per-channel analysis is ever wanted, the schema has to widen and old files
   cannot be recovered.

10. **Import is trusting.** Any CSV with a `focus` column is accepted. A file
    with plausible columns and nonsense values produces a session that renders
    perfectly and means nothing. Some sanity checking on ranges would help.

11. **The demo recorder is throttled in a background tab.** Browsers clamp
    `setInterval` in tabs that are not visible, so a demo session left running in
    a background tab collects rows more slowly than its nominal one per second.
    It degrades safely, because every row carries its own timestamp and the
    analysis derives the interval from the data rather than assuming it, but the
    row count will surprise anyone who expects one per second. A
    `visibilitychange` note in the UI, or `requestAnimationFrame`-based timing,
    would remove the surprise. This does not affect `logger.js`, which is a Node
    process and is not throttled.

12. **No quota handling.** If IndexedDB fills up, `putSession` rejects and the
    error surfaces as an unhandled promise rather than a message. Long sessions
    at a short interval get large: at 2000 ms, an hour is 1800 rows.

13. **The two copies of the web app drift.** Once it is on the site, the files in
    `public/logger/` are a copy. See the last section of `PORTING.md`.

## Deliberately not done

Not oversights. Each of these would break the property the project exists for.

- No server, no account, no sync, no analytics.
- No hosted database of anyone's sessions.
- No in-browser Neurosity login, which would mean users typing brain-data
  credentials into a web page.
