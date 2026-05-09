# Freeze-Dried-Fruit.com

Editorial site for the freeze-dried fruit field guide. Markdown articles and JSON config compile to static HTML, ready for GitHub Pages or Cloudflare Pages. The News Wire on the homepage is auto-refreshed by a GitHub Action.

## Quick start

```bash
npm install
npm run build       # writes dist/
npm run dev         # build + preview at http://localhost:8080
```

## Daily article workflow

Each article is a single Markdown file under `content/articles/`. The filename (without `.md`) becomes the URL slug.

```bash
# 1. Scaffold a new article (creates content/articles/<slug>.md with frontmatter)
npm run new-article -- "Why Banana Slices Stay Crisp Longer"
npm run new-article -- "Mango Sourcing in 2026" --category="Fruit Reports" --hero=fresh-frozen

# 2. Edit the new file. Frontmatter looks like:
# ---
# title: "Why Banana Slices Stay Crisp Longer"
# category: "Technology"
# date: 2026-05-09
# hero: process            # quality | fresh-frozen | sugar | pricing | process | moisture
# read: "5 min read"
# summary: "Short card/meta summary."
# intro: "Optional italic intro shown above the cover image."
# takeaways:
#   - "First key bullet"
#   - "Second key bullet"
# ---
#
# Body in Markdown — headings, lists, **bold**, *italic*, [links], > blockquotes,
# and the custom `::: note "Label" ... :::` block all render with the design system.

# 3. Build and preview
npm run build && npm run dev
```

To publish, commit the new `.md` and push. The GitHub Action rebuilds and redeploys automatically.

To unpublish without deleting, set `draft: true` in the frontmatter.

## Changing the homepage features

Open [`config/homepage.json`](config/homepage.json):

```json
{
  "auto_latest": false,                                       // true = use most recent article as featured
  "featured_id": "quality-varies",                            // big left-column story
  "sidebar_ids": ["added-sugar", "fresh-vs-frozen"],          // 2 stacked sidebar items
  "guide_id": "buyer-guide",                                  // dark Buyer's Guide card
  "latest_count": 4,
  "show_news_section": true
}
```

Each ID matches a filename in `content/articles/` (without `.md`). Set `auto_latest: true` and the featured slot always shows the newest published article — useful if you want zero homepage maintenance.

## News Wire (auto-updated)

The Wire under "Latest News" pulls items from the RSS feeds in `config/news-sources.json`. The `update-news` GitHub Action runs every 6 hours, refreshes `content/news/feed.json`, commits it, and that commit triggers the build/deploy workflow.

To run the fetcher manually:

```bash
npm run fetch-news
```

To change sources, edit `config/news-sources.json`:

```json
{
  "limit_per_source": 6,
  "total_limit": 12,
  "sources": [
    { "name": "Google News — freeze-dried fruit", "url": "https://news.google.com/rss/search?q=…" }
  ]
}
```

## Deployment

### Cloudflare Pages (current setup)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize GitHub, pick this repo.
3. Build command: `npm run build`. Build output directory: `dist`.
4. Save and Deploy.

Cloudflare watches `main` and rebuilds on every push — including the automated commits from the news-update workflow. No secrets, no GitHub Actions deploy step needed.

### GitHub Pages (alternative)

The build is path-portable: set `BASE_PATH=/<repo>` and `SITE_URL=https://<owner>.github.io/<repo>` and the emitted HTML uses the right prefixes. To deploy via GitHub Actions, restore a workflow with `actions/configure-pages@v5` (with `enablement: true`), `actions/upload-pages-artifact@v3`, and `actions/deploy-pages@v4`, and pass those env vars to `npm run build`. Pages must be enabled with **Source: GitHub Actions** in the repo settings before the first run.

### Custom domain

After connecting the deploy target, add `freeze-dried-fruit.com` in the host's DNS / domain settings. Update `url` in [`config/site.json`](config/site.json) so canonical/Open Graph URLs resolve correctly.

## Automation push (CI / external triggers)

| Trigger                                 | Effect                                                                |
| --------------------------------------- | --------------------------------------------------------------------- |
| `git push` to `main`                    | Cloudflare Pages auto-rebuilds and deploys                            |
| `gh workflow run "Auto-update News"`    | Pull RSS now (auto-commits `feed.json` if there are new items)        |
| Cron `0 */6 * * *` (in update-news.yml) | Runs the news fetch every six hours; commits trigger a redeploy       |

To force a redeploy from any external system, just push an empty commit to `main`:

```bash
git commit --allow-empty -m "redeploy" && git push
```

Or trigger the news fetch from the GitHub API:

```bash
curl -X POST -H "Authorization: Bearer $GH_TOKEN" \
  https://api.github.com/repos/<owner>/<repo>/actions/workflows/update-news.yml/dispatches \
  -d '{"ref":"main"}'
```

## Project layout

```
content/
  articles/         daily-update Markdown articles (the only thing you usually edit)
  news/feed.json    auto-generated by fetch-news.mjs — do not edit by hand
config/
  site.json         site title, nav links, email addresses
  homepage.json     which articles appear on the homepage
  news-sources.json RSS feeds for the News Wire
public/             static assets copied verbatim into dist/ (CSS, _headers, _redirects)
scripts/
  build.mjs         main builder
  fetch-news.mjs    RSS poller
  new-article.mjs   article scaffolder
  serve.mjs         local preview server
  lib/              shared modules (layout, illustrations, icons, mailto, articles)
.github/workflows/
  update-news.yml   fetches news every 6 hours, commits feed.json (triggers Cloudflare rebuild)
```

## Hero illustrations

The six SVG hero variants live in [`scripts/lib/illustrations.mjs`](scripts/lib/illustrations.mjs). Pick one with the `hero:` frontmatter key:

| Key            | Visual                          |
| -------------- | ------------------------------- |
| `quality`      | Three jars, fill-level variance |
| `fresh-frozen` | Sun + snowflake split panel     |
| `sugar`        | Sugar-cube grid + ingredients   |
| `pricing`      | Two product comparison cards    |
| `process`      | Four-step freeze-drying diagram |
| `moisture`     | Drop + moisture-over-time chart |

To add a seventh, drop a new function in `illustrations.mjs` and register it in `HEROES`.
