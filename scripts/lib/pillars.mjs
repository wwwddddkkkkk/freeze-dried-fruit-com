// Loads pillar pages from /content/pillars/<category-slug>.md.
//
// A pillar is the deep editorial overview for one site category. The frontmatter
// holds the page metadata (heading, intro, faqs); the markdown body holds the
// long-form content with H2 sections that double as anchor targets in the TOC.
// Build.mjs takes these and renders the full pillar layout — anchored TOC,
// glossary-auto-linked prose, inline related-article grids, FAQ block, full archive.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export async function loadPillars(dir) {
  let files;
  try {
    files = await readdir(dir);
  } catch (e) {
    if (e.code === "ENOENT") return new Map();
    throw e;
  }
  const pillars = new Map();
  for (const file of files) {
    if (!file.endsWith(".md") || file.startsWith("_")) continue;
    const raw = await readFile(path.join(dir, file), "utf8");
    const { data, content } = matter(raw);
    if (!data.category) continue;
    if (data.draft) continue;
    pillars.set(data.category, {
      category: data.category,
      heading: data.heading || data.category,
      intro: data.intro || "",
      description: data.description || data.intro || "",
      faqs: Array.isArray(data.faqs)
        ? data.faqs.filter(f => f && f.q && f.a).map(f => ({ q: String(f.q), a: String(f.a) }))
        : [],
      bodyMd: content,
    });
  }
  return pillars;
}

// Decode the small set of HTML entities the markdown renderer is likely to
// emit inside heading text, so the TOC label reads as plain Unicode before
// downstream code re-escapes it for the new context.
function decodeBasicEntities(s) {
  return String(s || "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// Extract H2 headings from rendered HTML body for the anchored TOC.
// We assign sequential anchor ids when the heading lacks one.
export function extractTocFromHtml(html) {
  const out = [];
  const re = /<h2\b([^>]*)>([\s\S]*?)<\/h2>/g;
  const anchoredHtml = ensureH2Anchors(html);
  let m;
  let i = 0;
  while ((m = re.exec(anchoredHtml))) {
    i += 1;
    const explicit = /\bid="([^"]+)"/.exec(m[1])?.[1];
    const rawText = m[2].replace(/<[^>]+>/g, "").trim();
    const text = decodeBasicEntities(rawText);
    const id = explicit || slugify(text) || `section-${i}`;
    out.push({ id, text });
  }
  return out;
}

// Support Markdown's explicit heading suffix used by the reports. Marked
// leaves `{#snapshot}` as text; it must become id="snapshot", not part of
// an automatically generated slug or a visible label.
export function ensureH2Anchors(html) {
  return html.replace(/<h2([^>]*?)>([\s\S]*?)<\/h2>/g, (full, attrs, inner) => {
    const explicit = /\s*\{#([A-Za-z][A-Za-z0-9_.:-]*)\}\s*$/.exec(inner);
    const visible = explicit ? inner.slice(0, explicit.index).trimEnd() : inner;
    if (explicit) {
      if (/\bid=/.test(attrs)) return `<h2${attrs}>${visible}</h2>`;
      return `<h2${attrs} id="${explicit[1]}">${visible}</h2>`;
    }
    if (/\bid=/.test(attrs)) return full;
    const text = decodeBasicEntities(inner.replace(/<[^>]+>/g, "").trim());
    const id = slugify(text);
    if (!id) return full;
    return `<h2${attrs} id="${id}">${inner}</h2>`;
  });
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}
