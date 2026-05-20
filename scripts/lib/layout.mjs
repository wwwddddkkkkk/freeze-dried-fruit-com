// Shared layout — masthead, nav, footer, full-page wrapper.
import { Icons } from "./icons.mjs";

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400&family=Source+Sans+3:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";

// Build-time stamp appended to /styles.css as a query string so the long
// browser cache (max-age 86400 in _headers) invalidates the moment the CSS
// changes. The query string is identical for every page in a single build,
// then bumps on the next build.
const BUILD_VERSION = Date.now().toString(36);

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Serialize an array of schema.org objects as JSON-LD <script> blocks.
// Each closing </ in the JSON is escaped so an inline <script> tag inside
// a string can never prematurely terminate the wrapper.
export function renderJsonLd(jsonLd) {
  if (!jsonLd || !jsonLd.length) return "";
  return jsonLd
    .filter(Boolean)
    .map(obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`)
    .join("\n");
}

// Build the <head> analytics block. Each provider is independent — only
// providers with a non-empty config value emit their tag. Pluggable so the
// site can run GSC + Plausible only, or add GA4 / Cloudflare Web Analytics
// alongside without disturbing the rest. Privacy-by-design defaults: only
// Plausible and Cloudflare run cookie-free; GA4 typically needs consent in
// EU/UK jurisdictions and is intentionally last.
export function renderAnalytics(analytics) {
  if (!analytics) return "";
  const parts = [];

  // Google Search Console domain ownership verification.
  // Google reads this from the homepage; harmless on every page.
  if (analytics.googleSiteVerification) {
    parts.push(`<meta name="google-site-verification" content="${escapeHtml(analytics.googleSiteVerification)}">`);
  }

  // Plausible — cookie-free, ~1KB, no consent banner required.
  // Use the apex domain (e.g. "freeze-dried-fruit.com"), not the full URL.
  if (analytics.plausibleDomain) {
    const src = analytics.plausibleSrc || "https://plausible.io/js/script.js";
    parts.push(`<script defer data-domain="${escapeHtml(analytics.plausibleDomain)}" src="${escapeHtml(src)}"></script>`);
  }

  // Cloudflare Web Analytics — also cookie-free; useful as a backup signal
  // or primary if the site is already on Cloudflare.
  if (analytics.cloudflareToken) {
    const tokenJson = JSON.stringify({ token: analytics.cloudflareToken });
    parts.push(`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${escapeHtml(tokenJson)}'></script>`);
  }

  // Google Analytics 4 — full event analytics, cookie-based. In EU/UK
  // jurisdictions a consent banner is typically required before this fires.
  // Loaded last so cookie-free providers do not block on it.
  if (analytics.ga4Id) {
    const id = escapeHtml(analytics.ga4Id);
    parts.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`);
    parts.push(`<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`);
  }

  return parts.join("\n");
}

function categorySlug(name) {
  return name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function categoryUrl(name, lang = "en") {
  const prefix = lang === "en" ? "" : `/${lang}`;
  return `${prefix}/articles/category/${categorySlug(name)}/`;
}

export function articleUrl(id, lang = "en") {
  const prefix = lang === "en" ? "" : `/${lang}`;
  return `${prefix}/articles/${id}/`;
}

function navItemUrl(item) {
  if (item.to) return item.to;
  if (item.category) return categoryUrl(item.category);
  return "/";
}

function isActive(currentPath, item) {
  const url = navItemUrl(item);
  if (url === "/") return currentPath === "/";
  return currentPath === url || currentPath.startsWith(url);
}

function renderHeader({ site, mailto, currentPath, lang = "en", i18n, alternates }) {
  const T = i18n;
  const prefix = lang === "en" ? "" : `/${lang}`;
  const homePath = `${prefix}/`;
  const navHtml = site.nav.map(item => {
    const url = lang === "en" ? navItemUrl(item) : navItemUrlForLang(item, lang);
    const label = (lang !== "en" && item.category)
      ? (T.categoryLabel(item.category) || item.label)
      : item.label;
    const cls = isActive(currentPath, item) ? "active" : "";
    return `<a href="${url}" class="${cls}">${escapeHtml(label)}</a>`;
  }).join("");

  // Language switcher in the top utility strip — smart, per-page.
  //   - If the current page has an alternates map (set by renderPage when
  //     a translation exists), point at the matching alternate. The visitor
  //     reading the EN apple-varieties report clicks "Lee en Español" and
  //     lands directly on /es/articles/apple-varieties-for-freeze-drying/,
  //     not on a generic Spanish home.
  //   - Otherwise fall back to the locale home (/es/ from EN, / from ES).
  //     This keeps the switcher useful on pages that don't yet have a
  //     translation — visitor lands somewhere coherent.
  let switcherTarget;
  if (lang === "en") {
    switcherTarget = (alternates && alternates.es) ? alternates.es : "/es/";
  } else {
    switcherTarget = (alternates && alternates.en) ? alternates.en : "/";
  }
  const languageSwitcher = lang === "en"
    ? `<a href="${escapeHtml(switcherTarget)}" class="lang-switch" hreflang="es">${escapeHtml(T.t("availableInSpanish"))}</a>`
    : `<a href="${escapeHtml(switcherTarget)}" class="lang-switch" hreflang="en">${escapeHtml(T.t("availableInEnglish"))}</a>`;

  return `
  <header class="site-header">
    <div class="container">
      <div class="site-header__top">
        <div class="site-header__top-left">
          <button class="utility-btn" type="button" data-menu-toggle aria-expanded="false" aria-controls="site-menu">${Icons.menu} ${escapeHtml(T.t("menu"))}</button>
          <button class="utility-btn utility-btn--search" type="button" data-search-toggle aria-expanded="false" aria-controls="site-search">${escapeHtml(T.t("search"))} ${Icons.search}</button>
        </div>
        <div class="site-header__top-right">
          ${languageSwitcher}
          <a href="${mailto.notes}">${escapeHtml(T.t("signUpNotes"))}</a>
        </div>
      </div>

      <div class="site-menu" id="site-menu" hidden>
        <div class="site-menu__grid">
          <a href="${homePath}">${escapeHtml(T.t("home"))}</a>
          <a href="${prefix}/articles/">${escapeHtml(T.t("allArticles"))}</a>
          <a href="/news/">${escapeHtml(T.t("newsWire"))}</a>
          <a href="/glossary/">${escapeHtml(T.t("glossary"))}</a>
          <a href="/compare/">${escapeHtml(T.t("compare"))}</a>
          <a href="/calculators/">${escapeHtml(T.t("calculators"))}</a>
          <a href="/exchange/">${escapeHtml(T.t("industryExchange"))}</a>
          <a href="/about/">${escapeHtml(T.t("about"))}</a>
          <a href="/editorial/">${escapeHtml(T.t("editorialDesk"))}</a>
          <a href="/methodology/">${escapeHtml(T.t("methodology"))}</a>
          <a href="/contact/">${escapeHtml(T.t("contact"))}</a>
          <a href="/privacy/">${escapeHtml(T.t("privacy"))}</a>
          <a href="${mailto.notes}">${escapeHtml(T.t("industryNotes"))}</a>
        </div>
      </div>

      <form class="site-search" id="site-search" role="search" action="/search/" method="get" hidden>
        <label class="site-search__label" for="site-search-input">${escapeHtml(T.t("searchAria"))}</label>
        <div class="site-search__row">
          <input id="site-search-input" name="q" type="search" placeholder="${escapeHtml(T.t("searchPlaceholder"))}" autocomplete="off">
          <button class="btn btn-primary" type="submit">${escapeHtml(T.t("search"))}</button>
        </div>
        <p class="site-search__hint">${escapeHtml(T.t("searchHint"))}</p>
      </form>

      <div class="masthead">
        <a href="${homePath}" class="wordmark">Freeze-Dried-Fruit<span class="wordmark__dot"></span><span class="wordmark__suffix">com</span></a>
        <div class="masthead__tag">${escapeHtml(site.tagline)}</div>
      </div>

      <div class="nav-strip">
        <nav class="nav" id="primary-nav">
          <span class="nav__quick">${escapeHtml(T.t("sections"))}</span>
          ${navHtml}
        </nav>
      </div>
    </div>
  </header>`;
}

// Locale-aware variant of navItemUrl — for nav items that point at category
// archive pages, we point at the localized category page when available.
function navItemUrlForLang(item, lang) {
  if (item.to) return item.to; // External links / non-localized routes stay as-is
  if (item.category) return categoryUrl(item.category, lang);
  return "/";
}

function renderFooter({ site, mailto, lang = "en", i18n }) {
  const T = i18n;
  const prefix = lang === "en" ? "" : `/${lang}`;
  return `
  <footer class="footer">
    <div class="container">
      <div class="footer__grid">
        <div>
          <div class="footer__brand">Freeze-Dried-Fruit<span class="dot">.com</span></div>
          <p class="footer__tag">${escapeHtml(site.footer_tagline)}</p>
        </div>
        <div>
          <h5>${escapeHtml(T.t("footerRead"))}</h5>
          <ul>
            <li><a href="${prefix}/articles/">${escapeHtml(T.t("allArticles"))}</a></li>
            <li><a href="${categoryUrl("Industry Insights", lang)}">${escapeHtml(T.categoryLabel("Industry Insights"))}</a></li>
            <li><a href="${categoryUrl("Technology", lang)}">${escapeHtml(T.categoryLabel("Technology"))}</a></li>
            <li><a href="${categoryUrl("Applications", lang)}">${escapeHtml(T.categoryLabel("Applications"))}</a></li>
            <li><a href="${categoryUrl("Labels & Quality", lang)}">${escapeHtml(T.categoryLabel("Labels & Quality"))}</a></li>
            <li><a href="${categoryUrl("Fruit Reports", lang)}">${escapeHtml(T.categoryLabel("Fruit Reports"))}</a></li>
          </ul>
        </div>
        <div>
          <h5>${escapeHtml(T.t("footerIndustry"))}</h5>
          <ul>
            <li><a href="/exchange/">${escapeHtml(T.t("industryExchange"))}</a></li>
            <li><a href="${mailto.supplier}">${escapeHtml(T.t("footerSubmitSupplier"))}</a></li>
            <li><a href="${mailto.equipment}">${escapeHtml(T.t("footerListEquipment"))}</a></li>
            <li><a href="${mailto.buyer}">${escapeHtml(T.t("footerBuyerRequest"))}</a></li>
          </ul>
        </div>
        <div>
          <h5>${escapeHtml(T.t("footerSite"))}</h5>
          <ul>
            <li><a href="/about/">${escapeHtml(T.t("about"))}</a></li>
            <li><a href="/editorial/">${escapeHtml(T.t("editorialDesk"))}</a></li>
            <li><a href="/methodology/">${escapeHtml(T.t("methodology"))}</a></li>
            <li><a href="/glossary/">${escapeHtml(T.t("glossary"))}</a></li>
            <li><a href="/compare/">${escapeHtml(T.t("footerCompareFruits"))}</a></li>
            <li><a href="/calculators/">${escapeHtml(T.t("calculators"))}</a></li>
            <li><a href="/contact/">${escapeHtml(T.t("contact"))}</a></li>
            <li><a href="/privacy/">${escapeHtml(T.t("privacy"))}</a></li>
          </ul>
        </div>
      </div>
      <div class="footer__bottom">
        <span>© ${new Date().getFullYear()} Freeze-Dried-Fruit.com</span>
        <span>${escapeHtml(T.t("footerIndependent"))} ${escapeHtml(site.established)}</span>
      </div>
    </div>
  </footer>`;
}

function headerScript() {
  return `<script>
(function () {
  var header = document.querySelector('.site-header');
  if (!header) return;

  var menuButton = header.querySelector('[data-menu-toggle]');
  var searchButton = header.querySelector('[data-search-toggle]');
  var menuPanel = header.querySelector('#site-menu');
  var searchForm = header.querySelector('#site-search');
  var searchInput = header.querySelector('#site-search-input');

  function setMenu(open) {
    header.classList.toggle('site-header--menu-open', open);
    if (menuPanel) menuPanel.hidden = !open;
    if (menuButton) menuButton.setAttribute('aria-expanded', String(open));
  }

  function setSearch(open) {
    header.classList.toggle('site-header--search-open', open);
    if (searchForm) searchForm.hidden = !open;
    if (searchButton) searchButton.setAttribute('aria-expanded', String(open));
    if (open && searchInput) setTimeout(function () { searchInput.focus(); }, 30);
  }

  if (menuButton) {
    menuButton.addEventListener('click', function () {
      setMenu(!header.classList.contains('site-header--menu-open'));
    });
  }

  if (searchButton) {
    searchButton.addEventListener('click', function () {
      setSearch(!header.classList.contains('site-header--search-open'));
    });
  }

  if (searchForm) {
    searchForm.addEventListener('submit', function (event) {
      if (!searchInput) return;
      var query = searchInput.value.trim();
      if (!query) {
        event.preventDefault();
        searchInput.focus();
        return;
      }
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      setMenu(false);
      setSearch(false);
    }
  });
})();
</script>`;
}

// Wraps a page body with shared <head>, header, footer.
//
// New i18n parameters:
//   lang        — "en" | "es". Drives <html lang>, header/footer chrome,
//                 and hreflang reciprocal annotations.
//   i18n        — must be { t(key), categoryLabel(name) }. Built by the
//                 caller from scripts/lib/i18n.mjs.
//   alternates  — { en?: "/path/", es?: "/es/path/" } describing every
//                 locale this page exists in. Used to emit hreflang
//                 <link> tags for the search engines. The current page's
//                 own locale is included so the link set is reciprocal
//                 (Google requires this).
export function renderPage({
  site, mailto, currentPath, title, description, body, screen,
  jsonLd, ogImage, ogType, noindex,
  lang = "en", i18n, alternates = null,
}) {
  const pageTitle = title ? `${title} — Freeze-Dried-Fruit.com` : site.title;
  const meta = description || site.description;
  const canonical = `${site.url.replace(/\/$/, "")}${currentPath}`;
  const image = ogImage || `${site.url.replace(/\/$/, "")}/images/og/default.png`;
  const ogTypeTag = ogType || "website";
  // Pages that should never enter the search index (404 helper, internal
  // tools, query-parameter result pages) opt out via `noindex: true`. Renders
  // the standard robots meta directive AND skips the canonical link, since
  // canonicalizing a 404 to itself sends conflicting signals.
  const robotsTag = noindex ? `<meta name="robots" content="noindex,follow">` : "";
  const canonicalTag = noindex ? "" : `<link rel="canonical" href="${canonical}">`;

  // hreflang reciprocal annotations. Every page exists in at least one
  // locale; pages with translations advertise the alternates so Google
  // serves the right locale to the right user. We always emit an
  // x-default pointing at the English version — the recognized fallback
  // signal for "if you don't know which locale, use this one."
  let hreflangTags = "";
  if (alternates) {
    const lines = [];
    if (alternates.en) {
      lines.push(`<link rel="alternate" hreflang="en" href="${site.url.replace(/\/$/, "")}${alternates.en}">`);
      lines.push(`<link rel="alternate" hreflang="x-default" href="${site.url.replace(/\/$/, "")}${alternates.en}">`);
    }
    if (alternates.es) {
      lines.push(`<link rel="alternate" hreflang="es" href="${site.url.replace(/\/$/, "")}${alternates.es}">`);
    }
    hreflangTags = lines.join("\n");
  }

  const T = i18n || { t: () => "", categoryLabel: (c) => c };

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(pageTitle)}</title>
<meta name="description" content="${escapeHtml(meta)}">
${robotsTag}
${canonicalTag}
${hreflangTags}
<meta property="og:title" content="${escapeHtml(pageTitle)}">
<meta property="og:description" content="${escapeHtml(meta)}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="${ogTypeTag}">
<meta property="og:site_name" content="Freeze-Dried-Fruit.com">
<meta property="og:locale" content="${lang === 'es' ? 'es_ES' : 'en_US'}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(pageTitle)}">
<meta name="twitter:description" content="${escapeHtml(meta)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS_HREF}" rel="stylesheet">
<link rel="stylesheet" href="/styles.css?v=${BUILD_VERSION}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="alternate" type="application/rss+xml" title="Freeze-Dried-Fruit.com Articles" href="/feed.xml">
${renderAnalytics(site.analytics)}
${renderJsonLd(jsonLd)}
</head>
<body>
${renderHeader({ site, mailto, currentPath, lang, i18n: T, alternates })}
<main data-screen-label="${screen || ""}">${body}</main>
${renderFooter({ site, mailto, lang, i18n: T })}
${headerScript()}
</body>
</html>`;
}
