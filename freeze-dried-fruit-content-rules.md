# Freeze-Dried-Fruit.com Content Rules

Freeze-Dried-Fruit.com is the professional authority hub for freeze-dried fruit. It should feel more technical, research-aware, and industry useful than Best Snack, Shopify blogs, or Vitablabla Journal.

Do not change the existing News Wire automation. The RSS-based News Wire already lives in `config/news-sources.json`, `content/news/feed.json`, `scripts/fetch-news.mjs`, and `.github/workflows/update-news.yml`. Keep that structure intact.

## Publishing Cadence

Default daily output:

- 3 articles per day
- 2 industry / research / technical articles
- 1 consumer-facing article
- 0 Fruit Reports unless specifically requested by the user

Recommended daily split:

- Technical article 1: process, science, packaging, moisture, water activity, defects, equipment, or quality control
- Technical article 2: buyer, supplier, pricing, standards, sourcing, commercial use, or industry trend
- Consumer article: fruit variety, taste, texture, storage, toppings, snack use, or practical shopping question

Fruit Reports are not part of the daily automation. Only write a Fruit Report when the user explicitly asks for one, such as a specific mango, dragon fruit, mangosteen, jackfruit, jujube, berry, or other fruit profile/report.

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

- brand promotion
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

## Cover Strategy

Every article should choose cover type from the content first.

### Technical / Research / Industry Articles

Use a custom SVG cover drawn for that specific article.

Do not rely on the existing reusable `hero` keys for daily automation unless there is no better option. The existing keys (`quality`, `fresh-frozen`, `sugar`, `pricing`, `process`, `moisture`) can stay for old articles and emergency fallback, but daily technical articles should get new article-specific SVGs.

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

Use a real photo from the local image gallery.

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

Daily automation should avoid `Fruit Reports` and choose from `Technology`, `Industry Insights`, `Applications`, or `Labels & Quality`.

If a new category is used, confirm it fits the nav/content model in `config/site.json`.

## Fruit Report Template

Fruit Reports are on-demand only. When the user asks for one, write it as a serious field guide rather than a casual fruit profile.

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

## Automation Expectations

Daily automation should:

1. Inspect git status and avoid overwriting unrelated user changes.
2. Read this rules file and existing `content/articles/*.md`.
3. Create 2 technical/industry articles with custom SVG covers.
4. Create 1 consumer-facing article with a selected local photo when available.
5. Do not create Fruit Reports during daily automation.
6. Update `used-hero-images.json` for any reused-source photo selected as cover.
7. Run `npm run build`.
8. Commit the new Markdown, SVG/photo assets, and usage log.
9. Attempt push if network allows. If Codex cannot push, the Mac LaunchAgent can push later.
