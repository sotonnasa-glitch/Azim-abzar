export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const requestPath = decodeURIComponent(url.pathname || "/");

    // Live hotfix bridge: serve selected public files from the canonical GitHub
    // main branch while the full Worker asset bundle remains unchanged.
    // All other requests continue to use ASSETS.
    const liveHotfixFiles = new Set([
      "/index.html",
      "/products-v4.html",
      "/products.html",
      "/products2.html",
      "/products-v2.html",
      "/products-v3.html",
      "/products-v5.html",
      "/cart.html",
      "/contact.html",
      "/order-status.html",
      "/ai.html",
      "/admin.html",
      "/admin-app.js",
      "/admin-modern.css",
      "/privacy.html",
      "/terms.html",
      "/payment-callback.html",
      "/404.html",
      "/wishlist.html",
      "/azim-cart.js",
      "/azim-product-ai.js",
      "/azim-product-ai.css",
      "/azim-ai-widget.js",
      "/azim-live-content.js",
      "/azim-order-tracking-inline.js",
      "/azim-home-categories.css",
      "/azim-home-categories.js",
      "/azim-home-copy.js",
      "/azim-home-gallery.js",
      "/azim-motion.js",
      "/azim-footer.css",
      "/assets/homepage/azim-hero-optimized.mp4",
      "/catalog_site_mapping_908/products.json",
      "/catalog_site_mapping_908/price-size-data.json",
      "/catalog_site_mapping_908/prices.json",
      "/catalog_site_mapping_908/category-map.json"
    ]);
    if (liveHotfixFiles.has(requestPath)) {
      try {
        const rawUrl = "https://raw.githubusercontent.com/sotonnasa-glitch/Azim-abzar/main" + requestPath;
        const hotfix = await fetch(rawUrl, {
          headers: {
            "accept": requestPath.endsWith(".js")
              ? "application/javascript,text/javascript,*/*"
              : requestPath.endsWith(".css")
                ? "text/css,*/*"
                : "text/html,application/xhtml+xml,*/*"
          }
        });
        if (hotfix.ok) {
          const headers = new Headers(hotfix.headers);
          headers.delete("content-security-policy");
          headers.delete("content-security-policy-report-only");
          headers.delete("content-disposition");
          headers.set("content-security-policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co;");
          headers.set("content-security-policy-report-only", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co; script-src-attr 'none';");
          headers.set("x-frame-options", "DENY");
          headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
          const hotfixType = requestPath.endsWith(".js")
            ? "application/javascript; charset=utf-8"
            : requestPath.endsWith(".css")
              ? "text/css; charset=utf-8"
              : requestPath.endsWith(".json")
                ? "application/json; charset=utf-8"
                : "text/html; charset=utf-8";
          headers.set("content-type", hotfixType);
          headers.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
          headers.set("pragma", "no-cache");
          headers.set("expires", "0");
          headers.set("x-content-type-options", "nosniff");
          return new Response(hotfix.body, {
            status: hotfix.status,
            statusText: hotfix.statusText,
            headers
          });
        }
      } catch (_) {
        // Fall back to the deployed static asset bundle below.
      }
    }

    // Defense in depth: never expose source, deployment, audit, database or build internals.
    const blocked = [
      /^\/(?:audit|database|supabase|src|scripts|tools)(?:\/|$)/i,
      /^\/(?:server\.js|worker\.js|wrangler\.jsonc|\.assetsignore|\.gitignore|package(?:-lock)?\.json)$/i,
      /^\/(?:HANDOVER|DEPLOYMENT_FA|TRANSFER_READY_FA|AI_AUDIT[^/]*?)\.md$/i,
      /\.(?:sql|b64|zip|pem|key)$/i,
      /(?:^|\/)\.env(?:\.|$)/i,
      /^\/catalog_site_mapping_908\/(?:hq-image-match-manifest\.json|product_sizes\.json|products\.jsonl|.*\.b64|.*\.zip)$/i
    ];

    if (blocked.some((pattern) => pattern.test(requestPath))) {
      return new Response("Not found", {
        status: 404,
        headers: {
          "cache-control": "no-store",
          "x-content-type-options": "nosniff"
        }
      });
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);

    headers.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    headers.set("pragma", "no-cache");
    headers.set("expires", "0");

    headers.set("x-content-type-options", "nosniff");
    headers.set("referrer-policy", "strict-origin-when-cross-origin");
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains; preload");
    headers.set("x-frame-options", "DENY");
    headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
    headers.set(
      "content-security-policy",
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co;"
    );
    // Report the future strict policy without breaking the existing inline-heavy pages.
    headers.set(
      "content-security-policy-report-only",
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co; script-src-attr 'none';"
    );

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};