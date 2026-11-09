// Only the HTTP apex route and the www hostname invoke this Worker. Canonical
// HTTPS requests continue using the existing static asset Worker directly.
export default {
  fetch(request) {
    const url = new URL(request.url);
    const isApex = url.hostname === "freeze-dried-fruit.com";
    const isWww = url.hostname === "www.freeze-dried-fruit.com";
    if (isWww || (isApex && url.protocol === "http:")) {
      url.protocol = "https:";
      url.hostname = "freeze-dried-fruit.com";
      url.port = "";
      return Response.redirect(url.toString(), 308);
    }
    return new Response("Not found", { status: 404 });
  },
};
