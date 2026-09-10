// Applies the catalog price policy only after the complete local catalog is available.
(() => {
  const EXPECTED_CATALOG_COUNT = 2116;

  const showCatalogError = message => {
    console.error(message);
    document.dispatchEvent(new CustomEvent('azim-catalog-error', { detail: { message } }));
    const info = document.getElementById('info');
    if (info) info.textContent = message;
  };

  const apply = () => {
    if (!Array.isArray(window.AZIM_CATALOG)) return false;
    if (window.AZIM_CATALOG.length !== EXPECTED_CATALOG_COUNT) {
      showCatalogError(`کاتالوگ ناقص است: ${window.AZIM_CATALOG.length} محصول دریافت شد؛ ${EXPECTED_CATALOG_COUNT} محصول لازم است.`);
      return false;
    }

    try {
      window.AZIM_CATALOG = window.AZIM_CATALOG.map((product, index) => {
        const originalPrice = Number(product.original_price);
        if (!String(product.name || '').trim() || !Number.isFinite(originalPrice) || originalPrice <= 0) {
          throw new Error(`Invalid catalog product at index ${index}`);
        }
        return {
          ...product,
          original_price: originalPrice,
          price: originalPrice * 1.2,
          code: product.code || `PDF-${String(index + 1).padStart(4, '0')}`
        };
      });
    } catch (error) {
      showCatalogError(`کاتالوگ نامعتبر است: ${error.message}`);
      return false;
    }

    try {
      if (typeof products !== 'undefined' && typeof normalize === 'function') {
        products = normalize(window.AZIM_CATALOG);
        page = 1;
        if (typeof render === 'function') render();
      }
    } catch (error) {
      showCatalogError(`نمایش کاتالوگ ناموفق بود: ${error.message}`);
      return false;
    }

    document.dispatchEvent(new CustomEvent('azim-catalog-loaded', { detail: { count: window.AZIM_CATALOG.length } }));
    return true;
  };

  document.addEventListener('azim-catalog-ready', apply);
  apply();
})();
