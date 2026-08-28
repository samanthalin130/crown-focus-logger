# Crown Focus Logger

Record your own [Neurosity Crown](https://neurosity.co/) focus sessions to a CSV
file you own, then read them back in your browser.

Two pieces, one data format:

- **`logger.js`**, a Node command-line tool that talks to the headset and writes
  a CSV. This is the part that touches real hardware.
- **`web/`**, a browser app that keeps your sessions on your own device and shows
  you what is in them. No build step, no framework, no server.

Independent research using hardware loaned by the GFT Labs Digital Innovation Lab.

## Privacy by design

Every session lives in your browser's own storage, on your own device, or in a
file you downloaded and kept. There is no account, no central database, and
nothing to sign into.

Concretely:

- The browser app makes **no network requests except for its own files**. No
  analytics, no telemetry, no third-party webfont, no CDN. You can confirm this
  in your browser's network tab: the only requests are to the page's own
  scripts, stylesheet and, if you click it, the example CSV.
- Your Neurosity email and password are only ever typed into `.env` on your own
  machine, for the command-line recorder. They are never entered into a web page.
- Moving your log to another device means exporting a file and importing it
  there. There is no sync, because sync would mean a server, and a server would
  mean somebody else could read your data.
- The author of this project cannot see your sessions. Not by policy. By there
  being no mechanism.

The trade is real and worth stating plainly: if you clear your browser data, your
sessions go with it. Export a backup for anything you want to keep.

## Try it in a minute, with no headset

```bash
npm install       # only needed for live mode, but harmless now
npm run sample    # writes a synthetic example session
npm run web       # open the address it prints
```

Click **Load the example session**. Everything on the page is computed in your
browser from that file.

You can also record a synthetic session in the page itself. It is clearly
labelled as synthetic wherever it appears, so it cannot be mistaken for a real
reading.

## Record from a real Crown

You need the headset and a Neurosity account.

```bash
npm install
cp .env.example .env      # then fill in your Neurosity email and password
npm run live              # Ctrl+C to stop
```

That writes `focus-log.csv`. Open the browser app (`npm run web`), click
**Import a CSV or backup**, and choose it.

To try the pipeline with no headset, use mock mode instead:

```bash
npm run mock
```

### Configuration

All optional, set as environment variables.

| Variable | Default | Description |
| --- | --- | --- |
| `MODE` | `mock` | `mock` (synthetic) or `live` (real Crown) |
| `LOG_INTERVAL_MS` | `2000` | How often a row is written, minimum 50 |
| `OUT_FILE` | `focus-log.csv` | Output path |
| `DURATION_SEC` | `0` | Auto-stop after N seconds, 0 means run until Ctrl+C |
| `NEUROSITY_EMAIL` | | Required for live mode |
| `NEUROSITY_PASSWORD` | | Required for live mode |
| `NEUROSITY_DEVICE_ID` | | Only if your account has several devices |

`node logger.js --help` prints the same table.

## How it works

The recorder is one pattern:

```
authenticate -> subscribe to the device streams -> keep the latest value of
each -> write one CSV row on a fixed timer
```

It subscribes to focus, calm, `powerByBand` and signal quality, holds the most
recent value of each, and samples them on the interval. Band power is averaged
across the eight electrodes. Signal quality collapses to the worst electrode, so
one loose sensor is never hidden by seven good ones.

The browser app reads that CSV, stores each session in IndexedDB, and computes
everything on screen from the rows. There is no model in the loop and no
randomness: the same file always produces the same numbers.

## What the analysis actually reports

For one session:

- length, number of readings, and the share with a usable signal
- your focus range in that session (lowest, median, highest) and the same for calm
- your longest unbroken stretch at or above your own median focus, with clock times
- focus and calm plotted against the clock, with your median marked
- average power in each of the five bands, over usable rows only
- how the recording split by sensor contact
- any pauses in the recording, and how long they were

Two rules it follows on purpose:

1. **Rows with bad sensor contact are excluded, not averaged in.** A loose
   electrode produces confident-looking numbers that mean nothing.
2. **There is no fixed threshold for "focused".** Crown scores are not comparable
   between people or between sittings, so every figure is scored against your own
   median in that same session.

## The data format

Eleven columns, frozen, documented in **[docs/SCHEMA.md](docs/SCHEMA.md)**:

```
timestamp_iso,epoch_ms,mode,focus,calm,alpha,beta,delta,theta,gamma,signal_quality
```

The CSV is the spreadsheet export. Excel, Numbers and Sheets all open it
directly, and a file that has been through a spreadsheet still imports.

## Project layout

```
logger.js                 the command-line recorder. Self-contained on purpose:
                          crown-debrief vendors this single file, so it must not
                          require anything else in this repo.
web/
  index.html              the browser app
  app.js                  wiring, rendering, import and export
  schema.js               the CSV format: parse, serialise, what counts as usable
  analysis.js             every number the app shows is computed here
  charts.js               inline SVG charts, no charting library
  store.js                IndexedDB, with a memory fallback
  recorder.js             the in-browser synthetic recorder
  styles.css              palette and cards taken from the Console Decoded page
  sample-session.csv      synthetic example, generated by npm run sample
scripts/
  serve-web.js            a static file server for local use
  make-sample.js          generates the example session
test/run-tests.mjs        27 tests, no dependencies
docs/
  SCHEMA.md               the data model
  USER-GUIDE.md           plain-language instructions for a non-engineer
  PORTING.md              how to drop the app into the Astro site
```

## Tests

```bash
npm test
```

27 tests, no test framework. They cover the CSV format, the analysis, and the
command-line tool end to end (including a regression test for the SDK import bug
described below). They do **not** cover the browser UI or IndexedDB.

## Honest notes

**What was broken and is now fixed.** Live mode had never worked against a
current SDK. `@neurosity/sdk` 7.x declares `"type": "module"` but its `require`
entry point is CommonJS, so `require("@neurosity/sdk")` threw
`exports is not defined in ES module scope` before login was ever attempted. It
now loads via dynamic `import()`. Live mode also used to write rows before the
streams had delivered anything, so a log began with real-looking `focus=0` rows;
it now waits.

**What is untested against hardware.** I have verified that the SDK loads,
constructs a client, and that the credential path is reached. I have not run this
against a physical Crown in this pass. The stream subscription code is unchanged
from the version that was previously used with the headset, but treat live mode
as needing one confirmation run.

**Assumptions worth challenging.** That one CSV file is one session. That the
mean across eight electrodes is a useful summary. That the median of a session is
a fair personal baseline, when a short session may not contain enough range to
have a meaningful median. That three times the typical interval is the right
definition of a pause.

**What is not production grade.** No schema version field in the file itself. No
migration path if the columns ever change. IndexedDB has no quota handling beyond
falling back to memory. The browser app has no automated tests. Import accepts
any CSV with a `focus` column, so a malformed file can produce a session that
parses but means nothing.

**Deliberately not built.** No server, no account, no sync, no analytics. Those
are not missing features. Adding any of them would break the one property this
project is for.

## Related

- **[crown-debrief](https://github.com/samanthalin130/crown-debrief)** reads the
  same CSV and writes a plain-English account of a session. It vendors this
  logger as `collector/logger.js`. That vendored copy has the SDK bug described
  above and needs the same fix.

## Licence

MIT. See [LICENSE](LICENSE).

---

Built by Samantha Lin as part of an independent exploration of brain-computer
interfaces and AI.
