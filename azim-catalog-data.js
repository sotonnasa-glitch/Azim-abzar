// Local, uncompressed catalog source. Keep this loader free of CDN and gzip dependencies.
(() => {
  const EXPECTED_CATALOG_COUNT = 2116;
  const CATALOG_URL = 'azim-catalog-data.json';

  const fail = message => {
    const error = new Error(message);
    console.error(error);
    document.dispatchEvent(new CustomEvent('azim-catalog-error', { detail: { error, message } }));
  };

  fetch(CATALOG_URL, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
      return response.json();
    })
    .then(catalog => {
      if (!Array.isArray(catalog) || catalog.length !== EXPECTED_CATALOG_COUNT) {
        throw new Error(`Catalog is incomplete: expected ${EXPECTED_CATALOG_COUNT} products, received ${Array.isArray(catalog) ? catalog.length : 0}`);
      }
      window.AZIM_CATALOG = catalog;
      document.dispatchEvent(new CustomEvent('azim-catalog-ready', { detail: { count: catalog.length } }));
    })
    .catch(error => fail(`Azim catalog could not be loaded: ${error.message}`));
})();
