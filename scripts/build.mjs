// Static site builder for Freeze-Dried-Fruit.com.
// Reads:
//   - content/articles/*.md       (one article per file)
//   - content/news/feed.json      (auto-fetched news items)
//   - config/site.json            (site metadata, nav, emails)
//   - config/homepage.json        (which articles appear in the hero/sidebar/guide)
// Writes:
//   - dist/                       (deploy this directory to Pages)
import { mkdir, readFile, copyFile, readdir, stat, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadArticles } from "./lib/articles.mjs";
import { renderHero } from "./lib/illustrations.mjs";
import { Icons } from "./lib/icons.mjs";
import { buildMailto } from "./lib/mailto.mjs";
import { renderPage, escapeHtml, articleUrl, categoryUrl } from "./lib/layout.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

// Subpath support: when GitHub Pages serves the site under
// /freeze-dried-fruit-com/, the workflow sets BASE_PATH so internal links
// (which are written as root-absolute /foo) get rewritten to /<base>/foo.
// SITE_URL overrides the canonical/og:url base for the same reason.
const BASE_PATH = (process.env.BASE_PATH || "").replace(/\/$/, "");

// ---------- Helpers ----------

async function readJson(p) {
  return JSON.parse(await readFile(p, "utf8"));
}

function applyBase(html) {
  if (!BASE_PATH) return html;
  // Match href="/..." and src="/..." but skip protocol-relative //example.com.
  return html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE_PATH}/`);
}

// Renders an article's cover — either a real photo (if cover_image is set
// in frontmatter) or the SVG hero variant. Used everywhere a hero used to
// be: home, sidebar, latest, list rows, article cover, related cards.
function renderCover(article) {
  if (article.cover_image) {
    const alt = article.cover_alt || article.title || "";
    return `<img class="cover-img" src="${escapeHtml(article.cover_image)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`;
  }
  return renderHero(article.hero);
}

// Caption strip rendered over the bottom-left of the main article cover.
// SVG figures get "FIG. — Category"; real photos get either a photo credit
// (if license requires attribution) or just the category.
function coverCaption(article) {
  if (!article.cover_image) return `FIG. — ${escapeHtml(article.category)}`;
  if (!article.cover_credit) return escapeHtml(article.category);
  const credit = escapeHtml(article.cover_credit);
  if (article.cover_credit_url) {
    return `Photo · <a href="${escapeHtml(article.cover_credit_url)}" rel="noopener nofollow" target="_blank" style="color:inherit;border-bottom:1px solid currentColor">${credit}</a>`;
  }
  return `Photo · ${credit}`;
}

async function writeFilePage(relPath, content) {
  const out = path.join(DIST, relPath);
  await mkdir(path.dirname(out), { recursive: true });
  const final = relPath.endsWith(".html") ? applyBase(content) : content;
  await writeFile(out, final, "utf8");
}

async function copyTree(src, dest) {
  const entries = await readdir(src, { withFileTypes: true });
  await mkdir(dest, { recursive: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) await copyTree(s, d);
    else await copyFile(s, d);
  }
}

function pickHomeArticles(articles, homeConfig) {
  const byId = Object.fromEntries(articles.map(a => [a.id, a]));
  const featuredId = homeConfig.auto_latest
    ? articles[0]?.id
    : (homeConfig.featured_id || articles.find(a => a.featured)?.id || articles[0]?.id);
  const sidebarIds = (homeConfig.sidebar_ids || []).filter(id => byId[id] && id !== featuredId);
  const guideId = homeConfig.guide_id && byId[homeConfig.guide_id] ? homeConfig.guide_id : null;

  // Pad sidebar to 2 from most-recent if user didn't list enough.
  while (sidebarIds.length < 2) {
    const next = articles.find(a => a.id !== featuredId && !sidebarIds.includes(a.id) && a.id !== guideId);
    if (!next) break;
    sidebarIds.push(next.id);
  }

  const used = new Set([featuredId, ...sidebarIds, guideId].filter(Boolean));
  const latest = articles.filter(a => !used.has(a.id)).slice(0, homeConfig.latest_count || 4);
  return {
    featured: byId[featuredId],
    sidebar: sidebarIds.map(id => byId[id]).filter(Boolean),
    guide: guideId ? byId[guideId] : null,
    latest,
  };
}

// ---------- Reusable HTML fragments ----------

function exchangeBand({ mailto }) {
  return `
  <section class="section" style="padding-top:0">
    <div class="container">
      <div class="exchange">
        <div>
          <span class="exchange__eyebrow">Industry Exchange · In Development</span>
          <h2 class="exchange__title">Building the Freeze-Dried Fruit Industry Exchange</h2>
        </div>
        <div class="exchange__body">
          <p>Freeze-Dried-Fruit.com is starting as an educational resource, but the category needs more than articles. Suppliers, manufacturers, equipment owners, snack brands, ingredient buyers, and retailers often have a hard time finding each other.</p>
          <p>We are building a lightweight industry exchange to collect and organize information across the freeze-dried fruit ecosystem.</p>
          <div class="exchange__ctas">
            <a href="${mailto.supplier}" class="btn btn-on-dark-primary">Submit Supplier Info ${Icons.arrow}</a>
            <a href="${mailto.equipment}" class="btn btn-on-dark">List Equipment ${Icons.arrow}</a>
            <a href="${mailto.join}" class="btn btn-on-dark">Join the Exchange ${Icons.arrow}</a>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function newsletterBand({ mailto }) {
  return `
  <section>
    <div class="container">
      <div class="newsletter">
        <div>
          <span class="eyebrow">Industry Notes · Occasional dispatch</span>
          <h3>Get freeze-dried fruit industry notes</h3>
          <p>Occasional insights on fruit quality, processing, pricing, sourcing, and category trends.</p>
        </div>
        <div>
          <div class="newsletter__form">
            <input placeholder="you@company.com" type="email">
            <a href="${mailto.notes}" class="btn btn-mint">Join the List ${Icons.arrow}</a>
          </div>
          <p class="muted" style="font-size:13px;margin-top:12px">No spam. Unsubscribe any time.</p>
        </div>
      </div>
    </div>
  </section>`;
}

function renderWireItems(items) {
  return items.map(it => `
    <article class="news-wire__item">
      <div class="news-wire__src">${escapeHtml(it.source || "Wire")}</div>
      <h3 class="news-wire__title"><a href="${escapeHtml(it.link)}" rel="noopener nofollow" target="_blank">${escapeHtml(it.title)}</a></h3>
      <div class="news-wire__meta">${escapeHtml(it.date_label || "")}</div>
    </article>`).join("");
}

function newsWireSection(news, opts = {}) {
  const limit = opts.limit ?? 10;
  const items = (news?.items || []).slice(0, limit);
  if (!items.length) {
    return `
    <section class="section" style="padding-top:0">
      <div class="container">
        <div class="fi-head">
          <div class="fi-head__icon">${Icons.article}</div>
          <h2 class="fi-head__title">News Wire</h2>
        </div>
        <div class="fi-rule"></div>
        <div class="news-wire__empty">News feed warming up — automated updates run every six hours.</div>
      </div>
    </section>`;
  }
  const updated = news.updated_at
    ? new Date(news.updated_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    : "";
  return `
    <section class="section" style="padding-top:0">
      <div class="container">
        <div class="fi-head">
          <div class="fi-head__icon">${Icons.article}</div>
          <h2 class="fi-head__title">News Wire</h2>
        </div>
        <div class="fi-rule"></div>
        <div class="news-wire">${renderWireItems(items)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:16px;gap:16px;flex-wrap:wrap">
          ${updated ? `<p class="muted" style="font-size:12px;margin:0;letter-spacing:0.1em;text-transform:uppercase">Auto-updated · ${escapeHtml(updated)}</p>` : "<span></span>"}
          <a href="/news/" class="btn-arrow">View Full Wire ${Icons.arrowSmall}</a>
        </div>
      </div>
    </section>`;
}

function renderNewsBody({ news }) {
  const items = news?.items || [];
  const updated = news?.updated_at
    ? new Date(news.updated_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    : null;
  const body = items.length
    ? `<div class="news-wire">${renderWireItems(items)}</div>`
    : `<div class="news-wire__empty">News feed warming up — automated updates run every six hours.</div>`;

  return `
    <section class="page-head">
      <div class="container">
        <span class="eyebrow">Wire · ${items.length} ${items.length === 1 ? "story" : "stories"}${updated ? " · auto-updated" : ""}</span>
        <h1>News Wire</h1>
        <p>Automated headlines about freeze-dried fruit, freeze-drying technology, and the broader category. Pulled from RSS feeds every six hours, deduplicated, and sorted newest-first. Click any headline to open the original source.</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        ${body}
        ${updated ? `<p class="muted" style="font-size:12px;margin-top:32px;letter-spacing:0.1em;text-transform:uppercase">Auto-updated · ${escapeHtml(updated)}</p>` : ""}
      </div>
    </section>`;
}

function guideCard(article) {
  const items = (article.takeaways && article.takeaways.length >= 4 ? article.takeaways.slice(0, 4) : [
    "Read ingredient labels beyond front-of-pack claims",
    "Compare real fruit content, added sugar, and fillers",
    "Evaluate format, piece size, texture, and moisture",
    "Calculate true fruit value per ounce",
  ]).map((line, i) => `
    <li><span class="guide-card__num">0${i + 1}</span> ${escapeHtml(stripMd(line))}</li>`).join("");
  return `
    <a href="${articleUrl(article.id)}" class="guide-card">
      <div class="guide-card__eyebrow"><span class="guide-card__dot"></span>Buyer's Field Guide</div>
      <h2 class="guide-card__title">${escapeHtml(article.title)}</h2>
      <p class="guide-card__sum">A practical reference for evaluating freeze-dried fruit on the shelf, in a sample box, or on a supplier spec sheet — from ingredients and fruit content to texture, moisture, format, and true price per ounce.</p>
      <ul class="guide-card__list">${items}</ul>
      <div class="guide-card__cta">Read the Buyer's Guide ${Icons.arrow}</div>
    </a>`;
}

function stripMd(s) {
  return String(s || "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
}

// ---------- Pages ----------

function renderHomeBody({ site, mailto, articles, home, news, homeConfig }) {
  const featured = home.featured;
  const sidebar = home.sidebar;
  const guide = home.guide;
  const latest = home.latest;

  const sidebarHtml = sidebar.map((a, i) => `
    ${i > 0 ? `<div class="feat-side__divider"></div>` : ""}
    <article class="feat-side__item">
      <a href="${articleUrl(a.id)}" style="display:block;color:inherit">
        <div class="feat-side__img">${renderCover(a)}</div>
        <h3 class="feat-side__title">${escapeHtml(a.title)}</h3>
        <p class="feat-side__sum">${escapeHtml(a.summary)}</p>
        <div class="feat-side__byline">${escapeHtml(a.category)} · ${escapeHtml(a.dateLabel)}</div>
      </a>
    </article>`).join("");

  const latestHtml = latest.map(a => `
    <article class="latest__item">
      <a href="${articleUrl(a.id)}" style="display:contents;color:inherit">
        <div class="latest__img">${renderCover(a)}</div>
        <div>
          <div class="latest__cat">${escapeHtml(a.category)}</div>
          <h3 class="latest__title">${escapeHtml(a.title)}</h3>
          <p class="latest__sum">${escapeHtml(a.summary)}</p>
          <div class="latest__date">${escapeHtml(a.dateLabel)} · ${escapeHtml(a.read)}</div>
        </div>
      </a>
    </article>`).join("");

  return `
  <div class="container">
    <div class="home-hero">
      <div class="home-hero__main">
        <article class="home-hero__article">
          <a href="${articleUrl(featured.id)}" style="display:block;color:inherit">
            <div class="home-hero__media">${renderCover(featured)}</div>
            <div class="home-hero__cat">${escapeHtml(featured.category)}</div>
            <h1 class="home-hero__title">${escapeHtml(featured.title)}</h1>
            <p class="home-hero__sum">${escapeHtml(featured.summary)}</p>
            <div class="home-hero__byline">FreezeDriedFruit Editorial · ${escapeHtml(featured.dateLabel)} · ${escapeHtml(featured.read)}</div>
          </a>
        </article>
        ${guide ? guideCard(guide) : ""}
      </div>

      <aside class="home-hero__sidebar">
        <div class="fi-head">
          <div class="fi-head__icon">${Icons.article}</div>
          <h2 class="fi-head__title">Featured Insight</h2>
        </div>
        <div class="fi-rule"></div>
        ${sidebarHtml}
        <a href="/articles/" class="more-link">More Insights ${Icons.arrow}</a>
      </aside>
    </div>
  </div>

  <section class="section" style="padding-top:24px">
    <div class="container">
      <div class="fi-head">
        <div class="fi-head__icon">${Icons.article}</div>
        <h2 class="fi-head__title">Latest News</h2>
      </div>
      <div class="fi-rule"></div>
      <div class="latest">${latestHtml}</div>
      <div style="text-align:right;padding-top:16px">
        <a href="/articles/" class="btn-arrow">More Articles ${Icons.arrowSmall}</a>
      </div>
    </div>
  </section>

  ${homeConfig.show_news_section ? newsWireSection(news) : ""}

  ${exchangeBand({ mailto })}
  ${newsletterBand({ mailto })}`;
}

function renderArticlesIndex({ articles, category }) {
  const filtered = category ? articles.filter(a => a.category === category) : articles;
  const headTitle = category || "All Articles";
  const headSub = category
    ? `Articles filed under ${category}.`
    : "Long-form explainers, label analysis, and category notes from the freeze-dried fruit space.";
  const eyebrow = category ? "Section" : "The Archive";

  const rows = filtered.map(a => `
    <article class="list__row">
      <a href="${articleUrl(a.id)}" style="display:contents;color:inherit">
        <div class="list__img">${renderCover(a)}</div>
        <div>
          <div class="list__cat">${escapeHtml(a.category)}</div>
          <h3 class="list__title">${escapeHtml(a.title)}</h3>
          <p class="list__sum">${escapeHtml(a.summary)}</p>
        </div>
        <div class="list__meta">
          <span>${escapeHtml(a.dateLabel)}</span>
          <span>${escapeHtml(a.read)}</span>
        </div>
      </a>
    </article>`).join("");

  const empty = `
    <div style="padding:80px 0;text-align:center;color:var(--muted)">
      <p>No articles published in this section yet.</p>
      <p>We're working on it — <a href="/contact/" style="color:var(--mint-deep)">get in touch</a> for updates.</p>
    </div>`;

  return `
    <section class="page-head">
      <div class="container">
        <span class="eyebrow">${eyebrow} · ${filtered.length} ${filtered.length === 1 ? "article" : "articles"}</span>
        <h1>${escapeHtml(headTitle)}</h1>
        <p>${escapeHtml(headSub)}</p>
      </div>
    </section>
    <div class="container">
      <div class="list">${filtered.length ? rows : empty}</div>
    </div>`;
}

function renderArticle({ article, related, mailto }) {
  const intro = article.intro || article.summary;
  const takeaways = article.takeaways && article.takeaways.length
    ? `<div class="takeaways">
         <div class="takeaways__title">Key Takeaways</div>
         <ul>${article.takeaways.map(t => `<li>${renderInlineMd(t)}</li>`).join("")}</ul>
       </div>` : "";

  const relatedHtml = related.map(r => `
    <a href="${articleUrl(r.id)}" class="related__card" style="display:block;color:inherit">
      <div class="related__img">${renderCover(r)}</div>
      <div class="related__cat">${escapeHtml(r.category)}</div>
      <h4 class="related__title">${escapeHtml(r.title)}</h4>
    </a>`).join("");

  return `
    <article>
      <div class="container-narrow article-head">
        <div class="article-head__meta">
          <span class="accent">${escapeHtml(article.category)}</span>
          <span>${escapeHtml(article.dateLabel)}</span>
          <span>${escapeHtml(article.read)}</span>
        </div>
        <h1>${escapeHtml(article.title)}</h1>
        <p class="article-head__intro">${escapeHtml(intro)}</p>
      </div>

      <div class="container-narrow">
        <div class="article-cover">
          ${renderCover(article)}
          <div class="article-cover__caption">${coverCaption(article)}</div>
        </div>
      </div>

      <div class="container-narrow article-body">
        ${takeaways}
        ${article.bodyHtml}

        <div class="exchange-cta">
          <div>
            <strong>Have category insight to share?</strong>
            <div class="muted" style="font-size:14px;margin-top:4px">Suppliers, equipment owners, and operators can submit notes for future articles.</div>
          </div>
          <a href="${mailto.join}" class="btn btn-primary">Join the Exchange ${Icons.arrow}</a>
        </div>

        ${related.length ? `
        <div class="related">
          <h3>Related Reading</h3>
          <div class="related__grid">${relatedHtml}</div>
        </div>` : ""}
      </div>
    </article>`;
}

// Tiny inline-markdown renderer for takeaway list items: handles **bold** and *italic*.
function renderInlineMd(s) {
  const escaped = escapeHtml(s);
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
}

function renderExchangeBody({ mailto }) {
  const cards = [
    { num: "01 / 04", title: "Suppliers & Manufacturers", body: "For freeze-dried fruit producers, private-label manufacturers, bulk ingredient suppliers, and fruit powder suppliers who want to be included in future directory resources.", cta: "Submit Supplier Info", href: mailto.supplier },
    { num: "02 / 04", title: "Equipment & Used Freeze Dryers", body: "For companies or individuals selling, buying, or researching commercial freeze-drying equipment, used freeze dryers, packaging tools, and related production resources.", cta: "List Equipment", href: mailto.equipment },
    { num: "03 / 04", title: "Brands, Buyers & Retailers", body: "For snack brands, retailers, ingredient buyers, distributors, and operators exploring freeze-dried fruit products, private label, or bulk sourcing.", cta: "Submit Buyer Request", href: mailto.buyer },
    { num: "04 / 04", title: "Community Exchange", body: "For people building, buying, selling, researching, or simply curious about freeze-dried fruit.", cta: "Join the Exchange", href: mailto.join },
  ];
  const who = [
    "Freeze-dried fruit suppliers", "Private-label manufacturers", "Bulk ingredient sellers",
    "Commercial equipment owners", "Used freeze dryer sellers", "Snack brands",
    "Retail buyers", "Distributors", "Researchers & observers",
  ];

  const cardsHtml = cards.map(c => `
    <div class="exch-card">
      <div class="exch-card__num">${c.num}</div>
      <h3 class="exch-card__title">${escapeHtml(c.title)}</h3>
      <p class="exch-card__body">${escapeHtml(c.body)}</p>
      <a href="${c.href}" class="btn btn-primary" style="align-self:flex-start">${escapeHtml(c.cta)} ${Icons.arrow}</a>
    </div>`).join("");

  const whoHtml = who.map(w => `<li>${escapeHtml(w)}</li>`).join("");

  return `
    <section class="page-head">
      <div class="container">
        <span class="eyebrow">Industry Exchange · In Development</span>
        <h1>Building the Freeze-Dried Fruit Industry Exchange.</h1>
        <p>Freeze-Dried-Fruit.com is starting as an educational resource, but the category needs more than articles. Suppliers, manufacturers, equipment owners, snack brands, ingredient buyers, and retailers often have a hard time finding each other. We are building a lightweight industry exchange to collect and organize information across the ecosystem.</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="fi-head"><div class="fi-head__icon">${Icons.article}</div><h2 class="fi-head__title">Who this is for</h2></div>
        <div class="fi-rule"></div>
        <ul class="who-list">${whoHtml}</ul>
      </div>
    </section>

    <section class="section" style="padding-top:0">
      <div class="container">
        <div class="fi-head"><div class="fi-head__icon">${Icons.article}</div><h2 class="fi-head__title">Four ways to participate</h2></div>
        <div class="fi-rule"></div>
        <div class="exch-grid">${cardsHtml}</div>
      </div>
    </section>

    <section class="section" style="padding-top:0">
      <div class="container">
        <div class="note-box" style="max-width:720px">
          <div class="note-box__label">A note on what this is</div>
          For now, this is a simple information exchange — not a marketplace, not a directory, not a paid service. If you want to be included in future supplier lists, equipment listings, buyer requests, or industry updates, contact us. We'll respond personally.
        </div>
      </div>
    </section>`;
}

function renderAboutBody({ mailto }) {
  return `
    <section class="page-head">
      <div class="container">
        <span class="eyebrow">About · Independent</span>
        <h1>About Freeze-Dried-Fruit.com</h1>
        <p>An independent field guide to the freeze-dried fruit category.</p>
      </div>
    </section>
    <section class="section">
      <div class="container-narrow">
        <div class="prose">
          <p>Freeze-Dried-Fruit.com is an independent field guide to the freeze-dried fruit category — written for everyone who eats it, makes it, or sells it.</p>
          <p>If you've ever stood in a snack aisle wondering why one bag of freeze-dried strawberries costs three times more than another, why some are crispy and others soft, or why some have sugar listed on the label and others don't — this site is for you.</p>
          <p>If you're a snack founder, ingredient buyer, supplier, equipment owner, retailer, or category researcher trying to understand how the freeze-dried fruit ecosystem actually works — sourcing, processing, moisture targets, packaging, pricing, private label — this site is also for you.</p>
          <p style="font-family:var(--titles);font-size:28px;line-height:1.3;color:var(--ink);margin:32px 0;font-weight:700;letter-spacing:-0.015em">Our goal is simple: <em style="color:var(--mint-deep);font-style:italic">make freeze-dried fruit easier to understand.</em></p>
          <p>For consumers, that means clear, honest answers to questions you've actually had: What's in the bag? Why does the texture change after opening? Is a heavier bag really more fruit? How do you compare two products that look almost identical? We translate technical realities into plain language.</p>
          <p>For industry, that means transparent reporting on processing methods, ingredient choices, sourcing trade-offs, packaging, and the parts of the category that don't usually get written about. We talk to suppliers, equipment owners, and operators to get details that go beyond marketing.</p>
          <p>We believe the category deserves more transparency around fruit sourcing, processing methods, added ingredients, moisture control, packaging, price comparison, and real fruit value — and that consumers and industry benefit when the same information is available to both.</p>
          <p>Freeze-Dried-Fruit.com is created by a team building in the fruit snack space. We may occasionally reference our own product development experience, but this site is built as a broader educational and industry resource.</p>
        </div>

        <div class="exchange-cta">
          <div>
            <strong>Want to contribute or be included?</strong>
            <div class="muted" style="font-size:14px;margin-top:4px">Suppliers, operators, and observers welcome.</div>
          </div>
          <a href="${mailto.join}" class="btn btn-primary">Join the Exchange ${Icons.arrow}</a>
        </div>
      </div>
    </section>`;
}

function renderContactBody({ site, mailto }) {
  return `
    <section class="page-head">
      <div class="container">
        <span class="eyebrow">Contact</span>
        <h1>Contact</h1>
        <p>Have a question, supplier note, equipment listing, buyer request, or industry insight to share? We'd love to hear from you.</p>
      </div>
    </section>
    <section>
      <div class="container">
        <div class="contact-grid">
          <div>
            <div class="contact-line">
              <div class="contact-line__label">General Inquiries</div>
              <a href="${mailto.hello}">${site.email.hello}</a>
            </div>
            <div class="contact-line">
              <div class="contact-line__label">Industry Exchange & Trade</div>
              <a href="${mailto.join}">${site.email.industry}</a>
            </div>
            <div class="contact-line">
              <div class="contact-line__label">Press & Editorial</div>
              <a href="${mailto.press}">${site.email.press}</a>
            </div>
            <p class="muted" style="margin-top:32px;max-width:50ch">We typically respond within 1–2 business days. For supplier and equipment submissions, please use the structured forms — they help us route information to the right place.</p>
          </div>
          <aside class="contact-side">
            <h4>Quick actions</h4>
            <p class="muted" style="font-size:14px;margin:0 0 8px">Pre-filled email templates for common requests.</p>
            <a href="${mailto.supplier}" class="btn btn-ghost">Submit Supplier Info ${Icons.arrow}</a>
            <a href="${mailto.equipment}" class="btn btn-ghost">List Equipment ${Icons.arrow}</a>
            <a href="${mailto.join}" class="btn btn-primary">Join the Exchange ${Icons.arrow}</a>
          </aside>
        </div>
      </div>
    </section>`;
}

function renderPrivacyBody({ site }) {
  const helloLink = `<a href="mailto:${site.email.hello}" style="color:var(--mint-deep)">${site.email.hello}</a>`;
  return `
    <section class="page-head">
      <div class="container">
        <span class="eyebrow">Legal · Privacy</span>
        <h1>Privacy Policy</h1>
        <p>Effective Date: May 8, 2026</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="article-body" style="max-width:760px">
          <p class="article-lead">Welcome to Freeze-Dried Fruit ("we," "our," or "us"). This Privacy Policy explains how we collect, use, disclose, and protect information when you visit freeze-dried-fruit.com or interact with us through our website, email links, industry exchange forms, supplier submissions, equipment listing requests, buyer inquiries, newsletter signups, or other communication channels.</p>
          <p>By using this website, you agree to the practices described in this Privacy Policy.</p>
          <h2>1. Information We Collect</h2>
          <h3>Information You Provide Voluntarily</h3>
          <p>You may choose to provide information when you contact us by email; submit supplier or manufacturer information; submit equipment listing information; submit a buyer or retailer request; join our industry exchange or newsletter list; or share feedback, questions, or industry insights with us.</p>
          <p>This information may include name, email address, company name, role or title, website, country or region, product or service information, supplier/manufacturer/buyer/equipment details, certifications, MOQ, production capabilities, sourcing preferences, or any other information you choose to include in your message.</p>
          <h3>Automatically Collected Information</h3>
          <p>When you visit our website, certain information may be collected automatically, such as IP address, browser type, device type, operating system, pages visited, referring URLs, approximate location based on IP address, time and date of visit, and general website usage data.</p>
          <h2>2. How We Use Information</h2>
          <p>We may use the information we collect to respond to your inquiries; review supplier, manufacturer, buyer, or equipment submissions; build and improve our industry exchange resources; communicate with you about industry-related opportunities or updates; send newsletters or industry notes if you choose to join; improve our website, content, and user experience; analyze website traffic and performance; maintain website security; prevent spam, abuse, or unauthorized activity; and comply with applicable legal obligations.</p>
          <h2>3. Industry Exchange Submissions</h2>
          <p>If you submit information for possible inclusion in future industry resources, directories, listings, or exchange opportunities, we may review and organize that information internally. We will not publish your personal contact details publicly without permission.</p>
          <h2>4. Email Communications</h2>
          <p>If you contact us by email or click a mailto link on our website, your email address and message content will be shared with us through your email provider. You may unsubscribe at any time by contacting us at ${helloLink}.</p>
          <h2>5. Cookies and Analytics</h2>
          <p>Our website may use cookies or similar technologies to understand website traffic, measure article performance, improve content and navigation, maintain website security, and remember basic preferences. We may use analytics tools such as Cloudflare Web Analytics or similar services.</p>
          <h2>6. Third-Party Services</h2>
          <p>We may use third-party service providers to operate and improve the website, including services for website hosting, domain and DNS management, analytics, email communication, spam protection, newsletter management, and form handling.</p>
          <h2>7. How We Share Information</h2>
          <p><strong>We do not sell your personal information.</strong> We may share information with service providers who help us operate the website, with your permission, to comply with legal obligations, or to protect our rights, safety, website, users, or the public.</p>
          <h2>8. Data Retention</h2>
          <p>We retain information for as long as reasonably necessary to respond to inquiries, maintain business records, build and manage industry exchange resources, improve our website and content, comply with legal obligations, or resolve disputes or enforce agreements.</p>
          <h2>9. Your Rights and Choices</h2>
          <p>You may have certain rights regarding your personal information, including the right to access, correct, delete, or port your data. To make a request, contact us at ${helloLink}.</p>
          <h2>10. Children's Privacy</h2>
          <p>This website is not intended for children under 13, and we do not knowingly collect personal information from children under 13.</p>
          <h2>11. Security</h2>
          <p>We take reasonable measures to protect information from unauthorized access, loss, misuse, alteration, or disclosure. However, no website, email system, or online transmission is completely secure.</p>
          <h2>12. International Visitors</h2>
          <p>By using the website or submitting information, you understand that your information may be transferred to and processed outside your country of residence.</p>
          <h2>13. Changes to This Privacy Policy</h2>
          <p>We may update this Privacy Policy from time to time. When we make changes, we will update the "Effective Date" at the top of this page.</p>
          <h2>14. Contact Us</h2>
          <p>If you have questions about this Privacy Policy, or if you want to access, correct, or delete your information, please contact us:</p>
          <div class="note-box">
            <strong>Freeze-Dried Fruit</strong><br>
            Email: ${helloLink}<br>
            Website: freeze-dried-fruit.com
          </div>
        </div>
      </div>
    </section>`;
}

// ---------- RSS feed for the site itself ----------
function buildRssFeed({ site, articles }) {
  const items = articles.slice(0, 20).map(a => `
    <item>
      <title>${escapeHtml(a.title)}</title>
      <link>${site.url}${articleUrl(a.id)}</link>
      <guid isPermaLink="true">${site.url}${articleUrl(a.id)}</guid>
      <category>${escapeHtml(a.category)}</category>
      <pubDate>${a.date ? a.date.toUTCString() : new Date().toUTCString()}</pubDate>
      <description>${escapeHtml(a.summary)}</description>
    </item>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${escapeHtml(site.title)}</title>
<link>${site.url}</link>
<description>${escapeHtml(site.description)}</description>
<language>en-US</language>
<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel></rss>`;
}

function buildSitemap({ site, articles }) {
  const urls = [
    "/",
    "/articles/",
    "/news/",
    "/exchange/",
    "/about/",
    "/contact/",
    "/privacy/",
    ...articles.map(a => articleUrl(a.id)),
  ];
  // Categories
  const cats = [...new Set(articles.map(a => a.category))];
  for (const c of cats) urls.push(categoryUrl(c));
  const items = urls.map(u => `<url><loc>${site.url}${u}</loc></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</urlset>`;
}

// ---------- Build orchestration ----------

async function build() {
  console.log("→ build: starting");
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const [site, homeConfig, news] = await Promise.all([
    readJson(path.join(ROOT, "config", "site.json")),
    readJson(path.join(ROOT, "config", "homepage.json")),
    readJson(path.join(ROOT, "content", "news", "feed.json")).catch(() => ({ items: [] })),
  ]);
  if (process.env.SITE_URL) site.url = process.env.SITE_URL.replace(/\/$/, "");
  const mailto = buildMailto(site.email);
  const articles = await loadArticles(path.join(ROOT, "content", "articles"));
  console.log(`→ build: ${articles.length} articles loaded`);

  const home = pickHomeArticles(articles, homeConfig);
  if (!home.featured) throw new Error("No articles found — add a Markdown file under content/articles/");

  // Home
  const homeBody = renderHomeBody({ site, mailto, articles, home, news, homeConfig });
  await writeFilePage("index.html", renderPage({
    site, mailto, currentPath: "/", title: null, description: null, body: homeBody, screen: "home",
  }));

  // All articles
  await writeFilePage("articles/index.html", renderPage({
    site, mailto, currentPath: "/articles/", title: "All Articles",
    description: "Long-form explainers, label analysis, and category notes from the freeze-dried fruit space.",
    body: renderArticlesIndex({ articles, category: null }), screen: "articles",
  }));

  // Articles by category — include both categories that have articles AND
  // categories referenced from the nav (so a nav link to "Fruit Reports"
  // resolves to a valid empty-state page until the first article lands).
  const articleCats = new Set(articles.map(a => a.category));
  const navCats = (site.nav || []).filter(n => n.category).map(n => n.category);
  const cats = [...new Set([...articleCats, ...navCats])];
  for (const c of cats) {
    await writeFilePage(`${categoryUrl(c).slice(1)}index.html`, renderPage({
      site, mailto, currentPath: categoryUrl(c), title: c,
      description: `Articles filed under ${c}.`,
      body: renderArticlesIndex({ articles, category: c }), screen: "articles-cat",
    }));
  }

  // Individual articles
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const related = articles.filter(x => x.id !== a.id).slice(0, 3);
    await writeFilePage(`articles/${a.id}/index.html`, renderPage({
      site, mailto, currentPath: articleUrl(a.id), title: a.title, description: a.summary,
      body: renderArticle({ article: a, related, mailto }), screen: "article",
    }));
  }

  // Static pages
  await writeFilePage("exchange/index.html", renderPage({
    site, mailto, currentPath: "/exchange/", title: "Industry Exchange",
    description: "Suppliers, equipment, buyers — connect across the freeze-dried fruit ecosystem.",
    body: renderExchangeBody({ mailto }), screen: "exchange",
  }));
  await writeFilePage("about/index.html", renderPage({
    site, mailto, currentPath: "/about/", title: "About",
    description: "An independent field guide to the freeze-dried fruit category.",
    body: renderAboutBody({ mailto }), screen: "about",
  }));
  await writeFilePage("contact/index.html", renderPage({
    site, mailto, currentPath: "/contact/", title: "Contact",
    description: "Get in touch with the team behind Freeze-Dried-Fruit.com.",
    body: renderContactBody({ site, mailto }), screen: "contact",
  }));
  await writeFilePage("privacy/index.html", renderPage({
    site, mailto, currentPath: "/privacy/", title: "Privacy Policy",
    description: "How we handle information on Freeze-Dried-Fruit.com.",
    body: renderPrivacyBody({ site }), screen: "privacy",
  }));
  await writeFilePage("news/index.html", renderPage({
    site, mailto, currentPath: "/news/", title: "News Wire",
    description: "Auto-updated headlines about freeze-dried fruit and freeze-drying technology.",
    body: renderNewsBody({ news }), screen: "news",
  }));

  // Feeds
  await writeFilePage("feed.xml", buildRssFeed({ site, articles }));
  await writeFilePage("sitemap.xml", buildSitemap({ site, articles }));
  await writeFilePage("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);

  // Static assets
  await copyTree(path.join(ROOT, "public"), DIST);

  // home + articles-index + N categories + N articles + 5 static + 3 feeds
  console.log(`→ build: wrote ${articles.length + cats.length + 10} pages to dist/`);
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
