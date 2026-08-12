const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const root = path.resolve(__dirname, '..');
const packageJsonPath = path.join(root, 'package.json');

function readPackage() {
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

test('Electron packaging metadata and scripts are configured', () => {
  const pkg = readPackage();
  assert.equal(pkg.version, '1.0.0');
  assert.equal(pkg.main, 'electron/main.cjs');
  assert.equal(pkg.scripts['dev:desktop'], 'node electron/dev.cjs');
  assert.match(pkg.scripts['dist:win'], /build/);
  assert.match(pkg.scripts['dist:win'], /electron-builder/);
  assert.ok(pkg.devDependencies.electron, 'electron must be a dev dependency');
  assert.ok(pkg.devDependencies['electron-builder'], 'electron-builder must be a dev dependency');

  const build = pkg.build;
  assert.equal(build.appId, 'cn.xingzheng.procurement-tracker');
  assert.equal(build.productName, '采购报销台账');
  assert.equal(build.directories.output, 'release');
  assert.match(build.artifactName, /\$\{productName\}/);
  assert.match(build.artifactName, /\$\{version\}/);

  const targets = Array.isArray(build.win.target) ? build.win.target : [build.win.target];
  const targetNames = targets.map((target) => typeof target === 'string' ? target : target.target);
  assert.ok(targetNames.includes('nsis'));
  assert.ok(targetNames.includes('portable'));
  assert.equal(build.nsis.oneClick, false);
  assert.equal(build.nsis.allowToChangeInstallationDirectory, true);
  assert.equal(build.nsis.createDesktopShortcut, true);
  assert.equal(build.nsis.createStartMenuShortcut, true);
  assert.equal(build.nsis.deleteAppDataOnUninstall, false);
});

test('Electron development launcher exists and manages child processes', () => {
  const launcherPath = path.join(root, 'electron', 'dev.cjs');
  assert.ok(fs.existsSync(launcherPath));
  const launcher = fs.readFileSync(launcherPath, 'utf8');
  assert.match(launcher, /ELECTRON_START_URL/);
  assert.match(launcher, /127\.0\.0\.1/);
  assert.match(launcher, /spawn/);
  assert.match(launcher, /kill/);
});

test('launcher waits for a reachable loopback HTTP endpoint and reports timeout', async () => {
  const { waitForHttp, signalExitCode } = require('./dev.cjs');
  assert.equal(signalExitCode('SIGINT'), 130);
  assert.equal(signalExitCode('SIGTERM'), 143);
  const server = http.createServer((_request, response) => {
    response.statusCode = server.ready ? 200 : 503;
    response.end();
  });
  server.ready = false;
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;
  const pending = waitForHttp(url, { timeoutMs: 500, intervalMs: 10 });
  setTimeout(() => { server.ready = true; }, 35);
  await pending;
  await new Promise((resolve) => server.close(resolve));

  await assert.rejects(
    waitForHttp('http://127.0.0.1:1', { timeoutMs: 30, intervalMs: 5 }),
    /Timed out waiting for Vite server at http:\/\/127\.0\.0\.1:1/,
  );
});

test('required Electron entrypoint and ignore rules exist', () => {
  assert.ok(fs.existsSync(path.join(root, 'electron', 'main.cjs')));
  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(gitignore, /(^|\n)release\//);
  assert.match(gitignore, /electron-builder/);
  assert.match(gitignore, /desktop.*log|log.*desktop/i);
});
