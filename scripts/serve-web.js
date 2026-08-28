/**
 * Serves web/ on localhost so the browser app can be used locally.
 *
 * Why this exists: browsers refuse IndexedDB (and ES module imports) on
 * file:// URLs, so opening web/index.html by double-clicking it will not work.
 * This is a plain static file server over http, nothing more. It has no
 * database, stores nothing, and never sends anything anywhere.
 *
 * Run with: npm run web
 */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "web");
const PORT = parseInt(process.env.PORT || "4321", 10);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  const rel = url === "/" ? "index.html" : url.replace(/^\/+/, "");
  const file = path.join(ROOT, rel);

  // Never serve outside web/.
  if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT, "index.html")) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found: " + rel);
      return;
    }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Crown Focus Logger, browser app: http://127.0.0.1:${PORT}`);
  console.log("Serving web/ only. Nothing is stored or sent by this server. Ctrl+C to stop.");
});
