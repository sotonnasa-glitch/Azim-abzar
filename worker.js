export default {
  async fetch(request, env) {
    const requestPath = new URL(request.url).pathname;
    const blocked = /\/(?:HANDOVER|DEPLOYMENT_FA|TRANSFER_READY_FA|AI_AUDIT[^/]*?|\.env\.example|supabase-config\.example)\.md?$|\/(?:\.env\.example|supabase-config\.example\.js)$/i;
    if (blocked.test(requestPath)) {
      return new Response('Not found', { status: 404 });
    }
    const response = await env.ASSETS.fetch(request);
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
};
