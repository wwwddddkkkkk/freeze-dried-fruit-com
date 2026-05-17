// Localization strings for the navigationally-important chrome — header,
// footer, common buttons, common labels. The goal is to make a Spanish
// reader feel they landed on a coherent Spanish site, not on an English
// page with Spanish article content shoehorned in.
//
// Articles, comparison pages, pillar pages, and most marketing copy stay
// in English unless a Spanish translation file exists at content/articles-es/
// — the Spanish surface is opt-in per article.

export const LOCALES = ["en", "es"];

export const DEFAULT_LOCALE = "en";

// All translatable chrome strings keyed by locale.
const STRINGS = {
  en: {
    // <html lang> attribute
    htmlLang: "en",
    // Common buttons / chrome
    menu: "Menu",
    search: "Search",
    searchAria: "Search Freeze-Dried-Fruit.com",
    searchPlaceholder: "Search articles, moisture, mango, suppliers...",
    searchHint: "Search articles on this site.",
    signUpNotes: "Sign Up for Industry Notes",
    sections: "Sections:",
    // Header / menu links
    home: "Home",
    allArticles: "All Articles",
    newsWire: "News Wire",
    glossary: "Glossary",
    compare: "Compare",
    industryExchange: "Industry Exchange",
    about: "About",
    editorialDesk: "Editorial Desk",
    methodology: "Methodology",
    contact: "Contact",
    privacy: "Privacy Policy",
    industryNotes: "Industry Notes",
    calculators: "Calculators",
    // Footer headings
    footerRead: "Read",
    footerIndustry: "Industry",
    footerSite: "Site",
    footerSubmitSupplier: "Submit Supplier Info",
    footerListEquipment: "List Equipment",
    footerBuyerRequest: "Buyer Request",
    footerCompareFruits: "Compare Fruits",
    footerIndependent: "Independent · Field Guide · Est.",
    // Article rendering
    keyTakeaways: "Key Takeaways",
    frequentlyAskedQuestions: "Frequently Asked Questions",
    primarySources: "Primary sources & further reading",
    references: "References",
    continueReadingIn: "Continue reading in",
    nextStops: "Next stops in the field guide",
    seeAllIn: "See all",
    seeAllInSuffix: "articles",
    relatedReading: "Related Reading",
    by: "By",
    originallyPublished: "Originally published",
    updated: "Updated",
    // Article cards
    readArticle: "Read article",
    // Language switcher
    languageLabel: "Language",
    inEnglish: "English",
    inSpanish: "Español",
    availableInSpanish: "Read in Español",
    availableInEnglish: "Read in English",
  },
  es: {
    htmlLang: "es",
    menu: "Menú",
    search: "Buscar",
    searchAria: "Buscar en Freeze-Dried-Fruit.com",
    searchPlaceholder: "Busca artículos: humedad, mango, proveedores...",
    searchHint: "Busca artículos en este sitio.",
    signUpNotes: "Suscríbete a las Notas de Industria",
    sections: "Secciones:",
    home: "Inicio",
    allArticles: "Todos los artículos",
    newsWire: "Noticias",
    glossary: "Glosario",
    compare: "Comparar",
    industryExchange: "Intercambio Industrial",
    about: "Quiénes somos",
    editorialDesk: "Mesa Editorial",
    methodology: "Metodología",
    contact: "Contacto",
    privacy: "Política de privacidad",
    industryNotes: "Notas de Industria",
    calculators: "Calculadoras",
    footerRead: "Leer",
    footerIndustry: "Industria",
    footerSite: "Sitio",
    footerSubmitSupplier: "Enviar información de proveedor",
    footerListEquipment: "Publicar equipos",
    footerBuyerRequest: "Solicitud de comprador",
    footerCompareFruits: "Comparar frutas",
    footerIndependent: "Independiente · Guía de campo · Desde",
    keyTakeaways: "Puntos clave",
    frequentlyAskedQuestions: "Preguntas frecuentes",
    primarySources: "Fuentes primarias y lecturas adicionales",
    references: "Referencias",
    continueReadingIn: "Sigue leyendo en",
    nextStops: "Próximas paradas en la guía de campo",
    seeAllIn: "Ver todos los artículos de",
    seeAllInSuffix: "",
    relatedReading: "Lectura relacionada",
    by: "Por",
    originallyPublished: "Publicado originalmente",
    updated: "Actualizado",
    readArticle: "Leer artículo",
    languageLabel: "Idioma",
    inEnglish: "English",
    inSpanish: "Español",
    availableInSpanish: "Lee en Español",
    availableInEnglish: "Read in English",
  },
};

export function t(lang, key) {
  return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS[DEFAULT_LOCALE][key] || key;
}

// Localized category labels. Same Spanish translations apply across header,
// footer, breadcrumbs, and article meta strips.
const CATEGORY_LABELS = {
  en: {
    "Industry Insights": "Industry Insights",
    "Technology": "Technology",
    "Applications": "Applications",
    "Labels & Quality": "Labels & Quality",
    "Fruit Reports": "Fruit Reports",
  },
  es: {
    "Industry Insights": "Perspectivas de industria",
    "Technology": "Tecnología",
    "Applications": "Aplicaciones",
    "Labels & Quality": "Etiquetas y calidad",
    "Fruit Reports": "Reportes de fruta",
  },
};

export function categoryLabel(lang, category) {
  return (CATEGORY_LABELS[lang] && CATEGORY_LABELS[lang][category]) || category;
}

// URL prefix for a given locale. English is rooted at "/" (no prefix).
// Spanish lives under "/es". Locale-aware URL helpers below all respect this.
export function langPrefix(lang) {
  if (lang === "en" || !lang) return "";
  return `/${lang}`;
}

// Resolve a path inside a locale. For Spanish, "/articles/foo/" becomes
// "/es/articles/foo/". For English, returns the path unchanged.
export function localePath(lang, pathInsideLocale) {
  const prefix = langPrefix(lang);
  if (!prefix) return pathInsideLocale;
  // Already has prefix? leave alone.
  if (pathInsideLocale.startsWith(`${prefix}/`)) return pathInsideLocale;
  return `${prefix}${pathInsideLocale}`;
}
