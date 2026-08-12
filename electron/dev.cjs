const path = require('node:path');
const { spawn } = require('node:child_process');

const host = '127.0.0.1';
const port = process.env.VITE_PORT || '5173';
const startUrl = process.env.ELECTRON_START_URL || `http://${host}:${port}`;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const electronBinary = require('electron');
const env = { ...process.env, ELECTRON_START_URL: startUrl };

const vite = spawn(npmCommand, ['run', 'dev', '--', '--host', host, '--port', port], {
  stdio: 'inherit',
  env,
});
const electron = spawn(electronBinary, [path.join(__dirname, 'main.cjs')], {
  stdio: 'inherit',
  env,
});

let shuttingDown = false;

function stopChild(child) {
  if (child && child.exitCode === null && !child.killed) child.kill('SIGTERM');
}

function cleanup(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopChild(vite);
  stopChild(electron);
  process.exitCode = exitCode;
}

electron.once('exit', (code, signal) => {
  cleanup(code ?? (signal ? 1 : 0));
});

vite.once('exit', (code) => {
  if (!shuttingDown && code && electron.exitCode === null) {
    stopChild(electron);
    cleanup(code);
  }
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => cleanup(0));
}

process.once('exit', () => {
  stopChild(vite);
  stopChild(electron);
});
