const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('renderer target resolves to the dev URL when provided', () => {
  const { resolveRendererTarget } = require('./main.cjs');

  assert.equal(
    resolveRendererTarget({ appPath: 'C:/app', startUrl: 'http://localhost:4173' }),
    'http://localhost:4173',
  );
});

test('renderer target resolves to the absolute production index file', () => {
  const { resolveRendererTarget } = require('./main.cjs');
  const appPath = path.join('C:', 'Program Files', 'Procurement Tracker');

  assert.equal(
    resolveRendererTarget({ appPath }),
    path.resolve(appPath, 'dist', 'index.html'),
  );
});

test('main process exports a window factory without loading Electron in Node', () => {
  const main = require('./main.cjs');

  assert.equal(typeof main.createMainWindow, 'function');
  assert.equal(typeof main.resolveRendererTarget, 'function');
});
