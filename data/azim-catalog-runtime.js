/* Load the verified, uncompressed catalog chunks.
 *
 * The former gzip payload was incomplete in production, causing the browser
 * decompressor to reject it and leaving the products page empty. Keeping the
 * records as JavaScript chunks avoids both that corruption point and reliance
 * on DecompressionStream support.
 */
window.AZIM_CATALOG_READY = (async () => {
  const files = Array.from({ length: 8 }, (_, index) => `azim-catalog-chunk-${index + 1}.js`);
  window.AZIM_CATALOG_PARTS = [];

  const load = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`خطا در بارگذاری فایل محصولات: ${src}`));
    document.head.appendChild(script);
  });

  for (const file of files) await load(file);

  const data = window.AZIM_CATALOG_PARTS.flat();
  if (!Array.isArray(data) || data.length !== 433) {
    throw new Error(`تعداد محصولات دیتابیس صحیح نیست: ${data?.length ?? 0}`);
  }

  window.AZIM_CATALOG = data;
  window.AZIM_PRODUCTS = data;
  return data;
})();
