// Loader for /content/reports/*.md — long-form flagship industry reports
// (the annual "State of Freeze-Dried Fruit" series, eventually quarterly
// supply notes, etc). Distinct from articles: each report lives at its
// own top-level URL (/state-of-freeze-dried-fruit-2026/), gets a custom
// report template (cover, TOC, big section headers, footnote block), and
// is heavier on outbound citations than a normal article.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { renderMarkdown } from "./articles.mjs";
import { readImageDimensions } from "./image-dims.mjs";

const PUBLIC_DIR = fileURLToPath(new URL("../../public", import.meta.url));

export async function loadReports(dir, lang = "en") {
  let files;
  try {
    files = (await readdir(dir)).filter(f => f.endsWith(".md") && !f.startsWith("_"));
  } catch {
    // Directory may not exist (e.g. for a locale with no reports yet).
    return [];
  }
  const reports = [];
  for (const file of files) {
    const id = file.replace(/\.md$/, "");
    const raw = await readFile(path.join(dir, file), "utf8");
    const { data, content } = matter(raw);
    if (data.draft) continue;

    const DATE_FMT = { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" };
    const dateObj = data.date ? new Date(data.date) : null;
    const updatedObj = data.updated ? new Date(data.updated) : null;
    const isUpdated = !!(updatedObj && dateObj && updatedObj.getTime() > dateObj.getTime());
    const dateLabel = dateObj ? dateObj.toLocaleDateString("en-US", DATE_FMT) : "";
    const updatedLabel = updatedObj ? updatedObj.toLocaleDateString("en-US", DATE_FMT) : null;

    reports.push({
      id,
      // Locale of the report (defaults to the loader's lang). Drives URL
      // prefix and reciprocal hreflang. Spanish reports declare en_slug
      // pointing back at the matching English report so we can emit the
      // link rel="alternate" set.
      lang,
      en_slug: data.en_slug || (lang === "en" ? (data.slug || id) : null),
      slug: data.slug || id,
      title: data.title || id,
      subtitle: data.subtitle || "",
      edition: data.edition || "",
      summary: data.summary || "",
      intro: data.intro || data.summary || "",
      read: data.read || "",
      date: dateObj,
      dateLabel,
      updated: updatedObj,
      updatedLabel,
      isUpdated,
      toc_label: data.toc_label || "Inside this report",
      sections: Array.isArray(data.sections)
        ? data.sections.filter(s => s && s.id && s.title).map(s => ({
            id: String(s.id),
            title: String(s.title),
          }))
        : [],
      takeaways: Array.isArray(data.takeaways) ? data.takeaways : null,
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
      cover_image: data.cover_image || null,
      cover_alt: data.cover_alt || null,
      ...(data.cover_image
        ? (() => {
            const dims = readImageDimensions(path.join(PUBLIC_DIR, data.cover_image));
            return dims ? { cover_width: dims.width, cover_height: dims.height } : {};
          })()
        : {}),
      bodyHtml: renderMarkdown(content),
    });
  }
  reports.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  return reports;
}
