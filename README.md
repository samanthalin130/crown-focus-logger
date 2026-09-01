# Crown Focus Logger

Records a [Neurosity Crown](https://neurosity.co/) session to a CSV file you own, then reads it back in your browser. No account, no server, no upload.

This is one half of independent research on a Crown headset loaned by the GFT Labs Digital Innovation Lab, the half that does the recording: 219 training trials and three full sessions came out of this tool and its console exports. The write-up is at [crown-analysis-tawny.vercel.app](https://crown-analysis-tawny.vercel.app/), and the companion tool that interprets a recording runs in a browser at [crown-debrief.vercel.app](https://crown-debrief.vercel.app/).

| | |
| --- | --- |
| Checks | **27**, all green |
| Dependencies to record in mock mode or read a log | **none**; it runs on Node alone |
| Network requests the browser app makes | **its own files only**: no analytics, no CDN, no webfont |
| Where your sessions live | your own machine, in a file you keep |

## Quickstart

Every command below was run from a fresh `git clone` into an empty directory before it was written here, with no `npm install` at any point.

```
git clone https://github.com/samanthalin130/crown-focus-logger.git
cd crown-focus-logger
npm run sample   # writes a synthetic example session
npm run web      # open the address it prints
npm test         # 26 checks pass, 1 skips
```

The one skipped check exercises live mode, which is the only part that needs the Neurosity SDK. Run `npm install` and it runs too, for 27.

Recording from a real headset needs credentials and is covered below.

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

## What this deliberately does not do

- **It does not sync.** Moving a log to another device means exporting a file and importing it there. Sync would mean a server, and a server would mean somebody else could read your sessions.
- **It does not interpret.** This tool records and shows; turning a recording into a plain-English account of what happened is [crown-debrief](https://github.com/samanthalin130/crown-debrief).
- **It does not diagnose.** Focus and calm are model outputs from a consumer headset, not measurements, and nothing here is a health assessment.
- **Live mode has never been run against a physical Crown by this author.** It reaches the credential check and the SDK loads, which is what the test asserts, and that is as far as the verification goes.

## How this was built

Designed, specified, and verified by Samantha Lin. Implementation was AI-assisted under her direction, with adversarial review and automated checks gating every shipped claim.

## Related

- [crown-debrief](https://github.com/samanthalin130/crown-debrief), which reads the CSV this tool writes and says what happened in the session.
- [The research write-up](https://crown-analysis-tawny.vercel.app/), including the findings and the session analyses.

## Licence

MIT. See [LICENSE](LICENSE).
