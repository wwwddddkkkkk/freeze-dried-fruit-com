# Freeze-Dried-Fruit.com Content Rules

Freeze-Dried-Fruit.com is the professional authority hub for freeze-dried fruit. It should feel more technical, research-aware, and industry useful than Best Snack, Shopify blogs, or Vitablabla Journal.

Do not change the existing News Wire automation. The RSS-based News Wire already lives in `config/news-sources.json`, `content/news/feed.json`, `scripts/fetch-news.mjs`, and `.github/workflows/update-news.yml`. Keep that structure intact.

## Publishing Cadence

For the next 90 days, optimize the existing library before expanding it. The
default weekly output is:

- 2 net-new articles per week maximum
- 2 substantive refreshes, consolidations, or source upgrades per week
- 1 original authority asset per month (survey, buyer checklist, interview,
  pricing methodology, seasonal supply note, or first-party comparison)
- 0 Fruit Reports unless a real query gap, product cluster, or user request
  justifies one

Do not publish to satisfy a category quota. Select work in this order:

1. Refresh pages already earning impressions but underperforming on clicks.
2. Consolidate pages competing for the same search intent.
3. Fill a documented topic gap supported by Search Console, customer
   questions, supplier conversations, or a priority OhCrisp product cluster.
4. Publish original data or operator insight that competing sites cannot
   reproduce from generic web research.

The News Wire may continue updating several times per day because it is an
automated aggregation surface, not a claim of four new editorial articles.

Fruit Reports are not part of scheduled automation. Only write a Fruit Report
when the user explicitly asks for one or when query and product evidence show a
clear standalone need.

Avoid duplicate topics by checking `content/articles/*.md` before writing.

## Editorial Positioning

The site is a field guide for:

- snack founders
- ingredient buyers
- foodservice buyers
- suppliers and processors
- curious consumers
- operators evaluating quality, pricing, process, and sourcing

The voice should be:

- precise
- practical
- independent
- technically credible
- readable for smart non-specialists
- cautious with claims

Avoid:

- undisclosed brand promotion
- unsupported health claims
- casual snack-blog language
- AI-like filler
- vague phrases such as "game changer"
- overclaiming nutrition, shelf life, or process outcomes without context

## Article Format

Articles are Markdown files in:

`content/articles/<slug>.md`

Each article needs frontmatter:

```yaml
---
title: "Article Title"
category: "Technology"
date: 2026-05-10
updated: 2026-05-14   # optional — only when the article has materially changed
read: "5 min read"
summary: "Short card/meta summary."
intro: "One-line intro shown above the cover image."
takeaways:
  - "First practical takeaway"
  - "Second practical takeaway"
  - "Third practical takeaway"
cover_image: /images/articles/article-slug.svg
cover_alt: "Descriptive alt text"
---
```

Use `draft: true` only when the article should not publish.

Future-dated articles and reports are automatically excluded from normal
builds. Set `INCLUDE_FUTURE=1` only for an intentional local preview; never use
it in the production deployment.

`updated:` is optional. Set it only when the article body, FAQs, takeaways, or
factual claims have meaningfully changed after first publication. When set and
strictly later than `date:`, the article shows an "Updated [date]" badge on the
byline, the Article schema's `dateModified` flows from `updated`, and the
sitemap's `lastmod` for that URL uses the newer date. Do not bump `updated:`
for cosmetic or site-wide changes (typo fixes, glossary auto-linking, header
tweaks).

## Cover Strategy

Every article should choose cover type from the content first.

### Technical / Research / Industry Articles

Use a custom SVG cover drawn for that specific article.

Do not rely on the existing reusable `hero` keys for new articles unless there is no better option. The existing keys (`quality`, `fresh-frozen`, `sugar`, `pricing`, `process`, `moisture`) can stay for old articles and emergency fallback, but new technical articles should get article-specific SVGs.

Create the SVG at:

`public/images/articles/<slug>.svg`

Reference it in frontmatter:

```yaml
cover_image: /images/articles/<slug>.svg
cover_alt: "Diagram showing moisture migration in freeze-dried fruit packaging"
```

The SVG should be editorial and content-specific:

- moisture graph for water activity articles
- chamber / tray / vapor path for process articles
- packaging layer diagram for barrier-film articles
- defect map for quality articles
- price/value matrix for buyer articles
- supplier flow map for sourcing articles
- fruit structure diagram for texture articles

SVG style should match the current site: clean, restrained, field-guide-like, not cartoonish.

### Consumer-Facing Articles

Use a real photo from the local image gallery when a strong, accurate image is
available. If the gallery does not have a credible match, generate a unique
professional editorial image for the article rather than falling back to a
generic SVG.

Source gallery:

`content-image-library/freezedriedfruit/`

Recommended folders:

- `fruit/`: mango, strawberry, dragon fruit, jackfruit, blueberry, pineapple, mixed fruit, closeups
- `applications/`: yogurt bowls, smoothie bowls, snack boards, lunchboxes, toppings, desserts
- `packaging/`: pouches, jars, labels, bulk bags, shelf setups
- `process/`: trays, freeze dryers, frozen fruit, finished product, equipment details
- `diagrams/`: optional manually prepared diagrams
- `used/`: optional archive

When an image is selected:

1. Copy it into `public/images/articles/<slug>.<ext>`.
2. Add `cover_image` and `cover_alt` to the article frontmatter.
3. Record the source image in `content-image-library/freezedriedfruit/used-hero-images.json`.

Do not reference `content-image-library/` directly from live articles.

## Hero Image Single-Use Rule

Each source photo can be used as a cover/hero only once.

Before selecting a consumer-facing photo, read:

`content-image-library/freezedriedfruit/used-hero-images.json`

Do not choose a source image already recorded there.

After using a photo, append:

```json
{
  "source": "content-image-library/freezedriedfruit/fruit/freeze-dried-mango-closeup.jpg",
  "usedAs": "cover_image",
  "postSlug": "freeze-dried-mango-texture",
  "publicPath": "public/images/articles/freeze-dried-mango-texture.jpg",
  "date": "2026-05-10"
}
```

Custom SVG covers do not need to be logged as reused because they are created uniquely for the article.

## Generated Editorial Image Standard

Generated images are allowed for cover art and explanatory editorial scenes,
but they must never be presented as documentary evidence of a real supplier,
factory, lab result, certification, person, or product.

- Use a restrained, photorealistic trade-publication style, not glossy ad art.
- Keep fruit texture, scale, processing equipment, and QA tools physically
  plausible.
- Avoid brand packaging, logos, readable labels, certificates, instrument
  results, health claims, and people whose identity could imply endorsement.
- Use one original composition per article. Do not recolor or lightly remix the
  same image across multiple URLs.
- Export covers as 1600 x 900 WebP at an appropriate quality setting and aim
  for less than 250 KB without obvious artifacts.
- Write alt text for the information visible in the image, not for the target
  keyword.
- Record the final prompt, public path, article slug, and generation date in
  `content-image-library/freezedriedfruit/generated-hero-images.json`.

Generated images should be favored for consumer applications, sample
comparisons, ingredient-format comparisons, and generic buyer workflows. Use a
diagram instead when the article needs exact scientific relationships, labels,
measurements, process steps, or regulatory information.

## Categories

Preferred categories:

- `Technology`
- `Industry Insights`
- `Applications`
- `Labels & Quality`
- `Fruit Reports`

Category mapping:

- Use `Technology` for process, packaging, shelf life, moisture, equipment, and technical quality-control topics.
- Use `Industry Insights` for supplier, buyer, sourcing, market, pricing, private label, and trade-structure topics.
- Use `Applications` for consumer use cases, storage after opening, toppings, snack formats, recipe-adjacent topics, and practical ways to use freeze-dried fruit.
- Use `Labels & Quality` for ingredient lists, added sugar, defects, specs, value comparison, and quality signals.
- Use `Fruit Reports` only for user-requested fruit profiles or fruit-specific reports.

Scheduled automation should avoid `Fruit Reports`. Category balance is reviewed
monthly; it is not enforced by creating one article in every category.

## OhCrisp Editorial Link Policy

Freeze-Dried-Fruit.com is published by the team behind OhCrisp. That ownership
must remain explicit while the article stays useful without a purchase.

- Link to an OhCrisp product only when it is a concrete, relevant example of
  the format, fruit, or use case being discussed.
- Prefer one OhCrisp product link per article. Do not add links merely to hit a
  commercial quota.
- Do not describe OhCrisp as an independent third-party recommendation.
- Product links receive campaign parameters and an on-page publisher
  disclosure automatically during the build.
- Map priority editorial clusters to the closest matching OhCrisp collection or
  product page, and measure referral clicks and downstream revenue.
- Keep authoritative citations, supplier examples, and category coverage
  brand-neutral. The media site's value must not depend on the product link.

Do not use older category names such as `Quality & Pricing`, `Packaging & Shelf Life`, or `Buyer Guides` unless the site navigation is intentionally changed first.

If a new category is used, confirm it fits the nav/content model in `config/site.json`.

## Fruit Report Template

Fruit Reports are on-demand only. When the user asks for one, write it as a serious field guide rather than a casual fruit profile.

Fruit Reports use two series labels:

- `report_series: "Freeze-Dried Guide"` for fruit-specific processing, sourcing, texture, and format reports.
- `report_series: "Fruit Variety Guide"` for cultivar/variety-led reports where the main value is comparing fruit types, varieties, origins, or commercial grades.

Recommended structure:

1. Open with a clear editorial thesis: why this fruit matters for freeze-drying, sourcing, texture, or market positioning.
2. Add a short "how to use this guide" paragraph for buyers, operators, and curious consumers.
3. Include a quick comparison table when the fruit has meaningful varieties, origins, formats, or quality grades.
4. Explain what matters technically: sugar/Brix, fiber, acidity, aroma, color, seed/skin ratio, cell structure, moisture sensitivity, breakage, or format behavior.
5. Describe the main varieties, origins, or commercial forms with practical freeze-drying implications.
6. Add a "quality in the finished bag" section: color, aroma, texture, breakage, powder, chew, and flavor finish.
7. Add a sourcing reality section: seasonality, origin, pricing pressure, blends, label claims, and what buyers should ask suppliers.
8. Close with a buyer-friendly conclusion that turns the report into a practical decision tool.

Fruit Reports should feel like a magazine-quality field guide with industry utility: sensory enough to be readable, technical enough to be trusted, and cautious with claims that would need sourcing.

## Topic Pools

Technical / research / process topics:

- water activity vs moisture content in freeze-dried fruit
- why freeze-dried fruit loses crunch after opening
- packaging barrier films and humidity protection
- oxygen absorbers vs desiccants
- freeze-drying cycle time and piece thickness
- fruit cell structure and crunch
- powder, breakage, fines, and shipping damage
- color retention and oxidation
- how pre-freezing affects final texture
- freeze-dried vs vacuum-dried vs air-dried
- quality specs buyers should request from suppliers
- shelf-life testing for freeze-dried fruit

Industry / buyer / sourcing topics:

- how to evaluate a freeze-dried fruit supplier
- what affects freeze-dried fruit pricing
- whole pieces vs broken pieces
- private label freeze-dried fruit considerations
- bulk freeze-dried fruit buying mistakes
- fruit origin and variety differences
- how tariffs, freight, and yield affect landed cost
- what snack brands should ask before sampling
- foodservice use cases for freeze-dried fruit
- ingredient buyers vs consumer snack buyers

Consumer-facing topics:

- what freeze-dried mango tastes like
- why freeze-dried strawberries taste intense
- best freeze-dried fruit for yogurt bowls
- freeze-dried fruit for kids vs adults
- how to store freeze-dried fruit after opening
- why some pieces are softer than others
- freeze-dried fruit for dessert toppings
- freeze-dried dragon fruit color and taste
- freeze-dried jackfruit texture
- fruit snack shopping guide

## SEO Rules

Each article should have:

- one primary keyword theme
- 3 to 6 secondary keyword phrases
- a clear title
- a summary under roughly 200 characters
- practical takeaways
- at least one section that answers the search query directly

Use keywords naturally. Do not stuff exact phrases.

Important keyword pools:

- freeze-dried fruit
- freeze dried fruit
- freeze-drying process
- freeze-dried fruit quality
- freeze-dried fruit supplier
- water activity
- moisture content
- shelf life
- packaging barrier
- desiccant
- oxygen absorber
- bulk freeze-dried fruit
- freeze-dried fruit ingredients
- freeze-dried fruit for yogurt
- freeze-dried mango
- freeze-dried strawberry

## Build And Validation

After adding articles and images:

1. Run `npm run build`.
2. Confirm the build succeeds.
3. Confirm the article appears in `dist/articles/<slug>/index.html`.
4. Confirm image paths copy into `dist/images/articles/` if a cover image is used.
5. Commit source files and public images. `dist/` is ignored in this repo and does not need to be committed.

## Scheduled Automation Expectations

Each scheduled content run should:

1. Inspect git status and avoid overwriting unrelated user changes.
2. Read this rules file and existing `content/articles/*.md`.
3. Review the current query/topic inventory and choose either one refresh or one
   genuinely new article; do not generate a batch by default.
4. Require primary sources for technical, regulatory, trade, pricing, nutrition,
   safety, and certification claims.
5. Do not create Fruit Reports during scheduled automation.
6. Use a custom SVG for technical/industry work or a single-use local photo for
   consumer work, updating `used-hero-images.json` when required.
7. Run `npm run build` and confirm no future-dated page is emitted.
8. Commit the source article, assets, and usage log only after validation.
9. Attempt push if network allows. If Codex cannot push, the Mac LaunchAgent can push later.
