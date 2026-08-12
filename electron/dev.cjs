const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const host = '127.0.0.1';
const port = process.env.VITE_PORT || '5173';
const startUrl = process.env.ELECTRON_START_URL || `http://${host}:${port}`;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function waitForHttp(url, { timeoutMs = 30_000, intervalMs = 100, signal } = {}) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      error ? reject(error) : resolve();
    };
    if (signal) {
      if (signal.aborted) return finish(new Error(`Cancelled waiting for Vite server at ${url}`));
      signal.addEventListener('abort', () => finish(new Error(`Cancelled waiting for Vite server at ${url}`)), { once: true });
    }
    const poll = () => {
      if (Date.now() >= deadline) {
        finish(new Error(`Timed out waiting for Vite server at ${url} after ${timeoutMs}ms`));
        return;
      }
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          finish();
        } else {
          request.once('close', () => { timer = setTimeout(poll, intervalMs); });
        }
      });
      request.once('error', () => { timer = setTimeout(poll, intervalMs); });
      request.setTimeout(Math.min(intervalMs, 250), () => request.destroy());
    };
    poll();
  });
}

function stopChild(child) {
  if (!child || child.exitCode !== null || child.killed) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    child.once('close', finish);
    if (process.platform === 'win32' && child.pid) {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      killer.once('close', () => {
        if (child.exitCode === null && !child.killed) child.kill();
      });
    } else {
      child.kill('SIGTERM');
    }
    setTimeout(finish, 2_000).unref();
  });
}

function signalExitCode(signal) {
  return { SIGHUP: 129, SIGINT: 130, SIGTERM: 143 }[signal] || 1;
}

async function launch() {
  const env = { ...process.env, ELECTRON_START_URL: startUrl };
  const vite = spawn(npmCommand, ['run', 'dev', '--', '--host', host, '--port', port], {
    stdio: 'inherit',
    env,
  });
  let electron;
  let shuttingDown = false;
  let viteReady = false;
  const abortController = new AbortController();
  const cleanup = async (exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    abortController.abort();
    await Promise.all([stopChild(vite), stopChild(electron)]);
    process.exitCode = exitCode;
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.once(signal, () => { void cleanup(signalExitCode(signal)); });
  }
  const viteExit = new Promise((_, reject) => {
    vite.once('exit', (code, signal) => {
      if (!shuttingDown && !viteReady) reject(new Error(`Vite exited before readiness (code=${code}, signal=${signal || 'none'})`));
    });
  });

  try {
    await Promise.race([waitForHttp(startUrl, { signal: abortController.signal }), viteExit]);
    viteReady = true;
    const electronBinary = require('electron');
    electron = spawn(electronBinary, [path.join(__dirname, 'main.cjs')], { stdio: 'inherit', env });
    await new Promise((resolve) => electron.once('exit', (code, signal) => cleanup(code ?? signalExitCode(signal)).then(resolve)));
  } catch (error) {
    console.error(error.message);
    await cleanup(1);
  }
}

if (require.main === module) {
  void launch();
}

module.exports = { waitForHttp, stopChild, signalExitCode };
