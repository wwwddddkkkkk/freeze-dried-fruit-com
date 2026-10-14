# Freeze-Dried-Fruit.com — SEO & Editorial Roadmap

## Active decision — October 14, 2026

The business objective is to send relevant readers to OhCrisp and measure
their product visits, cart additions, and completed checkouts. Organic reach
supports that objective. Article count is not a success metric.

The October 14 user-directed referral batch adds a visible, disclosed store
entry in the header/menu/footer; a homepage format chooser; and product
examples on the existing buyer and oatmeal guides. The three featured products
were publicly available when reviewed: Classic Mix, Discovery Mix, and
individually wrapped whole bananas. Review current availability before changing
the selection; ACTIVE in the Admin catalog alone does not prove purchasability.
Manage the small selection in config/publisher-products.json. Avoid copying
live prices, discounts, health claims, or stock promises into the static site.

New shared links carry utm_source=freeze-dried-fruit.com, utm_medium=referral,
utm_campaign=field_guide, and utm_content=<placement>:<source path>. This allows
Shopify to distinguish header/footer, homepage, and article referrals. Existing
editorial-reference UTMs remain valid. Run npm run check:publisher after a build
to verify that source paths, disclosures, locales, and reviewed offers survive
rendering. Do not add reciprocal links to the Shopify store without a separate
store-editing workflow.

For the next four weekly maintenance runs, pause new article creation and use
one bounded batch per week to improve crawl signals, existing content, and
semantic links. A content batch normally refreshes 1–2 existing URLs. The
publication needs to earn useful search visibility from its existing library
before expanding it.

This plan supersedes the earlier calendar-based publishing quotas. The weekly
automation should read it before choosing work. News Wire remains unchanged.
No sitemap submissions, indexing requests, Search Console setting changes, or
account-permission changes are authorized by this plan.

## Evidence and baseline

Property: `sc-domain:freeze-dried-fruit.com`; search type: Web. Retrieved
October 14, 2026 through the connected GSC Wizard integration, using Google's
live API. Settled performance data ends October 11; October 12 onward is
incomplete. Exact responses and URL inspections are saved in
[SEO-GSC-BASELINE-2026-10-14.json](SEO-GSC-BASELINE-2026-10-14.json).

| Metric | Last 90 days: Jul 14–Oct 11 | Prior 90 days: Apr 15–Jul 13 | Change |
| --- | ---: | ---: | ---: |
| Clicks | 1 | 8 | -7 |
| Impressions | 476 | 1,065 | -589 (-55.3%) |
| CTR | 0.21% | 0.75% | -0.54 percentage points |
| Average position | 41.02 | 28.09 | 12.93 positions worse |

| Metric | Last 28 days: Sep 14–Oct 11 | Prior 28 days: Aug 17–Sep 13 | Change |
| --- | ---: | ---: | ---: |
| Clicks | 0 | 1 | -1 |
| Impressions | 101 | 135 | -34 (-25.2%) |
| CTR | 0% | 0.74% | -0.74 percentage points |
| Average position | 14.50 | 33.96 | 19.47 positions better |

The site has little demonstrated organic traffic. Improved aggregate position
in the recent window has not produced more impressions or clicks, and does not
prove that the article library is ranking better. In that window, /articles/
alone recorded 49 page-level impressions at position 5.37; the homepage and
other hubs also appear frequently. Review comparable query–page pairs before
calling any movement a ranking win.

Important limits:

- Click counts are too small for reliable CTR experiments, forecasts, or revenue
  estimates. Do not attribute the decline to a Google update or a penalty from
  these observations.
- Visible query rows total only 164 impressions over 90 days and 16 over 28
  days; property totals are 476 and 101. Google omits anonymized queries. The
  visible terms are useful examples, not a complete demand census.
- Page impressions can count multiple URLs for a search. They are not directly
  additive to property impressions. A page with no reported impressions is not
  thereby proven unindexed.
- No GA4 property is linked in GSC Wizard, and config/site.json has no GA4 or
  Plausible identifier. Publisher-site visits and outbound-click denominators
  remain unmeasured. Shopify's human-session report for Jul 14–Oct 11 shows
  three referring sessions from this domain, all landing on the store homepage,
  with zero cart additions, checkout starts, completed checkouts, or orders in
  those sessions. The matching rows have no UTM values. The recent 28-day
  window contains the same three sessions. Store reporting uses America/Chicago;
  GSC uses America/Los_Angeles. These observations do not measure assisted sales
  or establish zero indirect brand value.

## Indexing diagnosis and next maintenance priority

The signed-in Page Indexing report, last updated October 8, shows 268 indexed
and 418 not-indexed URLs among 686 known URLs. This is 39.1% of Google's known
URLs, not an indexing rate for the current repository's canonical content.

| Reason | Known URLs |
| --- | ---: |
| Discovered — currently not indexed | 254 |
| Crawled — currently not indexed | 129 |
| Alternate page with proper canonical tag | 34 |
| Soft 404 | 1 |

The leading cause is the discovery-to-crawl backlog. Preserve useful existing
URLs and sample priority pages before deciding what to repair. The 34
alternates are not automatically defects; the single Soft 404 still needs its
specific URL diagnosed.

Three examples from the leading-cause list were individually inspected on
October 14:

| URL path | Current URL Inspection result | Implication |
| --- | --- | --- |
| /articles/added-sugar/ | Discovered — currently not indexed; no last crawl; homepage listed as referring URL | A homepage link already exists; adding another generic link is not a complete diagnosis |
| /articles/apple-varieties-for-freeze-drying/ | URL is unknown to Google; no last crawl or canonical returned | Reconcile exact URLs and the lagging aggregate example list before acting |
| /articles/barrier-films-for-freeze-dried-fruit/ | URL is unknown to Google; no last crawl or canonical returned | Same reconciliation needed; no canonical should be inferred |

Live audits of added-sugar, the persimmon guide, and the Spanish process guide
returned HTTP 200, self-canonicals, one H1, no noindex, and structured data. This
small sample does not show a blanket indexability block. Automated metadata
length and repeated Organization-logo warnings are secondary review leads,
not demonstrated causes of the backlog.

Next batch: make sitemap signals truthful and review a small priority URL set.
Repository inspection found that Spanish per-term glossary entries still emit
the current build date as lastmod, while English terms use the declared
glossary revision date. Fix that bounded inconsistency and remove the misleading
assumption that sitemap priority can allocate English versus Spanish crawl.
Google ignores priority and changefreq; changing either is not a crawl fix.
Do not resubmit the sitemap as part of that batch.

The sitemap was successfully read October 7, with 625 submitted Web URLs and
zero warnings/errors. Its API indexed field reports zero, inconsistent with
the Page Indexing report; use the latter and individual inspections for status,
not that legacy sitemap field.

Existing architecture already includes an all-articles directory segmented by
category and semantic English related-content links. Improve specific paths
from those hubs rather than repeating those completed architectural projects.
Also check actual HTML links, HTTP responses, robots directives, and canonical
consistency for the priority sample; inspect crawl/server evidence before
claiming the host is overloaded.

## Existing-page refresh queue

All figures below are Web performance for July 14–October 11 unless noted.
Every page already exists; none of these intents currently requires a new URL.

| Priority | Existing URL | Evidence | Refresh brief |
| --- | --- | --- | --- |
| 1 | /articles/how-many-types-of-persimmons-are-there/ | 9 impressions; position 19; all 9 occurred in the latest 28-day window; individual inspection: indexed, matching canonicals | Repair five literal undefined cells; explain Fuyu/Hachiya, astringency and treated fruit accurately; add horticultural primary sources and contextual link to the existing persimmon freeze-drying guide |
| 2 | /es/articles/how-its-made/ | 99 page impressions; position 90.87; proceso de liofilización de frutas: 85 query impressions at 92.05; indexed; no page impressions in latest 28 days | Refresh the existing process intent, validate technical ranges and sources, improve its Spanish answer and links to the existing moisture/water-activity cluster; review English source alongside it |
| 3 | /articles/best-freeze-dried-fruit-for-oatmeal-and-overnight-oats/ | 19 impressions; position 55.58; best fruit for oatmeal: 4 impressions at 39 | Add a documented recipe/rehydration comparison if real testing is available; explain add-before/add-after use clearly; label untested advice honestly |
| 4 | /articles/added-sugar/ | Priority homepage story, but individually discovered and not indexed | Connect accurate label guidance to relevant source documents and existing quality hub; evaluate crawl discovery and inspect again after a substantive refresh |

Thirty existing fruit-variety guides contain a total of 151 literal undefined
table cells. This is a concrete editorial defect, not proof of an algorithmic
penalty. Put the affected URLs into a repair backlog and work through small,
reviewed batches, starting with the indexed persimmon page. Do not replace
missing cells with invented cultivar claims or launch more of that template.

## Topic strategy

### English consumer and application content

Treat the persimmon guide as an existing-page experiment, not evidence for a
large new fruit-variety series. Improve the current oatmeal article before
adding adjacent breakfast URLs. Freeze-dried versus dried-fruit intent already
has a drying-method comparison page and related explanations; only one visible
query impression currently maps to /articles/. Review routing through the hub
and the best existing destination rather than building a duplicate answer.

Keep strawberry, mango, banana, blueberry, and apple as business-relevant
clusters, but do not call them proven search winners yet. Choose their next
refreshes from new query evidence or from individually confirmed problems on
priority pages. Product links must be relevant, disclosed, and UTM-tagged.

### Spanish process cluster

The strongest visible query signal is Spanish process education, not a new
uncovered intent. Spain contributed 97 property impressions with zero clicks
and average position 91.62 in the 90-day window. That supports a focused review
of the existing process cluster, not broad localization.

Use the existing Spanish how-its-made, moisture-control, and
water-activity-vs-moisture-content pages as one connected learning path.
Maintain reciprocal hreflang and accurate Spanish review signals. Expand the
cluster only if refreshed pages regain sustained visibility and an additional
intent remains uncovered. Do not publish isolated translations for
maqui liofilizado (9 impressions) or tipos de papaya (2 impressions).

### Professional and supplier content

The state-of-industry report has 16 page impressions, while freeze dried fruit
market has 6 query impressions at position 110.5. These figures do not justify
more generic market reports. Prefer source-backed improvements to the existing
report, documented measurement methods, and buyer tools when a real audience
need exists. Interviews and tests require real participants or records; never
invent expertise, supplier conversations, product testing, or market numbers.

The 90-day cannibalization scan found no competing query family above five
visible impressions. With anonymized queries and low traffic, that is weak
negative evidence, not a license to merge or remove pages.

## Four-week execution schedule

Use exactly one bounded batch each week; a code/architecture batch replaces
that week's content batch rather than adding to it.

| Run | Batch | Deliverable |
| --- | --- | --- |
| 1 | Sitemap truth and priority-URL crawl review | Fix Spanish glossary lastmod; reconcile the three sampled URLs; establish a fixed set of 10 important existing canonical URLs and record their individual index status |
| 2 | Persimmon quality repair | Refresh the existing persimmon variety guide, optionally its existing freeze-drying companion; source and verify the damaged table |
| 3 | Spanish process refresh | Review the English/Spanish process pair and connect existing Spanish supporting guides; no new translation |
| 4 | Application improvement and measurement | Refresh the oatmeal guide if documented evidence is available; otherwise use a source-backed priority quality page; compare index and query–page evidence for the earlier batches |

After each batch, save changed URLs and a before/after baseline. Validate
affected HTML, links, canonical/schema/hreflang where relevant, sitemap and
llms output, and UI at 1440px, 768px, and 390px. Run npm run build and relevant
checks for site-source changes; review the diff, commit verified source, and
push only a safe fast-forward. Keep meaningful deployment status separate from
a successful Git push. Planning-only documentation edits do not change
production HTML or require a new visual review.

## Conditions for resuming new articles

After the four-week repair period, new articles remain optional. Approve at
most one per weekly run, and only if all of the following are recorded:

1. A relevant uncovered query family normally has at least 20 visible Web
   impressions over a settled 90-day window. This is an editorial selection
   rule, not a Google requirement or a claim about total search volume.
2. The content inventory and query–page mapping show no close competing URL.
   If an existing page can answer the question well, refresh it.
3. The brief contains a useful original contribution: documented test,
   interview, buyer example, primary-source synthesis, or working tool with
   disclosed assumptions. Article length and a new cover are not substitutes.
4. Its parent hub and at least two relevant existing pages provide contextual
   links; review these for reader usefulness rather than just link count.
5. At least seven of the fixed ten priority URLs are individually indexed and
   two consecutive weekly checks show no newly introduced crawl/index block.
   This is a planning gate; the site-wide known-URL ratio cannot satisfy it.
6. The previous repair batches have been measured after a complete 28-day
   follow-up window. Report zero traffic honestly; do not invent an uplift.

Do not increase to two or three new articles per week until two consecutive
settled 28-day windows show improving relevant non-brand demand and the new-URL
cohort can be evaluated individually. A sitemap submission or an updated date
does not satisfy this gate.

## Measurement and review discipline

- Weekly: one 28-day performance comparison, three-month top queries/pages,
  leading indexing cause, and individual checks on affected URLs. Connector
  access now works; use it first. If it fails, record the access gap.
- For each refresh: compare the same URL and relevant visible query family
  before/after, separating crawl/index gains from ranking and click gains.
  Observe a full settled 28-day window; small counts remain directional only.
- Compare CTR only for similar query/device/country and position bands. Defer
  isolated title experiments until there is enough matched exposure to assess
  them; currently zero or one click cannot support a performance conclusion.
- At weeks 4 and 8: review the fixed ten-URL set, the persimmon and Spanish
  process experiments, and the repair backlog. Reorder work from actual
  outcomes rather than filling an article-count quota.
- Track publisher_referral and OhCrisp UTM sessions/conversions only once an
  actual analytics destination is connected and verified. Until then, report
  that commercial performance is unknown.
- Preserve design tokens/components, authentic attribution, and News Wire.
  Never mass-generate pages, redirects, canonicals, translations, or noindex
  rules. Removal or consolidation requires individual status and overlap
  evidence, a clear destination, and the applicable user authorization.

## Primary guidance

- [Google: Page Indexing report](https://support.google.com/webmasters/answer/7440203)
- [Google: Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google: Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
