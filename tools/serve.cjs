// Zero-dependency static server for local testing (ES modules + service worker need http://, not file://).
//   node tools/serve.cjs [port]   → http://localhost:8080/
const http = require("http"); const fs = require("fs"); const path = require("path");
const ROOT = path.join(__dirname, ".."); const PORT = +(process.argv[2] || 8080);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".pdf": "application/pdf", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".ics": "text/calendar" };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store", "Service-Worker-Allowed": "/" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Sofia's Spotlight → http://localhost:${PORT}/`));
