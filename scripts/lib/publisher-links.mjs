// One attribution contract for publisher links added by shared components.
// Keep the article path in utm_content so Shopify can report visits by source
// even when the reader's browser only sends the referring domain.
export function publisherUrl(destination = "/collections/all", placement = "shop", sourcePath = "/") {
  const url = new URL(destination, "https://ohcrisp.com");
  if (url.origin !== "https://ohcrisp.com") {
    throw new Error("Publisher links must point to https://ohcrisp.com");
  }
  url.searchParams.set("utm_source", "freeze-dried-fruit.com");
  url.searchParams.set("utm_medium", "referral");
  url.searchParams.set("utm_campaign", "field_guide");
  url.searchParams.set("utm_content", `${placement}:${sourcePath}`);
  return url.toString();
}
