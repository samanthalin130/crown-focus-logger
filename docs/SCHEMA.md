# The data model

One row per sample. One CSV file per recording run. Eleven columns, in this
order, always:

```
timestamp_iso,epoch_ms,mode,focus,calm,alpha,beta,delta,theta,gamma,signal_quality
```

Treat this as frozen. Three places depend on it: `logger.js` writes it,
`web/schema.js` reads it, and the separate `crown-debrief` project parses it in
`core/csv.js`. Change one and you must change all three.

## Columns

| Column | Type | Unit / range | What it is |
| --- | --- | --- | --- |
| `timestamp_iso` | string | ISO 8601, UTC | When the row was written, human readable. Redundant with `epoch_ms` on purpose, so the file is readable in a spreadsheet without conversion. |
| `epoch_ms` | integer | milliseconds since 1 Jan 1970 UTC | When the row was written. This is the column to sort and do arithmetic on. |
| `mode` | string | `mock` or `live` | How the row was produced. `mock` is synthetic data from the generator. `live` came from a real Crown. |
| `focus` | number | 0 to 1 | Neurosity's focus score at that moment. See "What focus and calm are not" below. |
| `calm` | number | 0 to 1 | Neurosity's calm score at that moment. |
| `alpha` | number | relative power, no fixed unit | Average alpha band power across the eight electrodes. |
| `beta` | number | relative power, no fixed unit | Average beta band power across the eight electrodes. |
| `delta` | number | relative power, no fixed unit | Average delta band power across the eight electrodes. |
| `theta` | number | relative power, no fixed unit | Average theta band power across the eight electrodes. |
| `gamma` | number | relative power, no fixed unit | Average gamma band power across the eight electrodes. |
| `signal_quality` | string | see below | How good the sensor contact was, collapsed across all eight electrodes to the worst one. |

A twelfth column, `person_id`, is optional. This logger does not write it.
`crown-debrief` does, and both sides tolerate its absence. If you add it, put it
last so older files still parse.

### `signal_quality` values

| Value | Meaning | Used in analysis? |
| --- | --- | --- |
| `great` | Every electrode reported great contact. | yes |
| `good` | At least one electrode was good or great, none were bad or off the head. | yes |
| `mock` | Synthetic row. Internally consistent, so it is analysable, but it is not a measurement. | yes |
| `bad` | At least one electrode reported bad contact. | no |
| `noContact` | At least one electrode was not touching the head. | no |
| `unknown` | The signal quality stream had not reported yet. | no |

The collapse is deliberately pessimistic: one loose sensor out of eight makes
the whole row untrusted. A bad electrode still produces confident-looking focus
numbers, so the choice is to drop those rows rather than average them in.

### How the band values are averaged

The Crown streams `powerByBand` as an array of eight values per band, one per
electrode. `logger.js` takes the plain mean across those eight and writes a
single number. That loses the per-electrode detail. It is the right trade for a
log you want to open in a spreadsheet, and the wrong one if you ever want to ask
which side of the head something happened on. If you need that, widen the schema
to `alpha_cp3, alpha_c3, ...` and bump a format version.

Band power is **relative**, with no fixed physical unit. Comparing alpha to beta
within one session is meaningful. Comparing today's alpha to last week's is not.

## What focus and calm are not

They are the output of models Neurosity trained in advance. They are
interpretations of the signal, not physical quantities, and they are not
comparable between people or reliably between sittings.

That is why nothing in this project uses a fixed "focused" threshold. The
browser app scores every session against the median focus of that same session,
computed from that person's own usable rows.

## Sampling

One row every `LOG_INTERVAL_MS`, default 2000 ms. The Crown's own streams update
faster than that; the logger holds the most recent value of each stream and
samples them on its own timer. So a row is a snapshot of the latest value of
each stream at that instant, not an average over the interval.

Rows are only written once both the focus and calm streams have delivered at
least one value. Before that the logger prints "waiting" and writes nothing,
which stops the file starting with rows of `0.0`.

## Files with more than one sitting in them

`logger.js` appends. Run it twice against the same `OUT_FILE` and you get one
file containing two sittings with a pause between them.

The browser app treats one file as one session and reports the pauses instead of
guessing where to split. A pause is any step longer than three times the typical
step for that file. The "longest good stretch" figure never spans one.

If you would rather keep sittings separate, set a different `OUT_FILE` per run.

## Spreadsheet export

The CSV **is** the spreadsheet export. Excel, Numbers and Google Sheets all open
it directly, and it round trips: the browser app re-reads a file that has been
through a spreadsheet, including quoted fields.

There is no `.xlsx` writer, and there never was one, despite what earlier notes
on this project said. Adding one would mean a new dependency for a format that
buys nothing over CSV here.

## Reading a file safely

`web/schema.js` is deliberately tolerant. It will:

- accept columns in any order, and keep columns it does not recognise
- rebuild `epoch_ms` from `timestamp_iso` if the number column is blank
- treat a blank numeric cell as missing, **not** as `0`
- skip lines it cannot read, and tell you how many it skipped
- refuse the whole file, rather than half-read it, if there is no `focus` column

That third point matters more than it looks. `Number("")` in JavaScript is `0`,
not `NaN`, so a naive parser turns a blank focus cell into a real-looking reading
of zero focus. The test suite has a case for it.
