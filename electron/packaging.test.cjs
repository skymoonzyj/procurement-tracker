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

  const nsisArtifactName = build.nsis?.artifactName;
  const portableArtifactName = build.portable?.artifactName;
  assert.equal(typeof nsisArtifactName, 'string', 'NSIS must define a target-specific artifact name');
  assert.equal(typeof portableArtifactName, 'string', 'portable must define a target-specific artifact name');
  assert.notEqual(nsisArtifactName, portableArtifactName, 'NSIS and portable artifact names must not collide');
  assert.match(nsisArtifactName, /nsis/);
  assert.match(portableArtifactName, /portable/);

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

test('macOS packaging targets Universal DMG and ZIP artifacts', () => {
  const pkg = readPackage();
  assert.match(pkg.scripts['dist:mac'], /npm run build/);
  assert.match(pkg.scripts['dist:mac'], /electron-builder/);
  assert.match(pkg.scripts['dist:mac'], /--mac/);
  assert.match(pkg.scripts['dist:mac'], /--universal/);
  const macTargets = Array.isArray(pkg.build.mac.target) ? pkg.build.mac.target : [pkg.build.mac.target];
  assert.deepEqual(macTargets.map((target) => target.target), ['dmg', 'zip']);
  for (const target of macTargets) assert.deepEqual(target.arch, ['universal']);
  assert.equal(pkg.build.mac.category, 'public.app-category.business');
  assert.match(pkg.build.dmg.artifactName, /mac-universal-dmg/);
  assert.match(pkg.build.zip.artifactName, /mac-universal-zip/);
  assert.notEqual(pkg.build.dmg.artifactName, pkg.build.zip.artifactName);
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
  const { waitForHttp, signalExitCode, classifyViteExit } = require('./dev.cjs');
  assert.equal(signalExitCode('SIGINT'), 130);
  assert.equal(signalExitCode('SIGTERM'), 143);
  assert.equal(classifyViteExit({ shuttingDown: false, viteReady: true, code: 7 }).kind, 'runtime-failure');
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

test('aborting readiness polling stops delayed responses from scheduling more requests', async () => {
  const { waitForHttp } = require('./dev.cjs');
  let requests = 0;
  const server = http.createServer((_request, response) => {
    requests += 1;
    setTimeout(() => { response.statusCode = 503; response.end(); }, 20);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const controller = new AbortController();
  const pending = waitForHttp(`http://127.0.0.1:${address.port}`, { timeoutMs: 500, intervalMs: 5, signal: controller.signal });
  setTimeout(() => controller.abort(), 8);
  await assert.rejects(pending, /Cancelled waiting for Vite server/);
  const countAfterAbort = requests;
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(requests, countAfterAbort);
  await new Promise((resolve) => server.close(resolve));
});

test('required Electron entrypoint and ignore rules exist', () => {
  assert.ok(fs.existsSync(path.join(root, 'electron', 'main.cjs')));
  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(gitignore, /(^|\n)release\//);
  assert.match(gitignore, /electron-builder/);
  assert.match(gitignore, /desktop.*log|log.*desktop/i);
});

test('built renderer entry uses relative asset URLs for Electron loadFile', () => {
  const distIndexPath = path.join(root, 'dist', 'index.html');
  assert.ok(fs.existsSync(distIndexPath), 'run npm run build before packaging checks');
  const html = fs.readFileSync(distIndexPath, 'utf8');
  const references = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((reference) => reference.includes('assets/'));

  assert.ok(references.length > 0, 'built index must reference emitted assets');
  for (const reference of references) {
    assert.match(reference, /^\.\/assets\//, `asset URL must be relative: ${reference}`);
  }
});

test('built PDF.js worker is emitted and referenced with a relative URL', () => {
  const assetsDir = path.join(root, 'dist', 'assets');
  assert.ok(fs.existsSync(assetsDir), 'run npm run build before packaging checks');
  const assetFiles = fs.readdirSync(assetsDir);
  const workerFile = assetFiles.find((file) => /^pdf\.worker(?:\.[^.]*)?-.+\.mjs$/.test(file));
  assert.ok(workerFile, 'Vite build must emit the PDF.js worker module');

  const bundles = assetFiles
    .filter((file) => /\.(?:js|mjs)$/.test(file))
    .map((file) => fs.readFileSync(path.join(assetsDir, file), 'utf8'))
    .join('\n');
  // Vite keeps this import relative to the JavaScript chunk by using
  // `new URL('<worker>', import.meta.url)`; this is file://-safe under loadFile.
  const workerReference = bundles.match(/new URL\(`(pdf\.worker[^`]+\.mjs)`,import\.meta\.url\)/);
  assert.ok(workerReference, 'application bundle must reference the emitted PDF.js worker');
  assert.equal(workerReference[1], workerFile);
  assert.ok(fs.existsSync(path.join(assetsDir, workerReference[1])));
});
