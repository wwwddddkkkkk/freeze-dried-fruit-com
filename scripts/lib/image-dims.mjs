// Read intrinsic pixel dimensions from local SVG / JPG / PNG files at build
// time so the renderer can emit explicit width / height attributes on every
// <img> tag — eliminating CLS (Cumulative Layout Shift) on Core Web Vitals
// and also strengthening Article.image JSON-LD with real ImageObject dimensions.
//
// Pure-Node: no image-processing dependency. Synchronous reads since this
// runs once per file at build-time setup.

import { readFileSync, statSync } from "node:fs";

// JPEG dimension parser. JPEG = SOI (0xFFD8) + sequence of segments.
// Width/height live inside any SOFn marker (0xFFC0..0xFFCF except 0xC4/C8/CC):
//   byte 0–1: marker (0xFFCn), byte 2–3: segment length, byte 4: precision,
//   byte 5–6: height (big-endian), byte 7–8: width (big-endian).
function readJpgDimensions(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    // Skip fill bytes (0xFF padding allowed between markers).
    while (buf[i] === 0xff && buf[i + 1] === 0xff) i += 1;
    const marker = buf[i + 1];
    // SOI / EOI carry no payload; just advance.
    if (marker === 0xd8 || marker === 0xd9) { i += 2; continue; }
    // RST markers (0xD0..0xD7) — no payload.
    if (marker >= 0xd0 && marker <= 0xd7) { i += 2; continue; }
    const segLen = buf.readUInt16BE(i + 2);
    const isSof =
      marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      return { width, height };
    }
    i += 2 + segLen;
  }
  return null;
}

// PNG dimension parser. PNG = 8-byte signature + IHDR chunk at offset 16:
//   byte 16–19: width (big-endian), byte 20–23: height (big-endian).
function readPngDimensions(buf) {
  if (buf.length < 24) return null;
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

// SVG dimension parser. We prefer `viewBox` (intrinsic aspect) over the
// declarative width/height attrs, which may be set to "100%". If neither
// is present we return null and the caller falls back to omitting dims.
function readSvgDimensions(buf) {
  // Only need the opening <svg ...> tag — read up to 4 KB worth.
  const head = buf.toString("utf8", 0, Math.min(buf.length, 4096));
  const svgMatch = head.match(/<svg\b[^>]*>/i);
  if (!svgMatch) return null;
  const tag = svgMatch[0];
  const vb = tag.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (vb) {
    const parts = vb[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(n => Number.isFinite(n))) {
      return { width: Math.round(parts[2]), height: Math.round(parts[3]) };
    }
  }
  const w = tag.match(/\bwidth\s*=\s*["']?(\d+)/i);
  const h = tag.match(/\bheight\s*=\s*["']?(\d+)/i);
  if (w && h) return { width: Number(w[1]), height: Number(h[1]) };
  return null;
}

// Public dispatcher. Returns { width, height } or null. Catches all errors
// so a malformed image never breaks the build — the renderer simply omits
// dimensions in that case.
export function readImageDimensions(absPath) {
  try {
    const stat = statSync(absPath);
    if (!stat.isFile()) return null;
    const lower = absPath.toLowerCase();
    const buf = readFileSync(absPath);
    if (lower.endsWith(".svg")) return readSvgDimensions(buf);
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return readJpgDimensions(buf);
    if (lower.endsWith(".png")) return readPngDimensions(buf);
    return null;
  } catch {
    return null;
  }
}
