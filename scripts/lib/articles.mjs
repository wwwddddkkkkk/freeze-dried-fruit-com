// Reads /content/articles/*.md, parses frontmatter, returns sorted article list.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";
import { readImageDimensions } from "./image-dims.mjs";

// Repo-relative path to /public, so we can resolve cover_image (which is a
// web-absolute path like "/images/articles/foo.jpg") to a filesystem path.
// Must use fileURLToPath — URL.pathname keeps spaces percent-encoded, which
// fs.readFileSync can't open on disks where the repo lives in a path with
// spaces (e.g. "/Users/<name>/Documents/New project/...").
const PUBLIC_DIR = fileURLToPath(new URL("../../public", import.meta.url));

// Custom markdown extension: ::: note "Label" ... :::  →  styled note box.
// Lets writers add the design's "note-box" without writing raw HTML.
const noteBox = {
  name: "noteBox",
  level: "block",
  start(src) { return src.indexOf("\n:::"); },
  tokenizer(src) {
    const m = /^:::\s*note(?:\s+"([^"]+)")?\s*\n([\s\S]*?)\n:::\s*(?:\n|$)/.exec(src);
    if (!m) return;
    return {
      type: "noteBox",
      raw: m[0],
      label: m[1] || "Note",
      tokens: this.lexer.blockTokens(m[2].trim(), []),
    };
  },
  renderer(token) {
    const inner = this.parser.parse(token.tokens);
    return `<div class="note-box"><div class="note-box__label">${token.label}</div>${inner}</div>`;
  },
};

// Custom markdown extension: ::: related ... :::  →  placeholder div that
// build.mjs later substitutes with a rendered article-card grid. Used by
// pillar pages to interleave editorial prose with sets of related articles.
const relatedGrid = {
  name: "relatedGrid",
  level: "block",
  start(src) { return src.indexOf("\n:::"); },
  tokenizer(src) {
    const m = /^:::\s*related\s*\n([\s\S]*?)\n:::\s*(?:\n|$)/.exec(src);
    if (!m) return;
    const slugs = m[1]
      .split(/\n/)
      .map(line => line.replace(/^[\s\-*]+/, "").trim())
      .filter(Boolean);
    return { type: "relatedGrid", raw: m[0], slugs };
  },
  renderer(token) {
    return `<div data-related="${token.slugs.join(",")}"></div>`;
  },
};

marked.use({ extensions: [noteBox, relatedGrid] });
marked.setOptions({ gfm: true });

function readTime(text) {
  const words = text.trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 220))} min read`;
}

export function renderMarkdown(md) {
  return marked.parse(md);
}

export async function loadArticles(dir, lang = "en") {
  let files;
  try {
    files = (await readdir(dir)).filter(f => f.endsWith(".md") && !f.startsWith("_"));
  } catch {
    // Directory may not exist (e.g. for a locale with no translations yet).
    return [];
  }
  const articles = [];
  for (const file of files) {
    const id = file.replace(/\.md$/, "");
    const raw = await readFile(path.join(dir, file), "utf8");
    const { data, content } = matter(raw);

    if (data.draft) continue;

    const dateObj = data.date ? new Date(data.date) : null;
    // YYYY-MM-DD frontmatter dates parse as UTC midnight. Formatting them in
    // the local timezone slides them to the previous evening, so a frontmatter
    // date of 2026-05-13 in a Pacific-time build prints as "May 12, 2026".
    // Pin formatting to UTC so the rendered date always matches frontmatter.
    const DATE_FMT = { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" };
    const dateLabel = data.date_label || (dateObj
      ? dateObj.toLocaleDateString("en-US", DATE_FMT)
      : "");

    // Optional revision date. If present and later than the publish date, the
    // article carries a visible "Updated" badge and the Article schema's
    // dateModified / sitemap lastmod flow from this value.
    const updatedObj = data.updated ? new Date(data.updated) : null;
    const isUpdated = !!(updatedObj && dateObj && updatedObj.getTime() > dateObj.getTime());
    const updatedLabel = isUpdated
      ? updatedObj.toLocaleDateString("en-US", DATE_FMT)
      : null;

    articles.push({
      id,
      // Locale of the article (defaults to the loader's lang). Drives URL
      // prefix, chrome strings, and html lang attribute.
      lang,
      // For translations, the slug of the English source article — lets
      // build.mjs emit reciprocal hreflang links between the two pages.
      en_slug: data.en_slug || (lang === "en" ? id : null),
      title: data.title || id,
      category: data.category || "Uncategorized",
      report_series: data.report_series || null,
      hero: data.hero || "quality",
      // cover_image overrides the SVG hero — used for product / variety /
      // snack / consumer-facing pieces that benefit from a real photo.
      cover_image: data.cover_image || null,
      cover_alt: data.cover_alt || null,
      // Intrinsic pixel dimensions of the cover image, auto-detected from
      // disk at build time. Lets the renderer emit explicit width/height
      // attributes on every <img>, which eliminates CLS (Core Web Vitals)
      // and lets JSON-LD ship a real ImageObject node with dimensions.
      ...(data.cover_image
        ? (() => {
            const dims = readImageDimensions(path.join(PUBLIC_DIR, data.cover_image));
            return dims ? { cover_width: dims.width, cover_height: dims.height } : {};
          })()
        : {}),
      // Required for any photo under a license that needs attribution
      // (e.g. Wikimedia CC BY-SA, Unsplash with credit). Renders as the
      // small caption strip on the article cover.
      cover_credit: data.cover_credit || null,
      cover_credit_url: data.cover_credit_url || null,
      summary: data.summary || "",
      intro: data.intro || data.summary || "",
      read: data.read || readTime(content),
      featured: !!data.featured,
      date: dateObj,
      dateLabel,
      updated: updatedObj,
      updatedLabel,
      isUpdated,
      takeaways: Array.isArray(data.takeaways) ? data.takeaways : null,
      // Optional Q&A list. Each entry: { q: "...", a: "markdown answer" }.
      // Renders as a visible FAQ section AND emits FAQPage JSON-LD.
      faqs: Array.isArray(data.faqs)
        ? data.faqs.filter(f => f && f.q && f.a).map(f => ({ q: String(f.q), a: String(f.a) }))
        : null,
      // Optional HowTo schema payload for procedural / checklist articles.
      // Frontmatter shape:
      //   howto:
      //     name: "How to approve a freeze-dried fruit supplier"
      //     description: "..."
      //     totalTime: "PT2H"   # ISO-8601 duration, optional
      //     steps:
      //       - name: "Start with the specification sheet"
      //         text: "Before debating flavor notes…"
      //         url: "#start-with-the-spec-sheet"   # optional, points at H2
      // When present we emit a HowTo JSON-LD node alongside the Article node.
      // Still used by Bing, AI engines (ChatGPT/Perplexity/Claude), and voice
      // assistants even though Google deprecated the rich-result surface.
      howto: (data.howto && data.howto.name && Array.isArray(data.howto.steps))
        ? {
            name: String(data.howto.name),
            description: data.howto.description ? String(data.howto.description) : null,
            totalTime: data.howto.totalTime ? String(data.howto.totalTime) : null,
            steps: data.howto.steps
              .filter(s => s && s.name)
              .map(s => ({
                name: String(s.name),
                text: s.text ? String(s.text) : null,
                url: s.url ? String(s.url) : null,
              })),
          }
        : null,
      // Optional outbound citations to authoritative primary sources (FDA,
      // USDA, IFT, ASTM, etc.). Each entry: { title, url, publisher, note? }.
      // Renders as a visible "Primary sources & further reading" section
      // AND becomes a citation[] array on the Article JSON-LD — a direct
      // E-E-A-T signal. Links are dofollow by default (no rel="nofollow")
      // because we are vouching for the source, not just referencing it.
      sources: Array.isArray(data.sources)
        ? data.sources
            .filter(s => s && s.title && s.url)
            .map(s => ({
              title: String(s.title),
              url: String(s.url),
              publisher: s.publisher ? String(s.publisher) : null,
              note: s.note ? String(s.note) : null,
            }))
        : null,
      bodyHtml: renderMarkdown(content),
    });
  }
  // Newest first.
  articles.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  return articles;
}
