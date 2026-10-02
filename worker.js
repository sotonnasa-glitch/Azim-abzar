export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const requestPath = decodeURIComponent(url.pathname || "/");

    // Live hotfix bridge: serve the two most recently corrected public files
    // from the canonical GitHub main branch while the full Worker asset bundle
    // remains unchanged. All other requests continue to use ASSETS.
    // Serve the newest re-encoded hero video directly from the GitHub Pages build.
    // This keeps the video independent of the older asset bundle while preserving Range requests.
    if (requestPath === "/assets/homepage/azim-hero-optimized.mp4") {
      try {
        const target = new URL(request.url);
        target.hostname = "sotonnasa-glitch.github.io";
        target.pathname = "/Azim-abzar/assets/homepage/azim-hero-optimized.mp4";
        const videoRequest = new Request(target.toString(), request);
        const video = await fetch(videoRequest, { redirect: "follow" });
        if (video.ok || video.status === 206) {
          const headers = new Headers(video.headers);
          headers.set("cache-control", "public, max-age=31536000, immutable");
          headers.set("accept-ranges", headers.get("accept-ranges") || "bytes");
          headers.set("x-content-type-options", "nosniff");
          return new Response(video.body, { status: video.status, statusText: video.statusText, headers });
        }
      } catch (_) {
        // Fall through to the local asset bundle if Pages is unavailable.
      }
    }

    const liveHotfixFiles = new Set([
      "/",
      "/index.html",
      "/azim-motion.js",
      "/azim-product-ai.js",
      "/products-v4.html",
      "/supabase-config.js",
      "/catalog_site_mapping_908/products.json",
      "/catalog_site_mapping_908/price-size-data.json",
      "/catalog_site_mapping_908/prices.json",
      "/catalog_site_mapping_908/category-map.json"
    ]);
    if (liveHotfixFiles.has(requestPath)) {
      try {
          const hotfixSourcePath = requestPath === "/" ? "/index.html" : requestPath;
      const rawUrl = "https://cdn.jsdelivr.net/gh/sotonnasa-glitch/Azim-abzar@83501f40cfa5acdcc837f5df1a52d10737a83348" + hotfixSourcePath;
      const hotfixTtl = /\.html?$/i.test(requestPath) ? 60 : /\.json$/i.test(requestPath) ? 3600 : 86400;
      const hotfix = await fetch(rawUrl, {
          headers: {
            "accept": requestPath.endsWith(".js")
              ? "application/javascript,text/javascript,*/*"
              : requestPath.endsWith(".json")
                ? "application/json,*/*"
                : "text/html,application/xhtml+xml,*/*"
          },
          cf: {
            cacheEverything: true,
            cacheTtl: hotfixTtl,
            cacheTtlByStatus: { "200-299": hotfixTtl, "404": 1, "500-599": 0 }
          }
        });
        if (hotfix.ok) {
          const headers = new Headers(hotfix.headers);
          const hotfixType = requestPath.endsWith(".js")
            ? "application/javascript; charset=utf-8"
            : requestPath.endsWith(".json")
              ? "application/json; charset=utf-8"
              : "text/html; charset=utf-8";
          headers.set("content-type", hotfixType);
          const browserTtl = /\.html?$/i.test(requestPath) ? 60 : /\.json$/i.test(requestPath) ? 300 : 86400;
          headers.set("cache-control", requestPath.endsWith(".html") || requestPath === "/index.html" || requestPath === "/"
            ? "public, max-age=60, stale-while-revalidate=300"
            : "public, max-age=" + browserTtl + ", stale-while-revalidate=604800");
          headers.delete("pragma");
          headers.delete("expires");
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

    const headers = new Headers();
    const method = request.method.toUpperCase();
    const isHtml = requestPath === "/" || /\.html?$/i.test(requestPath);
    const isJson = /\.json$/i.test(requestPath);
    const isVideo = /\.(?:mp4|webm|m4v)$/i.test(requestPath);
    const isStaticAsset = /\.(?:js|css|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|json)$/i.test(requestPath);

    let response;
    if ((method === "GET" || method === "HEAD") && isStaticAsset && !request.headers.has("authorization")) {
      const ttl = isJson ? 3600 : 86400;
      response = await env.ASSETS.fetch(request, {
        cf: {
          cacheEverything: true,
          cacheTtl: ttl,
          cacheTtlByStatus: { "200-299": ttl, "404": 1, "500-599": 0 }
        }
      });
    } else if ((method === "GET" || method === "HEAD") && isHtml && !request.headers.has("authorization")) {
      response = await env.ASSETS.fetch(request, {
        cf: {
          cacheEverything: true,
          cacheTtl: 60,
          cacheTtlByStatus: { "200-299": 60, "404": 1, "500-599": 0 }
        }
      });
    } else {
      response = await env.ASSETS.fetch(request);
    }
    const responseHeaders = new Headers(response.headers);
    responseHeaders.forEach((value, key) => headers.set(key, value));

    if (isVideo) {
      headers.set("cache-control", "public, max-age=31536000, immutable");
      headers.delete("pragma");
      headers.delete("expires");
    } else if (isHtml) {
      headers.set("cache-control", "public, max-age=60, stale-while-revalidate=300");
      headers.delete("pragma");
      headers.delete("expires");
    } else if (isJson) {
      headers.set("cache-control", "public, max-age=300, stale-while-revalidate=3600");
      headers.delete("pragma");
      headers.delete("expires");
    }

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
