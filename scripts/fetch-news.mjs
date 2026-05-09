// Pulls RSS feeds listed in config/news-sources.json, parses items, and writes
// content/news/feed.json. Run by the GitHub Action on a cron schedule, but you
// can also run it locally:  npm run fetch-news
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function decodeEntities(s) {
  return String(s ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripCdata(s) {
  return String(s ?? "").replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").trim();
}

function tag(item, name) {
  // Match the FIRST <name>...</name> in the item, including CDATA.
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i");
  const m = re.exec(item);
  return m ? decodeEntities(stripCdata(m[1])) : "";
}

function parseRss(xml) {
  const items = [];
  const itemRe = /<item[\s>][\s\S]*?<\/item>/gi;
  let match;
  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[0];
    items.push({
      title: tag(block, "title"),
      link: tag(block, "link"),
      pubDate: tag(block, "pubDate") || tag(block, "dc:date"),
      description: tag(block, "description"),
      source: tag(block, "source"),
    });
  }
  return items;
}

function fmtDate(d) {
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Google News wraps the originating publisher in a <source> tag; if not, use hostname.
function sourceOf(item) {
  if (item.source) return item.source;
  try { return new URL(item.link).hostname.replace(/^www\./, ""); } catch { return "Wire"; }
}

async function fetchOne(src, perSource) {
  try {
    const res = await fetch(src.url, {
      headers: { "User-Agent": "FreezeDriedFruit.com news fetcher" },
    });
    if (!res.ok) {
      console.warn(`! ${src.name}: HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const items = parseRss(xml).slice(0, perSource).map(it => {
      const pub = it.pubDate ? new Date(it.pubDate) : null;
      return {
        title: it.title,
        link: it.link,
        source: sourceOf(it),
        date: pub && !isNaN(pub) ? pub.toISOString() : null,
        date_label: pub && !isNaN(pub) ? fmtDate(pub) : "",
        feed: src.name,
      };
    });
    console.log(`  ${src.name}: ${items.length} items`);
    return items;
  } catch (err) {
    console.warn(`! ${src.name}: ${err.message}`);
    return [];
  }
}

async function main() {
  const cfg = JSON.parse(await readFile(path.join(ROOT, "config", "news-sources.json"), "utf8"));
  const all = [];
  for (const src of cfg.sources) {
    const items = await fetchOne(src, cfg.limit_per_source || 6);
    all.push(...items);
  }

  // De-dupe by link, then sort newest-first.
  const seen = new Set();
  const deduped = all.filter(it => {
    if (!it.link || seen.has(it.link)) return false;
    seen.add(it.link);
    return true;
  });
  deduped.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const output = {
    updated_at: new Date().toISOString(),
    items: deduped.slice(0, cfg.total_limit || 12),
  };

  const out = path.join(ROOT, "content", "news", "feed.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`→ wrote ${output.items.length} items to ${path.relative(ROOT, out)}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
