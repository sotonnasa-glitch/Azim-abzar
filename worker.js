export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Always fetch the latest static asset and explicitly disable edge/browser caching.
    // This is important for the catalog because products-v3 loads the PDF-derived
    // size/price dataset as a second asset.
    const response = await env.ASSETS.fetch(request);

    if (url.pathname !== '/' && url.pathname !== '/index.html') {
      const headers = new Headers(response.headers);
      headers.set('cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      headers.set('pragma', 'no-cache');
      headers.set('expires', '0');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    const html = await response.text();
    const injected = html.includes('azim-home-copy.js?v=5')
      ? html
      : html.replace('</body>', [
          '<script src="/azim-motion.js?v=3" defer></script>',
          '<script src="/azim-home-gallery.js?v=3" defer></script>',
          '<script src="/azim-home-copy.js?v=5" defer></script>',
          '</body>'
        ].join('\n'));

    const headers = new Headers(response.headers);
    headers.set('content-type', 'text/html; charset=UTF-8');
    headers.set('cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    headers.set('pragma', 'no-cache');
    headers.set('expires', '0');

    return new Response(injected, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
