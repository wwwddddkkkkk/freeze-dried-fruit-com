# Weekly maintenance of ten priority pages

Adopted November 9, 2026. This is the active execution plan for the existing
weekly Freeze-Dried Fruit SEO Maintenance automation. It supersedes the dated
four-run queue in SEO-EDITORIAL-ROADMAP.md; the roadmap's editorial standards,
publisher disclosures, and measurement limits still apply.

## Objective and evidence

Improve useful existing pages, their contextual discovery paths, and the
evidence behind their claims. Measure actual crawling and indexing separately
from rankings, impressions, and publisher referrals. More links or a new
revision date is not proof of an indexing improvement.

The November 9 public HTTP audit found no current blanket robots/noindex
block. The locally generated site contains 625 sitemap URLs, all reachable by
HTML links; English articles are one or two clicks from the homepage. That
does not establish historical availability or access by verified Googlebot.
The GSC Wizard connector returned `subscription_required`, but the signed-in
Google Search Console website is accessible directly. Individual official UI
inspections on November 9 found five indexed pages and five not indexed: four
had no recorded crawl, and the strawberry guide had been crawled. Packaging
showed inconsistent discovery sub-statuses across two official UI inspections;
both results and their evidence are retained. The direct baseline is
reports/seo/2026-11-09-gsc-direct.json. It supersedes the earlier access gap
for these ten URLs; the October aggregate coverage report remains historical.
Live-test results are separate from index status and do not prove indexing.

The machine-readable cohort is config/seo-priority-pages.json. Preserve these
ten canonical URLs until a measured review justifies a documented change.

## Fixed cohort and initial work

Paths below are under https://freeze-dried-fruit.com. The final column counts
distinct published English articles with a manually written Markdown link to
the target, confirmed in generated HTML. It excludes category listings,
automatic glossary links, hreflang, and generated recommendation cards. Zero
in this column did not mean a page had no internal links of any kind.

| Page path | Selection reason | November 9 work | Contextual sources, before → after |
| --- | --- | --- | ---: |
| /articles/buyer-guide/ | Core buying decision and publisher journey | Connect format, labels, fruit, process, and packaging questions | 0 → 6 |
| /articles/added-sugar/ | Homepage feature; historical discovery sample | Full refresh: natural versus added sugar, serving weight, concentrate exceptions, current FDA/CFR sources | 0 → 5 |
| /articles/how-its-made/ | Main process explanation and Spanish counterpart | Connect preparation and finished-quality checks | 0 → 4 |
| /articles/moisture-control/ | Common loss-of-crunch problem | Connect exposure, measurements, packaging, and buying | 0 → 7 |
| /articles/water-activity-vs-moisture-content/ | Core quality measurements | Connect process, exposure, and package evaluation | 0 → 7 |
| /articles/barrier-films-for-freeze-dried-fruit/ | Packaging decision; historical discovery sample | Connect measurements, powder handling, and buying | 0 → 6 |
| /articles/apple-varieties-for-freeze-drying/ | Relevant fruit; repeated template; historical discovery sample | Full refresh: sourced cultivar background, cut/treatment choices, proposed sample-comparison worksheet | 0 → 4 |
| /articles/strawberry-varieties-for-freeze-drying/ | Relevant snack and breakfast fruit | Connect quality checks, label reading, and application | 0 → 3 |
| /articles/best-freeze-dried-fruit-for-oatmeal-and-overnight-oats/ | Existing search signal and useful product context | Connect fruit formats, powder mixing, labels, and storage | 0 → 5 |
| /articles/how-freeze-dried-fruit-powder-agglomeration-improves-flow-and-dispersibility/ | Previously only a category entry in the HTML audit | Full refresh: remove mismatched references and no-heat claim; distinguish research scope; add proposed comparison procedure | 0 → 5 |

Initial implementation adds 52 distinct source→target contextual links across
the ten articles. Only the three substantive rewrites receive November 9
`updated` dates. The seven link-only articles keep their existing revision
dates. Original publication dates, URLs, cover attribution, locale pairings,
and disclosed publisher placements are preserved.

The apple and powder procedures are explicitly proposals, not claims of
testing performed by the publication. No product-test results, cultivar
rankings, supplier interviews, or performance improvements are invented.

Evidence: reports/seo/2026-11-09-before.json and
reports/seo/2026-11-09-after.json. They are local source/rendering baselines,
not Google inspection reports or proof of publication. Record the production
deployment date separately when these exact changes become publicly visible.

## Schedule

Keep the existing automation: Mondays at 09:00 America/Los_Angeles. Update its
prompt rather than create a second scheduled task. The next run after this
initial batch is November 16. Each run performs at most one bounded batch,
normally one or two existing pages, in addition to read-only cohort checks.

| Scheduled run | Work to select from current evidence | Required result |
| --- | --- | --- |
| November 16 | Moisture-control and water-activity pair | Verify numerical claims and actual reference destinations; distinguish texture, stability, and safety; improve only supported explanations. |
| November 23 | Strawberry and oatmeal pair | Review generic or unsupported ranking claims; strengthen format/timing guidance with primary sources. A tested recipe requires real records; otherwise label the guidance as an editorial framework. |
| November 30 | Buyer guide and barrier-film pair | Verify supplier questions, packaging claims, and sources; preserve relevant publisher disclosure and attribution. |
| December 7 | Full ten-page review | Compare individual Google statuses and settled query/page data if available. Check whether a full post-deployment 28-day window exists; defer outcome conclusions if it does not. |
| Following Mondays | Continue one evidence-based maintenance batch | Choose the most useful unresolved issue in this cohort. If there is no justified edit, record a verification-only run rather than manufacture a rewrite. |

New evidence can replace that week's proposed edit; record why. Do not repeat
the completed November 9 rewrites merely because an older roadmap or memory
still lists them. Do not expand the article or translation inventory during
this maintenance cycle. New URLs need a separate, evidenced decision under
the roadmap's conditions.

## Each weekly run

1. Read this plan, the cohort config, the roadmap, the latest repository
   report, and the automation memory. Inspect local/remote state. Preserve
   unrelated changes; determine whether earlier work was actually deployed
   before repeating it or calling it live. Do not overwrite unpublished local
   work while syncing or automatically stage someone else's edits.
2. Prefer the official Google Search Console website through the existing
   signed-in Chrome browser connection. GSC Wizard is optional; its payment
   error does not mean Google Search Console is unavailable. Preserve Google
   account permissions and do not create a new authorization to read an
   already accessible property. If GSC is available, collect Web performance over the last 28 settled days
   versus the preceding 28, plus the same pages/queries over 90 days. Use
   individual URL Inspection results for index status. For API inspections,
   read quota first and remain comfortably below half the remaining quota;
   for direct UI checks, inspect only the ten cohort URLs and use live tests
   only for a specific diagnostic question. Reuse recent history where
   appropriate. Save exact date ranges and inspection timestamps. If the
   official UI and any already-authorized alternative are unavailable, record
   that gap and continue repository-evidenced maintenance. Do not
   relabel old data as current, equate zero impressions with no indexing, or
   use the deprecated sitemap indexed field as coverage.
3. Build, then run `npm run audit:priority`. Compare the ten paths against the
   last saved baseline. Check that existing contextual links still survive
   rendering and investigate unexpected losses. Do not add links simply to
   increase a count; choose a passage where the destination answers the
   reader's next question. Any new context links must be in rendered HTML.
4. Perform one justified batch on existing content. Open primary sources and
   confirm title, subject, method, and limits actually match the claim. A
   reachable URL is not sufficient. Separate freeze-dried fruit from studies
   of spray-dried mixtures or conventional dehydration. Record a real
   substantive revision date only when the article merits one.
5. Run `npm run verify`, then the cohort audit against the previous report.
   Inspect changed pages at 1440px, 768px, and 390px; check readable tables,
   links, image attribution, canonical/schema, applicable hreflang, sitemap
   dates, and llms output. Reuse existing design and avoid broad template
   changes unless evidence makes them necessary.
6. Save reports/seo/YYYY-MM-DD.json with local link/rendering evidence, and a
   run log with inspected URLs, dates/ranges, source verification, actual
   edits, and validation results. Keep Google inspections and local link
   metrics separate. Record commit, push, and deployment status truthfully.
   The existing automation's safe commit/fast-forward publishing procedure
   remains in force; if delivery is incomplete, state the exact stage.
7. Update memory and return a concise Chinese report: access status, changed
   pages, reason, validation, delivery status, next batch, and any measured
   crawl/index change. Judge performance only after complete settled windows
   measured from the actual production deployment.

Example local commands after a build:

```sh
npm run verify
npm run audit:priority -- --baseline reports/seo/2026-11-09-after.json --output reports/seo/YYYY-MM-DD.json
```

For an isolated validation build, set the same `DIST_DIR` for `npm run verify`
and `npm run audit:priority`. The audit fails on a missing published cohort
page, a missing rendered source link, an unexpected noindex, or a canonical
mismatch. Link counts and deltas are observations; the audit does not certify
Google indexing, historical server availability, or production deployment.

## Review criteria

- Retain all ten canonical pages and their useful incoming links. Explain
  any deliberate change in the cohort rather than silently rotating URLs.
- Track each page's actual inspection status and last crawl when available;
  unknown remains unknown. Keep the three historical discovery examples
  distinct from newly collected evidence.
- Review the same query families and pages over complete settled 28-day
  windows; distinguish crawling, indexing, ranking, clicks, and referrals.
- Use verified Googlebot logs and Crawl Stats before blaming host capacity
  or a firewall. Do not change security settings based on a spoofed UA test.
- Do not submit sitemaps, request indexing, change account settings, or
  change permissions as part of this plan. Do not bulk delete, redirect,
  canonicalize away, or noindex pages. Keep News Wire unchanged.
- If a real indexing block appears, fix the verified block first and record
  its scope; do not promise that a link or a rewrite guarantees indexing.
