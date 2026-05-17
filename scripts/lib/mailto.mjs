// Builds the same pre-filled mailto links the React prototype shipped with.
// The structured "subject + body" templates are kept verbatim so the routing
// inboxes (industry@, hello@, press@) receive consistently formatted requests.
export function buildMailto(email) {
  const enc = encodeURIComponent;
  const ind = email.industry;
  const hello = email.hello;
  const press = email.press;

  const m = (to, subject, lines) =>
    `mailto:${to}?subject=${enc(subject)}` +
    (lines ? `&body=${lines.map(l => enc(l)).join("%0D%0A")}` : "");

  return {
    supplier: m(ind, "Supplier Info Submission", [
      "Company name:", "Website:", "Country/region:", "Products:", "MOQ:",
      "Certifications:", "Private label available:", "Anything else:",
    ]),
    equipment: m(ind, "Equipment Listing", [
      "I am: Selling / Looking for", "Machine type:", "Capacity:",
      "Location:", "Condition:", "Target price:", "Contact info:", "Additional details:",
    ]),
    join: m(ind, "Join Industry Exchange", [
      "Name:", "Company/role:", "Country/region:",
      "I am a: Supplier / Brand / Buyer / Equipment Seller / Researcher / Consumer",
      "What I want to exchange or learn:", "Contact info:",
    ]),
    buyer: m(ind, "Freeze-Dried Fruit Buyer Request", [
      "I am a: Brand / Retailer / Distributor / Ingredient Buyer",
      "What I am looking for:", "Estimated volume:", "Target market:",
      "Certification requirements:", "Timeline:", "Contact info:",
    ]),
    notes: `mailto:${hello}?subject=${enc("Join Freeze-Dried-Fruit Notes")}`,
    press: `mailto:${press}`,
    hello: `mailto:${hello}`,
    // Pre-filled report for broken links — wired into the 404 page. The
    // visitor's browser fills in the referring URL automatically when they
    // click it; we just give the inbox a consistent subject line so these
    // notes are easy to triage.
    broken: m(hello, "Broken Link on Freeze-Dried-Fruit.com", [
      "The link I followed:", "Where I came from (page or search):",
      "What I was looking for:", "Anything else:",
    ]),
  };
}
