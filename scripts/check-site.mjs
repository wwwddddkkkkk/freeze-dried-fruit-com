// Validate the complete static output before publication. No network required.
// Usage: npm run build && node scripts/check-site.mjs
// DIST_DIR, SITE_URL and BASE_PATH match the builder's preview overrides.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = path.resolve(process.env.DIST_DIR || path.join(root, "dist"));
const config = JSON.parse(await readFile(path.join(root, "config/site.json"), "utf8"));
const site = new URL(process.env.SITE_URL || config.url);
const basePath = (process.env.BASE_PATH || site.pathname).replace(/\/$/, "");
const origin = site.origin;
const endOfToday = new Date();
endOfToday.setUTCHours(23, 59, 59, 999);
const files = new Set();
const pages = new Map();
const problems = new Set();
const totals = { pages: 0, internalLinks: 0, fragments: 0, images: 0, socialImages: 0, sitemapUrls: 0, structuredData: 0 };

function fail(message) { problems.add(message); }

function decode(value) {
  const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: "\u00a0" };
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, name) => {
    if (name[0] !== "#") return named[name.toLowerCase()] || entity;
    const code = /^#x/i.test(name) ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

function attributes(raw) {
  const result = {};
  for (const match of raw.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    result[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return result;
}

function pagePath(file) {
  let relative = path.relative(dist, file).split(path.sep).join("/");
  if (relative === "index.html") relative = "";
  else if (relative.endsWith("/index.html")) relative = relative.slice(0, -"index.html".length);
  return `${basePath}/${relative}`;
}

function resolveFile(url) {
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { return null; }
  if (basePath && pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return null;
  const relative = basePath ? pathname.slice(basePath.length) : pathname;
  const target = path.resolve(dist, `.${relative || "/"}`);
  if (target !== dist && !target.startsWith(`${dist}${path.sep}`)) return null;
  const candidates = [target, path.join(target, "index.html")];
  if (!path.extname(target)) candidates.push(`${target}.html`);
  return candidates.find(file => files.has(file)) || null;
}

function internalUrl(value, source, description) {
  try {
    const url = new URL(value, source.url);
    return ["http:", "https:"].includes(url.protocol) && url.hostname === site.hostname ? url : null;
  } catch {
    fail(`${source.label}: invalid ${description}: ${value}`);
    return null;
  }
}

function checkResource(value, source, description, counter) {
  const url = internalUrl(value, source, description);
  if (!url) return;
  totals[counter]++;
  if (!resolveFile(url)) fail(`${source.label}: missing ${description}: ${value}`);
}

function checkDate(value, context) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) fail(`${context}: invalid date: ${value}`);
  else if (date > endOfToday) fail(`${context}: future date: ${value}`);
}

async function inventory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await inventory(file);
    else if (entry.isFile()) files.add(file);
  }
}

await inventory(dist);
for (const file of files) {
  if (!file.endsWith(".html")) continue;
  const html = await readFile(file, "utf8");
  const label = path.relative(dist, file).split(path.sep).join("/");
  const page = { file, label, html, url: new URL(pagePath(file), origin), ids: new Set(), tags: [], noindex: false };
  // Inline scripts can contain HTML templates; they are not rendered anchors.
  const markup = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
  for (const match of markup.matchAll(/<([a-z][\w:-]*)\b([^<>]*?)>/gi)) {
    const tag = match[1].toLowerCase();
    const attrs = attributes(match[2]);
    page.tags.push({ tag, attrs });
    if (attrs.id) page.ids.add(attrs.id);
    if (tag === "a" && attrs.name) page.ids.add(attrs.name);
    if (tag === "meta" && ["robots", "googlebot"].includes(attrs.name?.toLowerCase()) && /\bnoindex\b/i.test(attrs.content || "")) page.noindex = true;
  }
  pages.set(file, page);
}
totals.pages = pages.size;
if (!totals.pages) fail("No generated HTML pages found");

for (const page of pages.values()) {
  for (const { tag, attrs } of page.tags) {
    if (attrs.href !== undefined) {
      const url = internalUrl(attrs.href, page, "link");
      if (url) {
        totals.internalLinks++;
        const target = resolveFile(url);
        if (!target) fail(`${page.label}: missing link destination: ${attrs.href}`);
        else if (url.hash && pages.has(target)) {
          // Text-fragment directives identify text rather than an element id.
          const hash = url.hash.slice(1).split(":~:")[0];
          if (hash) {
            totals.fragments++;
            let fragment;
            try { fragment = decodeURIComponent(hash); }
            catch { fail(`${page.label}: invalid fragment encoding: ${attrs.href}`); continue; }
            if (!pages.get(target).ids.has(fragment)) fail(`${page.label}: missing fragment target: ${attrs.href}`);
          }
        }
      }
    }
    if (tag === "img") {
      if (!attrs.src) fail(`${page.label}: image has no src`);
      else checkResource(attrs.src, page, "image", "images");
    }
    if (tag === "meta" && attrs.property?.toLowerCase() === "og:image") {
      if (!attrs.content) fail(`${page.label}: og:image is empty`);
      else checkResource(attrs.content, page, "og:image", "socialImages");
    }
    if (tag === "meta" && ["article:published_time", "article:modified_time"].includes(attrs.property?.toLowerCase())) checkDate(attrs.content, `${page.label} ${attrs.property}`);
  }
  for (const match of page.html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (attributes(match[1]).type?.toLowerCase() !== "application/ld+json") continue;
    try {
      const data = JSON.parse(match[2]);
      totals.structuredData++;
      function inspect(value) {
        if (!value || typeof value !== "object") return;
        for (const [key, item] of Object.entries(value)) {
          if (["datePublished", "dateModified"].includes(key)) checkDate(item, `${page.label} JSON-LD ${key}`);
          else if (item && typeof item === "object") inspect(item);
        }
      }
      inspect(data);
    } catch (error) { fail(`${page.label}: invalid JSON-LD: ${error.message}`); }
  }
}

for (const helper of ["404.html", "search/index.html"]) {
  const page = pages.get(path.join(dist, helper));
  if (!page) fail(`Missing required noindex helper: ${helper}`);
  else if (!page.noindex) fail(`${helper}: must have a noindex robots directive`);
}

const sitemapFile = path.join(dist, "sitemap.xml");
if (!files.has(sitemapFile)) fail("Missing sitemap.xml");
else {
  const xml = await readFile(sitemapFile, "utf8");
  if (!/<urlset\b/.test(xml) || !/<\/urlset\s*>/.test(xml)) fail("sitemap.xml: invalid or incomplete urlset");
  const seen = new Set();
  for (const match of xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url\s*>/g)) {
    totals.sitemapUrls++;
    const loc = decode(match[1].match(/<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/)?.[1]?.trim() || "");
    const lastmod = decode(match[1].match(/<lastmod\b[^>]*>([\s\S]*?)<\/lastmod\s*>/)?.[1]?.trim() || "");
    if (seen.has(loc)) fail(`sitemap.xml: duplicate URL: ${loc}`);
    seen.add(loc);
    let url;
    try { url = new URL(loc); }
    catch { fail(`sitemap.xml: invalid URL: ${loc}`); continue; }
    if (url.origin !== origin || url.hash || url.search) fail(`sitemap.xml: unexpected URL: ${loc}`);
    const file = resolveFile(url);
    const page = file && pages.get(file);
    if (!page) fail(`sitemap.xml: URL has no generated HTML page: ${loc}`);
    else {
      if (page.noindex) fail(`sitemap.xml: noindex page included: ${loc}`);
      const canonical = page.tags.find(({ tag, attrs }) => tag === "link" && attrs.rel?.toLowerCase().split(/\s+/).includes("canonical"))?.attrs.href;
      if (canonical !== loc) fail(`sitemap.xml: canonical mismatch for ${loc}: ${canonical || "missing"}`);
    }
    checkDate(lastmod, `sitemap.xml ${loc} lastmod`);
  }
  if (!totals.sitemapUrls) fail("sitemap.xml: no URL entries found");
}

if (problems.size) {
  console.error(`Site integration failed: ${problems.size} issue(s).`);
  for (const message of [...problems].slice(0, 60)) console.error(`- ${message}`);
  if (problems.size > 60) console.error(`- ... ${problems.size - 60} further issue(s)`);
  console.error(JSON.stringify(totals));
  process.exitCode = 1;
} else {
  console.log(`Site integration passed: ${totals.pages} HTML pages, ${totals.sitemapUrls} sitemap URLs, ${totals.internalLinks} internal links, ${totals.fragments} fragments, ${totals.images} images, ${totals.socialImages} social images, ${totals.structuredData} JSON-LD blocks.`);
}
