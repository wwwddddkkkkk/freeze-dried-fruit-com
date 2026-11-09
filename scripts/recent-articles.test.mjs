import assert from "node:assert/strict";
import test from "node:test";
import { articleActivity, recentArticles } from "./lib/recent-articles.mjs";

test("a substantive revision surfaces ahead of newer original publication", () => {
  const articles = [
    { id: "new", date: new Date("2026-08-01"), updated: null },
    { id: "refreshed", date: new Date("2026-04-01"), updated: new Date("2026-11-02") },
    { id: "old", date: new Date("2026-04-01"), updated: null },
  ];
  assert.deepEqual(recentArticles(articles).map(a => a.id), ["refreshed", "new", "old"]);
  assert.deepEqual(articles.map(a => a.id), ["new", "refreshed", "old"], "archives retain their existing order");
  assert.equal(articles[1].date.toISOString(), "2026-04-01T00:00:00.000Z", "publication dates stay truthful");
  assert.deepEqual(articleActivity(articles[1]), { date: new Date("2026-11-02"), updated: true });
});

test("an absent, invalid, equal, or earlier revision is not presented as an update", () => {
  for (const updated of [null, undefined, "not-a-date", new Date("2026-01-01"), new Date("2026-04-01")]) {
    assert.deepEqual(articleActivity({ date: new Date("2026-04-01"), updated }), {
      date: new Date("2026-04-01"), updated: false,
    });
  }
});
