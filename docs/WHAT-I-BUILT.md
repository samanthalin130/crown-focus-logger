# What I built

Three descriptions of the same thing, at three lengths. All three have been
checked line by line against the code. Nothing here describes a feature that is
not actually there.

---

## One sentence

A logger that records your Neurosity Crown focus sessions to a spreadsheet file
you own, and a web page that reads those files back, with your data never
leaving your own device.

---

## One paragraph

`crown-focus-logger` is two pieces sharing one data format. A command-line
recorder connects to a Neurosity Crown and writes focus, calm and five bands of
brainwave power to a CSV file every couple of seconds, marking each row with how
good the sensor contact was. A browser app then reads those files, keeps each
session in your own browser's storage, and works out what happened in the
session: how much of it was usable, what your focus range was, when your longest
good stretch was, and how the bands moved. There is no server and no account.
The analysis runs entirely in your browser, and the person who built it cannot
see your data, because there is nowhere for it to be sent.

---

## The full version

**The problem.** Your own sense of how focused you were is unreliable, and the
Neurosity console does not let you keep or query your history in any useful way.
So the first thing worth building is a way to hold your own record.

**The recorder.** A Node command-line tool. It logs into your Neurosity account,
subscribes to the Crown's focus, calm, band-power and signal-quality streams,
holds the most recent value of each, and writes one CSV row on a fixed timer,
every two seconds by default. Band power is averaged across the eight
electrodes. Signal quality is collapsed to the worst electrode, so one loose
sensor is never hidden by seven good ones. It also runs in a mock mode that
generates synthetic data, so the whole pipeline can be developed and demonstrated
with no headset attached.

**The format.** Eleven columns, documented and frozen, because a second project
(`crown-debrief`) parses the same files. It is a plain CSV, which means it is
also the spreadsheet export: Excel, Numbers and Sheets all open it directly.

**The browser app.** A page with no build step and no framework. You import a
CSV, or record a synthetic demo session in the page itself. Each session is
stored in your browser's own IndexedDB. Opening one shows you the session length
and usable share, your focus range in that session, your longest unbroken
stretch at or above your own median focus, focus and calm plotted against the
clock, average power in each band, and how the recording split by sensor
contact. You can export any single session as CSV, or the whole log as a backup
file to move to another device.

**Two rules the analysis follows.** Rows with bad sensor contact are excluded
rather than averaged in, because a loose electrode produces confident-looking
numbers that mean nothing. And there is no fixed threshold for "focused": Crown
scores are not comparable between people or between sittings, so every figure is
scored against your own median within that same session.

**Why it is built this way.** Brain data is about as personal as data gets. So
there is no central database, no account and no sync. Your sessions live in your
browser or in a file you downloaded. Moving them to another device means
exporting a file and importing it, not trusting a server. The web page makes no
network requests at all, and your Neurosity credentials are only ever typed into
a local file for the command-line recorder, never into a web page. This is not a
missing feature set. It is the point.

**What it is not.** It is not a finished product, it does not diagnose anything,
and it is not a medical device. It reports what is in your file and stops there.

---

## Things the earlier description got wrong

Kept here so the same claims do not creep back in.

- **"It logs into an Excel sheet."** It writes CSV, and always did. There is no
  `.xlsx` writer. CSV is the spreadsheet export, since every spreadsheet
  application opens it.
- **"Runs in two modes: mock and live."** True of mock. Live mode had never
  worked against a current SDK: it threw on import before reaching the login.
  That is now fixed, but it has still not been confirmed against a physical
  headset in this pass.
- **The roadmap listed "session charts" as not started.** They exist now, in the
  browser app.
- **"Never leave the local machine."** The old README said this about logged
  data while describing a tool whose only privacy mechanism was `.gitignore`.
  The claim is now true of the browser app in a way that can be checked: it makes
  no network requests.
