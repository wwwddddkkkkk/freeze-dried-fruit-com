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

### GitHub Pages (default)

1. Push the repo to GitHub.
2. Settings → Pages → Source: **GitHub Actions**.
3. The included `Build & Deploy` workflow handles the rest. First deploy creates the site; subsequent commits update it.

### Cloudflare Pages

Two options — pick one:

**A. Connect the GitHub repo (recommended):**
1. Cloudflare dashboard → Workers & Pages → Create → connect your GitHub repo.
2. Build command: `npm run build`. Output directory: `dist`.
3. Cloudflare deploys on every push. No secrets needed.

**B. Wrangler from GitHub Actions:**
1. In the repo: Settings → Secrets → add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
2. Uncomment the "Deploy to Cloudflare Pages" step in [.github/workflows/deploy.yml](.github/workflows/deploy.yml).
3. Make sure the `--project-name` matches what you created in the dashboard.

### Custom domain

After connecting the deploy target, add `freeze-dried-fruit.com` in the host's DNS / domain settings. Update `url` in [`config/site.json`](config/site.json) so canonical/Open Graph URLs resolve correctly.

## Automation push (CI / external triggers)

Three useful entry points the deploy workflow already exposes:

| Trigger                              | Effect                                              |
| ------------------------------------ | --------------------------------------------------- |
| `git push` to `main`                 | Full rebuild + deploy                               |
| `gh workflow run "Build & Deploy"`   | Manual rebuild without a code change                |
| `gh workflow run "Auto-update News"` | Pull RSS now (auto-commits if there are new items)  |
| Cron `0 */6 * * *`                   | Auto-runs the news fetch every six hours            |
| Cron `0 6 * * *`                     | Daily safety-net rebuild (refreshes feeds/sitemaps) |

To kick off a deploy from any external system, hit the GitHub API:

```bash
curl -X POST -H "Authorization: Bearer $GH_TOKEN" \
  https://api.github.com/repos/<owner>/<repo>/actions/workflows/deploy.yml/dispatches \
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
  deploy.yml        builds and deploys on every push (+ daily cron)
  update-news.yml   fetches news every 6 hours, commits feed.json
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
