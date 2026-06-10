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

import { loadArticles, renderMarkdown } from "./lib/articles.mjs";
import { loadPillars, extractTocFromHtml, ensureH2Anchors } from "./lib/pillars.mjs";
import { loadReports } from "./lib/reports.mjs";
import { t as iT, categoryLabel as iCategoryLabel } from "./lib/i18n.mjs";
import {
  GLOSSARY_EN,
  GLOSSARY_ES,
  GLOSSARY_CATEGORY_ORDER_EN,
  GLOSSARY_CATEGORY_ORDER_ES,
  GLOSSARY_LABELS,
} from "./lib/glossary-data.mjs";
import {
  FRUIT_EQUIVALENCY,
  CLIMATE_ZONES,
  SHELF_LIFE_OPTIONS,
  PACK_SIZES,
  FRAGILITY_LEVELS,
  BASE_BARRIER_TARGETS,
} from "./lib/calculators-data.mjs";
import { FRUIT_DATA, SLUG_TO_FRUIT, clusterForFruit, buildComparisonPairs, comparePathFor, CLUSTERS } from "./lib/fruit-data.mjs";
import { renderHero } from "./lib/illustrations.mjs";
import { Icons } from "./lib/icons.mjs";
import { buildMailto } from "./lib/mailto.mjs";
import { renderPage as renderPageRaw, escapeHtml, articleUrl, categoryUrl } from "./lib/layout.mjs";
import {
  renderArticleOgSvg, renderSiteOgSvg, rasterize,
  OG_WIDTH, OG_HEIGHT,
} from "./lib/og-images.mjs";

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

// Build a per-locale i18n object that closes over `lang` and exposes the
// two helpers layout.mjs expects: t(key) and categoryLabel(name).
function makeI18n(lang) {
  return {
    t: (key) => iT(lang, key),
    categoryLabel: (name) => iCategoryLabel(lang, name),
  };
}
const I18N_EN = makeI18n("en");
const I18N_ES = makeI18n("es");

// renderPage wrapper that injects the correct i18n object for the page's
// locale (defaulting to English). Every existing call site continues to
// work without modification; new bilingual pages pass `lang` and
// `alternates` explicitly.
function renderPage(opts) {
  const lang = opts.lang || "en";
  const i18n = opts.i18n || (lang === "es" ? I18N_ES : I18N_EN);
  return renderPageRaw({ ...opts, lang, i18n });
}

function applyBase(html) {
  if (!BASE_PATH) return html;
  // Match href="/..." and src="/..." but skip protocol-relative //example.com.
  return html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE_PATH}/`);
}

// Renders an article's cover — either a real photo (if cover_image is set
// in frontmatter) or the SVG hero variant. Used everywhere a hero used to
// be: home, sidebar, latest, list rows, article cover, related cards.
//
// When intrinsic dimensions were auto-detected at load time, we emit
// explicit width / height attributes — eliminating CLS on Core Web Vitals
// and giving Google a stable layout signal before the image loads.
function renderCover(article) {
  if (article.cover_image) {
    const alt = article.cover_alt || article.title || "";
    const dimAttrs = (article.cover_width && article.cover_height)
      ? ` width="${article.cover_width}" height="${article.cover_height}"`
      : "";
    return `<img class="cover-img" src="${escapeHtml(article.cover_image)}" alt="${escapeHtml(alt)}"${dimAttrs} loading="lazy" decoding="async">`;
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

// ---------- Structured data (JSON-LD) ----------

// Resolve a path or relative URL to an absolute URL using the site origin.
function absUrl(site, p) {
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  const origin = site.url.replace(/\/$/, "");
  return `${origin}${p.startsWith("/") ? "" : "/"}${p}`;
}

function schemaLanguage(lang = "en") {
  return lang === "es" ? "es" : "en-US";
}

function organizationNode(site) {
  const node = {
    "@type": "Organization",
    "@id": `${site.url}/#organization`,
    name: "Freeze-Dried-Fruit.com",
    url: site.url,
    logo: {
      "@type": "ImageObject",
      url: absUrl(site, "/favicon.svg"),
    },
    email: site.email?.hello,
    sameAs: [],
  };
  if (site.editorial) {
    node.subOrganization = { "@id": `${site.url}/#editorial` };
  }
  return node;
}

function websiteNode(site) {
  return {
    "@type": "WebSite",
    "@id": `${site.url}/#website`,
    url: site.url,
    name: site.title,
    description: site.description,
    inLanguage: "en-US",
    publisher: { "@id": `${site.url}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${site.url}/search/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

function breadcrumbsNode(site, trail) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: absUrl(site, step.path),
    })),
  };
}

// The editorial collective is an Organization sub-entity of the publisher.
// Returns the same shape we use everywhere we credit "the editorial desk" —
// stable @id, parent reference, and a URL pointing at /editorial/ where the
// E-E-A-T context (who we are, how we work, what we won't do) lives.
function editorialNode(site) {
  const byline = site.editorial?.byline || "Editorial Desk";
  const url = absUrl(site, site.editorial?.url || "/editorial/");
  return {
    "@type": "Organization",
    "@id": `${site.url}/#editorial`,
    name: byline,
    url,
    description: site.editorial?.tagline || "Independent editorial team covering the freeze-dried fruit category.",
    parentOrganization: { "@id": `${site.url}/#organization` },
  };
}

function editorialPageJsonLd({ site }) {
  const url = absUrl(site, site.editorial?.url || "/editorial/");
  const byline = site.editorial?.byline || "Editorial Desk";
  return [
    {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      url,
      name: byline,
      description: site.editorial?.tagline,
      inLanguage: "en-US",
      isPartOf: { "@id": `${site.url}/#website` },
      mainEntity: editorialNode(site),
    },
    breadcrumbsNode(site, [
      { name: "Home", path: "/" },
      { name: byline, path: site.editorial?.url || "/editorial/" },
    ]),
  ];
}

function homeJsonLd({ site, articles }) {
  const graph = [
    organizationNode(site),
    websiteNode(site),
    {
      "@type": "CollectionPage",
      "@id": `${site.url}/#home`,
      url: `${site.url}/`,
      name: site.title,
      description: site.description,
      isPartOf: { "@id": `${site.url}/#website` },
      inLanguage: "en-US",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: Math.min(articles.length, 10),
        itemListElement: articles.slice(0, 10).map((a, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: absUrl(site, articleUrl(a.id)),
          name: a.title,
        })),
      },
    },
  ];
  return [{ "@context": "https://schema.org", "@graph": graph }];
}

// Resolve the og:image / Article.image URL for an article.
// If the article has a real photo (JPG/PNG cover), prefer that for stronger
// social previews. Otherwise fall back to the auto-generated 1200×630 OG card
// that lives at /images/og/<slug>.png — this is the path that makes every
// article eligible for Google's Article rich-result image requirement.
function articleImageUrl(site, article) {
  if (article.cover_image && !article.cover_image.toLowerCase().endsWith(".svg")) {
    return absUrl(site, article.cover_image);
  }
  const ogPrefix = article.lang === "es" ? "/images/og/es" : "/images/og";
  return `${site.url.replace(/\/$/, "")}${ogPrefix}/${article.id}.png`;
}

function articleJsonLd({ site, article }) {
  const lang = article.lang || "en";
  const url = absUrl(site, articleUrl(article.id, lang));
  const imageUrl = articleImageUrl(site, article);
  const usingGeneratedCard = !article.cover_image || article.cover_image.toLowerCase().endsWith(".svg");
  const published = article.date ? article.date.toISOString() : undefined;

  const articleNode = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.summary || article.intro || "",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    inLanguage: schemaLanguage(lang),
    articleSection: lang === "es" ? iCategoryLabel("es", article.category) : article.category,
    isAccessibleForFree: true,
    // ImageObject with explicit dimensions. The generated OG card is always
    // 1200×630 (the spec Google asks for). Real photo covers ship the
    // pixel dimensions we auto-detected from disk at load time — giving
    // every article an Image rich-result-eligible payload.
    image: usingGeneratedCard
      ? { "@type": "ImageObject", url: imageUrl, width: OG_WIDTH, height: OG_HEIGHT }
      : (article.cover_width && article.cover_height
          ? { "@type": "ImageObject", url: imageUrl, width: article.cover_width, height: article.cover_height }
          : imageUrl),
    author: editorialNode(site),
    publisher: organizationNode(site),
  };
  if (published) {
    articleNode.datePublished = published;
    articleNode.dateModified = article.updated ? article.updated.toISOString() : published;
  }

  // SpeakableSpecification — points Google Assistant / Bixby / Alexa-style
  // voice readers at the CSS selectors that compose a coherent spoken
  // summary of the article: the lede intro, the takeaways box, and the FAQ
  // Q&A pairs. The same selectors are also useful signals to AI engines
  // (ChatGPT/Perplexity) about which on-page text is "the answer."
  articleNode.speakable = {
    "@type": "SpeakableSpecification",
    cssSelector: [
      ".article-head__intro",
      ".takeaways",
      ".faq__q",
      ".faq__a",
    ],
  };

  // Outbound citations to authoritative sources become a citation[] array of
  // CreativeWork nodes. Schema.org's `citation` property is one of the
  // strongest E-E-A-T signals a content site can declare in JSON-LD: it tells
  // Google (and AI search engines) which specific external references back up
  // the article's claims.
  if (article.sources && article.sources.length) {
    articleNode.citation = article.sources.map(s => {
      const node = {
        "@type": "CreativeWork",
        name: s.title,
        url: s.url,
      };
      if (s.publisher) {
        node.publisher = { "@type": "Organization", name: s.publisher };
      }
      return node;
    });
  }

  const trail = [
    { name: lang === "es" ? "Inicio" : "Home", path: lang === "es" ? "/es/" : "/" },
    { name: lang === "es" ? "Artículos" : "Articles", path: lang === "es" ? "/es/articles/" : "/articles/" },
    { name: (lang === "es" ? iCategoryLabel("es", article.category) : article.category), path: categoryUrl(article.category, lang) },
    { name: article.title, path: articleUrl(article.id, lang) },
  ];

  const nodes = [articleNode, breadcrumbsNode(site, trail)];

  if (article.faqs && article.faqs.length) {
    nodes.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage: schemaLanguage(lang),
      mainEntity: article.faqs.map(f => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: {
          "@type": "Answer",
          // Schema.org allows HTML in answers; the pre-rendered markdown
          // (with glossary auto-links applied) maps cleanly to short
          // paragraphs and lists that LLMs extract well.
          text: (f.aHtml || renderMarkdown(f.a)).trim(),
        },
      })),
    });
  }

  // HowTo JSON-LD for procedural / checklist articles. The visible body is
  // still the canonical content — this node just gives Bing, Alexa, voice
  // search, and AI engines a strictly typed step-by-step payload they can
  // surface verbatim when answering "how do I…" queries.
  if (article.howto && article.howto.steps && article.howto.steps.length) {
    const ht = article.howto;
    const node = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      inLanguage: schemaLanguage(lang),
      name: ht.name,
      step: ht.steps.map((s, i) => {
        const step = { "@type": "HowToStep", position: i + 1, name: s.name };
        if (s.text) step.text = s.text;
        if (s.url) {
          // Relative anchor URLs become absolute so the schema is portable.
          step.url = s.url.startsWith("#") ? `${url}${s.url}` : s.url;
        }
        return step;
      }),
    };
    if (ht.description) node.description = ht.description;
    if (ht.totalTime) node.totalTime = ht.totalTime;
    nodes.push(node);
  }

  return nodes;
}

function articleListJsonLd({ site, articles, category, currentPath, name, description, lang = "en" }) {
  const url = absUrl(site, currentPath);
  const trail = [
    { name: lang === "es" ? "Inicio" : "Home", path: lang === "es" ? "/es/" : "/" },
    { name: lang === "es" ? "Artículos" : "Articles", path: lang === "es" ? "/es/articles/" : "/articles/" },
  ];
  if (category) trail.push({ name: lang === "es" ? iCategoryLabel("es", category) : category, path: currentPath });

  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      url,
      name,
      description,
      inLanguage: schemaLanguage(lang),
      isPartOf: { "@id": `${site.url}/#website` },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: articles.length,
        itemListElement: articles.slice(0, 50).map((a, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: absUrl(site, articleUrl(a.id, lang)),
          name: a.title,
        })),
      },
    },
    breadcrumbsNode(site, trail),
  ];
}

function simplePageJsonLd({ site, currentPath, name, description, type = "WebPage", extraTrail = [] }) {
  const url = absUrl(site, currentPath);
  const trail = [{ name: "Home", path: "/" }, ...extraTrail, { name, path: currentPath }];
  return [
    {
      "@context": "https://schema.org",
      "@type": type,
      url,
      name,
      description,
      inLanguage: "en-US",
      isPartOf: { "@id": `${site.url}/#website` },
    },
    breadcrumbsNode(site, trail),
  ];
}

function newsListJsonLd({ site, news }) {
  const items = (news?.items || []).slice(0, 20);
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      url: absUrl(site, "/news/"),
      name: "News Wire — Freeze-Dried-Fruit.com",
      description: "Auto-updated headlines about freeze-dried fruit and freeze-drying technology.",
      inLanguage: "en-US",
      isPartOf: { "@id": `${site.url}/#website` },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: items.length,
        itemListElement: items.map((it, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: it.link,
          name: it.title,
        })),
      },
    },
    breadcrumbsNode(site, [
      { name: "Home", path: "/" },
      { name: "News Wire", path: "/news/" },
    ]),
  ];
}

// ---------- Pages ----------

function renderHomeBody({ site, mailto, articles, home, news, homeConfig, reports }) {
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
            <div class="home-hero__byline">${escapeHtml(site.editorial?.byline || "Editorial Desk")} · ${escapeHtml(featured.dateLabel)} · ${escapeHtml(featured.read)}</div>
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
        <h2 class="fi-head__title">Latest Articles</h2>
      </div>
      <div class="fi-rule"></div>
      <div class="latest">${latestHtml}</div>
      <div style="text-align:right;padding-top:16px">
        <a href="/articles/" class="btn-arrow">More Articles ${Icons.arrowSmall}</a>
      </div>
    </div>
  </section>

  ${homeConfig.show_news_section ? newsWireSection(news) : ""}

  ${renderBrowseFieldGuide({ articles, reports })}

  ${exchangeBand({ mailto })}
  ${newsletterBand({ mailto })}`;
}

// ---------- Browse the field guide ----------
//
// Link-dense sitemap-style section appended near the bottom of the homepage.
// Purpose is purely SEO/indexing: the homepage is the most-crawled URL on the
// site, so fanning it out to ~70 internal URLs (organized by category, plus
// every major hub) gives Google a strong, hub-style discovery surface and
// pushes PageRank into pages that were stuck in "Discovered — not indexed".
// Editorial above-the-fold layout is untouched.
function renderBrowseFieldGuide({ articles, reports }) {
  const PER_CAT = 8;
  // Articles are passed in newest-first order from loadArticles, so slice(0, N)
  // surfaces the most recent N per category — which also tends to be what
  // Google's freshness signals reward.
  const byCat = (cat) => articles.filter(a => a.category === cat).slice(0, PER_CAT);

  const CATEGORY_BLOCKS = [
    { name: "Industry Insights", path: "/articles/category/industry-insights/" },
    { name: "Technology",        path: "/articles/category/technology/" },
    { name: "Labels & Quality",  path: "/articles/category/labels-and-quality/" },
    { name: "Applications",      path: "/articles/category/applications/" },
    { name: "Fruit Reports",     path: "/articles/category/fruit-reports/" },
  ];

  const catColumns = CATEGORY_BLOCKS.map(c => {
    const items = byCat(c.name);
    if (!items.length) return "";
    const lis = items.map(a =>
      `<li><a href="${articleUrl(a.id)}">${escapeHtml(a.title)}</a></li>`
    ).join("");
    return `
      <div class="browse-col">
        <h3 class="browse-col__title"><a href="${c.path}">${escapeHtml(c.name)}</a></h3>
        <ul class="browse-col__list">${lis}</ul>
        <a class="browse-col__all" href="${c.path}">All ${escapeHtml(c.name)} →</a>
      </div>`;
  }).join("");

  // Featured comparison pairs — a curated subset of the 121 /compare/ pages,
  // chosen for highest-impression queries (mangosteen vs lychee, cherry vs
  // cranberry, etc.) so we hub-link the pages Google sees most often.
  const featuredCompares = [
    { slug: "cherry-vs-cranberry",        label: "Cherry vs Cranberry" },
    { slug: "blueberry-vs-strawberry",    label: "Blueberry vs Strawberry" },
    { slug: "jackfruit-vs-lychee",        label: "Jackfruit vs Lychee" },
    { slug: "lychee-vs-mangosteen",       label: "Lychee vs Mangosteen" },
    { slug: "mangosteen-vs-rambutan",     label: "Mangosteen vs Rambutan" },
    { slug: "apricot-vs-plum",            label: "Apricot vs Plum" },
    { slug: "cranberry-vs-strawberry",    label: "Cranberry vs Strawberry" },
    { slug: "guava-vs-passion-fruit",     label: "Guava vs Passion Fruit" },
  ];
  const compareLis = featuredCompares.map(p =>
    `<li><a href="/compare/${p.slug}/">${escapeHtml(p.label)}</a></li>`
  ).join("");

  // Essential glossary terms — the ones with the strongest standalone search
  // intent. Surfaced here so Google sees them linked from the most-crawled URL.
  const essentialGlossary = [
    { slug: "water-activity",     label: "Water activity (aw)" },
    { slug: "moisture-content",   label: "Moisture content" },
    { slug: "lyophilization",     label: "Lyophilization" },
    { slug: "sublimation",        label: "Sublimation" },
    { slug: "brix",               label: "Brix" },
    { slug: "eutectic-point",     label: "Eutectic point" },
    { slug: "barrier-film",       label: "Barrier film" },
    { slug: "rehydration",        label: "Rehydration" },
  ];
  const glossaryLis = essentialGlossary.map(g =>
    `<li><a href="/glossary/${g.slug}/">${escapeHtml(g.label)}</a></li>`
  ).join("");

  // Flagship reports — these are top-level industry assets that already rank
  // well; promoting them on the homepage reinforces topical authority signals.
  const reportLis = (reports || []).map(r =>
    `<li><a href="/${r.slug}/">${escapeHtml(r.title)}</a></li>`
  ).join("");

  return `
  <section class="section browse-fieldguide" aria-labelledby="browse-fieldguide-heading">
    <div class="container">
      <div class="fi-head">
        <div class="fi-head__icon">${Icons.article}</div>
        <h2 class="fi-head__title" id="browse-fieldguide-heading">Browse the entire field guide</h2>
      </div>
      <div class="fi-rule"></div>
      <p class="browse-intro">Every section, every comparison, every glossary term — organized for fast access. Looking for something specific? Try <a href="/articles/">all articles</a>, <a href="/compare/">all comparisons</a>, or <a href="/glossary/">the glossary</a>.</p>

      <div class="browse-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:32px;margin-top:24px">
        ${catColumns}

        <div class="browse-col">
          <h3 class="browse-col__title"><a href="/compare/">Compare freeze-dried fruits</a></h3>
          <ul class="browse-col__list">${compareLis}</ul>
          <a class="browse-col__all" href="/compare/">All 120+ comparisons →</a>
        </div>

        <div class="browse-col">
          <h3 class="browse-col__title"><a href="/glossary/">Glossary</a></h3>
          <ul class="browse-col__list">${glossaryLis}</ul>
          <a class="browse-col__all" href="/glossary/">All glossary terms →</a>
        </div>

        <div class="browse-col">
          <h3 class="browse-col__title">Flagship reports</h3>
          <ul class="browse-col__list">${reportLis}</ul>
          <a class="browse-col__all" href="/state-of-freeze-dried-fruit-2026/">Read the 2026 industry overview →</a>
        </div>

        <div class="browse-col">
          <h3 class="browse-col__title">More tools &amp; hubs</h3>
          <ul class="browse-col__list">
            <li><a href="/news/">News Wire</a></li>
            <li><a href="/calculators/">Calculators</a></li>
            <li><a href="/calculators/fruit-equivalency/">Fruit equivalency calculator</a></li>
            <li><a href="/calculators/pouch-barrier/">Pouch barrier calculator</a></li>
            <li><a href="/exchange/">Industry Exchange</a></li>
            <li><a href="/editorial/">Editorial Desk</a></li>
            <li><a href="/methodology/">Methodology</a></li>
            <li><a href="/about/">About</a></li>
          </ul>
        </div>
      </div>
    </div>
  </section>`;
}

// ---------- Cross-fruit comparison table ----------

// Render the freeze-drying comparison table for one fruit, showing the
// current fruit highlighted alongside the other fruits in its cluster.
// Output is a standalone <section> meant to be injected into the article
// body just before the conclusion.
function renderFruitCompareTable(fruitKey) {
  const cluster = clusterForFruit(fruitKey);
  if (!cluster) return "";
  const self = FRUIT_DATA[fruitKey];
  if (!self) return "";

  // Self goes first, then the other cluster fruits in their declared order.
  // Skipped any cluster entries that don't have data (defensive against typos).
  const rows = [fruitKey, ...cluster.fruits.filter(k => k !== fruitKey)]
    .map(k => ({ key: k, data: FRUIT_DATA[k] }))
    .filter(r => r.data);

  const tbody = rows.map(({ key, data }) => {
    const isSelf = key === fruitKey;
    return `
      <tr${isSelf ? ' class="is-self"' : ""}>
        <th scope="row" class="fruit-compare__name">${escapeHtml(data.name)}${isSelf ? `<span class="fruit-compare__badge">this report</span>` : ""}</th>
        <td class="fruit-compare__num">${escapeHtml(data.brix)}</td>
        <td>${escapeHtml(data.fiber)}</td>
        <td>${escapeHtml(data.aroma)}</td>
        <td>${escapeHtml(data.colorStability)}</td>
        <td>${escapeHtml(data.breakage)}</td>
        <td class="fruit-compare__format">${escapeHtml(data.format)}</td>
      </tr>`;
  }).join("");

  return `
    <section class="fruit-compare" aria-labelledby="fruit-compare-heading">
      <div class="fruit-compare__eyebrow">Comparison · ${escapeHtml(cluster.label)}</div>
      <h2 id="fruit-compare-heading" class="fruit-compare__title">How ${escapeHtml(self.name.toLowerCase())} compares</h2>
      <p class="fruit-compare__intro">A quick reference for how <strong>${escapeHtml(self.name.toLowerCase())}</strong> sits alongside the freeze-drying personalities of its closest siblings.</p>
      <div class="fruit-compare__scroll">
        <table class="fruit-compare__table">
          <thead>
            <tr>
              <th scope="col">Fruit</th>
              <th scope="col">Brix</th>
              <th scope="col">Fiber</th>
              <th scope="col">Aroma</th>
              <th scope="col">Color stability</th>
              <th scope="col">Breakage risk</th>
              <th scope="col">Typical format</th>
            </tr>
          </thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>
      <p class="fruit-compare__caption">Values are typical industry ranges. Variety, origin, harvest window, and process all shift them.</p>
    </section>`;
}

// Pick the top-N comparison pairs to surface in a fruit report's
// "Compare with..." strip. Intra-cluster siblings rank first (alphabetical),
// then cross-cluster celebrity pairs.
function relevantPairsFor(fruitKey, limit = 4) {
  const pairs = buildComparisonPairs();
  const cluster = clusterForFruit(fruitKey);
  const relevant = pairs.filter(p => p.a === fruitKey || p.b === fruitKey);
  relevant.sort((p1, p2) => {
    const o1 = p1.a === fruitKey ? p1.b : p1.a;
    const o2 = p2.a === fruitKey ? p2.b : p2.a;
    const inCluster1 = cluster?.fruits.includes(o1) ? 0 : 1;
    const inCluster2 = cluster?.fruits.includes(o2) ? 0 : 1;
    if (inCluster1 !== inCluster2) return inCluster1 - inCluster2;
    const A = FRUIT_DATA[o1]?.name || o1;
    const B = FRUIT_DATA[o2]?.name || o2;
    return A.localeCompare(B);
  });
  return relevant.slice(0, limit);
}

// Render the "Compare with..." strip for a fruit report — a small grid of
// links pointing at the canonical pairwise comparison pages for this fruit's
// most relevant siblings. Lives at the bottom of the article, after the FAQ.
function renderCompareWithStrip(fruitKey) {
  if (!fruitKey) return "";
  const self = FRUIT_DATA[fruitKey];
  if (!self) return "";
  const pairs = relevantPairsFor(fruitKey, 4);
  if (!pairs.length) return "";

  const cards = pairs.map(p => {
    const otherKey = p.a === fruitKey ? p.b : p.a;
    const other = FRUIT_DATA[otherKey];
    if (!other) return "";
    return `
      <a href="/compare/${p.slug}/" class="compare-with__card">
        <span class="compare-with__pair"><span class="compare-with__self">${escapeHtml(self.name)}</span><span class="compare-with__vs">vs</span><span class="compare-with__other">${escapeHtml(other.name)}</span></span>
        <span class="compare-with__cta">See comparison ${Icons.arrowSmall}</span>
      </a>`;
  }).join("");

  return `
    <section class="compare-with" aria-labelledby="compare-with-heading">
      <div class="compare-with__eyebrow">Compare ${escapeHtml(self.name.toLowerCase())} with</div>
      <h2 id="compare-with-heading" class="compare-with__heading">How ${escapeHtml(self.name.toLowerCase())} compares side-by-side</h2>
      <div class="compare-with__grid">${cards}</div>
      <a href="/compare/" class="compare-with__all">See all freeze-dried fruit comparisons ${Icons.arrowSmall}</a>
    </section>`;
}

// Render the "Continue reading in [Category]" strip — a 3-card pillar-aware
// reading path that lives between the article's Sources block and the
// fruit-report Compare-with strip. Different from the bottom "Related
// Reading" block: this one stays inside the current pillar so a reader who
// finished a Technology article gets nudged to the next Technology article,
// not a Fruit Report. The bottom Related Reading block then offers a
// cross-pillar branch.
//
// Selection: `siblings` is a pre-filtered list of same-category articles,
// excluding the current one, ordered newest-first. We show up to 3.
function renderContinueReading(siblings, category) {
  if (!siblings || !siblings.length) return "";
  const top = siblings.slice(0, 3);
  const cards = top.map(a => `
    <a class="continue-reading__card" href="${articleUrl(a.id)}">
      <span class="continue-reading__date">${escapeHtml(a.dateLabel || "")}</span>
      <span class="continue-reading__title">${escapeHtml(a.title)}</span>
      <span class="continue-reading__cta">Read article ${Icons.arrowSmall}</span>
    </a>`).join("");
  return `
    <section class="continue-reading" aria-labelledby="continue-reading-heading">
      <div class="continue-reading__eyebrow">Continue reading in ${escapeHtml(category)}</div>
      <h2 id="continue-reading-heading" class="continue-reading__heading">Next stops in the field guide</h2>
      <div class="continue-reading__grid">${cards}</div>
      <a class="continue-reading__all" href="${categoryUrl(category)}">See all ${escapeHtml(category)} articles ${Icons.arrowSmall}</a>
    </section>`;
}

// Render the "Primary sources & further reading" section for an article that
// declares a `sources:` array in its frontmatter. These are dofollow outbound
// links to authoritative publishers (FDA, USDA, IFT, ASTM, ISO, etc.) used to
// substantiate technical claims — a direct E-E-A-T trust signal.
//
// We open external links in a new tab and add rel="external noopener" (NOT
// nofollow) because we are vouching for the cited source.
function renderSources(sources) {
  if (!sources || !sources.length) return "";
  const items = sources.map(s => {
    const publisherHtml = s.publisher
      ? `<span class="sources__publisher">${escapeHtml(s.publisher)}</span>`
      : "";
    const noteHtml = s.note
      ? `<span class="sources__note">${escapeHtml(s.note)}</span>`
      : "";
    return `
      <li class="sources__item">
        <a class="sources__link" href="${escapeHtml(s.url)}" target="_blank" rel="external noopener">
          <span class="sources__title">${escapeHtml(s.title)}</span>
          ${publisherHtml}
        </a>
        ${noteHtml}
      </li>`;
  }).join("");
  return `
    <section class="sources" aria-labelledby="sources-heading">
      <div class="sources__eyebrow">References</div>
      <h2 id="sources-heading" class="sources__heading">Primary sources &amp; further reading</h2>
      <ol class="sources__list">${items}</ol>
      <p class="sources__disclosure">External links open in a new tab. We do not receive compensation from any organization listed; sources are referenced because they are primary, current, and publicly verifiable.</p>
    </section>`;
}

// Inject the comparison table into rendered article HTML for fruit reports.
// We slot it BEFORE the article's conclusion-style final H2 ("Conclusion",
// "Bottom line", or similar) so the comparison feels like a reference the
// reader sees just before the wrap-up rather than after it.
function injectFruitCompareTable(bodyHtml, fruitKey) {
  const table = renderFruitCompareTable(fruitKey);
  if (!table) return bodyHtml;

  // Find the last H2 in the body. If its text matches a conclusion-style
  // heading, place the table immediately before that H2. Otherwise append.
  const h2Re = /<h2[^>]*>([\s\S]*?)<\/h2>/g;
  let lastMatch = null;
  let m;
  while ((m = h2Re.exec(bodyHtml))) {
    lastMatch = { index: m.index, text: m[1].replace(/<[^>]+>/g, "").trim().toLowerCase() };
  }
  if (lastMatch && /(conclusion|bottom line|the bottom line|in conclusion|wrap[- ]up)/i.test(lastMatch.text)) {
    return bodyHtml.slice(0, lastMatch.index) + table + bodyHtml.slice(lastMatch.index);
  }
  return bodyHtml + table;
}

// ---------- Pairwise comparison pages ----------

// Map a fruit key back to its primary article (source-of-truth content) so
// the comparison page can link to the full report at the bottom.
function findArticleForFruit(articles, fruitKey) {
  // Prefer the "X-for-freeze-drying" variant; fall back to "how-many-types-of-X"
  // or the special-case mango-varieties.
  const candidates = [];
  for (const [slug, key] of Object.entries(SLUG_TO_FRUIT)) {
    if (key !== fruitKey) continue;
    candidates.push(slug);
  }
  const preferred = candidates.find(s => s.endsWith("-for-freeze-drying"))
    || candidates.find(s => s.endsWith("-varieties-for-freeze-drying"))
    || candidates.find(s => s === "mango-varieties")
    || candidates[0];
  if (!preferred) return null;
  return articles.find(a => a.id === preferred) || null;
}

// Lightweight ordinal scale used to surface meaningful attribute differences
// in the generated prose / FAQ — *not* shown verbatim to readers.
function rankFiber(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("very low")) return 0;
  if (v.startsWith("low")) return 1;
  if (v.includes("medium")) return 2;
  if (v.includes("high")) return 3;
  return 2; // default mid
}
function rankAroma(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("very strong")) return 4;
  if (v.includes("sharp")) return 3;
  if (v.includes("strong")) return 3;
  if (v.includes("moderate")) return 2;
  if (v.includes("mild")) return 1;
  if (v.includes("quiet")) return 1;
  return 2;
}
function rankColor(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("very strong")) return 4;
  if (v.includes("strong")) return 3;
  if (v.includes("moderate")) return 2;
  if (v.includes("poor")) return 1;
  return 2;
}
function rankBreakage(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("low")) return 1;
  if (v.includes("medium")) return 2;
  if (v.includes("high")) return 3;
  return 2;
}

// Render one pairwise comparison page. Each page reuses the existing fruit
// comparison table (filtered to just these two fruits) plus side-by-side
// reference cards and a small set of generated FAQs derived from attribute
// differences — so every URL is factually unique without templated filler.
function renderComparePage({ a, b, articles }) {
  const A = FRUIT_DATA[a];
  const B = FRUIT_DATA[b];
  if (!A || !B) return null;

  const aArticle = findArticleForFruit(articles, a);
  const bArticle = findArticleForFruit(articles, b);
  const clusterA = clusterForFruit(a);
  const clusterB = clusterForFruit(b);
  const sameCluster = clusterA && clusterB && clusterA.id === clusterB.id;
  const clusterLabel = sameCluster ? clusterA.label : `${clusterA?.label || "Fruit"} vs ${clusterB?.label || "Fruit"}`;

  // Two-row comparison table that mirrors the existing fruit-compare style.
  const tableHtml = `
    <section class="fruit-compare compare-page__table" aria-label="At-a-glance comparison">
      <div class="fruit-compare__eyebrow">At a glance</div>
      <div class="fruit-compare__scroll">
        <table class="fruit-compare__table">
          <thead>
            <tr>
              <th scope="col">Fruit</th>
              <th scope="col">Brix</th>
              <th scope="col">Fiber</th>
              <th scope="col">Aroma</th>
              <th scope="col">Color stability</th>
              <th scope="col">Breakage risk</th>
              <th scope="col">Typical format</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" class="fruit-compare__name">${escapeHtml(A.name)}</th>
              <td class="fruit-compare__num">${escapeHtml(A.brix)}</td>
              <td>${escapeHtml(A.fiber)}</td>
              <td>${escapeHtml(A.aroma)}</td>
              <td>${escapeHtml(A.colorStability)}</td>
              <td>${escapeHtml(A.breakage)}</td>
              <td class="fruit-compare__format">${escapeHtml(A.format)}</td>
            </tr>
            <tr>
              <th scope="row" class="fruit-compare__name">${escapeHtml(B.name)}</th>
              <td class="fruit-compare__num">${escapeHtml(B.brix)}</td>
              <td>${escapeHtml(B.fiber)}</td>
              <td>${escapeHtml(B.aroma)}</td>
              <td>${escapeHtml(B.colorStability)}</td>
              <td>${escapeHtml(B.breakage)}</td>
              <td class="fruit-compare__format">${escapeHtml(B.format)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>`;

  // Side-by-side reference cards — each fruit's editorial one-liner plus a
  // richer attribute grid that surfaces the sourcing and commercial data
  // (best use, seasonality, cost tier, key origins) alongside the technical
  // fields. The compare page at the top still carries the technical at-a-glance.
  const fruitCard = (fruit, key, article) => `
    <div class="compare-card">
      <div class="compare-card__eyebrow">${escapeHtml(clusterForFruit(key)?.label || "Fruit")}</div>
      <h2 class="compare-card__name">${escapeHtml(fruit.name)}</h2>
      <p class="compare-card__one-line">${escapeHtml(fruit.oneLine || "")}</p>
      <dl class="compare-card__attrs">
        <div><dt>Brix</dt><dd class="is-mono">${escapeHtml(fruit.brix)}</dd></div>
        <div><dt>Cost tier</dt><dd>${escapeHtml(fruit.costTier || "—")}</dd></div>
        <div><dt>Best use</dt><dd>${escapeHtml(fruit.bestUse || "—")}</dd></div>
        <div><dt>Seasonality</dt><dd>${escapeHtml(fruit.seasonality || "—")}</dd></div>
      </dl>
      ${fruit.keyOrigins ? `<div class="compare-card__origins"><span class="compare-card__origins-label">Key origins</span><span class="compare-card__origins-value">${escapeHtml(fruit.keyOrigins)}</span></div>` : ""}
      ${article ? `<a href="${articleUrl(article.id)}" class="compare-card__link">Read the ${escapeHtml(fruit.name.toLowerCase())} field guide ${Icons.arrowSmall}</a>` : ""}
    </div>`;

  // Auto-generated diff bullets: only the differences worth surfacing
  // between the two fruits. Empty bullets are filtered out, so two very
  // similar fruits produce a shorter list rather than padded filler.
  const diffs = [];
  // Brix
  if (A.brix !== B.brix) {
    diffs.push(`<strong>Sugar (Brix).</strong> ${escapeHtml(A.name)} ${escapeHtml(A.brix)}, ${escapeHtml(B.name)} ${escapeHtml(B.brix)}. Higher Brix usually produces more concentrated flavor after drying.`);
  }
  // Fiber
  const fa = rankFiber(A.fiber), fb = rankFiber(B.fiber);
  if (fa !== fb) {
    const [more, less] = fa > fb ? [A, B] : [B, A];
    diffs.push(`<strong>Fiber.</strong> ${escapeHtml(more.name)} carries more fiber (${escapeHtml(more.fiber)}) than ${escapeHtml(less.name)} (${escapeHtml(less.fiber)}). Fiber shows up as toughness or chewiness in larger pieces.`);
  }
  // Aroma
  const aa = rankAroma(A.aroma), ab = rankAroma(B.aroma);
  if (aa !== ab) {
    const [more, less] = aa > ab ? [A, B] : [B, A];
    diffs.push(`<strong>Aroma.</strong> ${escapeHtml(more.name)} reads as ${escapeHtml(more.aroma.toLowerCase())}, ${escapeHtml(less.name)} as ${escapeHtml(less.aroma.toLowerCase())}. The more aromatic fruit usually carries a blend even at low inclusion.`);
  } else {
    diffs.push(`<strong>Aroma.</strong> Both fruits read as ${escapeHtml(A.aroma.toLowerCase())} when handled well. Variety, ripeness, and packaging integrity decide which one survives storage.`);
  }
  // Color stability
  const ca = rankColor(A.colorStability), cb = rankColor(B.colorStability);
  if (ca !== cb) {
    const [more, less] = ca > cb ? [A, B] : [B, A];
    diffs.push(`<strong>Color stability.</strong> ${escapeHtml(more.name)} holds color better (${escapeHtml(more.colorStability)}) than ${escapeHtml(less.name)} (${escapeHtml(less.colorStability)}). The weaker fruit demands tighter oxygen and packaging discipline.`);
  }
  // Breakage
  const bra = rankBreakage(A.breakage), brb = rankBreakage(B.breakage);
  if (bra !== brb) {
    const [fragile, sturdy] = bra > brb ? [A, B] : [B, A];
    diffs.push(`<strong>Breakage risk.</strong> ${escapeHtml(fragile.name)} (${escapeHtml(fragile.breakage)}) is more fragile in transit than ${escapeHtml(sturdy.name)} (${escapeHtml(sturdy.breakage)}). Expect more powder at the bottom of the bag and tighter whole-piece tolerances on the more fragile fruit.`);
  }

  const diffHtml = `
    <section class="compare-page__diffs" aria-labelledby="diffs-heading">
      <h2 id="diffs-heading">Where they differ</h2>
      <ul>${diffs.map(d => `<li>${d}</li>`).join("")}</ul>
    </section>`;

  // Choice section: a short, opinionated read on when each fruit makes more
  // sense. Generated from the attribute deltas above so it stays factual.
  const choice = (() => {
    const aBetter = [];
    const bBetter = [];
    if (rankAroma(A.aroma) > rankAroma(B.aroma)) aBetter.push("stronger aroma carrying a blend");
    if (rankAroma(B.aroma) > rankAroma(A.aroma)) bBetter.push("stronger aroma carrying a blend");
    if (rankColor(A.colorStability) > rankColor(B.colorStability)) aBetter.push("more stable color through shelf life");
    if (rankColor(B.colorStability) > rankColor(A.colorStability)) bBetter.push("more stable color through shelf life");
    if (rankBreakage(B.breakage) > rankBreakage(A.breakage)) aBetter.push("sturdier handling in transit");
    if (rankBreakage(A.breakage) > rankBreakage(B.breakage)) bBetter.push("sturdier handling in transit");
    if (rankFiber(A.fiber) < rankFiber(B.fiber)) aBetter.push("cleaner mouthfeel with less fiber");
    if (rankFiber(B.fiber) < rankFiber(A.fiber)) bBetter.push("cleaner mouthfeel with less fiber");
    return { aBetter, bBetter };
  })();

  const choiceHtml = `
    <section class="compare-page__choice" aria-labelledby="choice-heading">
      <h2 id="choice-heading">Which to choose</h2>
      <div class="compare-page__choice-grid">
        <div class="compare-page__choice-card">
          <div class="compare-page__choice-label">Choose ${escapeHtml(A.name)} when you want</div>
          <ul>${
            choice.aBetter.length
              ? choice.aBetter.map(x => `<li>${escapeHtml(x)}</li>`).join("")
              : `<li>the specific fruit identity ${escapeHtml(A.name.toLowerCase())} brings — there is no broad attribute where ${escapeHtml(A.name.toLowerCase())} clearly outranks ${escapeHtml(B.name.toLowerCase())}</li>`
          }</ul>
        </div>
        <div class="compare-page__choice-card">
          <div class="compare-page__choice-label">Choose ${escapeHtml(B.name)} when you want</div>
          <ul>${
            choice.bBetter.length
              ? choice.bBetter.map(x => `<li>${escapeHtml(x)}</li>`).join("")
              : `<li>the specific fruit identity ${escapeHtml(B.name.toLowerCase())} brings — there is no broad attribute where ${escapeHtml(B.name.toLowerCase())} clearly outranks ${escapeHtml(A.name.toLowerCase())}</li>`
          }</ul>
        </div>
      </div>
    </section>`;

  // Build a few FAQs from the attribute differences. Each Q is unique to
  // this pair, since the answer pulls in the actual values.
  const faqs = [];
  faqs.push({
    q: `Which is sweeter — freeze-dried ${A.name.toLowerCase()} or freeze-dried ${B.name.toLowerCase()}?`,
    a: `By typical Brix at harvest, ${A.name.toLowerCase()} sits at ${A.brix} and ${B.name.toLowerCase()} sits at ${B.brix}. Higher Brix usually produces more concentrated sweetness in the finished freeze-dried piece, though ripeness at processing and the variety chosen matter as much as the headline range.`,
  });
  if (rankFiber(A.fiber) !== rankFiber(B.fiber)) {
    const [more, less] = rankFiber(A.fiber) > rankFiber(B.fiber) ? [A, B] : [B, A];
    faqs.push({
      q: `Which has more fiber, ${A.name.toLowerCase()} or ${B.name.toLowerCase()}?`,
      a: `${more.name} typically carries more fiber (${more.fiber}) than ${less.name} (${less.fiber}). In freeze-dried form, higher fiber shows up as toughness or chewiness, especially in larger pieces — relevant when sourcing for premium snack packs.`,
    });
  }
  if (rankBreakage(A.breakage) !== rankBreakage(B.breakage)) {
    const [fragile, sturdy] = rankBreakage(A.breakage) > rankBreakage(B.breakage) ? [A, B] : [B, A];
    faqs.push({
      q: `Which is more fragile in transit — freeze-dried ${A.name.toLowerCase()} or ${B.name.toLowerCase()}?`,
      a: `${fragile.name} (${fragile.breakage} breakage risk) tends to be more fragile than ${sturdy.name} (${sturdy.breakage}). Expect more powder at the bottom of the bag with ${fragile.name.toLowerCase()}, and consider whether the use case justifies whole-piece premium pricing or whether broken-piece formats deliver better value.`,
    });
  }
  if (rankColor(A.colorStability) !== rankColor(B.colorStability)) {
    const [strong, weak] = rankColor(A.colorStability) > rankColor(B.colorStability) ? [A, B] : [B, A];
    faqs.push({
      q: `Which holds color better, ${A.name.toLowerCase()} or ${B.name.toLowerCase()}?`,
      a: `${strong.name} (color stability: ${strong.colorStability}) holds visual quality through shelf life more reliably than ${weak.name} (${weak.colorStability}). The weaker fruit needs tighter oxygen control, better barrier film, and faster handling between cutting and freezing.`,
    });
  }
  faqs.push({
    q: `Can you substitute freeze-dried ${A.name.toLowerCase()} for ${B.name.toLowerCase()} in a recipe?`,
    a: `Sometimes, but they are not interchangeable. ${A.name} (${A.aroma.toLowerCase()} aroma, ${A.colorStability.toLowerCase()} color stability) and ${B.name} (${B.aroma.toLowerCase()} aroma, ${B.colorStability.toLowerCase()} color stability) deliver different flavor profiles and visual cues. For ingredient applications, swap by weight cautiously; for snack-bag use, treat them as different products.`,
  });

  const faqHtml = `
    <section class="faq compare-page__faq" aria-labelledby="compare-faq-heading">
      <h2 id="compare-faq-heading">Frequently asked questions</h2>
      ${faqs.map(f => `
        <div class="faq__item">
          <h3 class="faq__q">${escapeHtml(f.q)}</h3>
          <div class="faq__a"><p>${escapeHtml(f.a)}</p></div>
        </div>`).join("")}
    </section>`;

  const readMoreHtml = (aArticle || bArticle) ? `
    <section class="compare-page__more">
      <div class="compare-page__more-label">Read the full field guides</div>
      <div class="compare-page__more-links">
        ${aArticle ? `<a href="${articleUrl(aArticle.id)}" class="compare-page__more-link">
          <span class="compare-page__more-eyebrow">${escapeHtml(aArticle.category)}</span>
          <span class="compare-page__more-title">${escapeHtml(aArticle.title)}</span>
        </a>` : ""}
        ${bArticle ? `<a href="${articleUrl(bArticle.id)}" class="compare-page__more-link">
          <span class="compare-page__more-eyebrow">${escapeHtml(bArticle.category)}</span>
          <span class="compare-page__more-title">${escapeHtml(bArticle.title)}</span>
        </a>` : ""}
      </div>
    </section>` : "";

  // Sibling-comparison strip. Compare pages historically had zero outbound
  // /compare/* links, leaving the 120 pages stranded in a hub-and-spoke from
  // /compare/ only. Cross-linking them spreads PageRank across the template
  // and gives Google obvious crawl paths between related pairs — important
  // because most compare pages sit in "Discovered — not indexed".
  const currentSlug = comparePathFor(a, b);
  const siblingLimit = 6;
  const seen = new Set([currentSlug]);
  const siblingPairs = [];
  for (const p of [...relevantPairsFor(a, 12), ...relevantPairsFor(b, 12)]) {
    if (seen.has(p.slug)) continue;
    seen.add(p.slug);
    siblingPairs.push(p);
    if (siblingPairs.length >= siblingLimit) break;
  }
  const siblingsHtml = siblingPairs.length ? `
    <section class="compare-page__siblings" aria-labelledby="compare-siblings-heading">
      <h2 id="compare-siblings-heading" class="compare-page__siblings-heading">Other comparisons with ${escapeHtml(A.name)} or ${escapeHtml(B.name)}</h2>
      <div class="compare-with__grid">
        ${siblingPairs.map(p => {
          const X = FRUIT_DATA[p.a];
          const Y = FRUIT_DATA[p.b];
          if (!X || !Y) return "";
          return `
          <a href="/compare/${p.slug}/" class="compare-with__card">
            <span class="compare-with__pair"><span class="compare-with__self">${escapeHtml(X.name)}</span><span class="compare-with__vs">vs</span><span class="compare-with__other">${escapeHtml(Y.name)}</span></span>
            <span class="compare-with__cta">See comparison ${Icons.arrowSmall}</span>
          </a>`;
        }).join("")}
      </div>
      <a href="/compare/" class="compare-with__all">See all freeze-dried fruit comparisons ${Icons.arrowSmall}</a>
    </section>` : "";

  // Page head + body composed in the same masthead language as other field-guide pages.
  const bodyHtml = `
    <section class="page-head compare-page__head">
      <div class="container">
        <span class="eyebrow">Comparison · ${escapeHtml(clusterLabel)}</span>
        <h1>Freeze-Dried ${escapeHtml(A.name)} vs ${escapeHtml(B.name)}</h1>
        <p>How ${escapeHtml(A.name.toLowerCase())} and ${escapeHtml(B.name.toLowerCase())} compare in freeze-dried form — sugar, fiber, aroma, color stability, breakage, and the buying decision behind each.</p>
      </div>
    </section>
    <div class="container-narrow compare-page">
      ${tableHtml}
      <section class="compare-page__cards" aria-label="Fruit reference cards">
        ${fruitCard(A, a, aArticle)}
        ${fruitCard(B, b, bArticle)}
      </section>
      ${diffHtml}
      ${choiceHtml}
      ${faqHtml}
      ${readMoreHtml}
      ${siblingsHtml}
    </div>`;

  return { bodyHtml, faqs, A, B };
}

function comparePageJsonLd({ site, a, b, currentPath, A, B, faqs }) {
  const url = absUrl(site, currentPath);
  const name = `Freeze-Dried ${A.name} vs ${B.name}`;
  const trail = [
    { name: "Home", path: "/" },
    { name: "Compare", path: "/compare/" },
    { name: `${A.name} vs ${B.name}`, path: currentPath },
  ];

  // Dataset + PropertyValue payload for the at-a-glance comparison table.
  // Schema.org's Dataset is one of the most parseable structures for AI
  // search — ChatGPT/Perplexity/Claude all index it explicitly when asked
  // for spec comparisons. Each measured attribute becomes a PropertyValue
  // node listing the value for both fruits so a single structured query
  // returns the comparison verbatim.
  const measuredAttrs = [
    { name: "Brix",            key: "brix",            unit: "° Brix",   description: "Dissolved sugar concentration of the fresh fruit, in degrees Brix. Higher Brix usually produces more concentrated flavor after drying." },
    { name: "Fiber",           key: "fiber",           unit: null,       description: "Relative fiber content as a qualitative band. Higher-fiber fruits read tougher or chewier in larger freeze-dried pieces." },
    { name: "Aroma",           key: "aroma",           unit: null,       description: "Qualitative aroma intensity after freeze-drying. Stronger aroma usually carries a blend at lower inclusion rates." },
    { name: "Color stability", key: "colorStability", unit: null,       description: "Resistance to fade or browning during storage. Weaker color stability demands tighter oxygen and packaging discipline." },
    { name: "Breakage risk",   key: "breakage",        unit: null,       description: "Susceptibility to fragmenting into powder or fines during shipping and handling." },
    { name: "Typical format",  key: "format",          unit: null,       description: "Most common commercial format the freeze-dried fruit ships in (whole pieces, slices, dice, crumble, powder)." },
  ];
  const datasetNode = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `Freeze-dried ${A.name} vs freeze-dried ${B.name} — specification comparison`,
    description: `Structured side-by-side comparison of freeze-dried ${A.name.toLowerCase()} and freeze-dried ${B.name.toLowerCase()} across six measured attributes used in commercial sourcing: Brix, fiber, aroma, color stability, breakage risk, and typical format.`,
    url,
    isAccessibleForFree: true,
    inLanguage: "en-US",
    keywords: [
      `freeze-dried ${A.name.toLowerCase()}`,
      `freeze-dried ${B.name.toLowerCase()}`,
      `${A.name.toLowerCase()} vs ${B.name.toLowerCase()}`,
      "freeze-dried fruit comparison",
      "freeze-dried fruit specification",
    ],
    creator: organizationNode(site),
    license: "https://creativecommons.org/licenses/by/4.0/",
    measurementTechnique: "Editorial compilation from supplier specifications, published USDA / IFT references, and direct sample observation.",
    variableMeasured: measuredAttrs.map(attr => {
      const node = {
        "@type": "PropertyValue",
        name: attr.name,
        description: attr.description,
        // PropertyValue can carry a single value plus a structured
        // alternative — we put the two fruits' values into alternateName
        // (a string list) so a downstream consumer reads them as a tuple.
        value: `${A.name}: ${A[attr.key]}; ${B.name}: ${B[attr.key]}`,
      };
      if (attr.unit) node.unitText = attr.unit;
      return node;
    }),
    distribution: {
      "@type": "DataDownload",
      encodingFormat: "text/html",
      contentUrl: url,
    },
  };

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": url,
      url,
      name,
      description: `Side-by-side comparison of freeze-dried ${A.name.toLowerCase()} and freeze-dried ${B.name.toLowerCase()} — Brix, fiber, aroma, color stability, breakage, and typical format.`,
      inLanguage: "en-US",
      isPartOf: { "@id": `${site.url}/#website` },
    },
    breadcrumbsNode(site, trail),
    datasetNode,
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map(f => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];
}

// /compare/ hub page — groups every generated comparison by cluster so
// readers can find pair pages by the fruit they came from.
function renderCompareHub({ pairs }) {
  const byCluster = new Map();
  for (const p of pairs) {
    const ca = clusterForFruit(p.a);
    const cb = clusterForFruit(p.b);
    const clusterId = (ca && cb && ca.id === cb.id) ? ca.id : "cross-cluster";
    const clusterLabel = (ca && cb && ca.id === cb.id) ? ca.label : "Cross-category comparisons";
    if (!byCluster.has(clusterId)) byCluster.set(clusterId, { label: clusterLabel, items: [] });
    byCluster.get(clusterId).items.push(p);
  }
  // Render clusters in a stable, intuitive order
  const order = ["berries", "stone", "pome", "tropical", "asian-tropical", "andean", "citrus", "melon", "structural", "cross-cluster"];
  const clusters = order
    .filter(id => byCluster.has(id))
    .map(id => ({ id, ...byCluster.get(id) }));

  const sectionsHtml = clusters.map(c => `
    <section class="compare-hub__section">
      <h2 class="compare-hub__h2">${escapeHtml(c.label)}</h2>
      <ul class="compare-hub__list">
        ${c.items.map(p => {
          const A = FRUIT_DATA[p.a];
          const B = FRUIT_DATA[p.b];
          return `<li><a href="/compare/${escapeHtml(p.slug)}/" class="compare-hub__item">
            <span class="compare-hub__pair">${escapeHtml(A.name)} <span class="compare-hub__vs">vs</span> ${escapeHtml(B.name)}</span>
          </a></li>`;
        }).join("")}
      </ul>
    </section>`).join("");

  return `
    <section class="page-head">
      <div class="container">
        <span class="eyebrow">Compare · ${pairs.length} pairings</span>
        <h1>Compare Freeze-Dried Fruits</h1>
        <p>Side-by-side reference pages for freeze-dried fruit pairings — Brix, fiber, aroma, color stability, breakage, and the buying decision behind each. Organized by cluster.</p>
      </div>
    </section>
    <section class="section">
      <div class="container-narrow compare-hub">${sectionsHtml}</div>
    </section>`;
}

function compareHubJsonLd({ site, pairs }) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      url: absUrl(site, "/compare/"),
      name: "Compare Freeze-Dried Fruits",
      description: "Side-by-side comparisons of freeze-dried fruits across Brix, fiber, aroma, color stability, breakage, and typical format.",
      inLanguage: "en-US",
      isPartOf: { "@id": `${site.url}/#website` },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: pairs.length,
        itemListElement: pairs.slice(0, 50).map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: absUrl(site, `/compare/${p.slug}/`),
          name: `${FRUIT_DATA[p.a].name} vs ${FRUIT_DATA[p.b].name}`,
        })),
      },
    },
    breadcrumbsNode(site, [
      { name: "Home", path: "/" },
      { name: "Compare", path: "/compare/" },
    ]),
  ];
}

// ---------- Pillar pages ----------

// Renders the editorial pillar layout that sits ABOVE the category archive
// list. Pillars are markdown-driven (one file per category in content/pillars/)
// so the editorial team can revise without touching code. The glossary linker
// and FAQ rendering reuse the same pipeline as articles.
function renderPillar({ pillar, articles, articlesById, linker, mailto }) {
  // Step 1: render the pillar's markdown body to HTML.
  let bodyHtml = renderMarkdown(pillar.bodyMd || "");

  // Step 2: replace `:::related` placeholders with real article-card grids.
  // The marked extension emits <div data-related="slug1,slug2"></div>; we
  // expand each into a row of compact pillar-card links to those articles.
  bodyHtml = bodyHtml.replace(/<div data-related="([^"]+)"><\/div>/g, (_, csv) => {
    const slugs = csv.split(",").map(s => s.trim()).filter(Boolean);
    const cards = slugs.map(slug => {
      const a = articlesById[slug];
      if (!a) return "";
      return `
        <a href="${articleUrl(a.id)}" class="pillar-card" style="display:block;color:inherit">
          <div class="pillar-card__cat">${escapeHtml(a.category)}</div>
          <div class="pillar-card__title">${escapeHtml(a.title)}</div>
          <div class="pillar-card__sum">${escapeHtml(a.summary)}</div>
          <div class="pillar-card__cta">Read article ${Icons.arrowSmall}</div>
        </a>`;
    }).filter(Boolean).join("");
    return `<div class="pillar-related">${cards}</div>`;
  });

  // Step 3: ensure every H2 has a stable id so the TOC anchors actually land.
  bodyHtml = ensureH2Anchors(bodyHtml);

  // Step 4: extract the TOC after anchors are in place.
  const toc = extractTocFromHtml(bodyHtml);

  // Step 5: run the shared glossary auto-linker over the pillar body.
  const bodyUsed = new Set();
  bodyHtml = linker(bodyHtml, bodyUsed);

  // Step 6: render FAQs (same shape as article FAQs) and link inside answers.
  const faqUsed = new Set();
  const faqsRendered = (pillar.faqs || []).map(f => ({
    q: f.q,
    aHtml: linker(renderMarkdown(f.a), faqUsed),
  }));

  const faqHtml = faqsRendered.length
    ? `<section class="faq pillar-faq" aria-labelledby="pillar-faq-heading">
         <h2 id="pillar-faq-heading">Frequently asked questions</h2>
         ${faqsRendered.map(f => `
           <div class="faq__item">
             <h3 class="faq__q">${escapeHtml(f.q)}</h3>
             <div class="faq__a">${f.aHtml}</div>
           </div>`).join("")}
       </section>` : "";

  const tocHtml = toc.length
    ? `<nav class="pillar-toc" aria-label="On this page">
         <div class="pillar-toc__label">On this page</div>
         <ol class="pillar-toc__list">
           ${toc.map(s => `<li><a href="#${escapeHtml(s.id)}">${escapeHtml(s.text)}</a></li>`).join("")}
           ${faqsRendered.length ? `<li><a href="#pillar-faq-heading">Frequently asked questions</a></li>` : ""}
         </ol>
       </nav>` : "";

  const introHtml = pillar.intro
    ? `<p class="pillar-intro">${escapeHtml(pillar.intro)}</p>` : "";

  // Page head — same masthead language as other top-level pages.
  const headHtml = `
    <section class="page-head pillar-head">
      <div class="container">
        <span class="eyebrow">Field Guide · ${escapeHtml(pillar.category)}</span>
        <h1>${escapeHtml(pillar.heading || pillar.category)}</h1>
        ${pillar.intro ? `<p>${escapeHtml(pillar.intro)}</p>` : ""}
      </div>
    </section>`;

  return {
    pillarHtml: `
      ${headHtml}
      <div class="container-narrow pillar">
        ${tocHtml}
        <div class="pillar-body prose">${bodyHtml}</div>
        ${faqHtml}
      </div>`,
    faqsRendered,
  };
}

function pillarCategoryPageJsonLd({ site, articles, category, currentPath, name, description, pillar, faqsRendered }) {
  const url = absUrl(site, currentPath);
  const trail = [
    { name: "Home", path: "/" },
    { name: "Articles", path: "/articles/" },
    { name: category, path: currentPath },
  ];
  const nodes = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      url,
      name,
      description,
      inLanguage: "en-US",
      isPartOf: { "@id": `${site.url}/#website` },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: articles.length,
        itemListElement: articles.slice(0, 50).map((a, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: absUrl(site, articleUrl(a.id)),
          name: a.title,
        })),
      },
    },
    breadcrumbsNode(site, trail),
  ];
  if (faqsRendered && faqsRendered.length) {
    nodes.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqsRendered.map(f => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.aHtml.trim() },
      })),
    });
  }
  return nodes;
}

// Meta-pillar for `/articles/` — surfaces all 5 categories with featured
// articles and a routing FAQ, then renders the full archive below. Visually
// reuses the pillar TOC + pillar-card patterns already shipped, so the look
// matches the per-category pillar pages.
function renderArticlesMetaPillar({ site, articles, articlesById }) {
  // Editorial selection of 4 featured articles per category, in the order
  // they should appear. Curated rather than auto-derived so the page leads
  // with the strongest entry points into each section.
  const categoryFeatures = [
    {
      category: "Industry Insights",
      slug: "industry-insights",
      lead: "How the freeze-dried fruit supply chain actually works — landed cost, supplier evaluation, channel-specific specs, and the quality patterns that recur across the category.",
      featured: [
        "quality-varies",
        "freeze-dried-fruit-landed-cost-drivers",
        "freeze-dried-fruit-supplier-approval-checklist",
        "freeze-dried-fruit-specs-by-sales-channel",
      ],
    },
    {
      category: "Technology",
      slug: "technology",
      lead: "Sublimation, moisture and water activity, packaging barrier films, oxidation control, and the process decisions that decide whether a finished bag stays crunchy.",
      featured: [
        "how-its-made",
        "water-activity-vs-moisture-content",
        "barrier-films-for-freeze-dried-fruit",
        "freeze-dried-fruit-color-retention-and-oxidation",
      ],
    },
    {
      category: "Labels & Quality",
      slug: "labels-and-quality",
      lead: "What's actually on the bag — ingredient labels, breakage specs, organic claims, value comparison, and the framework for telling a real premium product from a marketed one.",
      featured: [
        "buyer-guide",
        "added-sugar",
        "how-to-read-a-freeze-dried-fruit-spec-sheet",
        "freeze-dried-fruit-breakage-specs",
      ],
    },
    {
      category: "Applications",
      slug: "applications",
      lead: "How freeze-dried fruit actually gets used — yogurt bowls, oatmeal, trail mix, ice cream toppings, and the storage habits that protect the crunch you paid for.",
      featured: [
        "best-freeze-dried-fruit-for-yogurt-bowls",
        "best-freeze-dried-fruit-for-oatmeal-and-overnight-oats",
        "best-freeze-dried-fruit-for-trail-mix-and-snack-mixes",
        "how-to-store-freeze-dried-fruit-after-opening",
      ],
    },
    {
      category: "Fruit Reports",
      slug: "fruit-reports",
      lead: "Per-fruit field guides covering origin, variety, processing personality, and what to ask suppliers — from strawberry and mango to lychee, jackfruit, and starfruit.",
      featured: [
        "mango-varieties",
        "strawberry-varieties-for-freeze-drying",
        "blueberry-varieties-for-freeze-drying",
        "how-many-types-of-mangoes-are-there",
      ],
    },
  ];

  // Routing FAQ — meta-level questions that help readers find the right
  // section. Each question answer is a short paragraph; they double as
  // FAQPage schema for AI engines navigating the catalog.
  const metaFaqs = [
    {
      q: "How is Freeze-Dried-Fruit.com organized?",
      a: "Five editorial sections, each with a different job. *Industry Insights* covers the supply chain and supplier evaluation. *Technology* covers the freeze-drying process and packaging. *Labels & Quality* covers reading labels and comparing products. *Applications* covers how freeze-dried fruit gets used. *Fruit Reports* covers per-fruit variety guides. The full archive lives at the bottom of this page.",
    },
    {
      q: "Where should freeze-dried fruit buyers and brands start?",
      a: "Start with Industry Insights and Labels & Quality. The Buyer's Guide to Freeze-Dried Fruit Quality is the foundational anchor; the Supplier Approval Checklist and Landed Cost articles cover the sourcing conversation. Technology articles deepen the process understanding when needed.",
    },
    {
      q: "Where should consumers start?",
      a: "Start with Applications and Fruit Reports. The Applications section covers how to use freeze-dried fruit in yogurt bowls, oatmeal, trail mix, and at home. Fruit Reports give per-fruit context — what to expect from freeze-dried mango, strawberry, blueberry, and dozens of others."
    },
    {
      q: "How current is the content?",
      a: "Articles carry both a publish date and an *updated* date when the content has been materially revised. The article meta strip and the sitemap both flow from those fields. Most articles in the Technology, Labels & Quality, and Industry Insights sections are reviewed and refreshed at intervals as the category evolves.",
    },
    {
      q: "Is Freeze-Dried-Fruit.com independent?",
      a: "Yes. The site does not accept paid placements, sponsored articles, or affiliate compensation tied to editorial coverage. Disclosures and editorial methodology are documented in the Methodology page, and authorship sits with the Editorial Desk rather than fictional named bylines.",
    },
    {
      q: "How are articles selected for each category?",
      a: "Daily publishing aims for one article each in Technology, Industry Insights, Labels & Quality, and Applications. Fruit Reports are written when a fruit warrants a standalone variety or processing guide. Editorial cadence is documented in the Methodology page and in the content rules used by the publishing automation.",
    },
  ];

  // Category sections — H2 + lead + 4 article cards + "See all" link
  const categorySectionsHtml = categoryFeatures.map(cf => {
    const cards = cf.featured.map(slug => {
      const a = articlesById[slug];
      if (!a) return "";
      return `
        <a href="${articleUrl(a.id)}" class="pillar-card" style="display:block;color:inherit">
          <div class="pillar-card__cat">${escapeHtml(a.category)}</div>
          <div class="pillar-card__title">${escapeHtml(a.title)}</div>
          <div class="pillar-card__sum">${escapeHtml(a.summary || "")}</div>
          <div class="pillar-card__cta">Read article ${Icons.arrowSmall}</div>
        </a>`;
    }).filter(Boolean).join("");
    const totalInCat = articles.filter(a => a.category === cf.category).length;
    return `
      <section class="meta-pillar__section" id="${cf.slug}">
        <header class="meta-pillar__section-head">
          <div class="meta-pillar__section-eyebrow">Section · ${totalInCat} articles</div>
          <h2 class="meta-pillar__section-title">${escapeHtml(cf.category)}</h2>
          <p class="meta-pillar__section-lead">${escapeHtml(cf.lead)}</p>
        </header>
        <div class="pillar-related">${cards}</div>
        <a href="${categoryUrl(cf.category)}" class="meta-pillar__see-all">See all ${escapeHtml(cf.category)} articles ${Icons.arrowSmall}</a>
      </section>`;
  }).join("");

  // TOC — links to the H2 anchors above
  const tocHtml = `
    <nav class="pillar-toc" aria-label="On this page">
      <div class="pillar-toc__label">On this page</div>
      <ol class="pillar-toc__list">
        ${categoryFeatures.map(cf =>
          `<li><a href="#${cf.slug}">${escapeHtml(cf.category)}</a></li>`
        ).join("")}
        <li><a href="#field-guide-faq">Frequently asked questions</a></li>
        <li><a href="#field-guide-archive">Full archive</a></li>
      </ol>
    </nav>`;

  // FAQ block — same shape as article FAQs so visual styling matches
  const faqHtml = `
    <section class="faq meta-pillar__faq" aria-labelledby="field-guide-faq">
      <h2 id="field-guide-faq">Frequently asked questions</h2>
      ${metaFaqs.map(f => `
        <div class="faq__item">
          <h3 class="faq__q">${escapeHtml(f.q)}</h3>
          <div class="faq__a">${renderMarkdown(f.a)}</div>
        </div>`).join("")}
    </section>`;

  // Page head + the body. The full archive is appended below (in build
  // orchestration) with the suppressHead path so we don't duplicate the H1.
  return {
    bodyHtml: `
      <section class="page-head pillar-head meta-pillar__head">
        <div class="container">
          <span class="eyebrow">Field Guide · ${articles.length} articles</span>
          <h1>The Field Guide to Freeze-Dried Fruit</h1>
          <p>Everything published on Freeze-Dried-Fruit.com, organized by what you're trying to do — make better products, understand the category, choose the right fruit, or use it well at home.</p>
        </div>
      </section>
      <div class="container-narrow meta-pillar">
        ${tocHtml}
        <div class="meta-pillar__sections">${categorySectionsHtml}</div>
        ${faqHtml}
        <div id="field-guide-archive"></div>
      </div>`,
    faqs: metaFaqs,
  };
}

function articlesMetaPillarJsonLd({ site, articles, faqs }) {
  const url = absUrl(site, "/articles/");
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      url,
      name: "The Field Guide to Freeze-Dried Fruit — All Articles",
      description: "All articles on Freeze-Dried-Fruit.com, organized across Industry Insights, Technology, Labels & Quality, Applications, and Fruit Reports.",
      inLanguage: "en-US",
      isPartOf: { "@id": `${site.url}/#website` },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: articles.length,
        itemListElement: articles.slice(0, 50).map((a, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: absUrl(site, articleUrl(a.id)),
          name: a.title,
        })),
      },
    },
    breadcrumbsNode(site, [
      { name: "Home", path: "/" },
      { name: "Articles", path: "/articles/" },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map(f => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: renderMarkdown(f.a).trim() },
      })),
    },
  ];
}

function renderArticlesIndex({ articles, category, suppressHead = false, eyebrowLabel = null, lang = "en" }) {
  const filtered = category ? articles.filter(a => a.category === category) : articles;
  const categoryName = category ? (lang === "es" ? iCategoryLabel("es", category) : category) : null;
  const headTitle = categoryName || (lang === "es" ? "Artículos" : "All Articles");
  const headSub = category
    ? (lang === "es" ? `Artículos disponibles en español dentro de ${categoryName}.` : `Articles filed under ${category}.`)
    : (lang === "es"
      ? "Artículos traducidos y guías disponibles en español sobre calidad, proceso, abastecimiento, empaque y aplicaciones de la fruta liofilizada."
      : "Long-form explainers, label analysis, and category notes from the freeze-dried fruit space.");
  const eyebrow = suppressHead
    ? (eyebrowLabel || (category ? `${lang === "es" ? "Archivo" : "Full Archive"} · ${categoryName}` : (lang === "es" ? "Archivo" : "Full Archive")))
    : (category ? (lang === "es" ? "Sección" : "Section") : (lang === "es" ? "Archivo" : "The Archive"));
  const articleNoun = lang === "es"
    ? (filtered.length === 1 ? "artículo" : "artículos")
    : (filtered.length === 1 ? "article" : "articles");
  const isFruitReports = category === "Fruit Reports";
  const fruitReportSeries = ["Freeze-Dried Guide", "Fruit Variety Guide"];
  const seriesCounts = isFruitReports
    ? Object.fromEntries(fruitReportSeries.map(series => [
        series,
        filtered.filter(a => (a.report_series || "Freeze-Dried Guide") === series).length,
      ]))
    : {};
  const visibleFruitReportSeries = fruitReportSeries.filter(series => (seriesCounts[series] || 0) > 0);

  const rows = filtered.map(a => `
    <article class="list__row"${isFruitReports ? ` data-report-series="${escapeHtml(a.report_series || "Freeze-Dried Guide")}"` : ""}>
      <a href="${articleUrl(a.id, lang)}" style="display:contents;color:inherit">
        <div class="list__img">${renderCover(a)}</div>
        <div>
          <div class="list__cat">${escapeHtml(lang === "es" ? iCategoryLabel("es", a.category) : a.category)}${isFruitReports && a.report_series ? ` · ${escapeHtml(a.report_series)}` : ""}</div>
          <h3 class="list__title">${escapeHtml(a.title)}</h3>
          <p class="list__sum">${escapeHtml(a.summary)}</p>
        </div>
        <div class="list__meta">
          <span>${escapeHtml(a.dateLabel)}</span>
          <span>${escapeHtml(a.read)}</span>
        </div>
      </a>
    </article>`).join("");

  const empty = lang === "es"
    ? `<div style="padding:80px 0;text-align:center;color:var(--muted)">
        <p>Todavía no hay artículos en español en esta sección.</p>
        <p>La edición en español está creciendo — <a href="/contact/" style="color:var(--mint-deep)">escríbenos</a> para sugerir una traducción.</p>
      </div>`
    : `
    <div style="padding:80px 0;text-align:center;color:var(--muted)">
      <p>No articles published in this section yet.</p>
      <p>We're working on it — <a href="/contact/" style="color:var(--mint-deep)">get in touch</a> for updates.</p>
    </div>`;
  const fruitReportTabs = isFruitReports ? `
    <div class="report-tabs" data-report-tabs>
      ${visibleFruitReportSeries.length > 1 ? `<button class="report-tab is-active" type="button" data-series="all">
        <span>All</span>
        <strong>${filtered.length}</strong>
      </button>` : ""}
      ${visibleFruitReportSeries.map(series => `
        <button class="report-tab${visibleFruitReportSeries.length === 1 ? " is-active" : ""}" type="button" data-series="${escapeHtml(series)}">
          <span>${escapeHtml(series === "Fruit Variety Guide" ? "Fruit Variety Report" : series)}</span>
          <strong>${seriesCounts[series] || 0}</strong>
        </button>`).join("")}
    </div>
    <script>
      (() => {
        const tabs = document.querySelector("[data-report-tabs]");
        if (!tabs) return;
        const bindTabs = () => {
          const rows = [...document.querySelectorAll("[data-report-series]")];
          const buttons = [...tabs.querySelectorAll("[data-series]")];
          const setSeries = (series) => {
            buttons.forEach(button => {
              const isActive = button.dataset.series === series;
              button.classList.toggle("is-active", isActive);
              button.setAttribute("aria-pressed", String(isActive));
            });
            rows.forEach(row => {
              row.classList.toggle("is-filtered-out", series !== "all" && row.dataset.reportSeries !== series);
            });
          };
          buttons.forEach(button => button.addEventListener("click", () => setSeries(button.dataset.series)));
          setSeries(tabs.querySelector(".is-active")?.dataset.series || "all");
        };
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", bindTabs);
        } else {
          bindTabs();
        }
      })();
    </script>` : "";

  const headHtml = suppressHead
    ? `<section class="archive-head">
         <div class="container">
           <span class="eyebrow">${eyebrow} · ${filtered.length} ${articleNoun}</span>
         </div>
       </section>`
    : `<section class="page-head">
         <div class="container">
           <span class="eyebrow">${eyebrow} · ${filtered.length} ${articleNoun}</span>
           <h1>${escapeHtml(headTitle)}</h1>
           <p>${escapeHtml(headSub)}</p>
         </div>
       </section>`;

  return `
    ${headHtml}
    <div class="container">
      ${fruitReportTabs}
      <div class="list">${filtered.length ? rows : empty}</div>
    </div>`;
}

// ---------- Annual / flagship industry report ----------
// Long-form flagship pages (e.g. /state-of-freeze-dried-fruit-2026/) get a
// dedicated template with a covered hero, edition banner, sticky-feel TOC,
// and a heavier reference apparatus at the bottom. This is the highest-
// authority asset format in B2B food publishing — used as the answer when
// LLMs are asked "what's the state of the freeze-dried fruit category."
function renderReportBody({ report, mailto, site }) {
  const bodyHtml = ensureH2Anchors(report.bodyHtml);

  const tocHtml = report.sections.length
    ? `<nav class="report-toc" aria-label="${escapeHtml(report.toc_label)}">
         <div class="report-toc__eyebrow">${escapeHtml(report.toc_label)}</div>
         <ol class="report-toc__list">
           ${report.sections.map((s, i) => `
             <li class="report-toc__item">
               <a class="report-toc__link" href="#${escapeHtml(s.id)}">
                 <span class="report-toc__num">${String(i + 1).padStart(2, "0")}</span>
                 <span class="report-toc__title">${escapeHtml(s.title)}</span>
               </a>
             </li>`).join("")}
         </ol>
       </nav>` : "";

  const takeawaysHtml = report.takeaways && report.takeaways.length
    ? `<div class="report-takeaways">
         <div class="report-takeaways__title">Key takeaways</div>
         <ul>${report.takeaways.map(t => `<li>${renderInlineMd(t)}</li>`).join("")}</ul>
       </div>` : "";

  const sourcesHtml = renderSources(report.sources);

  const editorialUrl = site?.editorial?.url || "/editorial/";
  const editorialByline = site?.editorial?.byline || "Editorial Desk";
  const publishedIso = report.date ? report.date.toISOString().slice(0, 10) : "";
  const updatedIso = report.updated ? report.updated.toISOString().slice(0, 10) : "";

  return `
    <article class="report">
      <section class="report-cover">
        <div class="container-narrow">
          <div class="report-cover__edition">${escapeHtml(report.edition || "Annual Report")}</div>
          <h1 class="report-cover__title">${escapeHtml(report.title)}</h1>
          ${report.subtitle ? `<p class="report-cover__subtitle">${escapeHtml(report.subtitle)}</p>` : ""}
          <div class="report-cover__meta">
            <span><time datetime="${publishedIso}">${escapeHtml(report.dateLabel)}</time></span>
            ${report.read ? `<span>${escapeHtml(report.read)}</span>` : ""}
            <span>By <a href="${editorialUrl}" class="byline-link" rel="author">${escapeHtml(editorialByline)}</a></span>
          </div>
          ${report.isUpdated ? `<p class="report-cover__updated"><span class="meta-updated">Updated</span> <time datetime="${updatedIso}">${escapeHtml(report.updatedLabel)}</time></p>` : ""}
        </div>
      </section>

      <section class="report-intro">
        <div class="container-narrow">
          <p class="report-intro__lede">${escapeHtml(report.intro)}</p>
        </div>
      </section>

      <div class="container-narrow report-body">
        ${tocHtml}
        ${takeawaysHtml}
        <div class="prose report-prose">${bodyHtml}</div>
        ${sourcesHtml}

        <div class="exchange-cta">
          <div>
            <strong>Building or buying in the category?</strong>
            <div class="muted" style="font-size:14px;margin-top:4px">Suppliers, brands, and operators can share notes for the next edition.</div>
          </div>
          <a href="${mailto.join}" class="btn btn-primary">Join the Exchange ${Icons.arrow}</a>
        </div>
      </div>
    </article>`;
}

function reportJsonLd({ site, report }) {
  const lang = report.lang || "en";
  const pathForLang = lang === "es" ? `/es/${report.slug}/` : `/${report.slug}/`;
  const url = absUrl(site, pathForLang);
  const published = report.date ? report.date.toISOString() : undefined;
  const ogPrefix = lang === "es" ? "/images/og/es" : "/images/og";
  const reportNode = {
    "@context": "https://schema.org",
    "@type": "Report",
    headline: report.title,
    description: report.summary || report.intro || "",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    inLanguage: schemaLanguage(lang),
    isAccessibleForFree: true,
    image: `${site.url.replace(/\/$/, "")}${ogPrefix}/${report.slug}.png`,
    author: editorialNode(site),
    publisher: organizationNode(site),
    reportNumber: report.edition || "",
    abstract: report.summary || "",
    keywords: [
      "freeze-dried fruit",
      "industry report",
      "category overview",
      "freeze-dried fruit market",
      "freeze-dried fruit supply",
    ],
    // SpeakableSpecification — voice assistants and AI engines should read
    // the lede, the takeaways block, and every H2 in the body.
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [".report-intro__lede", ".report-takeaways", ".report-prose h2"],
    },
  };
  if (published) {
    reportNode.datePublished = published;
    reportNode.dateModified = report.updated ? report.updated.toISOString() : published;
  }
  if (report.sources && report.sources.length) {
    reportNode.citation = report.sources.map(s => {
      const node = { "@type": "CreativeWork", name: s.title, url: s.url };
      if (s.publisher) node.publisher = { "@type": "Organization", name: s.publisher };
      return node;
    });
  }
  const trail = [
    { name: lang === "es" ? "Inicio" : "Home", path: lang === "es" ? "/es/" : "/" },
    { name: report.title, path: pathForLang },
  ];
  return [reportNode, breadcrumbsNode(site, trail)];
}

function renderArticle({ article, related, continueReading, mailto, site }) {
  const intro = article.intro || article.summary;
  const takeaways = article.takeaways && article.takeaways.length
    ? `<div class="takeaways">
         <div class="takeaways__title">Key Takeaways</div>
         <ul>${article.takeaways.map(t => `<li>${renderInlineMd(t)}</li>`).join("")}</ul>
       </div>` : "";

  // Visible FAQ block, paired with FAQPage JSON-LD in articleJsonLd().
  // Rendered as h2 + h3 + div so AI engines and screen readers parse the
  // Q&A pairs without any JS or accordion behavior.
  const faqHtml = article.faqs && article.faqs.length
    ? `<section class="faq" aria-labelledby="faq-heading">
         <h2 id="faq-heading">Frequently Asked Questions</h2>
         ${article.faqs.map(f => `
           <div class="faq__item">
             <h3 class="faq__q">${escapeHtml(f.q)}</h3>
             <div class="faq__a">${f.aHtml || renderMarkdown(f.a)}</div>
           </div>`).join("")}
       </section>` : "";

  const relatedHtml = related.map(r => `
    <a href="${articleUrl(r.id)}" class="related__card" style="display:block;color:inherit">
      <div class="related__img">${renderCover(r)}</div>
      <div class="related__cat">${escapeHtml(r.category)}</div>
      <h4 class="related__title">${escapeHtml(r.title)}</h4>
    </a>`).join("");

  // The byline date: when an article carries an `updated:` newer than its
  // publish date, the freshness date becomes the headline meta and the original
  // date drops to a small italic line below — same masthead language as the
  // rest of the field guide. <time datetime=…> markers give Google and AI
  // engines a clean signal independent of the JSON-LD payload.
  const publishedIso = article.date ? article.date.toISOString().slice(0, 10) : "";
  const updatedIso = article.updated ? article.updated.toISOString().slice(0, 10) : "";
  const dateMetaHtml = article.isUpdated
    ? `<span><span class="meta-updated">Updated</span> <time datetime="${updatedIso}">${escapeHtml(article.updatedLabel)}</time></span>`
    : `<span><time datetime="${publishedIso}">${escapeHtml(article.dateLabel)}</time></span>`;

  // Supplementary italic line beneath the meta strip: "By <byline>" always
  // shown (links to the editorial desk page), with the originally-published
  // date appended when the article carries an `updated:`. Combining these
  // into a single small serif-italic line keeps the masthead clean and gives
  // the eye one place to look for provenance.
  const editorialUrl = site?.editorial?.url || "/editorial/";
  const editorialByline = site?.editorial?.byline || "Editorial Desk";
  const bylineParts = [
    `By <a href="${editorialUrl}" class="byline-link" rel="author">${escapeHtml(editorialByline)}</a>`,
  ];
  if (article.isUpdated) {
    bylineParts.push(`Originally published <time datetime="${publishedIso}">${escapeHtml(article.dateLabel)}</time>`);
  }
  const originalLineHtml = `<p class="article-head__original">${bylineParts.join(" · ")}</p>`;

  return `
    <article>
      <div class="container-narrow article-head">
        <div class="article-head__meta">
          <span class="accent">${escapeHtml(article.category)}</span>
          ${dateMetaHtml}
          <span>${escapeHtml(article.read)}</span>
        </div>
        ${originalLineHtml}
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
        ${faqHtml}
        ${renderSources(article.sources)}
        ${renderContinueReading(continueReading, article.category)}
        ${renderCompareWithStrip(SLUG_TO_FRUIT[article.id])}

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

function renderEditorialBody({ site, mailto }) {
  const byline = site.editorial?.byline || "Editorial Desk";
  const tagline = site.editorial?.tagline || "Independent editorial team.";

  return `
    <section class="page-head">
      <div class="container">
        <span class="eyebrow">Editorial · Masthead</span>
        <h1>${escapeHtml(byline)}</h1>
        <p>${escapeHtml(tagline)}</p>
      </div>
    </section>
    <section class="section">
      <div class="container-narrow">
        <div class="prose">
          <h2>Who writes the field guide</h2>
          <p>The ${escapeHtml(byline)} is the collective byline used on Freeze-Dried-Fruit.com. Articles are produced by a small editorial team building in the fruit snack space — operators, ingredient buyers, and writers who work directly with freeze-dried fruit suppliers, equipment, and product development.</p>
          <p>We publish under a single editorial byline rather than individual author names because the work is collaborative. A typical article involves research, supplier conversations, internal review, and editing across more than one contributor. Attributing it to one person would misrepresent how the field guide actually gets made.</p>

          <h2>What we cover</h2>
          <p>The editorial desk focuses on five areas:</p>
          <ul>
            <li><strong>Technology</strong> — freeze-drying process, packaging, moisture and water activity control, equipment behavior, shelf-life mechanisms.</li>
            <li><strong>Industry Insights</strong> — sourcing, supplier evaluation, landed cost, pricing pressure, private label, trade-structure shifts.</li>
            <li><strong>Labels &amp; Quality</strong> — ingredient labels, breakage and powder specs, value comparison, label claims and grading.</li>
            <li><strong>Applications</strong> — consumer use cases, storage after opening, toppings, snack formats, recipe-adjacent topics.</li>
            <li><strong>Fruit Reports</strong> — variety-level guides covering origin, cultivar behavior, processing implications, and sourcing reality for specific fruits.</li>
          </ul>

          <h2>How articles are researched</h2>
          <p>Every article draws on a combination of published industry research, supplier and operator conversations, and direct observation of the product category — including labels, packaging, finished samples, and trade reports. Where a claim depends on a specific number, we either cite the source or note the typical range observed.</p>
          <p>Technical articles are reviewed against the freeze-drying literature and against the practical experience of operators who work with the equipment and the fruit. Where the literature and operator practice disagree, we note both rather than pick one.</p>
          <p>For more on standards, scope, and the work we will not do, see the <a href="/methodology/">Editorial Methodology</a>.</p>

          <h2>What we will not do</h2>
          <ul>
            <li>We do not invent author identities or attach articles to fictional people.</li>
            <li>We do not accept paid placements, sponsored articles, or affiliate compensation tied to editorial coverage.</li>
            <li>We do not write articles to promote a specific brand, supplier, or product.</li>
            <li>We do not present marketing language ("premium," "game-changer," "the best") as a quality standard.</li>
            <li>We do not make health, nutrition, or shelf-life claims that would require formal validation we have not performed.</li>
          </ul>

          <h2>Editorial contact</h2>
          <p>For story tips, corrections, and editorial feedback: <a href="mailto:${escapeHtml(site.email?.hello || "")}">${escapeHtml(site.email?.hello || "")}</a>.</p>
          <p>For press inquiries and republication requests: <a href="mailto:${escapeHtml(site.email?.press || "")}">${escapeHtml(site.email?.press || "")}</a>.</p>
          <p>For industry insight and supplier contributions: <a href="/exchange/">Industry Exchange</a>.</p>

          <h2>Corrections</h2>
          <p>If you spot a factual error, an outdated claim, or a missing nuance, please <a href="mailto:${escapeHtml(site.email?.hello || "")}">tell us</a>. Corrections are made promptly and the article is marked as updated when the change is material.</p>
        </div>

        <div class="exchange-cta">
          <div>
            <strong>Want to contribute or share category insight?</strong>
            <div class="muted" style="font-size:14px;margin-top:4px">Suppliers, operators, and observers welcome.</div>
          </div>
          <a href="${mailto.join}" class="btn btn-primary">Join the Exchange ${Icons.arrow}</a>
        </div>
      </div>
    </section>`;
}

function renderMethodologyBody({ mailto }) {
  return `
    <section class="page-head">
      <div class="container">
        <span class="eyebrow">Editorial · Methodology</span>
        <h1>How We Research and Write</h1>
        <p>The standards behind every article on Freeze-Dried-Fruit.com — what we cover, how we evaluate, and what we choose not to claim.</p>
      </div>
    </section>
    <section class="section">
      <div class="container-narrow">
        <div class="prose">
          <h2>What this site is</h2>
          <p>Freeze-Dried-Fruit.com is an independent field guide to the freeze-dried fruit category. We cover quality, processing, sourcing, packaging, pricing, applications, and the parts of the category that usually go unwritten. Articles are written for consumers, brand founders, ingredient buyers, suppliers, and operators — readers who want a precise picture of how this category actually works.</p>

          <h2>What we cover</h2>
          <p>We write about fruit chemistry, freeze-drying process design, residual moisture and water activity, packaging barrier behavior, supplier evaluation, landed cost, ingredient labels, and consumer use cases. We avoid health and medical claims. We do not write product reviews of named brands.</p>

          <h2>How articles are researched</h2>
          <p>Each article draws on a combination of three sources: published industry research, supplier and operator conversations, and direct observation of the product category — including labels, packaging, finished samples, and trade reports. When a claim depends on a specific number, we either cite the source or note the typical range observed in the category.</p>
          <p>Technical articles are reviewed against the freeze-drying literature and against the practical experience of operators who work with the equipment and the fruit. Where the literature and operator practice disagree, we note both.</p>

          <h2>What we will not do</h2>
          <ul>
            <li>We do not accept paid placements or sponsored articles.</li>
            <li>We do not run affiliate links in editorial content.</li>
            <li>We do not write articles to promote a specific brand, supplier, or product.</li>
            <li>We do not make health, nutrition, or shelf-life claims that would require formal validation we have not performed.</li>
            <li>We do not present marketing language ("premium," "game-changer," "the best") as a quality standard.</li>
          </ul>

          <h2>Disclosures</h2>
          <p>Freeze-Dried-Fruit.com is created by a team building in the fruit snack space. We may occasionally reference our own product development experience, but the site is built as a broader educational and industry resource — not as a brand channel. Suppliers, equipment owners, and operators who submit information through the Industry Exchange are not granted editorial coverage in exchange.</p>

          <h2>Corrections policy</h2>
          <p>If you spot a factual error, an outdated claim, or a missing nuance, please tell us. Corrections are made promptly and we mark the article as updated when the change is material.</p>

          <h2>Update cadence</h2>
          <p>Articles in technical, supplier, and quality categories are reviewed periodically as the category evolves — particularly around packaging standards, certifications, and pricing dynamics. Consumer-facing articles are updated when reader feedback or new evidence justifies it. The News Wire is auto-updated several times per day from public RSS sources.</p>

          <h2>How to contribute</h2>
          <p>If you operate in the freeze-dried fruit category — as a supplier, equipment owner, brand, buyer, retailer, or researcher — we welcome submissions through the <a href="/exchange/">Industry Exchange</a>. Press inquiries should go to <a href="mailto:press@freeze-dried-fruit.com">press@freeze-dried-fruit.com</a>. Story tips and corrections to <a href="mailto:hello@freeze-dried-fruit.com">hello@freeze-dried-fruit.com</a>.</p>
        </div>

        <div class="exchange-cta">
          <div>
            <strong>Have category insight to share?</strong>
            <div class="muted" style="font-size:14px;margin-top:4px">Suppliers, operators, and observers welcome.</div>
          </div>
          <a href="${mailto.join}" class="btn btn-primary">Join the Exchange ${Icons.arrow}</a>
        </div>
      </div>
    </section>`;
}

// ---------- Glossary ----------

// English glossary data — moved to scripts/lib/glossary-data.mjs together
// with the Spanish translation. We keep an alias of GLOSSARY for the legacy
// code path that builds the English /glossary/ pages.
const GLOSSARY = GLOSSARY_EN;
// Suppress unused-block declarations below; the original inline GLOSSARY
// array has been replaced with the imported value.

// Build a function that walks rendered article HTML and links the first
// occurrence of each glossary term to /glossary/#slug. We deliberately avoid
// touching headings, code blocks, and any text already inside an <a> so
// auto-linking never breaks structure or generates nested links.
function createGlossaryLinker(terms, urlPrefix = "") {
  // Skip text inside these tags. Headings are excluded so the article's
  // outline stays a clean visual hierarchy. Existing <a> blocks are excluded
  // to prevent nested links. <code>/<pre>/<script>/<style> are excluded for
  // correctness.
  const SKIP_TAGS = new Set([
    "a", "h1", "h2", "h3", "h4", "h5", "h6",
    "code", "pre", "script", "style", "title",
  ]);
  const VOID_TAGS = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "source", "track", "wbr",
  ]);

  // Sort patterns longest-first so "Water activity (aw)" can't be partially
  // shadowed by "water activity" and "Individually Quick-Frozen" wins over
  // "Quick-Frozen". Each pattern carries the slug + canonical term to link to.
  const patterns = [];
  for (const t of terms) {
    const aliases = [t.term, ...(t.aliases || [])];
    for (const alias of aliases) {
      patterns.push({ alias, slug: t.slug });
    }
  }
  patterns.sort((a, b) => b.alias.length - a.alias.length);

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // For each pattern we precompile one regex. Word-boundary `\b` works for
  // most aliases; for aliases that start or end with a non-word character
  // (e.g. ends in ")"), we relax the boundary on that side.
  for (const p of patterns) {
    const startBoundary = /^[\w]/.test(p.alias) ? "\\b" : "";
    const endBoundary = /[\w]$/.test(p.alias) ? "\\b" : "";
    p.regex = new RegExp(`${startBoundary}(${escapeRe(p.alias)})${endBoundary}`, "i");
  }

  return function linkGlossary(html, usedSlugs) {
    if (!html) return html;
    const used = usedSlugs instanceof Set ? usedSlugs : new Set();

    // Walk the HTML once, separating it into tokens of {kind: 'text'|'tag', value}.
    // For text tokens, attempt term insertion only when not inside any SKIP_TAGS.
    const out = [];
    const stack = []; // open-tag stack of lowercase tag names
    let i = 0;
    while (i < html.length) {
      const lt = html.indexOf("<", i);
      if (lt === -1) {
        out.push(processText(html.slice(i), stack));
        break;
      }
      if (lt > i) out.push(processText(html.slice(i, lt), stack));
      const gt = html.indexOf(">", lt);
      if (gt === -1) {
        out.push(html.slice(lt));
        break;
      }
      const tag = html.slice(lt, gt + 1);
      out.push(tag);
      // Parse tag to track open/close for the skip-stack.
      const m = /^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(tag);
      if (m) {
        const isClose = m[1] === "/";
        const name = m[2].toLowerCase();
        const selfClosing = /\/\s*>$/.test(tag) || VOID_TAGS.has(name);
        if (isClose) {
          const idx = stack.lastIndexOf(name);
          if (idx >= 0) stack.splice(idx, 1);
        } else if (!selfClosing) {
          stack.push(name);
        }
      }
      i = gt + 1;
    }
    return out.join("");

    function processText(text, openStack) {
      if (!text) return text;
      if (openStack.some(t => SKIP_TAGS.has(t))) return text;

      let working = text;
      let result = "";
      // For each pattern not yet used in this article, try first match.
      // We iterate longest-first so longer aliases bind before shorter ones.
      // Because we mutate `working` after each insertion, we restart scanning
      // from the position right after the inserted link to avoid linking the
      // same surface twice within one text node.
      for (const p of patterns) {
        if (used.has(p.slug)) continue;
        const m = p.regex.exec(working);
        if (!m) continue;
        const matched = m[0];
        const before = working.slice(0, m.index);
        const after = working.slice(m.index + matched.length);
        // Flush text before the match to the result; reset working to the
        // text after so subsequent patterns scan only the remainder. This
        // keeps the first-occurrence-per-article invariant easy to reason about.
        result += before + `<a class="glossary-link" href="${urlPrefix}/glossary/${p.slug}/" data-glossary="${p.slug}">${matched}</a>`;
        working = after;
        used.add(p.slug);
      }
      result += working;
      return result;
    }
  };
}

// Standard category order used across all glossary pages (hub + per-term).
// English category ordering — moved to scripts/lib/glossary-data.mjs
// (alongside the Spanish ordering). Aliased here for the legacy code path.
const GLOSSARY_CATEGORY_ORDER = GLOSSARY_CATEGORY_ORDER_EN;

// Extract the first sentence of a definition for use as a short summary on
// the hub. Falls back to the full definition if no sentence boundary found.
// Strips markdown emphasis so the summary reads cleanly without rendering.
function firstSentence(s) {
  const clean = String(s || "").replace(/\*([^*]+)\*/g, "$1");
  const m = /^(.{20,}?[.!?])(\s|$)/.exec(clean);
  return m ? m[1] : clean;
}

// All glossary functions below take an explicit `glossary` array and `lang`
// (with category order + UI labels derived from lang) so we can run the
// same render pipeline twice — once for English (/glossary/), once for
// Spanish (/es/glossary/). Both locales share the same slug for every term,
// so data-glossary="<slug>" markers from either language's auto-linker
// flow into the same mention index.

// Sibling glossary terms in the same category, excluding self.
function relatedGlossaryTerms(slug, glossary = GLOSSARY) {
  const self = glossary.find(t => t.slug === slug);
  if (!self) return [];
  return glossary.filter(t => t.slug !== slug && t.category === self.category);
}

// Walk every article's body and FAQ HTML for `data-glossary="<slug>"` markers
// (left there by the auto-linker) and build a reverse index from term slug to
// the list of articles that mention it. Used to surface "articles that use
// this term" on each per-term page. Slugs are locale-invariant so a single
// pass over the article set produces an index usable in both /glossary/
// and /es/glossary/ — but we pass a `glossary` to initialize the index keys.
function buildGlossaryMentionIndex(articles, glossary = GLOSSARY) {
  const index = Object.fromEntries(glossary.map(t => [t.slug, []]));
  const re = /data-glossary="([^"]+)"/g;
  for (const a of articles) {
    const seen = new Set();
    const corpus = [a.bodyHtml || ""].concat(
      Array.isArray(a.faqs) ? a.faqs.map(f => f.aHtml || "") : []
    ).join(" ");
    let m;
    while ((m = re.exec(corpus))) seen.add(m[1]);
    for (const slug of seen) {
      if (index[slug]) index[slug].push(a);
    }
  }
  for (const slug of Object.keys(index)) {
    index[slug].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  }
  return index;
}

// Hub page renderer — accepts the glossary, category order, and label set
// for the target locale. Same structural template for both languages; only
// the strings and URL prefix differ.
function renderGlossaryBody(glossary = GLOSSARY, categoryOrder = GLOSSARY_CATEGORY_ORDER, lang = "en") {
  const labels = GLOSSARY_LABELS[lang] || GLOSSARY_LABELS.en;
  const urlPrefix = lang === "en" ? "" : `/${lang}`;
  const byCategory = new Map();
  for (const t of glossary) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category).push(t);
  }

  const tocHtml = categoryOrder.map(cat => `
    <div class="glossary-toc__group">
      <h3>${escapeHtml(cat)}</h3>
      <ul>${(byCategory.get(cat) || []).map(t => `
        <li><a href="${urlPrefix}/glossary/${t.slug}/">${escapeHtml(t.term)}</a></li>`).join("")}</ul>
    </div>`).join("");

  const sectionsHtml = categoryOrder.map(cat => `
    <section class="glossary-section">
      <h2 class="glossary-section__title">${escapeHtml(cat)}</h2>
      <dl class="glossary-list">
        ${(byCategory.get(cat) || []).map(t => `
          <div class="glossary-item" id="${t.slug}">
            <dt class="glossary-item__term"><a href="${urlPrefix}/glossary/${t.slug}/" class="glossary-item__link">${escapeHtml(t.term)}</a></dt>
            <dd class="glossary-item__def">${renderInlineMd(firstSentence(t.definition))} <a href="${urlPrefix}/glossary/${t.slug}/" class="glossary-item__more">${escapeHtml(labels.readFullDefinition)} ${Icons.arrowSmall}</a></dd>
          </div>`).join("")}
      </dl>
    </section>`).join("");

  return `
    <section class="page-head">
      <div class="container">
        <span class="eyebrow">${escapeHtml(labels.eyebrowPrefix)} · ${glossary.length} ${escapeHtml(labels.termsSuffix)}</span>
        <h1>${escapeHtml(labels.pageTitle)}</h1>
        <p>${escapeHtml(labels.pageIntro)}</p>
      </div>
    </section>
    <section class="section">
      <div class="container-narrow">
        <nav class="glossary-toc" aria-label="${escapeHtml(labels.contentsLabel)}">${tocHtml}</nav>
        ${sectionsHtml}
      </div>
    </section>`;
}

function glossaryJsonLd({ site, glossary = GLOSSARY, lang = "en" }) {
  const labels = GLOSSARY_LABELS[lang] || GLOSSARY_LABELS.en;
  const urlPrefix = lang === "en" ? "" : `/${lang}`;
  const hubUrl = `${site.url}${urlPrefix}/glossary/`;
  const definedTerms = glossary.map(t => ({
    "@type": "DefinedTerm",
    "@id": `${site.url}${urlPrefix}/glossary/${t.slug}/#term`,
    name: t.term,
    description: firstSentence(t.definition).replace(/\*([^*]+)\*/g, "$1"),
    url: `${site.url}${urlPrefix}/glossary/${t.slug}/`,
    inDefinedTermSet: `${hubUrl}#glossary-set`,
    termCode: t.slug,
    inLanguage: lang === "en" ? "en-US" : "es",
  }));
  return [
    {
      "@context": "https://schema.org",
      "@type": "DefinedTermSet",
      "@id": `${hubUrl}#glossary-set`,
      name: labels.pageTitle,
      url: hubUrl,
      inLanguage: lang === "en" ? "en-US" : "es",
      isPartOf: { "@id": `${site.url}/#website` },
      hasDefinedTerm: definedTerms,
    },
    breadcrumbsNode(site, [
      { name: labels.breadcrumbHome, path: urlPrefix ? `${urlPrefix}/` : "/" },
      { name: labels.breadcrumbGlossary, path: `${urlPrefix}/glossary/` },
    ]),
  ];
}

// Per-term page body. Accepts locale-aware glossary + labels and emits
// article links with the right locale prefix.
function renderGlossaryTermBody(term, related, mentioning, lang = "en") {
  const labels = GLOSSARY_LABELS[lang] || GLOSSARY_LABELS.en;
  const urlPrefix = lang === "en" ? "" : `/${lang}`;

  const relatedHtml = related.length ? `
    <section class="glossary-term__related" aria-labelledby="related-heading">
      <h2 id="related-heading" class="glossary-term__h2">${escapeHtml(labels.relatedTermsInPrefix)} ${escapeHtml(term.category)}</h2>
      <div class="glossary-term__related-grid">
        ${related.map(t => `
          <a href="${urlPrefix}/glossary/${t.slug}/" class="glossary-term__related-card">
            <span class="glossary-term__related-name">${escapeHtml(t.term)}</span>
            <span class="glossary-term__related-summary">${escapeHtml(firstSentence(t.definition).replace(/\*([^*]+)\*/g, "$1"))}</span>
          </a>`).join("")}
      </div>
    </section>` : "";

  const mentionsHtml = mentioning.length ? `
    <section class="glossary-term__mentions" aria-labelledby="mentions-heading">
      <h2 id="mentions-heading" class="glossary-term__h2">${escapeHtml(labels.mentionsHeading)}</h2>
      <ul class="glossary-term__mentions-list">
        ${mentioning.slice(0, 8).map(a => `
          <li>
            <a href="${articleUrl(a.id, lang)}" class="glossary-term__mention">
              <span class="glossary-term__mention-cat">${escapeHtml(a.category)}</span>
              <span class="glossary-term__mention-title">${escapeHtml(a.title)}</span>
              <span class="glossary-term__mention-date">${escapeHtml(a.dateLabel || "")}${a.read ? ` · ${escapeHtml(a.read)}` : ""}</span>
            </a>
          </li>`).join("")}
      </ul>
    </section>` : `
    <section class="glossary-term__mentions glossary-term__mentions--empty">
      <p class="muted" style="font-style:italic">${escapeHtml(labels.emptyMentions)} <a href="/search/" class="glossary-term__inline-link">${escapeHtml(labels.emptyMentionsLink)}</a>.</p>
    </section>`;

  return `
    <section class="page-head glossary-term__head">
      <div class="container">
        <span class="eyebrow"><a href="${urlPrefix}/glossary/" class="eyebrow-link">${escapeHtml(labels.glossaryEyebrow)}</a> · ${escapeHtml(term.category)}</span>
        <h1>${escapeHtml(term.term)}</h1>
      </div>
    </section>
    <section class="section">
      <div class="container-narrow glossary-term">
        <div class="glossary-term__definition">${renderInlineMd(term.definition)}</div>
        ${relatedHtml}
        ${mentionsHtml}
        <div class="glossary-term__back">
          <a href="${urlPrefix}/glossary/" class="glossary-term__back-link">${Icons.arrow ? "← " : ""}${escapeHtml(labels.backToAll)}</a>
        </div>
      </div>
    </section>`;
}

function glossaryTermJsonLd({ site, term, mentioning, lang = "en" }) {
  const labels = GLOSSARY_LABELS[lang] || GLOSSARY_LABELS.en;
  const urlPrefix = lang === "en" ? "" : `/${lang}`;
  const hubUrl = `${site.url}${urlPrefix}/glossary/`;
  const url = `${hubUrl}${term.slug}/`;
  const nodes = [
    {
      "@context": "https://schema.org",
      "@type": "DefinedTerm",
      "@id": `${url}#term`,
      name: term.term,
      description: term.definition.replace(/\*([^*]+)\*/g, "$1"),
      url,
      termCode: term.slug,
      inLanguage: lang === "en" ? "en-US" : "es",
      inDefinedTermSet: {
        "@id": `${hubUrl}#glossary-set`,
        "@type": "DefinedTermSet",
        name: labels.pageTitle,
        url: hubUrl,
      },
    },
    breadcrumbsNode(site, [
      { name: labels.breadcrumbHome, path: urlPrefix ? `${urlPrefix}/` : "/" },
      { name: labels.breadcrumbGlossary, path: `${urlPrefix}/glossary/` },
      { name: term.term, path: `${urlPrefix}/glossary/${term.slug}/` },
    ]),
  ];
  if (mentioning && mentioning.length) {
    nodes.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Articles using "${term.term}"`,
      url: `${url}#mentioned-by`,
      numberOfItems: Math.min(mentioning.length, 8),
      itemListElement: mentioning.slice(0, 8).map((a, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absUrl(site, articleUrl(a.id, lang)),
        name: a.title,
      })),
    });
  }
  return nodes;
}

function renderSearchBody({ articles }) {
  const data = articles.map(a => ({
    title: a.title,
    category: a.category,
    summary: a.summary,
    intro: a.intro,
    url: articleUrl(a.id),
    date: a.dateLabel,
    takeaways: a.takeaways || [],
  }));
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return `
    <section class="page-head">
      <div class="container">
        <span class="eyebrow">Search · Freeze-Dried-Fruit.com</span>
        <h1>Search the Field Guide</h1>
        <p>Search articles, fruit reports, quality notes, technology explainers, buyer guides, and packaging topics published on this site.</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <form class="search-panel" role="search" action="/search/" method="get">
          <label class="site-search__label" for="search-page-input">Search articles</label>
          <div class="search-panel__row">
            <input id="search-page-input" name="q" type="search" placeholder="Try moisture, mango, supplier, packaging..." autocomplete="off">
            <button class="btn btn-primary" type="submit">Search</button>
          </div>
        </form>
        <div id="searchSummary" class="eyebrow" style="margin-bottom:16px"></div>
        <div id="searchResults" class="search-results"></div>
      </div>
    </section>
    <script type="application/json" id="search-data">${json}</script>
    <script>
(function () {
  var input = document.getElementById('search-page-input');
  var results = document.getElementById('searchResults');
  var summary = document.getElementById('searchSummary');
  var dataNode = document.getElementById('search-data');
  var data = dataNode ? JSON.parse(dataNode.textContent) : [];

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function searchable(article) {
    return [
      article.title,
      article.category,
      article.summary,
      article.intro,
      article.date,
      (article.takeaways || []).join(' ')
    ].join(' ').toLowerCase();
  }

  function render(query) {
    var q = query.trim().toLowerCase();
    var matches = q
      ? data.filter(function (article) { return searchable(article).includes(q); })
      : data;

    summary.textContent = q
      ? matches.length + ' result' + (matches.length === 1 ? '' : 's') + ' for "' + query.trim() + '"'
      : 'Latest articles';

    if (!matches.length) {
      results.innerHTML = '<div class="search-empty">No matching articles yet. Try a broader term like moisture, fruit, packaging, supplier, or quality.</div>';
      return;
    }

    results.innerHTML = matches.map(function (article) {
      return '<a class="search-result" href="' + escapeHtml(article.url) + '">' +
        '<div class="search-result__cat">' + escapeHtml(article.category) + (article.date ? ' · ' + escapeHtml(article.date) : '') + '</div>' +
        '<h2>' + escapeHtml(article.title) + '</h2>' +
        '<p>' + escapeHtml(article.summary || article.intro || '') + '</p>' +
      '</a>';
    }).join('');
  }

  var params = new URLSearchParams(window.location.search);
  var initial = params.get('q') || '';
  if (input) input.value = initial;
  render(initial);
})();
    </script>`;
}

// ---------- 404 Not Found page ----------
// Cloudflare Pages automatically serves /404.html for any URL that does not
// resolve to a static file. Our 404 is built to be useful, not punitive:
//   - Field-guide aesthetic, identical chrome to the rest of the site
//   - Inline site search (delegates to /search/?q=…)
//   - Five category cards so a misdirected visitor can re-enter the field guide
//   - A small "Most-read fruit reports" strip to recover lost long-tail traffic
//   - A mailto link for reporting persistent broken links
//
// The page renders with <meta name="robots" content="noindex,follow"> so it
// never enters the search index even if Google fetches it directly. GSC's
// Coverage report still surfaces 404 hits so we can spot patterns over time.
function render404Body({ site, mailto, articles, categories }) {
  // Top 6 most recent fruit-report articles — the long-tail rescue set, since
  // these are the most-Googled "what is freeze-dried <fruit>" entry points
  // and most likely to have been hit via an outdated link.
  const recentReports = articles
    .filter(a => a.category === "Fruit Reports")
    .slice(0, 6);
  const reportCards = recentReports.map(a => `
    <a class="not-found__report-card" href="${articleUrl(a.id)}">
      <span class="not-found__report-cat">${escapeHtml(a.category)}</span>
      <span class="not-found__report-title">${escapeHtml(a.title)}</span>
    </a>`).join("");

  const categoryCards = categories.map(c => `
    <a class="not-found__cat-card" href="${categoryUrl(c)}">
      <span class="not-found__cat-name">${escapeHtml(c)}</span>
      <span class="not-found__cat-cta">Browse ${Icons.arrowSmall}</span>
    </a>`).join("");

  return `
    <section class="not-found">
      <div class="container-narrow">
        <div class="not-found__head">
          <div class="not-found__eyebrow">Error 404 · Page Not Found</div>
          <h1 class="not-found__h1">This page doesn't exist — yet.</h1>
          <p class="not-found__intro">The link you followed may be broken, or the article may have moved. The field guide is still here. Try a search, jump into one of the five categories, or pick up a fruit report below.</p>
        </div>

        <form class="not-found__search" role="search" action="/search/" method="get">
          <label class="not-found__search-label" for="not-found-q">Search the field guide</label>
          <div class="not-found__search-row">
            <input id="not-found-q" name="q" type="search" placeholder="Try moisture, mango, supplier, packaging…" autocomplete="off">
            <button class="btn btn-primary" type="submit">Search ${Icons.arrowSmall}</button>
          </div>
        </form>

        <div class="not-found__section">
          <div class="not-found__section-eyebrow">By category</div>
          <h2 class="not-found__section-h2">Where were you trying to go?</h2>
          <div class="not-found__cat-grid">${categoryCards}</div>
        </div>

        <div class="not-found__section">
          <div class="not-found__section-eyebrow">Most-read fruit reports</div>
          <h2 class="not-found__section-h2">Recent fruit reports</h2>
          <div class="not-found__report-grid">${reportCards}</div>
          <a class="not-found__see-all" href="/articles/category/fruit-reports/">See all fruit reports ${Icons.arrowSmall}</a>
        </div>

        <div class="not-found__report-link">
          <p>Followed a link that should work? <a href="${mailto.broken}">Tell us about it</a> and we will check the redirect.</p>
        </div>
      </div>
    </section>`;
}

// ---------- Spanish home page ----------
// A focused landing page for Spanish-speaking visitors. Not a full mirror
// of the English home — surfaces the translated articles, links to key
// English-only assets (compare, glossary, calculators) with brief Spanish
// labels so the visitor isn't dropped into an English-only experience.
function renderEsHomeBody({ articlesEs, reportsEs = [], mailto, site }) {
  const cards = articlesEs.map(a => `
    <a class="continue-reading__card" href="${articleUrl(a.id, "es")}">
      <span class="continue-reading__date">${escapeHtml(a.category)}</span>
      <span class="continue-reading__title">${escapeHtml(a.title)}</span>
      <span class="continue-reading__cta">Leer artículo ${Icons.arrowSmall}</span>
    </a>`).join("");

  // Featured-reports section. Annual report leads (mint-deep tile), then a
  // grid of all other reports (quarterly supply notes) underneath. Sort by
  // date descending so the most recent quarterly note shows first.
  const annualReport = reportsEs.find(r => /state-of/i.test(r.slug) || /annual|anual/i.test(r.edition || "")) || reportsEs[0];
  const quarterlyReports = reportsEs
    .filter(r => r !== annualReport)
    .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

  const annualFeaturedHtml = annualReport ? `
    <div class="continue-reading" style="background:var(--bg-tint);border-left:3px solid var(--mint-deep);margin:0 0 32px">
      <div class="continue-reading__eyebrow">${escapeHtml(annualReport.edition || "Reporte anual")}</div>
      <h2 class="continue-reading__heading">${escapeHtml(annualReport.title)}</h2>
      <p style="font-family:var(--serif);font-size:16px;line-height:1.5;color:var(--ink);margin:0 0 18px;max-width:62ch">${escapeHtml(annualReport.summary || annualReport.intro || "")}</p>
      <a class="continue-reading__all" href="/es/${escapeHtml(annualReport.slug)}/">Leer el reporte completo ${Icons.arrowSmall}</a>
    </div>` : "";

  const quarterlyGridHtml = quarterlyReports.length ? `
    <div class="continue-reading" style="background:transparent;border:0;padding:0;margin:0 0 48px">
      <div class="continue-reading__eyebrow">Notas trimestrales de suministro</div>
      <h2 class="continue-reading__heading">Reportes trimestrales</h2>
      <div class="continue-reading__grid">
        ${quarterlyReports.map(r => `
          <a class="continue-reading__card" href="/es/${escapeHtml(r.slug)}/">
            <span class="continue-reading__date">${escapeHtml(r.edition || "")}</span>
            <span class="continue-reading__title">${escapeHtml(r.title)}</span>
            <span class="continue-reading__cta">Leer la nota ${Icons.arrowSmall}</span>
          </a>`).join("")}
      </div>
    </div>` : "";

  const reportFeaturedHtml = annualFeaturedHtml + quarterlyGridHtml;

  return `
    <section class="page-head">
      <div class="container">
        <span class="eyebrow">Edición en Español · Freeze-Dried-Fruit.com</span>
        <h1>Guía de campo de la fruta liofilizada</h1>
        <p>Una guía editorial independiente sobre la fruta liofilizada — calidad, proceso, abastecimiento, empaque y aplicaciones. Escrita para consumidores curiosos, fundadores de snacks, compradores de ingredientes, proveedores y operadores.</p>
      </div>
    </section>

    <section class="section">
      <div class="container-narrow">
        ${reportFeaturedHtml}

        <div class="continue-reading" style="background:transparent;border:0;padding:0;margin:0">
          <div class="continue-reading__eyebrow">Artículos disponibles en Español</div>
          <h2 class="continue-reading__heading">Comienza por aquí</h2>
          <div class="continue-reading__grid">${cards}</div>
        </div>

        <div class="not-found__section" style="margin-top:48px">
          <div class="not-found__section-eyebrow">Más recursos</div>
          <h2 class="not-found__section-h2">Otros recursos del sitio</h2>
          <div class="not-found__cat-grid">
            <a class="not-found__cat-card" href="/compare/">
              <span class="not-found__cat-name">Comparar frutas (EN)</span>
              <span class="not-found__cat-cta">Abrir ${Icons.arrowSmall}</span>
            </a>
            <a class="not-found__cat-card" href="/calculators/">
              <span class="not-found__cat-name">Calculadoras (EN)</span>
              <span class="not-found__cat-cta">Abrir ${Icons.arrowSmall}</span>
            </a>
            <a class="not-found__cat-card" href="/es/glossary/">
              <span class="not-found__cat-name">Glosario en Español</span>
              <span class="not-found__cat-cta">Abrir ${Icons.arrowSmall}</span>
            </a>
          </div>
        </div>

        <div class="not-found__report-link">
          <p>La edición en español está en construcción. ¿Quieres ver un artículo traducido? <a href="${mailto.hello}">Escríbenos</a>.</p>
        </div>
      </div>
    </section>`;
}

// ---------- Calculator pages (backlink-bait assets) ----------
// Two interactive on-site tools:
//   /calculators/fruit-equivalency/  — fresh ↔ freeze-dried mass / volume
//   /calculators/pouch-barrier/      — barrier-film target estimator
// Both render as fully static HTML with inline vanilla JS — no framework,
// no external network calls. The interactive math is deterministic and
// transparent, which is exactly what blog editors and trade-press writers
// link to (and what AI engines reproduce verbatim).

function renderCalculatorsHubBody() {
  return `
    <section class="page-head">
      <div class="container">
        <span class="eyebrow">Tools · Free calculators</span>
        <h1>Freeze-Dried Fruit Calculators</h1>
        <p>Free, dependency-free tools for converting fresh fruit into freeze-dried equivalents and for estimating packaging-barrier requirements. Independent and ad-free.</p>
      </div>
    </section>
    <section class="section">
      <div class="container-narrow">
        <div class="calculators-hub">
          <a href="/calculators/fruit-equivalency/" class="calculators-hub__card">
            <div class="calculators-hub__eyebrow">Conversion</div>
            <h2 class="calculators-hub__title">Fruit Equivalency Calculator</h2>
            <p class="calculators-hub__desc">Convert cups or grams of fresh fruit into the equivalent weight and volume of freeze-dried fruit — or vice versa. Useful for recipe writers, ingredient buyers, and brand teams sizing pack content.</p>
            <span class="calculators-hub__cta">Open the calculator ${Icons.arrowSmall}</span>
          </a>
          <a href="/calculators/pouch-barrier/" class="calculators-hub__card">
            <div class="calculators-hub__eyebrow">Packaging</div>
            <h2 class="calculators-hub__title">Pouch Barrier Estimator</h2>
            <p class="calculators-hub__desc">Get a guideline MVTR and OTR target for a freeze-dried fruit pouch based on fruit fragility, climate zone, shelf-life target, and pack size. Editorial guidance — not a substitute for supplier validation.</p>
            <span class="calculators-hub__cta">Open the calculator ${Icons.arrowSmall}</span>
          </a>
        </div>
      </div>
    </section>`;
}

function renderFruitEquivalencyCalculator() {
  const json = JSON.stringify(FRUIT_EQUIVALENCY).replace(/</g, "\\u003c");
  const optionsHtml = FRUIT_EQUIVALENCY
    .map(f => `<option value="${escapeHtml(f.key)}">${escapeHtml(f.name)}</option>`)
    .join("");

  return `
    <section class="page-head">
      <div class="container">
        <span class="eyebrow">Calculator · Conversion</span>
        <h1>Fruit Equivalency Calculator</h1>
        <p>Convert fresh fruit to freeze-dried fruit and back. Useful for recipe writers, ingredient formulators, and brand teams sizing pack content.</p>
      </div>
    </section>
    <section class="section">
      <div class="container-narrow">
        <div class="calc">
          <form class="calc__form" id="equivForm" onsubmit="return false">
            <div class="calc__row">
              <label class="calc__label" for="equivFruit">Fruit</label>
              <select class="calc__input" id="equivFruit">${optionsHtml}</select>
            </div>
            <div class="calc__row">
              <label class="calc__label" for="equivDirection">I have</label>
              <select class="calc__input" id="equivDirection">
                <option value="freshToFd">Fresh fruit → freeze-dried equivalent</option>
                <option value="fdToFresh">Freeze-dried fruit → fresh equivalent</option>
              </select>
            </div>
            <div class="calc__row calc__row--split">
              <div>
                <label class="calc__label" for="equivAmount">Amount</label>
                <input class="calc__input" id="equivAmount" type="number" min="0" step="0.1" value="1">
              </div>
              <div>
                <label class="calc__label" for="equivUnit">Unit</label>
                <select class="calc__input" id="equivUnit">
                  <option value="cup">cups</option>
                  <option value="g">grams</option>
                  <option value="oz">ounces</option>
                </select>
              </div>
            </div>
          </form>

          <div class="calc__result" id="equivResult" aria-live="polite"></div>

          <details class="calc__assumptions">
            <summary>Assumptions</summary>
            <ul>
              <li>Fresh-fruit water content is the category USDA average; specific cultivars vary.</li>
              <li>Freeze-dried product is assumed to finish at ~3% residual moisture (typical premium target).</li>
              <li>Volume conversions assume loose-pack density; pressed or chopped product fits differently.</li>
              <li>1 cup ≈ 236.6 mL; 1 ounce ≈ 28.35 g.</li>
            </ul>
          </details>
        </div>

        <div class="calc-context">
          <h2>How freeze-dried equivalency works</h2>
          <p>Freeze-drying removes nearly all the water from fresh fruit without applying high heat. The remaining dry-matter mass is small — usually 8–20% of the starting fresh weight, depending on the fruit's natural water content. Volume falls less than mass, because the porous structure left behind by sublimated ice keeps the pieces near their original shape.</p>
          <p>The calculator uses three inputs per fruit: fresh-fruit water content, the typical loose-pack density of the fresh prepared fruit, and the typical loose-pack density of the finished freeze-dried product. The result is a usable estimate — not a guarantee — for converting recipe quantities or pack-content targets.</p>
          <p>For more on what these numbers mean in practice, see <a href="/articles/water-activity-vs-moisture-content/">water activity vs. moisture content</a>, <a href="/articles/moisture-control/">moisture control</a>, and the full <a href="/articles/how-to-read-fruit-equivalent-claims-on-freeze-dried-fruit-labels/">guide to reading fruit-equivalent claims on labels</a>.</p>
        </div>
      </div>
    </section>

    <script type="application/json" id="equivData">${json}</script>
    <script>
(function () {
  var data = JSON.parse(document.getElementById('equivData').textContent);
  var byKey = {};
  for (var i = 0; i < data.length; i++) byKey[data[i].key] = data[i];

  var fruitEl = document.getElementById('equivFruit');
  var dirEl = document.getElementById('equivDirection');
  var amtEl = document.getElementById('equivAmount');
  var unitEl = document.getElementById('equivUnit');
  var resultEl = document.getElementById('equivResult');

  function toGrams(amount, unit, freshDensity) {
    if (unit === 'g') return amount;
    if (unit === 'oz') return amount * 28.3495;
    if (unit === 'cup') return amount * 236.5882 * freshDensity;
    return amount;
  }

  function fromGrams(grams, unit, density) {
    if (unit === 'g') return grams;
    if (unit === 'oz') return grams / 28.3495;
    if (unit === 'cup') return grams / (236.5882 * density);
    return grams;
  }

  function fmt(n, digits) {
    if (!isFinite(n)) return '—';
    var d = (digits == null) ? (n < 10 ? 1 : 0) : digits;
    return Number(n.toFixed(d)).toString();
  }

  function compute() {
    var f = byKey[fruitEl.value];
    var dir = dirEl.value;
    var amt = parseFloat(amtEl.value);
    var unit = unitEl.value;

    if (!f || !(amt > 0)) {
      resultEl.innerHTML = '<p class="muted" style="font-family:var(--serif);font-style:italic">Enter an amount to see the equivalent.</p>';
      return;
    }

    var dryMatterFresh = 1 - (f.waterPct / 100);
    var dryMatterFd = 1 - (f.moisturePctFinal / 100);

    var labels;
    if (dir === 'freshToFd') {
      var freshGrams = toGrams(amt, unit, f.freshDensity);
      var fdGrams = freshGrams * dryMatterFresh / dryMatterFd;
      var freshCups = fromGrams(freshGrams, 'cup', f.freshDensity);
      var fdCups = fromGrams(fdGrams, 'cup', f.fdDensity);
      labels = [
        { label: 'Fresh ' + f.name.toLowerCase() + ' input', value: fmt(freshGrams) + ' g (' + fmt(freshCups) + ' cups, ' + fmt(freshGrams / 28.3495) + ' oz)' },
        { label: 'Freeze-dried ' + f.name.toLowerCase() + ' output', value: fmt(fdGrams) + ' g (' + fmt(fdCups) + ' cups, ' + fmt(fdGrams / 28.3495) + ' oz)' },
        { label: 'Mass retention', value: fmt(100 * fdGrams / freshGrams) + '%' },
        { label: 'Water removed', value: fmt(freshGrams - fdGrams) + ' g' },
      ];
    } else {
      var fdGramsIn = toGrams(amt, unit, f.fdDensity);
      var freshGramsOut = fdGramsIn * dryMatterFd / dryMatterFresh;
      var fdCupsIn = fromGrams(fdGramsIn, 'cup', f.fdDensity);
      var freshCupsOut = fromGrams(freshGramsOut, 'cup', f.freshDensity);
      labels = [
        { label: 'Freeze-dried ' + f.name.toLowerCase() + ' input', value: fmt(fdGramsIn) + ' g (' + fmt(fdCupsIn) + ' cups, ' + fmt(fdGramsIn / 28.3495) + ' oz)' },
        { label: 'Fresh ' + f.name.toLowerCase() + ' equivalent', value: fmt(freshGramsOut) + ' g (' + fmt(freshCupsOut) + ' cups, ' + fmt(freshGramsOut / 28.3495) + ' oz)' },
        { label: 'Mass ratio', value: '1 g freeze-dried ≈ ' + fmt(freshGramsOut / fdGramsIn) + ' g fresh' },
        { label: 'Water content of original fresh fruit', value: f.waterPct + '%' },
      ];
    }

    resultEl.innerHTML =
      '<div class="calc-result__title">Result</div>' +
      '<dl class="calc-result__list">' +
      labels.map(function (l) {
        return '<div class="calc-result__row"><dt>' + l.label + '</dt><dd>' + l.value + '</dd></div>';
      }).join('') +
      '</dl>';
  }

  ['change', 'input'].forEach(function (ev) {
    fruitEl.addEventListener(ev, compute);
    dirEl.addEventListener(ev, compute);
    amtEl.addEventListener(ev, compute);
    unitEl.addEventListener(ev, compute);
  });
  compute();
})();
    </script>`;
}

function renderPouchBarrierCalculator() {
  const fruitJson = JSON.stringify(FRAGILITY_LEVELS).replace(/</g, "\\u003c");
  const climateJson = JSON.stringify(CLIMATE_ZONES).replace(/</g, "\\u003c");
  const shelfJson = JSON.stringify(SHELF_LIFE_OPTIONS).replace(/</g, "\\u003c");
  const packJson = JSON.stringify(PACK_SIZES).replace(/</g, "\\u003c");
  const baseJson = JSON.stringify(BASE_BARRIER_TARGETS).replace(/</g, "\\u003c");

  const fragOpts = FRAGILITY_LEVELS.map(f => `<option value="${escapeHtml(f.key)}">${escapeHtml(f.label)}</option>`).join("");
  const climOpts = CLIMATE_ZONES.map(c => `<option value="${escapeHtml(c.key)}">${escapeHtml(c.label)}</option>`).join("");
  const shelfOpts = SHELF_LIFE_OPTIONS.map(s => `<option value="${s.months}">${escapeHtml(s.label)}</option>`).join("");
  const packOpts = PACK_SIZES.map(p => `<option value="${escapeHtml(p.key)}">${escapeHtml(p.label)}</option>`).join("");

  return `
    <section class="page-head">
      <div class="container">
        <span class="eyebrow">Calculator · Packaging</span>
        <h1>Pouch Barrier Estimator</h1>
        <p>Get a guideline MVTR and OTR target for a freeze-dried fruit pouch based on fruit fragility, climate, shelf-life target, and pack size. Editorial guidance — not a substitute for supplier validation.</p>
      </div>
    </section>
    <section class="section">
      <div class="container-narrow">
        <div class="calc">
          <form class="calc__form" id="barrierForm" onsubmit="return false">
            <div class="calc__row">
              <label class="calc__label" for="barrierFrag">Fruit fragility</label>
              <select class="calc__input" id="barrierFrag">${fragOpts}</select>
            </div>
            <div class="calc__row">
              <label class="calc__label" for="barrierClim">Climate of intended distribution</label>
              <select class="calc__input" id="barrierClim">${climOpts}</select>
            </div>
            <div class="calc__row">
              <label class="calc__label" for="barrierShelf">Shelf-life target (unopened)</label>
              <select class="calc__input" id="barrierShelf">${shelfOpts}</select>
            </div>
            <div class="calc__row">
              <label class="calc__label" for="barrierPack">Pack size</label>
              <select class="calc__input" id="barrierPack">${packOpts}</select>
            </div>
          </form>

          <div class="calc__result" id="barrierResult" aria-live="polite"></div>

          <details class="calc__assumptions">
            <summary>Assumptions</summary>
            <ul>
              <li>MVTR targets are at 38 °C, 90% RH per ASTM F1249.</li>
              <li>OTR targets are at 23 °C, 0% RH per ASTM F1927.</li>
              <li>Film tier recommendations are editorial guidelines, not engineering specifications. Always validate with shelf-life testing under the conditions the product will actually face.</li>
              <li>Tighter barrier targets reduce permeation but rarely fix bad seals, sloppy zipper performance, or oversized headspace. Packaging is a system.</li>
            </ul>
          </details>
        </div>

        <div class="calc-context">
          <h2>How the recommendation is built</h2>
          <p>Freeze-dried fruit fails on shelf for two main reasons: humidity pickup (which softens texture) and oxygen exposure (which fades color and aroma). The pouch's job is to delay both. The right barrier choice balances cost, recyclability, shelf appeal, and the actual quality risk for the specific product.</p>
          <p>The estimator starts from baseline MVTR and OTR targets for medium-fragility fruit in a temperate climate, in a medium pouch, at a 12-month shelf life. It then multiplies those targets by factors derived from your inputs: more fragile fruit, a more humid climate, a longer shelf life, or a larger pack each tighten the required barrier.</p>
          <p>For background, see the field guide on <a href="/articles/barrier-films-for-freeze-dried-fruit/">barrier films</a>, <a href="/articles/desiccants-vs-oxygen-absorbers/">desiccants vs. oxygen absorbers</a>, and <a href="/articles/nitrogen-flushing-for-freeze-dried-fruit/">when nitrogen flushing helps</a>.</p>
        </div>
      </div>
    </section>

    <script type="application/json" id="fragData">${fruitJson}</script>
    <script type="application/json" id="climData">${climateJson}</script>
    <script type="application/json" id="shelfData">${shelfJson}</script>
    <script type="application/json" id="packData">${packJson}</script>
    <script type="application/json" id="baseData">${baseJson}</script>
    <script>
(function () {
  var FRAG = JSON.parse(document.getElementById('fragData').textContent);
  var CLIM = JSON.parse(document.getElementById('climData').textContent);
  var SHELF = JSON.parse(document.getElementById('shelfData').textContent);
  var PACK = JSON.parse(document.getElementById('packData').textContent);
  var BASE = JSON.parse(document.getElementById('baseData').textContent);

  function lookup(arr, key, prop) {
    for (var i = 0; i < arr.length; i++) {
      if (String(arr[i][key]) === String(prop)) return arr[i];
    }
    return arr[0];
  }

  function tier(mvtr) {
    if (mvtr <= 0.5)  return { name: 'Foil lamination',  desc: 'PET/Foil/PE structure with metal foil layer for highest barrier. Opaque, highest cost, best for export, humid distribution, premium positioning, or long shelf life.' };
    if (mvtr <= 1.5)  return { name: 'Metallized lamination', desc: 'PET/metPET/PE or AlOx clear-barrier structure. Strong barrier at moderate cost. Most common premium retail pouch.' };
    return                  { name: 'Clear lamination', desc: 'PET/PE or BOPP lamination with no specialty barrier layer. Lowest cost, retail-shelf friendly, suitable for low-fragility / short-life / dry-climate use only.' };
  }

  var fragEl  = document.getElementById('barrierFrag');
  var climEl  = document.getElementById('barrierClim');
  var shelfEl = document.getElementById('barrierShelf');
  var packEl  = document.getElementById('barrierPack');
  var out     = document.getElementById('barrierResult');

  function compute() {
    var f = lookup(FRAG, 'key', fragEl.value);
    var c = lookup(CLIM, 'key', climEl.value);
    var s = lookup(SHELF, 'months', shelfEl.value);
    var p = lookup(PACK, 'key', packEl.value);

    // Multiplicative load on barrier. Higher = tighter required spec
    // (= lower allowed transmission rates).
    var load = (f.factor || 1) * (c.hrFactor || 1) * (s.factor || 1) * (p.factor || 1);

    var mvtrTarget = BASE.mvtr / load;
    var otrTarget  = BASE.otr  / load;

    var t = tier(mvtrTarget);

    // Nitrogen-flush + desiccant recommendations driven by load level.
    var nitrogen = (load >= 1.5)
      ? 'Recommended — color and aroma protection is meaningful at this load level.'
      : 'Optional — useful for premium positioning or color-sensitive fruit, but not required to hit the targets above.';
    var desiccant = (load >= 1.2)
      ? 'Recommended — a food-grade silica gel packet sized to pouch volume helps absorb residual humidity from sealing and from each opening.'
      : 'Optional — most useful when the pouch is large or the climate sits at the humid end of temperate.';

    out.innerHTML =
      '<div class="calc-result__title">Recommendation</div>' +
      '<dl class="calc-result__list">' +
        '<div class="calc-result__row"><dt>Suggested film tier</dt><dd><strong>' + t.name + '</strong></dd></div>' +
        '<div class="calc-result__row"><dt>Film tier notes</dt><dd>' + t.desc + '</dd></div>' +
        '<div class="calc-result__row"><dt>MVTR target (38 °C / 90% RH)</dt><dd>≤ ' + mvtrTarget.toFixed(2) + ' g/m²/day</dd></div>' +
        '<div class="calc-result__row"><dt>OTR target (23 °C / 0% RH)</dt><dd>≤ ' + otrTarget.toFixed(2) + ' cc/m²/day</dd></div>' +
        '<div class="calc-result__row"><dt>Nitrogen flush</dt><dd>' + nitrogen + '</dd></div>' +
        '<div class="calc-result__row"><dt>Desiccant packet</dt><dd>' + desiccant + '</dd></div>' +
      '</dl>' +
      '<p class="calc-result__note">Guideline only — validate with shelf-life testing under the conditions the product will actually face. Seal integrity, zipper performance, and headspace also need to be designed together.</p>';
  }

  ['change'].forEach(function (ev) {
    fragEl.addEventListener(ev, compute);
    climEl.addEventListener(ev, compute);
    shelfEl.addEventListener(ev, compute);
    packEl.addEventListener(ev, compute);
  });
  compute();
})();
    </script>`;
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

// llms.txt — curated index for LLMs/AI engines, grouped by category.
// Convention: https://llmstxt.org. Lets ChatGPT/Perplexity/Claude pull a
// machine-readable map of the site's most useful URLs.
function buildLlmsTxt({ site, articles, reports = [] }) {
  const byCategory = new Map();
  for (const a of articles) {
    if (!byCategory.has(a.category)) byCategory.set(a.category, []);
    byCategory.get(a.category).push(a);
  }
  // Category order matches site nav.
  const order = ["Industry Insights", "Technology", "Labels & Quality", "Applications", "Fruit Reports"];
  const ordered = [
    ...order.filter(c => byCategory.has(c)),
    ...[...byCategory.keys()].filter(c => !order.includes(c)),
  ];

  const sections = ordered.map(cat => {
    const lines = byCategory.get(cat)
      .map(a => `- [${a.title}](${site.url}${articleUrl(a.id)})${a.summary ? `: ${a.summary}` : ""}`)
      .join("\n");
    return `## ${cat}\n\n${lines}`;
  }).join("\n\n");

  return `# Freeze-Dried-Fruit.com

> ${site.description}

An independent, advertising-free field guide to freeze-dried fruit — covering quality, processing, sourcing, packaging, and applications. Written for curious consumers, snack founders, ingredient buyers, suppliers, and operators.

${reports.length ? `## Flagship reports

${reports.map(r => `- [${r.title}](${site.url}/${r.slug}/)${r.summary ? `: ${r.summary}` : ""}`).join("\n")}

` : ""}## About

- [About Freeze-Dried-Fruit.com](${site.url}/about/): What the site is and who it is for.
- [${site.editorial?.byline || "Editorial Desk"}](${site.url}${site.editorial?.url || "/editorial/"}): Who writes the field guide.
- [Editorial Methodology](${site.url}/methodology/): How we research, evaluate, and write.
- [Glossary](${site.url}/glossary/): Plain-language definitions for technical, commercial, and packaging terms.
- [Compare freeze-dried fruits](${site.url}/compare/): Side-by-side comparisons across Brix, fiber, aroma, color, and breakage.
- [Industry Exchange](${site.url}/exchange/): Submission channels for suppliers, equipment, buyers, and operators.
- [Contact](${site.url}/contact/): Editorial, press, and industry contacts.

${sections}

## Reference

- [All articles](${site.url}/articles/)
- [News Wire](${site.url}/news/) — auto-updated headlines across the freeze-dried fruit category.
- [RSS feed](${site.url}/feed.xml)
- [XML sitemap](${site.url}/sitemap.xml)
`;
}

function buildSitemap({ site, articles, reports = [], articlesEs = [], reportsEs = [] }) {
  const today = new Date().toISOString().slice(0, 10);
  // Latest activity timestamp: prefer updated date when present, otherwise
  // fall back to publish date. This keeps the homepage / index lastmod fresh
  // whenever any article — new or revised — has moved.
  const latestArticleDate = articles.reduce((acc, a) => {
    const t = (a.updated || a.date)?.getTime();
    return t && (!acc || t > acc) ? t : acc;
  }, 0);
  const latestArticleIso = latestArticleDate ? new Date(latestArticleDate).toISOString().slice(0, 10) : today;

  const entries = [
    { loc: "/", lastmod: latestArticleIso, changefreq: "daily", priority: "1.0" },
    { loc: "/articles/", lastmod: latestArticleIso, changefreq: "daily", priority: "0.9" },
    { loc: "/news/", lastmod: today, changefreq: "hourly", priority: "0.7" },
    { loc: "/glossary/", lastmod: today, changefreq: "monthly", priority: "0.8" },
    { loc: "/compare/", lastmod: today, changefreq: "monthly", priority: "0.7" },
    { loc: "/calculators/", lastmod: today, changefreq: "monthly", priority: "0.7" },
    { loc: "/calculators/fruit-equivalency/", lastmod: today, changefreq: "monthly", priority: "0.7" },
    { loc: "/calculators/pouch-barrier/", lastmod: today, changefreq: "monthly", priority: "0.7" },
    { loc: "/methodology/", lastmod: today, changefreq: "monthly", priority: "0.6" },
    { loc: "/editorial/", lastmod: today, changefreq: "monthly", priority: "0.6" },
    // /search/ intentionally omitted — it's noindex'd, see the writeFilePage call.
    { loc: "/exchange/", lastmod: today, changefreq: "monthly", priority: "0.6" },
    { loc: "/about/", lastmod: today, changefreq: "monthly", priority: "0.4" },
    { loc: "/contact/", lastmod: today, changefreq: "monthly", priority: "0.4" },
    { loc: "/privacy/", lastmod: today, changefreq: "yearly", priority: "0.2" },
  ];

  // Category pages — lastmod = newest article in that category.
  const cats = [...new Set(articles.map(a => a.category))];
  for (const c of cats) {
    const catLatest = articles
      .filter(a => a.category === c)
      .reduce((acc, a) => {
        const t = a.date?.getTime();
        return t && (!acc || t > acc) ? t : acc;
      }, 0);
    entries.push({
      loc: categoryUrl(c),
      lastmod: catLatest ? new Date(catLatest).toISOString().slice(0, 10) : today,
      changefreq: "weekly",
      priority: "0.7",
    });
  }

  // Individual articles.
  for (const a of articles) {
    const mod = a.updated || a.date;
    entries.push({
      loc: articleUrl(a.id),
      lastmod: mod ? mod.toISOString().slice(0, 10) : today,
      changefreq: "monthly",
      priority: "0.8",
    });
  }

  // Spanish home + Spanish article translations + Spanish glossary.
  //
  // Priority lowered (May 2026) while English indexing is still being worked
  // through. With ~50% of submitted URLs sitting in "Discovered — not
  // indexed", we want Google to spend crawl budget on English first; Spanish
  // can be re-promoted once English coverage is solid and we have dedicated
  // Spanish backlinks. Pages remain in the sitemap so they stay discoverable
  // and hreflang stays intact — only the priority hint changes.
  if (articlesEs.length) {
    const latestEsDate = articlesEs.reduce((acc, a) => {
      const t = (a.updated || a.date)?.getTime();
      return t && (!acc || t > acc) ? t : acc;
    }, 0);
    const latestEsIso = latestEsDate ? new Date(latestEsDate).toISOString().slice(0, 10) : today;
    entries.push({
      loc: "/es/",
      lastmod: latestEsIso,
      changefreq: "weekly",
      priority: "0.4",
    });
    entries.push({
      loc: "/es/articles/",
      lastmod: latestEsIso,
      changefreq: "weekly",
      priority: "0.4",
    });
    const catsEs = [...new Set([
      ...articlesEs.map(a => a.category),
      ...(site.nav || []).filter(n => n.category).map(n => n.category),
    ])];
    for (const c of catsEs) {
      const catLatest = articlesEs
        .filter(a => a.category === c)
        .reduce((acc, a) => {
          const t = (a.updated || a.date)?.getTime();
          return t && (!acc || t > acc) ? t : acc;
        }, 0);
      entries.push({
        loc: categoryUrl(c, "es"),
        lastmod: catLatest ? new Date(catLatest).toISOString().slice(0, 10) : latestEsIso,
        changefreq: "weekly",
        priority: "0.3",
      });
    }
    for (const a of articlesEs) {
      const mod = a.updated || a.date;
      entries.push({
        loc: `/es/articles/${a.id}/`,
        lastmod: mod ? mod.toISOString().slice(0, 10) : today,
        changefreq: "monthly",
        priority: "0.3",
      });
    }
    // Spanish glossary hub and per-term pages.
    entries.push({
      loc: "/es/glossary/",
      lastmod: today,
      changefreq: "monthly",
      priority: "0.3",
    });
    // Spanish glossary slugs match the English slugs.
    for (const t of GLOSSARY_ES) {
      entries.push({
        loc: `/es/glossary/${t.slug}/`,
        lastmod: today,
        changefreq: "monthly",
        priority: "0.3",
      });
    }
  }

  // Flagship reports — high-priority since they are top-level industry
  // assets. Reports use their `updated` field if newer than publish date.
  for (const r of reports) {
    const mod = r.updated || r.date;
    entries.push({
      loc: `/${r.slug}/`,
      lastmod: mod ? mod.toISOString().slice(0, 10) : today,
      changefreq: "monthly",
      priority: "0.9",
    });
  }
  // Spanish report translations — deprioritized in lockstep with the rest of
  // /es/ (see comment on the Spanish home block above).
  for (const r of reportsEs) {
    const mod = r.updated || r.date;
    entries.push({
      loc: `/es/${r.slug}/`,
      lastmod: mod ? mod.toISOString().slice(0, 10) : today,
      changefreq: "monthly",
      priority: "0.4",
    });
  }

  // Pairwise comparison pages — built from fruit data, refreshed when the
  // data file changes. They share the build date.
  for (const pair of buildComparisonPairs()) {
    entries.push({
      loc: `/compare/${pair.slug}/`,
      lastmod: today,
      changefreq: "monthly",
      priority: "0.6",
    });
  }

  // Per-term glossary pages — each definition lives at its own URL and is
  // independently citable by AI engines and indexable by Google.
  for (const term of GLOSSARY) {
    entries.push({
      loc: `/glossary/${term.slug}/`,
      lastmod: today,
      changefreq: "monthly",
      priority: "0.6",
    });
  }

  const items = entries.map(e =>
    `<url><loc>${site.url}${e.loc}</loc><lastmod>${e.lastmod}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`;
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

  // Spanish article translations live in content/articles-es/. Each file's
  // `en_slug` field maps it back to the English source for reciprocal
  // hreflang. Articles without a Spanish translation simply ship English-only.
  const articlesEs = await loadArticles(path.join(ROOT, "content", "articles-es"), "es");
  if (articlesEs.length) console.log(`→ build: ${articlesEs.length} Spanish article translation(s) loaded`);
  const esBySource = new Map(); // en_slug -> es article
  for (const a of articlesEs) {
    if (a.en_slug) esBySource.set(a.en_slug, a);
  }

  // Log which analytics providers will be active in the build. Missing values
  // mean the provider's tag is not emitted; visible in the build log so the
  // user notices when something they expected to be on is off.
  const an = site.analytics || {};
  const active = [
    an.googleSiteVerification && "GSC verification",
    an.plausibleDomain && `Plausible (${an.plausibleDomain})`,
    an.cloudflareToken && "Cloudflare Web Analytics",
    an.ga4Id && `GA4 (${an.ga4Id})`,
  ].filter(Boolean);
  console.log(`→ build: analytics → ${active.length ? active.join(", ") : "none configured"}`);

  // Load pillar pages (one per category, if present). Each pillar's prose
  // and FAQ block runs through the same glossary linker as articles below.
  const pillars = await loadPillars(path.join(ROOT, "content", "pillars"));

  // Load flagship reports (the annual "State of Freeze-Dried Fruit" series
  // and any future quarterly notes). Reports live at the root path (not
  // /articles/) so they read as top-level industry assets.
  const reports = await loadReports(path.join(ROOT, "content", "reports"));
  // Spanish flagship reports — each declares en_slug for reciprocal hreflang.
  const reportsEs = await loadReports(path.join(ROOT, "content", "reports-es"), "es");
  if (reportsEs.length) console.log(`→ build: ${reportsEs.length} Spanish report translation(s) loaded`);
  const reportEsBySource = new Map();
  for (const r of reportsEs) {
    if (r.en_slug) reportEsBySource.set(r.en_slug, r);
  }

  // Pass 1: auto-link glossary terms inside each article's body and FAQs.
  // Body and FAQ each get their own `used` set so each section gets one
  // first-occurrence link per term — the FAQ is the section AI engines
  // extract most often, so it deserves its own contextual links rather
  // than being starved by an already-linked body.
  const linker = createGlossaryLinker(GLOSSARY);
  let linkedTermCount = 0;
  let comparisonTableCount = 0;
  for (const a of articles) {
    const bodyUsed = new Set();
    a.bodyHtml = linker(a.bodyHtml, bodyUsed);
    linkedTermCount += bodyUsed.size;
    if (Array.isArray(a.faqs) && a.faqs.length) {
      const faqUsed = new Set();
      a.faqs = a.faqs.map(f => ({ ...f, aHtml: linker(renderMarkdown(f.a), faqUsed) }));
      linkedTermCount += faqUsed.size;
    }
    // Cross-fruit comparison table for fruit-report articles that match a
    // known fruit. Injected after glossary linking so terms inside the
    // table cells are not auto-linked (the table is reference data, not prose).
    const fruitKey = SLUG_TO_FRUIT[a.id];
    if (fruitKey) {
      a.bodyHtml = injectFruitCompareTable(a.bodyHtml, fruitKey);
      comparisonTableCount += 1;
    }
  }
  // Apply the glossary linker to reports too — same single-pass body
  // linking pattern used for articles so the prose carries first-occurrence
  // anchor links to the glossary for every defined term it mentions.
  for (const r of reports) {
    const used = new Set();
    r.bodyHtml = linker(r.bodyHtml, used);
    linkedTermCount += used.size;
  }
  // Spanish articles get their own glossary linker — uses GLOSSARY_ES so the
  // surface forms matched against Spanish prose are the Spanish term forms
  // (e.g. "actividad de agua", "humedad residual", "película barrera"). The
  // linker is configured with the "/es" URL prefix so emitted anchors point
  // at /es/glossary/<slug>/ instead of /glossary/<slug>/. Both linkers emit
  // data-glossary="<slug>" markers with the SAME slug, so the mention index
  // is shared across both locales.
  const linkerEs = createGlossaryLinker(GLOSSARY_ES, "/es");
  for (const a of articlesEs) {
    const used = new Set();
    a.bodyHtml = linkerEs(a.bodyHtml, used);
    linkedTermCount += used.size;
    if (Array.isArray(a.faqs) && a.faqs.length) {
      const faqUsed = new Set();
      a.faqs = a.faqs.map(f => ({ ...f, aHtml: linkerEs(renderMarkdown(f.a), faqUsed) }));
    }
  }
  // Spanish reports get the Spanish glossary linker too.
  for (const r of reportsEs) {
    const used = new Set();
    r.bodyHtml = linkerEs(r.bodyHtml, used);
    linkedTermCount += used.size;
  }
  console.log(`→ build: linked ${linkedTermCount} glossary terms across articles`);
  console.log(`→ build: injected ${comparisonTableCount} fruit comparison tables`);

  const home = pickHomeArticles(articles, homeConfig);
  if (!home.featured) throw new Error("No articles found — add a Markdown file under content/articles/");

  // Articles indexed by id — used by both the meta-pillar (for /articles/)
  // and the per-category pillars (for /articles/category/<x>/).
  const articlesById = Object.fromEntries(articles.map(a => [a.id, a]));

  // Home
  const homeBody = renderHomeBody({ site, mailto, articles, home, news, homeConfig, reports });
  const homeAlternates = articlesEs.length ? { en: "/", es: "/es/" } : null;
  await writeFilePage("index.html", renderPage({
    site, mailto, currentPath: "/", title: null, description: null, body: homeBody, screen: "home",
    jsonLd: homeJsonLd({ site, articles }),
    alternates: homeAlternates,
  }));

  // Spanish home page — a focused landing surface for Spanish-speaking
  // visitors. Indexed under /es/ with hreflang reciprocal back to "/".
  if (articlesEs.length) {
    await writeFilePage("es/index.html", renderPage({
      site, mailto, currentPath: "/es/",
      title: "Guía de campo de la fruta liofilizada",
      description: "Una guía editorial independiente sobre la fruta liofilizada — calidad, proceso, abastecimiento, empaque y aplicaciones.",
      body: renderEsHomeBody({ articlesEs, reportsEs, mailto, site }),
      screen: "home-es",
      lang: "es",
      alternates: { en: "/", es: "/es/" },
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${site.url}/es/`,
          url: `${site.url}/es/`,
          name: "Guía de campo de la fruta liofilizada",
          description: "Una guía editorial independiente sobre la fruta liofilizada.",
          inLanguage: "es",
          isPartOf: { "@id": `${site.url}/#website` },
        },
        breadcrumbsNode(site, [
          { name: "Inicio", path: "/es/" },
        ]),
      ],
    }));
  }

  // All articles — meta-pillar surfacing the 5 categories first, then the
  // suppressed-head archive list of all articles below.
  const metaPillar = renderArticlesMetaPillar({ site, articles, articlesById });
  const archiveBelow = renderArticlesIndex({ articles, category: null, suppressHead: true, eyebrowLabel: "Full Archive" });
  await writeFilePage("articles/index.html", renderPage({
    site, mailto, currentPath: "/articles/", title: "The Field Guide to Freeze-Dried Fruit",
    description: "All articles on Freeze-Dried-Fruit.com, organized across Industry Insights, Technology, Labels & Quality, Applications, and Fruit Reports.",
    body: metaPillar.bodyHtml + archiveBelow,
    screen: "articles",
    jsonLd: articlesMetaPillarJsonLd({ site, articles, faqs: metaPillar.faqs }),
    alternates: articlesEs.length ? { en: "/articles/", es: "/es/articles/" } : null,
  }));

  // Articles by category — include both categories that have articles AND
  // categories referenced from the nav (so a nav link to "Fruit Reports"
  // resolves to a valid empty-state page until the first article lands).
  // When a pillar markdown exists for the category, render the full pillar
  // layout above the archive list.
  const articleCats = new Set(articles.map(a => a.category));
  const navCats = (site.nav || []).filter(n => n.category).map(n => n.category);
  const cats = [...new Set([...articleCats, ...navCats])];
  for (const c of cats) {
    const inCat = articles.filter(a => a.category === c);
    const pillar = pillars.get(c);

    let bodyHtml;
    let jsonLd;
    let title = c;
    let description = pillar?.description || `Articles filed under ${c}.`;

    if (pillar) {
      const { pillarHtml, faqsRendered } = renderPillar({
        pillar, articles, articlesById, linker, mailto,
      });
      const archiveHtml = renderArticlesIndex({ articles, category: c, suppressHead: true });
      bodyHtml = pillarHtml + archiveHtml;
      title = pillar.heading || c;
      jsonLd = pillarCategoryPageJsonLd({
        site, articles: inCat, category: c, currentPath: categoryUrl(c),
        name: `${pillar.heading || c} — Freeze-Dried-Fruit.com`,
        description, pillar, faqsRendered,
      });
    } else {
      bodyHtml = renderArticlesIndex({ articles, category: c });
      jsonLd = articleListJsonLd({
        site, articles: inCat, category: c, currentPath: categoryUrl(c),
        name: `${c} — Freeze-Dried-Fruit.com`, description,
      });
    }

    await writeFilePage(`${categoryUrl(c).slice(1)}index.html`, renderPage({
      site, mailto, currentPath: categoryUrl(c), title, description,
      body: bodyHtml, screen: "articles-cat", jsonLd,
      alternates: articlesEs.length ? { en: categoryUrl(c), es: categoryUrl(c, "es") } : null,
    }));
  }

  // Spanish article index and category archives. The Spanish header links to
  // /es/articles/ and /es/articles/category/<section>/, so these pages keep
  // the localized nav crawlable instead of sending Spanish readers to 404s.
  if (articlesEs.length) {
    const esArticlesDescription = "Artículos disponibles en español sobre calidad, proceso, abastecimiento, empaque y aplicaciones de la fruta liofilizada.";
    await writeFilePage("es/articles/index.html", renderPage({
      site, mailto,
      currentPath: "/es/articles/",
      title: "Artículos en español",
      description: esArticlesDescription,
      body: renderArticlesIndex({ articles: articlesEs, category: null, lang: "es" }),
      screen: "articles",
      lang: "es",
      alternates: { en: "/articles/", es: "/es/articles/" },
      jsonLd: articleListJsonLd({
        site, articles: articlesEs, category: null, currentPath: "/es/articles/",
        name: "Artículos en español — Freeze-Dried-Fruit.com",
        description: esArticlesDescription,
        lang: "es",
      }),
    }));

    const esCats = [...new Set([...articlesEs.map(a => a.category), ...navCats])];
    for (const c of esCats) {
      const currentPath = categoryUrl(c, "es");
      const inCat = articlesEs.filter(a => a.category === c);
      const categoryName = iCategoryLabel("es", c);
      const description = `Artículos en español dentro de ${categoryName} en Freeze-Dried-Fruit.com.`;
      await writeFilePage(`${currentPath.slice(1)}index.html`, renderPage({
        site, mailto,
        currentPath,
        title: `${categoryName} en español`,
        description,
        body: renderArticlesIndex({ articles: articlesEs, category: c, lang: "es" }),
        screen: "articles-cat",
        lang: "es",
        alternates: { en: categoryUrl(c), es: currentPath },
        jsonLd: articleListJsonLd({
          site, articles: inCat, category: c, currentPath,
          name: `${categoryName} en español — Freeze-Dried-Fruit.com`,
          description,
          lang: "es",
        }),
      }));
    }
  }

  // Individual articles
  // Two-track internal-link strategy per article:
  //   1. `continueReading` — up to 3 same-category siblings, surfaced
  //      mid-article (between Sources and Compare-with). Keeps a reader
  //      moving deeper into the same pillar.
  //   2. `related` — 3 articles from OTHER categories, surfaced at the
  //      bottom. Branches the reader into adjacent pillars.
  // Deduping `related` against `continueReading` makes sure the two blocks
  // never repeat a card. For fruit reports, we additionally drop articles
  // that already appear in the Compare-with strip so the page never shows
  // the same neighbor twice.
  const defaultOg = `${site.url.replace(/\/$/, "")}/images/og/default.png`;
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];

    const sameCategory = articles.filter(x => x.id !== a.id && x.category === a.category);
    const continueReading = sameCategory.slice(0, 3);

    // Compare-with strip cards (only for fruit reports) — dedupe to avoid
    // showing the same neighbor article twice on one page.
    const compareIds = new Set();
    const selfFruit = SLUG_TO_FRUIT[a.id];
    if (selfFruit) {
      for (const pair of relevantPairsFor(selfFruit, 4)) {
        const otherKey = pair.a === selfFruit ? pair.b : pair.a;
        // The compare-with cards link to /compare/<pair>/, not to article
        // pages — so the dedupe is conservative and rarely triggers, but
        // we add it for the case where article ids happen to match the
        // "other fruit's" canonical report slug.
        compareIds.add(otherKey);
      }
    }

    const continueIds = new Set(continueReading.map(x => x.id));
    const related = articles
      .filter(x => x.id !== a.id && x.category !== a.category)
      .filter(x => !continueIds.has(x.id))
      .filter(x => !compareIds.has(x.id))
      .slice(0, 3);

    // Reciprocal hreflang alternates — when a Spanish translation exists
    // for this article, both versions advertise each other.
    const esTranslation = esBySource.get(a.id);
    const alternates = esTranslation
      ? { en: articleUrl(a.id, "en"), es: articleUrl(esTranslation.id, "es") }
      : null;

    await writeFilePage(`articles/${a.id}/index.html`, renderPage({
      site, mailto, currentPath: articleUrl(a.id), title: a.title, description: a.summary,
      body: renderArticle({ article: a, related, continueReading, mailto, site }), screen: "article",
      jsonLd: articleJsonLd({ site, article: a }),
      ogImage: articleImageUrl(site, a),
      ogType: "article",
      alternates,
    }));
  }

  // Spanish article pages. They reuse the English renderArticle template
  // (which is largely structural) but their bodyHtml, faqs, takeaways,
  // sources, and meta are all already in Spanish from the loader. The
  // visible chrome around the article is also Spanish because renderPage
  // is called with lang="es".
  //
  // We continue using the English article's `related` / `continueReading`
  // lists for now — Spanish articles can link out to English siblings when
  // no Spanish translation exists, which is better than a dead-end page.
  // Once more Spanish translations exist this list should prefer Spanish.
  for (const aEs of articlesEs) {
    const enSource = articles.find(a => a.id === aEs.en_slug);
    if (!enSource) continue; // Spanish article references a non-existent English source

    // For now, related = first 3 Spanish-translation siblings if available,
    // otherwise fall back to the English source's related list. Continue
    // Reading uses the same logic.
    const esSiblings = articlesEs.filter(x => x.id !== aEs.id);
    const continueReading = esSiblings.slice(0, 3);
    const related = articles
      .filter(x => x.id !== enSource.id && x.category !== enSource.category)
      .slice(0, 3);

    // Spanish OG card lives at /images/og/es/<slug>.png with the Spanish
    // title baked in. For Spanish articles with real photo covers we still
    // prefer the photo (articleImageUrl handles that), but the SVG-hero
    // fallback now uses the Spanish-titled card.
    const hasPhoto = aEs.cover_image && !aEs.cover_image.toLowerCase().endsWith(".svg");
    const ogImage = hasPhoto
      ? articleImageUrl(site, aEs)
      : `${site.url.replace(/\/$/, "")}/images/og/es/${aEs.id}.png`;

    await writeFilePage(`es/articles/${aEs.id}/index.html`, renderPage({
      site, mailto,
      currentPath: articleUrl(aEs.id, "es"),
      title: aEs.title, description: aEs.summary,
      body: renderArticle({ article: aEs, related, continueReading, mailto, site }),
      screen: "article",
      jsonLd: articleJsonLd({ site, article: aEs }),
      ogImage,
      ogType: "article",
      lang: "es",
      alternates: { en: articleUrl(enSource.id, "en"), es: articleUrl(aEs.id, "es") },
    }));
  }
  if (articlesEs.length) console.log(`→ build: wrote ${articlesEs.length} Spanish article page(s)`);

  // Static pages
  await writeFilePage("exchange/index.html", renderPage({
    site, mailto, currentPath: "/exchange/", title: "Industry Exchange",
    description: "Suppliers, equipment, buyers — connect across the freeze-dried fruit ecosystem.",
    body: renderExchangeBody({ mailto }), screen: "exchange",
    jsonLd: simplePageJsonLd({
      site, currentPath: "/exchange/", name: "Industry Exchange",
      description: "Suppliers, equipment, buyers — connect across the freeze-dried fruit ecosystem.",
    }),
  }));
  await writeFilePage("about/index.html", renderPage({
    site, mailto, currentPath: "/about/", title: "About",
    description: "An independent field guide to the freeze-dried fruit category.",
    body: renderAboutBody({ mailto }), screen: "about",
    jsonLd: simplePageJsonLd({
      site, currentPath: "/about/", name: "About Freeze-Dried-Fruit.com",
      description: "An independent field guide to the freeze-dried fruit category.",
      type: "AboutPage",
    }),
  }));
  await writeFilePage("contact/index.html", renderPage({
    site, mailto, currentPath: "/contact/", title: "Contact",
    description: "Get in touch with the team behind Freeze-Dried-Fruit.com.",
    body: renderContactBody({ site, mailto }), screen: "contact",
    jsonLd: simplePageJsonLd({
      site, currentPath: "/contact/", name: "Contact — Freeze-Dried-Fruit.com",
      description: "Get in touch with the team behind Freeze-Dried-Fruit.com.",
      type: "ContactPage",
    }),
  }));
  await writeFilePage("privacy/index.html", renderPage({
    site, mailto, currentPath: "/privacy/", title: "Privacy Policy",
    description: "How we handle information on Freeze-Dried-Fruit.com.",
    body: renderPrivacyBody({ site }), screen: "privacy",
    jsonLd: simplePageJsonLd({
      site, currentPath: "/privacy/", name: "Privacy Policy",
      description: "How we handle information on Freeze-Dried-Fruit.com.",
    }),
  }));
  await writeFilePage("methodology/index.html", renderPage({
    site, mailto, currentPath: "/methodology/", title: "Methodology",
    description: "How Freeze-Dried-Fruit.com researches, evaluates, and writes about the freeze-dried fruit category. Editorial standards, disclosures, and corrections policy.",
    body: renderMethodologyBody({ mailto }), screen: "methodology",
    jsonLd: simplePageJsonLd({
      site, currentPath: "/methodology/", name: "Editorial Methodology",
      description: "How Freeze-Dried-Fruit.com researches, evaluates, and writes about the freeze-dried fruit category. Editorial standards, disclosures, and corrections policy.",
      type: "AboutPage",
    }),
  }));
  await writeFilePage("editorial/index.html", renderPage({
    site, mailto, currentPath: "/editorial/", title: site.editorial?.byline || "Editorial Desk",
    description: `${site.editorial?.byline || "Editorial Desk"} — ${site.editorial?.tagline || "Independent editorial team."}`,
    body: renderEditorialBody({ site, mailto }), screen: "editorial",
    jsonLd: editorialPageJsonLd({ site }),
  }));
  // English glossary hub. Reciprocal hreflang points at the Spanish hub
  // since both glossaries share slugs (and therefore the same conceptual
  // term set).
  const glossaryAlternates = articlesEs.length ? { en: "/glossary/", es: "/es/glossary/" } : null;
  await writeFilePage("glossary/index.html", renderPage({
    site, mailto, currentPath: "/glossary/", title: "Glossary",
    description: `Plain-language definitions of ${GLOSSARY_EN.length} technical, commercial, and packaging terms across the freeze-dried fruit category.`,
    body: renderGlossaryBody(GLOSSARY_EN, GLOSSARY_CATEGORY_ORDER_EN, "en"),
    screen: "glossary",
    jsonLd: glossaryJsonLd({ site, glossary: GLOSSARY_EN, lang: "en" }),
    alternates: glossaryAlternates,
  }));

  // Per-term English glossary pages. Mention index walks every article
  // (English + Spanish) for data-glossary="<slug>" markers, so a Spanish
  // article that mentions "actividad de agua" boosts the same slug's
  // mention list that an English article's "water activity" mention does.
  const glossaryMentionsEn = buildGlossaryMentionIndex(articles, GLOSSARY_EN);
  const glossaryMentionsCombined = buildGlossaryMentionIndex([...articles, ...articlesEs], GLOSSARY_EN);
  for (const term of GLOSSARY_EN) {
    const related = relatedGlossaryTerms(term.slug, GLOSSARY_EN);
    const mentioning = glossaryMentionsEn[term.slug] || [];
    const currentPath = `/glossary/${term.slug}/`;
    const altPathEs = articlesEs.length ? `/es/glossary/${term.slug}/` : null;
    await writeFilePage(`glossary/${term.slug}/index.html`, renderPage({
      site, mailto, currentPath, title: term.term,
      description: firstSentence(term.definition).replace(/\*([^*]+)\*/g, "$1"),
      body: renderGlossaryTermBody(term, related, mentioning, "en"),
      screen: "glossary-term",
      jsonLd: glossaryTermJsonLd({ site, term, mentioning, lang: "en" }),
      alternates: altPathEs ? { en: currentPath, es: altPathEs } : null,
    }));
  }
  console.log(`→ build: wrote ${GLOSSARY_EN.length} per-term glossary pages`);

  // Spanish glossary hub + per-term pages. Same slugs as English so
  // hreflang reciprocal is trivial. Uses Spanish chrome (renderPage
  // lang="es") and Spanish display strings from GLOSSARY_ES + labels.
  if (articlesEs.length) {
    await writeFilePage("es/glossary/index.html", renderPage({
      site, mailto, currentPath: "/es/glossary/",
      title: GLOSSARY_LABELS.es.pageTitle,
      description: `Definiciones en lenguaje sencillo de ${GLOSSARY_ES.length} términos técnicos, comerciales y de empaque en la categoría de fruta liofilizada.`,
      body: renderGlossaryBody(GLOSSARY_ES, GLOSSARY_CATEGORY_ORDER_ES, "es"),
      screen: "glossary",
      jsonLd: glossaryJsonLd({ site, glossary: GLOSSARY_ES, lang: "es" }),
      lang: "es",
      alternates: { en: "/glossary/", es: "/es/glossary/" },
    }));

    // Mention index for Spanish per-term pages — only walks the Spanish
    // article corpus so the surfaced mentions are in the reader's language.
    const glossaryMentionsEs = buildGlossaryMentionIndex(articlesEs, GLOSSARY_ES);
    for (const term of GLOSSARY_ES) {
      const related = relatedGlossaryTerms(term.slug, GLOSSARY_ES);
      const mentioning = glossaryMentionsEs[term.slug] || [];
      const currentPath = `/es/glossary/${term.slug}/`;
      await writeFilePage(`es/glossary/${term.slug}/index.html`, renderPage({
        site, mailto, currentPath, title: term.term,
        description: firstSentence(term.definition).replace(/\*([^*]+)\*/g, "$1"),
        body: renderGlossaryTermBody(term, related, mentioning, "es"),
        screen: "glossary-term",
        jsonLd: glossaryTermJsonLd({ site, term, mentioning, lang: "es" }),
        lang: "es",
        alternates: { en: `/glossary/${term.slug}/`, es: currentPath },
      }));
    }
    console.log(`→ build: wrote ${GLOSSARY_ES.length} per-term Spanish glossary pages`);
  }

  // Pairwise comparison pages — fully derived from FRUIT_DATA. The hub
  // lives at /compare/, each pair at /compare/<a>-vs-<b>/.
  const comparisonPairs = buildComparisonPairs();
  await writeFilePage("compare/index.html", renderPage({
    site, mailto, currentPath: "/compare/", title: "Compare Freeze-Dried Fruits",
    description: `Side-by-side comparisons across ${comparisonPairs.length} freeze-dried fruit pairings — Brix, fiber, aroma, color stability, breakage, and typical format.`,
    body: renderCompareHub({ pairs: comparisonPairs }),
    screen: "compare-hub",
    jsonLd: compareHubJsonLd({ site, pairs: comparisonPairs }),
  }));
  for (const pair of comparisonPairs) {
    const built = renderComparePage({ a: pair.a, b: pair.b, articles });
    if (!built) continue;
    const currentPath = `/compare/${pair.slug}/`;
    await writeFilePage(`compare/${pair.slug}/index.html`, renderPage({
      site, mailto, currentPath,
      title: `Freeze-Dried ${built.A.name} vs ${built.B.name}`,
      description: `Side-by-side comparison of freeze-dried ${built.A.name.toLowerCase()} and freeze-dried ${built.B.name.toLowerCase()} — Brix, fiber, aroma, color stability, breakage, and typical format.`,
      body: built.bodyHtml, screen: "compare-pair",
      jsonLd: comparePageJsonLd({ site, a: pair.a, b: pair.b, currentPath, A: built.A, B: built.B, faqs: built.faqs }),
    }));
  }
  console.log(`→ build: wrote ${comparisonPairs.length} pairwise comparison pages`);

  // Calculator pages — interactive backlink-bait tools. WebApplication
  // schema tells Google these are functional, not just article-style pages.
  const calcAppSchema = (name, description, url) => ([
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name,
      description,
      url,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: organizationNode(site),
    },
    breadcrumbsNode(site, [
      { name: "Home", path: "/" },
      { name: "Calculators", path: "/calculators/" },
      { name, path: new URL(url).pathname },
    ]),
  ]);
  await writeFilePage("calculators/index.html", renderPage({
    site, mailto, currentPath: "/calculators/", title: "Freeze-Dried Fruit Calculators",
    description: "Free, dependency-free tools for converting fresh fruit into freeze-dried equivalents and for estimating freeze-dried fruit packaging-barrier requirements.",
    body: renderCalculatorsHubBody(), screen: "calculators-hub",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        url: absUrl(site, "/calculators/"),
        name: "Freeze-Dried Fruit Calculators",
        description: "Free interactive tools for the freeze-dried fruit category.",
        inLanguage: "en-US",
        isPartOf: { "@id": `${site.url}/#website` },
      },
      breadcrumbsNode(site, [
        { name: "Home", path: "/" },
        { name: "Calculators", path: "/calculators/" },
      ]),
    ],
    ogImage: `${site.url.replace(/\/$/, "")}/images/og/calculators.png`,
  }));
  await writeFilePage("calculators/fruit-equivalency/index.html", renderPage({
    site, mailto, currentPath: "/calculators/fruit-equivalency/",
    title: "Fruit Equivalency Calculator — Fresh to Freeze-Dried",
    description: "Convert cups or grams of fresh fruit into the equivalent weight and volume of freeze-dried fruit — or vice versa. Free interactive calculator.",
    body: renderFruitEquivalencyCalculator(),
    screen: "calculator-equivalency",
    jsonLd: calcAppSchema(
      "Fruit Equivalency Calculator",
      "Convert fresh fruit to freeze-dried fruit and back. Used by recipe writers, ingredient formulators, and brand teams sizing pack content.",
      absUrl(site, "/calculators/fruit-equivalency/")
    ),
    ogImage: `${site.url.replace(/\/$/, "")}/images/og/calculators-fruit-equivalency.png`,
  }));
  await writeFilePage("calculators/pouch-barrier/index.html", renderPage({
    site, mailto, currentPath: "/calculators/pouch-barrier/",
    title: "Pouch Barrier Estimator — Freeze-Dried Fruit Packaging",
    description: "Estimate the MVTR and OTR target for a freeze-dried fruit pouch based on fruit fragility, climate, shelf-life target, and pack size.",
    body: renderPouchBarrierCalculator(),
    screen: "calculator-barrier",
    jsonLd: calcAppSchema(
      "Pouch Barrier Estimator",
      "Estimate freeze-dried fruit packaging barrier targets (MVTR, OTR, film tier) from fruit fragility, climate zone, shelf-life target, and pack size.",
      absUrl(site, "/calculators/pouch-barrier/")
    ),
    ogImage: `${site.url.replace(/\/$/, "")}/images/og/calculators-pouch-barrier.png`,
  }));

  // Flagship reports — each at its own top-level URL.
  for (const r of reports) {
    // If a Spanish translation exists, both versions advertise each other.
    const esTr = reportEsBySource.get(r.slug);
    const alternates = esTr ? { en: `/${r.slug}/`, es: `/es/${esTr.slug}/` } : null;
    await writeFilePage(`${r.slug}/index.html`, renderPage({
      site, mailto, currentPath: `/${r.slug}/`,
      title: r.title, description: r.summary || r.intro,
      body: renderReportBody({ report: r, mailto, site }),
      screen: "report",
      jsonLd: reportJsonLd({ site, report: r }),
      ogType: "article",
      ogImage: `${site.url.replace(/\/$/, "")}/images/og/${r.slug}.png`,
      alternates,
    }));
  }
  if (reports.length) console.log(`→ build: wrote ${reports.length} flagship report page(s)`);

  // Spanish report translations — live at /es/<slug>/, share the same template
  // as English reports (renderReportBody is structural). Locale-aware chrome
  // comes from renderPage lang="es" automatically.
  for (const r of reportsEs) {
    const enSource = reports.find(x => x.slug === r.en_slug);
    if (!enSource) continue; // Spanish report references a non-existent English source
    await writeFilePage(`es/${r.slug}/index.html`, renderPage({
      site, mailto, currentPath: `/es/${r.slug}/`,
      title: r.title, description: r.summary || r.intro,
      body: renderReportBody({ report: r, mailto, site }),
      screen: "report",
      jsonLd: reportJsonLd({ site, report: r }),
      ogType: "article",
      ogImage: `${site.url.replace(/\/$/, "")}/images/og/es/${r.slug}.png`,
      lang: "es",
      alternates: { en: `/${enSource.slug}/`, es: `/es/${r.slug}/` },
    }));
  }
  if (reportsEs.length) console.log(`→ build: wrote ${reportsEs.length} Spanish report page(s)`);

  await writeFilePage("news/index.html", renderPage({
    site, mailto, currentPath: "/news/", title: "News Wire",
    description: "Auto-updated headlines about freeze-dried fruit and freeze-drying technology.",
    body: renderNewsBody({ news }), screen: "news",
    jsonLd: newsListJsonLd({ site, news }),
  }));
  // Internal search results UI. Tagged noindex,follow because Google's own
  // guidelines explicitly flag site-search pages as low-value targets that
  // tend to land in "Crawled — currently not indexed". We keep `follow` so
  // the outbound article links still pass authority. The /search/ entry is
  // also dropped out of the sitemap below for the same reason.
  await writeFilePage("search/index.html", renderPage({
    site, mailto, currentPath: "/search/", title: "Search",
    description: "Search Freeze-Dried-Fruit.com articles and field guide topics.",
    body: renderSearchBody({ articles }), screen: "search",
    noindex: true,
    jsonLd: simplePageJsonLd({
      site, currentPath: "/search/", name: "Search — Freeze-Dried-Fruit.com",
      description: "Search Freeze-Dried-Fruit.com articles and field guide topics.",
    }),
  }));

  // 404 helper page. Cloudflare Pages auto-serves /404.html for any URL that
  // doesn't resolve, so writing it at the root of dist/ is enough. Tagged
  // noindex so it never enters the search index — GSC's Coverage report
  // still tracks 404 hits so we can spot patterns over time.
  // Category list ordered by the site nav for visual consistency with the
  // header menu the visitor just clicked through.
  const navCategoryOrder = (site.nav || [])
    .filter(n => n.category)
    .map(n => n.category)
    .filter(c => cats.includes(c));
  await writeFilePage("404.html", renderPage({
    site, mailto, currentPath: "/404.html", title: "Page Not Found",
    description: "The page you requested could not be found. Search the field guide, browse a category, or pick up a recent fruit report.",
    body: render404Body({ site, mailto, articles, categories: navCategoryOrder }),
    screen: "not-found",
    noindex: true,
  }));

  // Feeds
  await writeFilePage("feed.xml", buildRssFeed({ site, articles }));
  await writeFilePage("sitemap.xml", buildSitemap({ site, articles, reports, articlesEs, reportsEs }));
  await writeFilePage("llms.txt", buildLlmsTxt({ site, articles, reports }));
  await writeFilePage("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n\n# AI engine guidance\n# A curated index for LLMs is published at /llms.txt\n`);

  // Static assets
  await copyTree(path.join(ROOT, "public"), DIST);

  // Social-share / rich-result PNG cards (1200×630). Generated last so they
  // are written directly into dist/ and don't pollute source. Articles with
  // real photo covers (.jpg/.png) keep their photo for og:image; articles
  // with SVG hero figures get a branded text card so they qualify for
  // Google Article rich-result image and so social previews are consistent.
  const ogDir = path.join(DIST, "images", "og");
  await mkdir(ogDir, { recursive: true });
  let ogCount = 0;
  await writeFile(path.join(ogDir, "default.png"), rasterize(renderSiteOgSvg(site)));
  ogCount++;
  for (const a of articles) {
    const hasPhoto = a.cover_image && !a.cover_image.toLowerCase().endsWith(".svg");
    if (hasPhoto) continue;
    const png = rasterize(renderArticleOgSvg({ title: a.title, category: a.category }));
    await writeFile(path.join(ogDir, `${a.id}.png`), png);
    ogCount++;
  }

  // OG cards for Spanish article translations — same template, Spanish title
  // and category. Lives at /images/og/es/<slug>.png so it doesn't collide
  // with the English card of the same slug. articleImageUrl already routes
  // English articles to /images/og/<slug>.png; Spanish articles use the
  // same fallback path via articleJsonLd, so we generate at the matching
  // path the renderer expects (using en_slug for the matching English file
  // since both languages share the slug).
  const esOgDir = path.join(ogDir, "es");
  await mkdir(esOgDir, { recursive: true });
  for (const a of articlesEs) {
    const hasPhoto = a.cover_image && !a.cover_image.toLowerCase().endsWith(".svg");
    if (hasPhoto) continue;
    const png = rasterize(renderArticleOgSvg({ title: a.title, category: a.category }));
    await writeFile(path.join(esOgDir, `${a.id}.png`), png);
    ogCount++;
  }

  // OG cards for flagship reports — uses the article OG template with a
  // distinctive eyebrow ("ANNUAL REPORT 2026" instead of a regular category).
  for (const r of reports) {
    const png = rasterize(renderArticleOgSvg({
      title: r.title,
      category: r.edition || "ANNUAL REPORT",
    }));
    await writeFile(path.join(ogDir, `${r.slug}.png`), png);
    ogCount++;
  }
  // Spanish report OG cards — Spanish title baked in, at /images/og/es/<slug>.png.
  for (const r of reportsEs) {
    const png = rasterize(renderArticleOgSvg({
      title: r.title,
      category: r.edition || "REPORTE ANUAL",
    }));
    await writeFile(path.join(esOgDir, `${r.slug}.png`), png);
    ogCount++;
  }

  // OG cards for the calculator pages. Each gets its own card so social
  // shares of any calculator surface its name and intent at a glance.
  const calcCards = [
    { slug: "calculators", title: "Freeze-Dried Fruit Calculators", eyebrow: "FREE TOOLS" },
    { slug: "calculators-fruit-equivalency", title: "Fruit Equivalency Calculator — Fresh to Freeze-Dried", eyebrow: "CALCULATOR · CONVERSION" },
    { slug: "calculators-pouch-barrier", title: "Pouch Barrier Estimator for Freeze-Dried Fruit Packaging", eyebrow: "CALCULATOR · PACKAGING" },
  ];
  for (const c of calcCards) {
    const png = rasterize(renderArticleOgSvg({ title: c.title, category: c.eyebrow }));
    await writeFile(path.join(ogDir, `${c.slug}.png`), png);
    ogCount++;
  }

  console.log(`→ build: generated ${ogCount} OG image${ogCount === 1 ? "" : "s"}`);

  // home + articles-index + N categories + N articles + 6 static + 3 feeds
  // Accurate page count walks dist/ for *.html since the build emits many
  // page families (articles, categories, comparisons, glossary terms, static).
  let pageCount = 0;
  async function countHtml(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await countHtml(p);
      else if (e.name.endsWith(".html")) pageCount += 1;
    }
  }
  await countHtml(DIST);
  console.log(`→ build: wrote ${pageCount} pages to dist/`);
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
