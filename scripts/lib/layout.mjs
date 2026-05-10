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

function categorySlug(name) {
  return name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function categoryUrl(name) {
  return `/articles/category/${categorySlug(name)}/`;
}

export function articleUrl(id) {
  return `/articles/${id}/`;
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

function renderHeader({ site, mailto, currentPath }) {
  const navHtml = site.nav.map(item => {
    const url = navItemUrl(item);
    const cls = isActive(currentPath, item) ? "active" : "";
    return `<a href="${url}" class="${cls}">${escapeHtml(item.label)}</a>`;
  }).join("");

  return `
  <header class="site-header">
    <div class="container">
      <div class="site-header__top">
        <div class="site-header__top-left">
          <button class="utility-btn" type="button" data-menu-toggle aria-expanded="false" aria-controls="primary-nav">${Icons.menu} Menu</button>
          <button class="utility-btn utility-btn--search" type="button" data-search-toggle aria-expanded="false" aria-controls="site-search">Search ${Icons.search}</button>
        </div>
        <div class="site-header__top-right">
          <a href="${mailto.notes}">Sign Up for Industry Notes</a>
        </div>
      </div>

      <form class="site-search" id="site-search" role="search" action="https://www.google.com/search" method="get" hidden>
        <label class="site-search__label" for="site-search-input">Search Freeze-Dried-Fruit.com</label>
        <div class="site-search__row">
          <input id="site-search-input" name="q" type="search" placeholder="Search articles, moisture, mango, suppliers..." autocomplete="off">
          <button class="btn btn-primary" type="submit">Search</button>
        </div>
        <p class="site-search__hint">Search opens Google results limited to Freeze-Dried-Fruit.com.</p>
      </form>

      <div class="masthead">
        <a href="/" class="wordmark">Freeze-Dried-Fruit<span class="wordmark__dot"></span><span class="wordmark__suffix">com</span></a>
        <div class="masthead__tag">${escapeHtml(site.tagline)}</div>
      </div>

      <div class="nav-strip">
        <nav class="nav" id="primary-nav">
          <span class="nav__quick">Sections:</span>
          ${navHtml}
        </nav>
      </div>
    </div>
  </header>`;
}

function renderFooter({ site, mailto }) {
  return `
  <footer class="footer">
    <div class="container">
      <div class="footer__grid">
        <div>
          <div class="footer__brand">Freeze-Dried-Fruit<span class="dot">.com</span></div>
          <p class="footer__tag">${escapeHtml(site.footer_tagline)}</p>
        </div>
        <div>
          <h5>Read</h5>
          <ul>
            <li><a href="/articles/">All Articles</a></li>
            <li><a href="${categoryUrl("Industry Insights")}">Insights</a></li>
            <li><a href="${categoryUrl("Technology")}">Technology</a></li>
            <li><a href="${categoryUrl("Labels & Quality")}">Labels &amp; Quality</a></li>
          </ul>
        </div>
        <div>
          <h5>Industry</h5>
          <ul>
            <li><a href="/exchange/">Industry Exchange</a></li>
            <li><a href="${mailto.supplier}">Submit Supplier Info</a></li>
            <li><a href="${mailto.equipment}">List Equipment</a></li>
            <li><a href="${mailto.buyer}">Buyer Request</a></li>
          </ul>
        </div>
        <div>
          <h5>Site</h5>
          <ul>
            <li><a href="/about/">About</a></li>
            <li><a href="/contact/">Contact</a></li>
            <li><a href="/privacy/">Privacy Policy</a></li>
          </ul>
        </div>
      </div>
      <div class="footer__bottom">
        <span>© ${new Date().getFullYear()} Freeze-Dried-Fruit.com</span>
        <span>Independent · Field Guide · Est. ${escapeHtml(site.established)}</span>
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
  var searchForm = header.querySelector('#site-search');
  var searchInput = header.querySelector('#site-search-input');

  function setMenu(open) {
    header.classList.toggle('site-header--menu-open', open);
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
      event.preventDefault();
      window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent('site:freeze-dried-fruit.com ' + query);
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') setSearch(false);
  });
})();
</script>`;
}

// Wraps a page body with shared <head>, header, footer.
export function renderPage({ site, mailto, currentPath, title, description, body, screen }) {
  const pageTitle = title ? `${title} — Freeze-Dried-Fruit.com` : site.title;
  const meta = description || site.description;
  const canonical = `${site.url.replace(/\/$/, "")}${currentPath}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(pageTitle)}</title>
<meta name="description" content="${escapeHtml(meta)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${escapeHtml(pageTitle)}">
<meta property="og:description" content="${escapeHtml(meta)}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS_HREF}" rel="stylesheet">
<link rel="stylesheet" href="/styles.css?v=${BUILD_VERSION}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="alternate" type="application/rss+xml" title="Freeze-Dried-Fruit.com Articles" href="/feed.xml">
</head>
<body>
${renderHeader({ site, mailto, currentPath })}
<main data-screen-label="${screen || ""}">${body}</main>
${renderFooter({ site, mailto })}
${headerScript()}
</body>
</html>`;
}
