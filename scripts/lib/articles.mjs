// Reads /content/articles/*.md, parses frontmatter, returns sorted article list.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

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

marked.use({ extensions: [noteBox] });
marked.setOptions({ gfm: true });

function readTime(text) {
  const words = text.trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 220))} min read`;
}

export function renderMarkdown(md) {
  return marked.parse(md);
}

export async function loadArticles(dir) {
  const files = (await readdir(dir)).filter(f => f.endsWith(".md") && !f.startsWith("_"));
  const articles = [];
  for (const file of files) {
    const id = file.replace(/\.md$/, "");
    const raw = await readFile(path.join(dir, file), "utf8");
    const { data, content } = matter(raw);

    if (data.draft) continue;

    const dateObj = data.date ? new Date(data.date) : null;
    const dateLabel = data.date_label || (dateObj
      ? dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "");

    articles.push({
      id,
      title: data.title || id,
      category: data.category || "Uncategorized",
      hero: data.hero || "quality",
      summary: data.summary || "",
      intro: data.intro || data.summary || "",
      read: data.read || readTime(content),
      featured: !!data.featured,
      date: dateObj,
      dateLabel,
      takeaways: Array.isArray(data.takeaways) ? data.takeaways : null,
      bodyHtml: renderMarkdown(content),
    });
  }
  // Newest first.
  articles.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  return articles;
}
