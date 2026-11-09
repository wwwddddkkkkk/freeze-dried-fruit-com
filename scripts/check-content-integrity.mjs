// Catch missing local covers and report links that do not reach their heading.
// Run independently of the build: node scripts/check-content-integrity.mjs.
import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { ensureH2Anchors, extractTocFromHtml } from "./lib/pillars.mjs";
import { loadReports } from "./lib/reports.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const publicDir = path.join(root, "public");
let covers = 0;
for (const directory of ["articles", "articles-es", "reports", "reports-es"]) {
  const contentDir = path.join(root, "content", directory);
  for (const file of await readdir(contentDir)) {
    if (!file.endsWith(".md")) continue;
    const { data } = matter(await readFile(path.join(contentDir, file), "utf8"));
    if (!data.cover_image?.startsWith("/")) continue;
    const image = path.resolve(publicDir, `.${data.cover_image}`);
    assert.ok(image.startsWith(`${publicDir}${path.sep}`), `Cover escapes public directory: ${file}`);
    await assert.doesNotReject(access(image), `Missing cover in ${directory}/${file}: ${data.cover_image}`);
    covers++;
  }
}

// Explicit anchor suffixes must disappear from visible text, retain inline
// formatting, and agree with TOC extraction even when other attributes exist.
assert.equal(ensureH2Anchors('<h2>Supply &amp; demand {#supply}</h2>'), '<h2 id="supply">Supply &amp; demand</h2>');
assert.equal(ensureH2Anchors('<h2 class="section"><em>Berry</em> peak {#berry-peak}</h2>'), '<h2 class="section" id="berry-peak"><em>Berry</em> peak</h2>');
assert.equal(ensureH2Anchors('<h2 id="existing">Title {#other}</h2>'), '<h2 id="existing">Title</h2>');
assert.deepEqual(extractTocFromHtml('<h2 class="section" id="custom">Title</h2>'), [{ id: "custom", text: "Title" }]);
assert.deepEqual(extractTocFromHtml('<h2>Supply &amp; demand {#supply}</h2>'), [{ id: "supply", text: "Supply & demand" }]);

let reports = 0;
let reportLinks = 0;
for (const directory of ["reports", "reports-es"]) {
  for (const report of await loadReports(path.join(root, "content", directory))) {
    const html = ensureH2Anchors(report.bodyHtml);
    assert.ok(!/\{#[A-Za-z][A-Za-z0-9_.:-]*\}/.test(html), `Visible anchor suffix in ${directory}/${report.slug}`);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    for (const section of report.sections) {
      assert.equal(ids.filter(id => id === section.id).length, 1, `Report target must exist once: ${directory}/${report.slug}#${section.id}`);
      reportLinks++;
    }
    reports++;
  }
}

console.log(`Content integrity passed: ${covers} covers, ${reports} reports, ${reportLinks} report links.`);
