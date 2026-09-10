'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'azim-catalog-data.json'), 'utf8'));

assert.equal(catalog.length, 2116, 'the local catalog must contain all 2116 products');
for (const [index, product] of catalog.entries()) {
  assert.ok(String(product.name || '').trim(), `product ${index} must have a name`);
  assert.ok(Number.isFinite(Number(product.price)) && Number(product.price) > 0, `product ${index} must have a price`);
  assert.equal(product.price, product.original_price * 1.2, `product ${index} must be marked up by exactly 20%`);
}

const events = [];
const window = {};
const document = {
  dispatchEvent(event) { events.push(event); return true; }
};
class CustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
}
const context = {
  window,
  document,
  CustomEvent,
  console,
  fetch: async requestedPath => {
    assert.equal(requestedPath, 'azim-catalog-data.json');
    return { ok: true, status: 200, json: async () => catalog };
  }
};
vm.runInNewContext(fs.readFileSync(path.join(root, 'azim-catalog-data.js'), 'utf8'), context);

setImmediate(() => {
  assert.equal(window.AZIM_CATALOG.length, 2116, 'loader must expose all 2116 products on window.AZIM_CATALOG');
  assert.ok(events.some(event => event.type === 'azim-catalog-ready'));
  console.log('Catalog integrity checks passed.');
});
