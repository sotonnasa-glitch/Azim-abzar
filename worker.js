export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const requestPath = decodeURIComponent(url.pathname || "/");

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

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
