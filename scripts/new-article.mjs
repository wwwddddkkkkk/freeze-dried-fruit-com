// Scaffolds a new article: writes content/articles/<slug>.md with frontmatter.
//   node scripts/new-article.mjs "Title goes here"
//   node scripts/new-article.mjs "Title" --category="Technology" --hero=process
import { writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function slugify(s) {
  return s.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function arg(name, fallback) {
  const flag = `--${name}=`;
  const found = process.argv.find(a => a.startsWith(flag));
  return found ? found.slice(flag.length) : fallback;
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function main() {
  const positional = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const title = positional[0];
  if (!title) {
    console.error("Usage: node scripts/new-article.mjs \"Article title\" [--category=Technology] [--hero=quality]");
    process.exit(1);
  }
  const slug = arg("slug", slugify(title));
  const category = arg("category", "Industry Insights");
  const hero = arg("hero", "quality");
  const today = new Date().toISOString().slice(0, 10);

  const outPath = path.join(ROOT, "content", "articles", `${slug}.md`);
  if (await exists(outPath)) {
    console.error(`! ${outPath} already exists. Pick a different slug with --slug=`);
    process.exit(1);
  }

  const body = `---
title: "${title.replace(/"/g, '\\"')}"
category: "${category}"
date: ${today}

# COVER — pick ONE style:
#  (a) clean SVG diagram (good for industry insight / process pieces)
hero: ${hero}        # quality | fresh-frozen | sugar | pricing | process | moisture
#
#  (b) real food photo (good for product / variety / snack / consumer pieces)
#      Drop the file in public/images/articles/ then uncomment + edit:
# cover_image: /images/articles/${slug}.jpg
# cover_alt: "Short alt text describing the photo"
# cover_credit: "Photographer / License"          # only if attribution is required
# cover_credit_url: "https://link-to-source"

read: "5 min read"
summary: "Short summary that appears in cards and meta tags. Keep it under ~200 chars."
intro: "Optional one-line italic intro shown above the cover image."
takeaways:
  - "First bullet"
  - "Second bullet"
  - "Third bullet"
---

Write the article body here in Markdown.

## Section heading

Paragraphs, **bold**, *italic*, [links](https://example.com), and lists all work.

> Block quotes render as styled pull-quotes.

::: note "For sourcing"
Wrap a "::: note" block to render the design's note-box. The label after \`note\` becomes the eyebrow.
:::
`;

  await writeFile(outPath, body, "utf8");
  console.log(`→ created ${path.relative(ROOT, outPath)}`);
  console.log(`  npm run build       # rebuild dist/`);
  console.log(`  hero options: quality | fresh-frozen | sugar | pricing | process | moisture`);
}

main().catch(err => { console.error(err); process.exit(1); });
