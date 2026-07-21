# Crown Focus Logger

Log Neurosity Crown focus, calm, and brainwave band power to a CSV. Ships with a **mock** mode so you can develop and test without the headset.

## Setup

```bash
npm install
cp .env.example .env   # only needed for LIVE mode — fill in your Neurosity credentials
```

## Run

Mock mode (no headset needed):

```bash
npm run mock
```

Live mode (uses your Crown):

```bash
npm run live
```

Stop with `Ctrl+C` — the CSV is flushed and closed cleanly, and the total row count is printed.

## Config (env vars)

| Var                  | Default          | Meaning                                                   |
| -------------------- | ---------------- | --------------------------------------------------------- |
| `MODE`               | `mock`           | `mock` or `live`.                                         |
| `LOG_INTERVAL_MS`    | `2000`           | How often a row is written.                               |
| `OUT_FILE`           | `focus-log.csv`  | Output CSV path (appended if it already exists).          |
| `DURATION_SEC`       | `0`              | Auto-stop after N seconds. `0` means run until `Ctrl+C`.  |
| `NEUROSITY_EMAIL`    | —                | LIVE mode account email.                                  |
| `NEUROSITY_PASSWORD` | —                | LIVE mode account password.                               |
| `NEUROSITY_DEVICE_ID`| —                | LIVE mode device ID (optional if account has one device). |

Example — run mock mode for 10 seconds into a custom file:

```bash
DURATION_SEC=10 OUT_FILE=session.csv npm run mock
```

## CSV columns

`timestamp_iso, epoch_ms, mode, focus, calm, alpha, beta, delta, theta, gamma, signal_quality`

- `focus` / `calm`: 0–1 probabilities.
- Band powers: mean across the 8 Crown electrodes (mock mode: synthesized so beta/gamma track focus and alpha/theta track calm).
- `signal_quality`: worst-case summary of the 8 electrodes (`bad` > `noContact` > `good` > `great`). Always `mock` in mock mode.

The header is written only when the file is new; re-running appends to the same file.
