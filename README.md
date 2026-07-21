# Crown Focus Logger

A Node.js tool that records real-time **focus**, **calm**, and **brainwave** data from a [Neurosity Crown](https://neurosity.co/) EEG headset to CSV. It's the data-collection foundation for a series of experiments exploring what you can build at the intersection of consumer brain–computer interfaces (BCI) and AI.

## About this project

The Neurosity Crown is an 8-channel, dry-electrode EEG headset that streams brain metrics in real time. I started this project from a simple observation: **our subjective sense of our own focus is unreliable** — you can feel "locked in" while your measured focus is actually low. This logger captures objective focus data over time so it can be analyzed later: to find genuine peak-focus windows, see what disrupts concentration, and serve as the input for higher-level tools.

It's deliberately the *first* piece of a larger roadmap (see below). Almost every interesting BCI + AI idea — an end-of-day debrief, focus-aware notifications, adaptive study tools — depends first on reliably capturing this data. This project solves that base problem cleanly and reusably.

## What it does

- Records **focus** and **calm** scores (0–1) plus power in all five EEG bands — delta, theta, alpha, beta, gamma — to a timestamped CSV every few seconds.
- Runs in two modes:
  - **Mock** — generates realistic synthetic data, so the full pipeline can be built and tested with no hardware.
  - **Live** — connects to a real Crown via the Neurosity SDK.
- Collapses 8-electrode **signal quality** into a per-row label (worst-case), so unreliable rows can be filtered out during analysis.
- Configurable sampling interval, output file, and run duration; graceful shutdown with a session summary.

## How it works

The core is a simple, reusable pattern:

    authenticate → subscribe to device streams → keep the latest value of each → write one CSV row on a fixed interval

In live mode it subscribes to the Crown's focus, calm, brainwave (power-by-band), and signal-quality streams, holds the most recent value of each, and samples them on a timer. Band power is averaged across the 8 electrodes; signal quality collapses to worst-case so a single loose sensor is never hidden by the good ones.

## Tech stack

- **Node.js** — JavaScript runtime
- **@neurosity/sdk** — official Neurosity SDK for streaming EEG data
- **dotenv** — environment-based credentials
- **CSV** output for easy analysis in any spreadsheet or notebook

## Getting started

Mock mode needs only Node.js — no headset required:

    node logger.js

You'll see a live focus readout and a `focus-log.csv` fill up. Press Ctrl+C to stop.

For a real Crown:

    npm install
    cp .env.example .env      # then add your Neurosity login
    npm run live

### Configuration

All optional, set via environment variables:

| Variable          | Default         | Description                                    |
| ----------------- | --------------- | ---------------------------------------------- |
| `MODE`            | `mock`          | `mock` (synthetic) or `live` (real Crown)      |
| `LOG_INTERVAL_MS` | `2000`          | How often a row is written                     |
| `OUT_FILE`        | `focus-log.csv` | Output filename                                |
| `DURATION_SEC`    | `0`             | Auto-stop after N seconds (0 = until Ctrl+C)   |

## Output

CSV columns:

    timestamp_iso, epoch_ms, mode, focus, calm, alpha, beta, delta, theta, gamma, signal_quality

## Roadmap

This logger is step one of a planned series of BCI + AI projects:

- [x] **Focus logger** — reliable data capture *(this repo)*
- [ ] **Session charts** — visualize focus and calm over a session
- [ ] **AI end-of-day debrief** — an LLM summarizes a day of data into plain-English insight
- [ ] **Focus-aware tools** — e.g. notification triage and adaptive study aids that react to live cognitive state

## What I learned

- EEG fundamentals: the five frequency bands and what each indicates
- Consuming real-time, reactive data streams from a hardware SDK
- Why dry-electrode signal quality matters — and gating data on it
- Node.js project setup, environment-based configuration, and a Git/GitHub workflow

## Privacy & data

Brain data is sensitive. Credentials (`.env`) and all logged data (`*.csv`) are excluded from version control via `.gitignore` and never leave the local machine.

---

*Built by Samantha Lin as part of an independent exploration of brain–computer interfaces and AI.*
