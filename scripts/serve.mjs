// Tiny static server for local previews.
//   node scripts/serve.mjs           → http://localhost:8080
import { createServer } from "node:http";
import { stat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "..", "dist");
const PORT = process.env.PORT || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

async function tryFile(p) {
  try {
    const s = await stat(p);
    if (s.isFile()) return p;
    if (s.isDirectory()) {
      const idx = path.join(p, "index.html");
      const s2 = await stat(idx);
      if (s2.isFile()) return idx;
    }
  } catch {}
  return null;
}

createServer(async (req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  let target = path.join(DIST, safe);
  let resolved = await tryFile(target);
  if (!resolved && !path.extname(target)) resolved = await tryFile(path.join(target, "index.html"));
  if (!resolved) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  const ext = path.extname(resolved).toLowerCase();
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
  res.end(await readFile(resolved));
}).listen(PORT, () => {
  console.log(`→ serving dist/ at http://localhost:${PORT}`);
});
