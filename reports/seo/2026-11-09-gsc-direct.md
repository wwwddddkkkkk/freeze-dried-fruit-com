# Direct Google Search Console inspection of ten priority pages

Reviewed November 9, 2026 (America/Los_Angeles), through the signed-in official Google Search Console website. No GSC Wizard used.

Five URLs are indexed; five are not. All five unindexed pages passed the current Google live test: crawling allowed, successful fetch, indexing allowed. Live testing uses Google Inspection Tool and does not prove indexing or a regular Googlebot recrawl.

| Page | Official index record | Last index crawl (verbatim UI) | Live test |
| --- | --- | --- | --- |
| [Buyer guide](https://search.google.com/search-console/inspect?resource_id=sc-domain%3Afreeze-dried-fruit.com&id=WSdpf5guekuSoUVIRQJlbw) | Page is indexed | Oct 14, 2026, 9:08:38 PM | Not separately tested |
| [Added sugar](https://search.google.com/search-console/inspect?resource_id=sc-domain%3Afreeze-dried-fruit.com&id=66Sg3_1GqCfDji12GOL1kw) | Discovered - currently not indexed | N/A | Passed |
| [How it is made](https://search.google.com/search-console/inspect?resource_id=sc-domain%3Afreeze-dried-fruit.com&id=hyOmBHmxVpctv8NhAiPysQ) | Page is indexed | Jul 24, 2026, 11:41:52 PM | Not separately tested |
| [Moisture control](https://search.google.com/search-console/inspect?resource_id=sc-domain%3Afreeze-dried-fruit.com&id=ywSTgF92bnNf_jTWqZ_oRw) | Page is indexed | Oct 20, 2026, 9:35:06 AM | Not separately tested |
| [Water activity vs moisture](https://search.google.com/search-console/inspect?resource_id=sc-domain%3Afreeze-dried-fruit.com&id=lYWq4CZV8zkfs4FiqW190g) | Page is indexed | Oct 20, 2026, 10:00:06 AM | Not separately tested |
| [Barrier films](https://search.google.com/search-console/inspect?resource_id=sc-domain%3Afreeze-dried-fruit.com&id=1eEHGEi0iKoYTchZzSvSQg) | Not indexed; no crawl record; discovery sub-status differs between inspections* | N/A | Passed |
| [Apple guide](https://search.google.com/search-console/inspect?resource_id=sc-domain%3Afreeze-dried-fruit.com&id=DITSq7RW1JWjxhU5VlmsJQ) | Discovered - currently not indexed | N/A | Passed |
| [Strawberry guide](https://search.google.com/search-console/inspect?resource_id=sc-domain%3Afreeze-dried-fruit.com&id=3H6cSXDAr6BPNkyrDsG79Q) | Crawled - currently not indexed | Jul 28, 2026, 9:49:09 PM | Passed |
| [Oatmeal](https://search.google.com/search-console/inspect?resource_id=sc-domain%3Afreeze-dried-fruit.com&id=b5XzKl6uwDLemTVE93FeLw) | Page is indexed | Oct 28, 2026, 11:45:07 AM | Not separately tested |
| [Powder agglomeration](https://search.google.com/search-console/inspect?resource_id=sc-domain%3Afreeze-dried-fruit.com&id=uR1CbDYs6ME3f7TrHM7NlA) | Discovered - currently not indexed | N/A | Passed |

*Packaging initially showed Discovered - currently not indexed. A subsequent official inspection showed URL is unknown to Google. Both lack a last crawl. The JSON preserves both results and their inspection links; do not force a more precise diagnosis.

All six pages with a recorded index crawl (including strawberry) show successful fetch, crawling/indexing allowed, and matching canonical selection. Four pages have no recorded index crawl and no declared/Google-selected canonical in that index record. Live-test declarations must not replace missing index-record canonicals.

Every recorded index crawl predates the November 9 content deployment. Do not interpret the current records as evidence that Google has already processed that update. No indexing request, sitemap submission, or account permission change was performed.

Weekly checks now prefer direct official Search Console UI access; the Wizard subscription error is only a connector limitation. Compare the same ten URLs against this baseline and keep live-test results separate.

[Full evidence and timestamps](2026-11-09-gsc-direct.json).
