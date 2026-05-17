// Social-share / rich-result image generation.
//
// Produces 1200×630 PNGs that match the site's field-guide aesthetic:
// dark navy title on cream tint, mint accents, JetBrains-style mono eyebrow.
// We render an SVG string and rasterize it via @resvg/resvg-js — no headless
// browser, no native compile, prebuilt binaries for darwin-arm64 + linux-x64.
import { Resvg } from "@resvg/resvg-js";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const PADDING = 80;

function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Word-wrap a string into N visual lines that fit within `maxChars`. Plain
// SVG <text> has no auto-wrap, so we wrap explicitly into <tspan> rows.
function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Pick title size / wrap width based on title length. Long titles get a
// smaller font and a wider character budget so they don't overflow.
function titleLayout(title) {
  if (title.length > 90) return { fontSize: 46, maxChars: 30, maxLines: 4, lineHeight: 1.18 };
  if (title.length > 60) return { fontSize: 54, maxChars: 26, maxLines: 4, lineHeight: 1.16 };
  return { fontSize: 64, maxChars: 22, maxLines: 4, lineHeight: 1.14 };
}

export function renderArticleOgSvg({ title, category }) {
  const { fontSize, maxChars, maxLines, lineHeight } = titleLayout(title);
  let lines = wrapText(title, maxChars);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s,.;:]+$/, "") + "…";
  }

  // Center the title block vertically in the lower 2/3 of the card.
  const blockHeight = fontSize * lineHeight * (lines.length - 1) + fontSize;
  const titleStartY = 290 + Math.max(0, (210 - blockHeight) / 2);
  const dy = fontSize * lineHeight;

  const titleTspans = lines
    .map((line, i) =>
      `<tspan x="${PADDING}" dy="${i === 0 ? 0 : dy}">${escapeXml(line)}</tspan>`
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#FFFFFF"/>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#F2F7F6"/>

  <!-- field-guide grid texture (subtle) -->
  <defs>
    <pattern id="og-grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="#0A2540" stroke-opacity="0.045" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#og-grid)"/>

  <!-- wordmark -->
  <text x="${PADDING}" y="125" font-family="Georgia, 'Times New Roman', serif" font-size="34" font-weight="700" fill="#0A2540" letter-spacing="-0.5">Freeze-Dried-Fruit<tspan fill="#3CCFA1">.com</tspan></text>

  <!-- accent rule -->
  <rect x="${PADDING}" y="155" width="64" height="2" fill="#3CCFA1"/>

  <!-- category eyebrow -->
  <text x="${PADDING}" y="235" font-family="'Courier New', 'Menlo', monospace" font-size="16" font-weight="700" fill="#0F8E6E" letter-spacing="3">${escapeXml(String(category || "").toUpperCase())}</text>

  <!-- title -->
  <text x="${PADDING}" y="${titleStartY}" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700" fill="#0A2540" letter-spacing="-1">${titleTspans}</text>

  <!-- bottom rule + tagline -->
  <line x1="${PADDING}" y1="${OG_HEIGHT - 105}" x2="${OG_WIDTH - PADDING}" y2="${OG_HEIGHT - 105}" stroke="#0A2540" stroke-opacity="0.12" stroke-width="1"/>
  <text x="${PADDING}" y="${OG_HEIGHT - PADDING + 8}" font-family="'Courier New', 'Menlo', monospace" font-size="14" fill="#0A2540" fill-opacity="0.65" letter-spacing="2.5">INDEPENDENT FIELD GUIDE · EST. 2026</text>
  <text x="${OG_WIDTH - PADDING}" y="${OG_HEIGHT - PADDING + 8}" text-anchor="end" font-family="'Courier New', 'Menlo', monospace" font-size="14" fill="#0A2540" fill-opacity="0.65" letter-spacing="2.5">FREEZE-DRIED-FRUIT.COM</text>
</svg>`;
}

export function renderSiteOgSvg(site) {
  const tagline = site?.tagline || "The field guide to freeze-dried fruit.";
  // Allow up to 3 lines so the full tagline ("…processing, and market trends.")
  // fits without truncation.
  const lines = wrapText(tagline, 36).slice(0, 3);
  const taglineTspans = lines
    .map((line, i) => `<tspan x="${PADDING}" dy="${i === 0 ? 0 : 48}">${escapeXml(line)}</tspan>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#FFFFFF"/>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#F2F7F6"/>

  <defs>
    <pattern id="og-grid-site" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="#0A2540" stroke-opacity="0.045" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#og-grid-site)"/>

  <text x="${PADDING}" y="225" font-family="Georgia, 'Times New Roman', serif" font-size="64" font-weight="700" fill="#0A2540" letter-spacing="-1.5">Freeze-Dried-Fruit<tspan fill="#3CCFA1">.com</tspan></text>

  <rect x="${PADDING}" y="260" width="80" height="3" fill="#3CCFA1"/>

  <text x="${PADDING}" y="345" font-family="Georgia, 'Times New Roman', serif" font-size="40" font-style="italic" fill="#0A2540" letter-spacing="-0.5">${taglineTspans}</text>

  <line x1="${PADDING}" y1="${OG_HEIGHT - 105}" x2="${OG_WIDTH - PADDING}" y2="${OG_HEIGHT - 105}" stroke="#0A2540" stroke-opacity="0.12" stroke-width="1"/>
  <text x="${PADDING}" y="${OG_HEIGHT - PADDING + 8}" font-family="'Courier New', 'Menlo', monospace" font-size="14" fill="#0A2540" fill-opacity="0.65" letter-spacing="2.5">INDEPENDENT FIELD GUIDE · EST. 2026</text>
  <text x="${OG_WIDTH - PADDING}" y="${OG_HEIGHT - PADDING + 8}" text-anchor="end" font-family="'Courier New', 'Menlo', monospace" font-size="14" fill="#0A2540" fill-opacity="0.65" letter-spacing="2.5">FREEZE-DRIED-FRUIT.COM</text>
</svg>`;
}

// Rasterize an SVG string to a PNG Buffer at the OG_WIDTH × OG_HEIGHT.
export function rasterize(svg) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: OG_WIDTH },
    font: { loadSystemFonts: true },
    background: "#FFFFFF",
  });
  return resvg.render().asPng();
}
