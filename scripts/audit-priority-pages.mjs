// Repeatable local evidence for the fixed ten-page cohort. This measures
// editorial Markdown links, not generated recommendation cards or Google status.
// Build first; optionally pass --output <file> and --baseline <earlier JSON>.
import assert from "node:assert/strict";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = path.resolve(process.env.DIST_DIR || path.join(root, "dist"));
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  assert.ok(["--output", "--baseline"].includes(args[i]) && args[i + 1], "Use --output <file> or --baseline <file>");
  options[args[i].slice(2)] = args[i + 1];
}
const cohort = JSON.parse(await readFile(path.join(root, "config/seo-priority-pages.json"), "utf8"));
assert.equal(cohort.pages.length, 10, "Maintain exactly ten priority pages");
assert.equal(new Set(cohort.pages.map(p => p.slug)).size, 10, "Priority URLs must be unique");
const sourceDir = path.join(root, "content/articles");
const articles = new Map();
const endOfToday = new Date();
endOfToday.setUTCHours(23, 59, 59, 999);
for (const file of await readdir(sourceDir)) {
  if (!file.endsWith(".md") || file.startsWith("_")) continue;
  const parsed = matter(await readFile(path.join(sourceDir, file), "utf8"));
  if (parsed.data.draft || new Date(parsed.data.date) > endOfToday) continue;
  articles.set(file.slice(0, -3), parsed);
}
const paths = new Set(cohort.pages.map(p => `/articles/${p.slug}/`));
const incoming = new Map([...paths].map(p => [p, new Set()]));
for (const [slug, article] of articles) {
  const sourcePath = `/articles/${slug}/`;
  const targets = new Set();
  marked.walkTokens(marked.lexer(article.content), token => {
    if (token.type !== "link") return;
    const url = new URL(token.href, `${cohort.siteUrl}${sourcePath}`);
    const target = url.pathname.replace(/\/?$/, "/");
    if (url.origin === cohort.siteUrl && target !== sourcePath && paths.has(target)) targets.add(target);
  });
  if (!targets.size) continue;
  const html = await readFile(path.join(dist, sourcePath, "index.html"), "utf8");
  for (const target of targets) {
    // Confirm the source link survives into the generated HTML. Existing site
    // integration checks validate every destination and fragment separately.
    assert.ok(html.includes(`href="${target}"`) || html.includes(`href="${target}#`), `${sourcePath}: link to ${target} missing from generated HTML`);
    incoming.get(target).add(sourcePath);
  }
}
const baseline = options.baseline ? JSON.parse(await readFile(path.resolve(options.baseline), "utf8")) : null;
const rows = [];
for (const selected of cohort.pages) {
  const article = articles.get(selected.slug);
  assert.ok(article, `Priority article must be published: ${selected.slug}`);
  const pathname = `/articles/${selected.slug}/`;
  const html = await readFile(path.join(dist, pathname, "index.html"), "utf8");
  const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
  assert.equal(canonical, `${cohort.siteUrl}${pathname}`, `${pathname}: canonical mismatch`);
  assert.ok(!/<meta[^>]+name="(?:robots|googlebot)"[^>]+content="[^"]*noindex/i.test(html), `${pathname}: unexpected noindex`);
  const sources = [...incoming.get(pathname)].sort();
  const previous = baseline?.pages.find(p => p.path === pathname);
  rows.push({ path: pathname, title: article.data.title, reason: selected.reason,
    updated: article.data.updated ? new Date(article.data.updated).toISOString().slice(0, 10) : null,
    contextualSources: sources, contextualSourceCount: sources.length,
    ...(previous ? { newContextualSources: sources.filter(s => !previous.contextualSources.includes(s)), removedContextualSources: previous.contextualSources.filter(s => !sources.includes(s)) } : {}),
    canonical, googleIndexStatus: "unverified", googleIndexCheckedOn: null });
}
const report = { checkedAt: new Date().toISOString(), reviewTimezone: cohort.reviewTimezone,
  method: "Distinct published English article Markdown sources with links confirmed in generated HTML. Excludes automatic glossary links, category/archive links, hreflang, and generated related cards. Not a live Google index inspection.",
  indexStatusNote: cohort.indexStatusNote, pages: rows };
if (options.output) {
  const output = path.resolve(options.output);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
