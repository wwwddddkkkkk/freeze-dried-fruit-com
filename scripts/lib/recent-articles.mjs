// Homepage recency reflects substantive revisions as well as new publication.
// This leaves the library's original publication dates and archive order intact.
export function articleActivity(article) {
  const published = article.date instanceof Date ? article.date : new Date(article.date);
  const revised = article.updated instanceof Date ? article.updated : new Date(article.updated);
  const publishedTime = Number.isFinite(published.getTime()) ? published.getTime() : 0;
  const revisedTime = article.updated && Number.isFinite(revised.getTime()) ? revised.getTime() : 0;
  const updated = revisedTime > publishedTime;
  return { date: new Date(updated ? revisedTime : publishedTime), updated };
}

export function recentArticles(articles) {
  return [...articles].sort((a, b) => articleActivity(b).date - articleActivity(a).date);
}
