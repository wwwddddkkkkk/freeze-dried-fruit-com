import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir, copyFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fetchOne, refreshNews, runNewsUpdate } from "./fetch-news.mjs";

const logger = { log() {}, warn() {} };
const source = { name: "News A", url: "https://example.com/a.xml" };
const other = { name: "News B", url: "https://example.com/b.xml" };
const config = { sources: [source, other], limit_per_source: 3, total_limit: 4 };
const rss = (title = "Fruit news", link = "https://example.com/story", date = "Mon, 09 Nov 2026 01:00:00 GMT") =>
  `<rss version="2.0"><channel><item><title>${title}</title><link>${link}</link><pubDate>${date}</pubDate><source>Publisher</source></item></channel></rss>`;
const response = xml => ({ ok: true, text: async () => xml });
const options = { logger, attempts: 2, retryDelayMs: 0, sleep: async () => {}, now: () => new Date("2026-11-09T12:00:00Z") };

async function fixture(t, feed = { updated_at: "2026-11-08T12:00:00Z", items: [{ title: "Old news", link: "https://example.com/old", feed: source.name }] }) {
  const root = await mkdtemp(path.join(os.tmpdir(), "fdf-news-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "config"), { recursive: true });
  await mkdir(path.join(root, "content/news"), { recursive: true });
  await writeFile(path.join(root, "config/news-sources.json"), JSON.stringify(config));
  const out = path.join(root, "content/news/feed.json");
  const original = JSON.stringify(feed, null, 2) + "\n";
  await writeFile(out, original);
  return { root, out, original };
}

test("transient source errors are retried before a successful response", async () => {
  let calls = 0;
  const items = await fetchOne(source, 3, { ...options, fetchImpl: async () => {
    if (++calls === 1) throw new Error("temporary network failure");
    return response(rss());
  } });
  assert.equal(calls, 2);
  assert.equal(items[0].title, "Fruit news");
  assert.equal(items[0].date_label, "Nov 9, 2026");
});

test("HTTP errors, HTML responses, and empty RSS fail instead of producing an empty wire", async () => {
  for (const res of [{ ok: false, status: 503 }, response("<html>Gateway error</html>"), response("<rss><channel/></rss>")]) {
    await assert.rejects(fetchOne(source, 3, { ...options, fetchImpl: async () => res }));
  }
});

test("network requests receive an abort signal and hanging requests time out", async () => {
  let observedSignal;
  const request = fetchOne(source, 3, { ...options, attempts: 1, timeoutMs: 10, fetchImpl: (_url, { signal }) => {
    observedSignal = signal;
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  } });
  // AbortSignal.timeout uses an unreferenced timer; keep this test alive until it fires.
  const keepAlive = setTimeout(() => {}, 1000);
  try { await assert.rejects(request, /timed out|timeout/i); }
  finally { clearTimeout(keepAlive); }
  assert.equal(observedSignal.aborted, true);
});

test("one failed source preserves the complete previous file and rejects the update", async t => {
  const f = await fixture(t);
  await assert.rejects(runNewsUpdate(f.root, { ...options, fetchImpl: async url => {
    if (url === other.url) throw new Error("upstream unavailable");
    return response(rss());
  } }), /previous feed preserved/);
  assert.equal(await readFile(f.out, "utf8"), f.original);
  assert.deepEqual(await readdir(path.dirname(f.out)), ["feed.json"]);
});

test("all failed sources preserve the previous file", async t => {
  const f = await fixture(t);
  await assert.rejects(runNewsUpdate(f.root, { ...options, fetchImpl: async () => ({ ok: false, status: 429 }) }), /previous feed preserved/);
  assert.equal(await readFile(f.out, "utf8"), f.original);
});

test("the command-line entry point reports an upstream failure with a nonzero exit code", async t => {
  const f = await fixture(t);
  await mkdir(path.join(f.root, "scripts"));
  await copyFile(new URL("./fetch-news.mjs", import.meta.url), path.join(f.root, "scripts/fetch-news.mjs"));
  const preload = "data:text/javascript," + encodeURIComponent("globalThis.fetch = async () => ({ok:false,status:503});");
  await assert.rejects(promisify(execFile)(process.execPath, ["--import", preload, path.join(f.root, "scripts/fetch-news.mjs")]), error => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /previous feed preserved/);
    return true;
  });
  assert.equal(await readFile(f.out, "utf8"), f.original);
});

test("successful content updates dedupe stories, sort newest first, and write atomically", async t => {
  const f = await fixture(t);
  const changed = await runNewsUpdate(f.root, { ...options, fetchImpl: async url => response(url === source.url
    ? rss("Older", "https://example.com/older", "Sun, 08 Nov 2026 01:00:00 GMT") + "\n"
    : rss("Newest", "https://example.com/newest")) });
  assert.equal(changed, true);
  const feed = JSON.parse(await readFile(f.out, "utf8"));
  assert.equal(feed.updated_at, "2026-11-09T12:00:00.000Z");
  assert.deepEqual(feed.items.map(item => item.title), ["Newest", "Older"]);
  assert.deepEqual(await readdir(path.dirname(f.out)), ["feed.json"]);
  const deduped = await refreshNews(config, null, { ...options, fetchImpl: async () => response(rss()) });
  assert.equal(deduped.items.length, 1);
});

test("unchanged stories preserve exact file bytes and previous update timestamp", async t => {
  const fetchImpl = async () => response(rss());
  const feed = await refreshNews(config, null, { ...options, fetchImpl });
  feed.updated_at = "2026-11-01T00:00:00Z";
  const f = await fixture(t, feed);
  assert.equal(await runNewsUpdate(f.root, { ...options, fetchImpl }), false);
  assert.equal(await readFile(f.out, "utf8"), f.original);
});

test("invalid or missing source configuration fails instead of clearing the feed", async () => {
  await assert.rejects(refreshNews({ sources: [] }, null, options), /No RSS sources configured/);
});
