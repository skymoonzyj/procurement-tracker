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

test('window-open protocol policy allows local blob previews and opens only HTTP(S) externally', () => {
  const { createMainWindow } = require('./main.cjs');
  const decisions = {};
  const opened = [];
  const webContents = {
    setWindowOpenHandler(handler) {
      decisions.blob = handler({ url: 'blob:file:///invoice.pdf' });
      decisions.blank = handler({ url: 'about:blank' });
      decisions.https = handler({ url: 'https://example.com/invoice' });
      decisions.javascript = handler({ url: 'javascript:alert(1)' });
    },
    on() {},
  };
  const window = {
    webContents,
    once() {},
    loadFile() {},
  };
  const electron = {
    BrowserWindow: function BrowserWindow() {
      return window;
    },
    shell: {
      openExternal(url) {
        opened.push(url);
      },
    },
  };

  createMainWindow({ electron, app: { getAppPath: () => '/app' } });

  assert.deepEqual(decisions.blob, { action: 'allow' });
  assert.deepEqual(decisions.blank, { action: 'allow' });
  assert.deepEqual(decisions.https, { action: 'deny' });
  assert.deepEqual(decisions.javascript, { action: 'deny' });
  assert.deepEqual(opened, ['https://example.com/invoice']);
});
