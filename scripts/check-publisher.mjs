// Validate the rendered referral journey, including the source page preserved
// in Shopify UTMs. Run after npm run build.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publisherUrl } from "./lib/publisher-links.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = path.join(root, "dist");
const catalog = JSON.parse(await readFile(path.join(root, "config/publisher-products.json"), "utf8"));
assert.throws(() => publisherUrl("https://example.com/"));
const productPaths = new Set(catalog.products.map(product => product.path));
assert.equal(productPaths.size, catalog.products.length, "Duplicate product destinations");
const expectedArticlePaths = new Set(Object.keys(catalog.articles).map(id => `/articles/${id}/`));
const articleUpdates = new Map();
for (const id of Object.keys(catalog.articles)) {
  const source = await readFile(path.join(root, "content/articles", `${id}.md`), "utf8");
  const updated = source.match(/^updated:\s*(\d{4}-\d{2}-\d{2})\s*$/m)?.[1];
  assert.ok(updated, `Missing reviewed article date: ${id}`);
  articleUpdates.set(`/articles/${id}/`, updated);
}
const seenArticlePaths = new Set();
let pages = 0;
let productCards = 0;

async function inspect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { await inspect(file); continue; }
    if (!entry.name.endsWith(".html")) continue;
    const html = await readFile(file, "utf8");
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
    // Existing noindex helpers intentionally have no canonical.
    const helperPath = file === path.join(dist, "404.html") ? "/404.html"
      : file === path.join(dist, "search/index.html") ? "/search/" : null;
    if (helperPath) assert.ok(html.includes('name="robots" content="noindex,follow"'));
    else assert.ok(canonical, `Missing canonical: ${file}`);
    const sourcePath = helperPath || new URL(canonical[1]).pathname;
    const placements = new Map();
    for (const match of html.matchAll(/<a\b([^>]+)>/g)) {
      const attrs = match[1];
      const placement = attrs.match(/data-publisher-placement="([^"]+)"/)?.[1];
      if (!placement) continue;
      assert.ok(attrs.includes('data-publisher-link="ohcrisp"'), `Untracked placement: ${file}`);
      const href = attrs.match(/href="([^"]+)"/)?.[1];
      assert.ok(href, `Missing publisher href: ${file}`);
      const url = new URL(href.replaceAll("&amp;", "&"));
      assert.equal(url.origin, "https://ohcrisp.com");
      assert.equal(url.searchParams.get("utm_source"), "freeze-dried-fruit.com");
      assert.equal(url.searchParams.get("utm_medium"), "referral");
      assert.equal(url.searchParams.get("utm_campaign"), "field_guide");
      assert.equal(url.searchParams.get("utm_content"), `${placement}:${sourcePath}`, `Wrong source path: ${file}`);
      placements.set(placement, (placements.get(placement) || 0) + 1);
      if (placement === "home_shop" || placement === "article_shop") {
        assert.ok(productPaths.has(url.pathname), `Unreviewed product: ${url.pathname}`);
        productCards++;
      }
    }
    for (const placement of ["header", "menu", "footer"]) {
      assert.equal(placements.get(placement), 1, `Missing/duplicate ${placement}: ${file}`);
    }
    if (sourcePath === "/") assert.equal(placements.get("home_shop"), catalog.products.length);
    else assert.ok(!placements.has("home_shop"), `Homepage offer leaked: ${file}`);
    if (expectedArticlePaths.has(sourcePath)) {
      const id = sourcePath.split("/")[2];
      assert.equal(placements.get("article_shop"), catalog.articles[id].products.length);
      assert.ok(html.includes("These links lead to our own products."));
      assert.ok(!html.includes("Have category insight to share?"));
      assert.ok(html.includes(`"dateModified":"${articleUpdates.get(sourcePath)}T00:00:00.000Z"`));
      seenArticlePaths.add(sourcePath);
    } else assert.ok(!placements.has("article_shop"), `Article offer leaked: ${file}`);
    if (sourcePath.startsWith("/es/")) assert.ok(html.includes("Comprar en OhCrisp"));
    pages++;
  }
}

await inspect(dist);
assert.deepEqual(seenArticlePaths, expectedArticlePaths);
const sitemap = await readFile(path.join(dist, "sitemap.xml"), "utf8");
const llms = await readFile(path.join(dist, "llms.txt"), "utf8");
for (const route of expectedArticlePaths) {
  assert.ok(sitemap.includes(`${route}</loc><lastmod>${articleUpdates.get(route)}</lastmod>`));
  assert.ok(llms.includes(route));
}
console.log(`Publisher journey passed: ${pages} pages, ${productCards} product cards, ${seenArticlePaths.size} reviewed article placements.`);
