import assert from "node:assert/strict";
import test from "node:test";
import worker from "../workers/redirects.mjs";

test("HTTP and www redirect to one canonical HTTPS URL, preserving path and query", () => {
  for (const origin of ["http://freeze-dried-fruit.com", "http://www.freeze-dried-fruit.com", "https://www.freeze-dried-fruit.com"]) {
    const response = worker.fetch(new Request(`${origin}/es/articles/mango-varieties/?utm_source=wire&q=a%20b`));
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), "https://freeze-dried-fruit.com/es/articles/mango-varieties/?utm_source=wire&q=a%20b");
  }
});

test("redirects preserve POST semantics and never loop on canonical or unknown hosts", () => {
  const redirect = worker.fetch(new Request("http://freeze-dried-fruit.com/subscribe/", {method:"POST",body:"email=example"}));
  assert.equal(redirect.status, 308);
  for (const url of ["https://freeze-dried-fruit.com/", "https://example.com/", "https://freeze-dried-fruit.com.evil.example/"]) {
    const response = worker.fetch(new Request(url));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("location"), null);
  }
});
