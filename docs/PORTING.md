# Putting this on crown-site-v2

Target: `~/neurosity-projects/crown-site-v2`, Astro 7, deployed on Netlify.

The app is plain HTML, CSS and ES modules with no build step, so it goes in as
static files plus one Astro page. Nothing in `astro.config.mjs` changes and no
dependency is added.

## 1. Copy the app into `public/`

Files in `public/` are served exactly as they are, so the `import` statements
between the modules keep working with no bundler involved.

```bash
mkdir -p ~/neurosity-projects/crown-site-v2/public/logger
cp ~/neurosity-projects/crown-focus-logger/web/app.js \
   ~/neurosity-projects/crown-focus-logger/web/schema.js \
   ~/neurosity-projects/crown-focus-logger/web/analysis.js \
   ~/neurosity-projects/crown-focus-logger/web/charts.js \
   ~/neurosity-projects/crown-focus-logger/web/store.js \
   ~/neurosity-projects/crown-focus-logger/web/recorder.js \
   ~/neurosity-projects/crown-focus-logger/web/sample-session.csv \
   ~/neurosity-projects/crown-site-v2/public/logger/
```

Do **not** copy `web/package.json`, `web/index.html` or `web/styles.css`. The
first is only there so Node treats the modules as ESM when the tests import
them. The other two are replaced by the Astro page below.

## 2. Create the page

New file: `src/pages/logger.astro`.

Its shape follows `src/pages/console-decoded.astro` exactly:

```astro
---
import Base from "@/layouts/Base.astro";
---

<Base
  title="Focus Logger"
  meta_title="Focus Logger"
  description="Record your own Crown focus sessions, keep the file, and read it back. Everything stays on your device."
>
  <div class="cfl cfl-embedded">
    <div class="rail">
      <!-- paste everything inside <div class="rail"> from web/index.html here -->
    </div>
  </div>

  <script type="module" src="/logger/app.js"></script>
</Base>

<style is:global>
  /* paste the whole of web/styles.css here */
</style>
```

Three things to get right:

1. **Keep the `cfl` class on the wrapper.** Every selector in the stylesheet is
   prefixed `.cfl`, the same way console-decoded prefixes everything `.cd`, so
   none of it leaks into the rest of the site.
2. **Add `cfl-embedded` as well.** It reserves the 98px the site's fixed header
   occupies. Without it the first card sits under the header.
3. **Drop the `cfl-standalone` class.** That only exists to paint a background
   when the app is opened on its own. On the site the page ground already
   exists, and adding it would paint over the theme.

Copy the markup from `web/index.html` starting at `<div class="rail">` and
ending at its closing `</div>`, which includes the header, the privacy banner,
the three tab panels and the footer. Leave out the `<head>`, the font `<link>`
tags and the `<script>` at the bottom of that file.

## 3. Fonts

The app asks for IBM Plex Sans and IBM Plex Mono, which is what the console
palette uses. The site already loads its own fonts, and the stylesheet falls
back through `system-ui` if Plex is not there, so this works either way. If the
site's Plex variables exist, point the two custom properties at them instead:

```css
.cfl {
  --mono: var(--font-plexmono), "IBM Plex Mono", ui-monospace, Menlo, monospace;
  --sans: var(--font-plex), "IBM Plex Sans", system-ui, -apple-system, sans-serif;
}
```

That is the same line console-decoded uses.

## 4. Wire it into the nav

Add an entry to `src/config/menu.json` pointing at `/logger`. Check the current
nav length first: item A1 in the feedback ledger was specifically about the nav
being too long, so this may belong inside an existing group rather than as a new
top-level item.

## 5. Verify

```bash
cd ~/neurosity-projects/crown-site-v2
npm run build
npm run preview
```

Then, on `/logger`:

- Click **Load the example session**. If the results page renders, the module
  imports and the sample fetch both resolved.
- Record a demo session, stop it, and confirm it appears under **Your log**.
- Export a CSV and re-import it.
- Reload the page and confirm your sessions are still listed. That proves
  IndexedDB is working on the deployed origin.
- Check narrow widths. The tab strip, the takeaway grid and the session rows all
  wrap.

Two things that will bite if they are missed:

- **The app must be served over http or https, never `file://`.** Browsers block
  IndexedDB and ES module imports on `file://`. On Netlify this is automatic.
- **`fetch` for the sample file is resolved against `import.meta.url`**, not the
  page URL, which is why the file has to sit in `public/logger/` next to
  `app.js`. Move it elsewhere and the example button breaks.

## 6. Framing copy for the page

Samantha's draft, to sit near the top of the page:

> This is a starting point, not a finished product. I have built the beginning
> stages of a way to record and read your own Crown focus data, so you can keep
> and analyze your own sessions. Your data stays with you. I have no access to
> it. If it is useful to you, take it and run with it, and anyone with more
> software engineering experience is welcome to refine it or build on the idea.
> For now: record it, keep it, and read it back.

## Keeping the two copies in step

The site copy under `public/logger/` is a copy, so a change in this repo does not
reach the site until it is copied again. If that becomes annoying, the smallest
fix is a script in the site's `package.json` that copies the six files as part of
`npm run build`, rather than a git submodule or a published package.
