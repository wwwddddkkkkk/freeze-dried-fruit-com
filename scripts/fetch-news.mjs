// Pulls RSS feeds listed in config/news-sources.json, parses items, and writes
// content/news/feed.json. Run by the GitHub Action on a cron schedule, but you
// can also run it locally:  npm run fetch-news
import { readFile, writeFile, mkdir, rename, rm, realpath } from "node:fs/promises";
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
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// Google News wraps the originating publisher in a <source> tag; if not, use hostname.
function sourceOf(item) {
  if (item.source) return item.source;
  try { return new URL(item.link).hostname.replace(/^www\./, ""); } catch { return "Wire"; }
}

export async function fetchOne(src, perSource, {
  fetchImpl = fetch,
  timeoutMs = 10_000,
  attempts = 3,
  retryDelayMs = 1_000,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  logger = console,
} = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetchImpl(src.url, {
        headers: { "User-Agent": "FreezeDriedFruit.com news fetcher" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      if (!/<(?:rss|rdf:RDF)\b/i.test(xml)) throw new Error("Response is not an RSS feed");
      const parsed = parseRss(xml).filter(it => {
        try { return it.title && ["https:", "http:"].includes(new URL(it.link).protocol); }
        catch { return false; }
      });
      // An empty/malformed upstream response must not erase a working wire.
      if (!parsed.length) throw new Error("RSS feed contains no valid news items");
      const items = parsed.slice(0, perSource).map(it => {
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
      logger.log(`  ${src.name}: ${items.length} items`);
      return items;
    } catch (err) {
      lastError = err;
      logger.warn(`! ${src.name}: attempt ${attempt}/${attempts}: ${err.message}`);
      if (attempt < attempts) await sleep(retryDelayMs * attempt);
    }
  }
  throw new Error(`${src.name}: ${lastError?.message || "fetch failed"}`, { cause: lastError });
}

export async function refreshNews(cfg, previous, options = {}) {
  if (!Array.isArray(cfg.sources) || !cfg.sources.length) throw new Error("No RSS sources configured");
  const results = await Promise.allSettled(cfg.sources.map(src => fetchOne(src, cfg.limit_per_source || 6, options)));
  const failures = results.filter(result => result.status === "rejected").map(result => result.reason);
  if (failures.length) {
    throw new AggregateError(failures, `News refresh failed; previous feed preserved. ${failures.map(error => error.message).join("; ")}`);
  }
  const all = results.flatMap(result => result.value);

  // De-dupe by link, then sort newest-first.
  const seen = new Set();
  const deduped = all.filter(it => {
    if (!it.link || seen.has(it.link)) return false;
    seen.add(it.link);
    return true;
  });
  deduped.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0) || a.link.localeCompare(b.link));

  const items = deduped.slice(0, cfg.total_limit || 12);
  if (JSON.stringify(items) === JSON.stringify(previous?.items)) return null;
  return { updated_at: (options.now?.() || new Date()).toISOString(), items };
}

export async function runNewsUpdate(root = ROOT, options = {}) {
  const cfg = JSON.parse(await readFile(path.join(root, "config", "news-sources.json"), "utf8"));
  const out = path.join(root, "content", "news", "feed.json");
  let previous;
  try { previous = JSON.parse(await readFile(out, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const output = await refreshNews(cfg, previous, options);
  const logger = options.logger || console;
  if (!output) {
    logger.log("→ news content unchanged — preserving feed and update timestamp");
    return false;
  }
  await mkdir(path.dirname(out), { recursive: true });
  const temporary = `${out}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(output, null, 2) + "\n", "utf8");
    await rename(temporary, out);
  } finally {
    await rm(temporary, { force: true });
  }
  logger.log(`→ wrote ${output.items.length} items to ${path.relative(root, out)}`);
  return true;
}

const entryPoint = process.argv[1] && await realpath(process.argv[1]).catch(() => null);
if (entryPoint === fileURLToPath(import.meta.url)) {
  runNewsUpdate().catch(err => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
