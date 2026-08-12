const path = require('node:path');

function loadElectron() {
  // Keep this module require-safe in plain Node (for smoke tests and tooling).
  // Electron is only available when this file is launched as an Electron main
  // process, so defer loading it until a runtime API is actually needed.
  return require('electron');
}

function resolveRendererTarget({ appPath = process.cwd(), startUrl } = {}) {
  const devUrl = startUrl || process.env.ELECTRON_START_URL;
  if (devUrl) return devUrl;
  return path.resolve(appPath, 'dist', 'index.html');
}

function isHttpUrl(value) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function isLocalRendererUrl(value) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'file:' || protocol === 'blob:' || protocol === 'about:';
  } catch {
    return false;
  }
}

function createMainWindow(options = {}) {
  const electron = options.electron || loadElectron();
  const app = options.app || electron.app;
  const BrowserWindow = options.BrowserWindow || electron.BrowserWindow;
  const shell = options.shell || electron.shell;
  const appPath = options.appPath || app.getAppPath();
  const startUrl = options.startUrl;
  const rendererTarget = resolveRendererTarget({ appPath, startUrl });

  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  const webContents = mainWindow.webContents;
  if (webContents && typeof webContents.setWindowOpenHandler === 'function') {
    webContents.setWindowOpenHandler(({ url }) => {
      if (isHttpUrl(url) && shell && typeof shell.openExternal === 'function') {
        Promise.resolve(shell.openExternal(url)).catch(() => {});
      }
      return { action: 'deny' };
    });
  }

  if (webContents && typeof webContents.on === 'function') {
    webContents.on('will-navigate', (event, url) => {
      if (isLocalRendererUrl(url)) return;
      if (isHttpUrl(url) && shell && typeof shell.openExternal === 'function') {
        Promise.resolve(shell.openExternal(url)).catch(() => {});
      }
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
    });
  }

  if (typeof mainWindow.once === 'function') {
    mainWindow.once('ready-to-show', () => {
      if (typeof mainWindow.show === 'function') mainWindow.show();
    });
  }

  if (rendererTarget.startsWith('http://') || rendererTarget.startsWith('https://')) {
    mainWindow.loadURL(rendererTarget);
  } else {
    mainWindow.loadFile(rendererTarget);
  }

  return mainWindow;
}

function startElectronApp() {
  const { app, BrowserWindow } = loadElectron();
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  let mainWindow;
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (typeof mainWindow.isMinimized === 'function' && mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    if (typeof mainWindow.focus === 'function') mainWindow.focus();
  });

  app.whenReady().then(() => {
    mainWindow = createMainWindow({ app, BrowserWindow });
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow({ app, BrowserWindow });
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

if (process.versions && process.versions.electron) {
  startElectronApp();
}

module.exports = { createMainWindow, resolveRendererTarget };
