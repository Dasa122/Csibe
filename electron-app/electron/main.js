const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

// ── Logging ──────────────────────────────────────────────────
const LOG_PREFIX = '[Main]';
function log(...args) { console.log(`${LOG_PREFIX} ${new Date().toLocaleTimeString()} │`, ...args); }
function logError(...args) { console.error(`${LOG_PREFIX} ${new Date().toLocaleTimeString()} ❌`, ...args); }

// ── Crash prevention for Linux (network service, GPU sandbox) ──
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-features', 'NetworkServiceSandbox');
  log('Linux flags applied: --no-sandbox, --disable-gpu-sandbox, --disable-features=NetworkServiceSandbox');
}

// Only allow one instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  log('Another instance is running. Quitting.');
  app.quit();
}

let mainWindow = null;
let devWindow = null;

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;
log(`Starting in ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);

function createMainWindow(targetDisplayId = null) {
  const displays = screen.getAllDisplays();
  log(`Detected ${displays.length} display(s):`, displays.map(d => `${d.size.width}x${d.size.height}`).join(', '));

  let displayToUse = displays[0];
  if (targetDisplayId !== null) {
    const found = displays.find(d => d.id === targetDisplayId);
    if (found) displayToUse = found;
  }

  const { x, y, width, height } = displayToUse.bounds;
  log(`Main window → ${width}x${height} at (${x},${y})`);

  mainWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    fullscreen: true,
    frame: false,
    show: false, // show after ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Show window once content is ready to avoid white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    log('Main window shown');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    log('Main window loaded');
  });

  mainWindow.webContents.on('did-fail-load', (_event, code, desc) => {
    logError(`Main window load failed: ${code} — ${desc}`);
  });

  // Log renderer crashes
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logError(`Renderer gone: reason=${details.reason}, exitCode=${details.exitCode}`);
  });

  if (isDev) {
    const url = 'http://localhost:5173';
    log(`Loading: ${url}`);
    mainWindow.loadURL(url);
  } else {
    const filePath = path.join(__dirname, '..', 'dist', 'index.html');
    log(`Loading file: ${filePath}`);
    mainWindow.loadFile(filePath);
  }

  mainWindow.on('closed', () => {
    log('Main window closed');
    mainWindow = null;
  });
}

// IPC handlers
ipcMain.handle('get-screens', () => {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    index: i,
    label: d.label || `Display ${i + 1}`,
    bounds: d.bounds,
    isPrimary: d.id === primaryId,
    size: `${d.size.width}×${d.size.height}`,
    scaleFactor: d.scaleFactor,
  }));
});

ipcMain.handle('move-main-window', (_event, displayId) => {
  if (!mainWindow) return false;
  const displays = screen.getAllDisplays();
  const target = displays.find(d => d.id === displayId) || displays[0];
  if (!target) return false;

  // Leave fullscreen, reposition, re-enter fullscreen
  const wasFullScreen = mainWindow.isFullScreen();
  if (wasFullScreen) mainWindow.setFullScreen(false);

  // Small delay to let the window leave fullscreen before moving
  setTimeout(() => {
    mainWindow.setBounds(target.bounds);
    if (wasFullScreen) {
      setTimeout(() => mainWindow.setFullScreen(true), 150);
    }
  }, 150);

  return true;
});

ipcMain.handle('toggle-fullscreen', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
  return true;
});

// ---- Dev Screen (persistent second-monitor operator view) ----
function createDevWindow(targetDisplayId = null) {
  if (devWindow) {
    devWindow.close();
    devWindow = null;
  }

  const displays = screen.getAllDisplays();
  // Default to secondary display, fallback to primary
  let displayToUse = displays.length > 1 ? displays[1] : displays[0];
  if (targetDisplayId !== null) {
    const found = displays.find(d => d.id === targetDisplayId);
    if (found) displayToUse = found;
  }

  const { x, y, width, height } = displayToUse.bounds;

  devWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    fullscreen: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = isDev
    ? 'http://localhost:5173/#/dev-screen'
    : `file://${path.join(__dirname, '..', 'dist', 'index.html')}#/dev-screen`;

  devWindow.loadURL(devUrl);

  devWindow.on('closed', () => {
    devWindow = null;
  });

  return true;
}

ipcMain.handle('open-dev-screen', (_event, displayId) => {
  return createDevWindow(displayId);
});

ipcMain.handle('close-dev-screen', () => {
  if (devWindow) {
    devWindow.close();
    devWindow = null;
    return true;
  }
  return false;
});

ipcMain.handle('dev-screen-status', () => {
  return devWindow !== null;
});

// Forward card updates from main window to dev window
ipcMain.handle('send-to-dev-screen', (_event, action, data) => {
  if (devWindow && !devWindow.isDestroyed()) {
    devWindow.webContents.send('dev-screen-update', action, data);
    return true;
  }
  return false;
});

// Reverse: dev screen selects a card on the main window
ipcMain.handle('select-on-main', (_event, action, data) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('main-screen-action', action, data);
    return true;
  }
  return false;
});

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
