const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

// ── Logging ──────────────────────────────────────────────────
const LOG_PREFIX = '[Main]';
function log(...args) { console.log(`${LOG_PREFIX} ${new Date().toLocaleTimeString()} │`, ...args); }
function logError(...args) { console.error(`${LOG_PREFIX} ${new Date().toLocaleTimeString()} ❌`, ...args); }
function logIpc(channel, payload) {
  log(`IPC ${channel}`, payload);
}
function logWindowState(label, win) {
  if (!win || win.isDestroyed()) {
    log(`${label} → unavailable`);
    return;
  }
  log(`${label} →`, {
    bounds: win.getBounds(),
    isFullScreen: win.isFullScreen(),
    isMinimized: win.isMinimized(),
    isFocused: win.isFocused(),
  });
}

// ── Linux stability + GPU acceleration ──
// Must be set BEFORE app.whenReady()
if (process.platform === 'linux') {
  // Stability (kept from original — prevents crashes in certain environments)
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-dev-shm-usage');

  // GPU acceleration — let Electron pick the best backend (Vulkan > ANGLE > EGL > GL)
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
  app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
  app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
  app.commandLine.appendSwitch('enable-accelerated-video-decode');
  // Prefer Vulkan if available, fall back to ANGLE/EGL automatically
  app.commandLine.appendSwitch('enable-features', 'Vulkan,DefaultANGLEVulkan,VaapiVideoDecoder,CanvasOopRasterization');

  log('Linux flags: GPU acceleration ENABLED (Vulkan/ANGLE/EGL), sandbox=off, dev-shm=off');
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
  log('createMainWindow()', { targetDisplayId });
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
    logWindowState('Main window state after load', mainWindow);
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
  logIpc('get-screens', {});
  const primaryId = screen.getPrimaryDisplay().id;
  const result = screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    index: i,
    label: d.label || `Display ${i + 1}`,
    bounds: d.bounds,
    isPrimary: d.id === primaryId,
    size: `${d.size.width}×${d.size.height}`,
    scaleFactor: d.scaleFactor,
  }));
  log('get-screens →', result.length, 'displays');
  return result;
});

ipcMain.handle('move-main-window', (_event, displayId) => {
  logIpc('move-main-window', { displayId });
  if (!mainWindow) return false;
  const displays = screen.getAllDisplays();
  const target = displays.find(d => d.id === displayId) || displays[0];
  if (!target) return false;
  log('move-main-window → display', displayId, `${target.size.width}x${target.size.height}`);

  const wasFullScreen = mainWindow.isFullScreen();
  if (wasFullScreen) mainWindow.setFullScreen(false);

  setTimeout(() => {
    mainWindow.setBounds(target.bounds);
    if (wasFullScreen) {
      setTimeout(() => mainWindow.setFullScreen(true), 150);
    }
    logWindowState('Main window after move', mainWindow);
  }, 150);

  return true;
});

ipcMain.handle('toggle-fullscreen', () => {
  logIpc('toggle-fullscreen', {});
  if (mainWindow) {
    const next = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(next);
    log('toggle-fullscreen →', next);
    logWindowState('Main window after fullscreen toggle', mainWindow);
  }
  return true;
});

// ---- Dev Screen ----
function createDevWindow(targetDisplayId = null) {
  log('createDevWindow()', { targetDisplayId });
  if (devWindow) {
    devWindow.close();
    devWindow = null;
  }

  const displays = screen.getAllDisplays();
  let displayToUse = displays.length > 1 ? displays[1] : displays[0];
  if (targetDisplayId !== null) {
    const found = displays.find(d => d.id === targetDisplayId);
    if (found) displayToUse = found;
  }

  const { x, y, width, height } = displayToUse.bounds;
  log('Dev window →', `${width}x${height} at (${x},${y})`);

  devWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    fullscreen: true,
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  devWindow.once('ready-to-show', () => {
    devWindow.show();
    log('Dev window shown');
  });

  devWindow.webContents.on('did-finish-load', () => {
    log('Dev window loaded');
    logWindowState('Dev window state after load', devWindow);
  });

  devWindow.webContents.on('did-fail-load', (_event, code, desc) => {
    logError(`Dev window load failed: ${code} — ${desc}`);
  });

  const devUrl = isDev
    ? 'http://localhost:5173/#/dev-screen'
    : `file://${path.join(__dirname, '..', 'dist', 'index.html')}#/dev-screen`;

  log('Dev window loading:', devUrl);
  devWindow.loadURL(devUrl);

  devWindow.on('closed', () => {
    log('Dev window closed');
    devWindow = null;
  });

  return true;
}

ipcMain.handle('open-dev-screen', (_event, displayId) => {
  logIpc('open-dev-screen', { displayId });
  log('open-dev-screen', displayId || 'auto');
  return createDevWindow(displayId);
});

ipcMain.handle('close-dev-screen', () => {
  logIpc('close-dev-screen', {});
  if (devWindow) {
    log('close-dev-screen');
    devWindow.close();
    devWindow = null;
    return true;
  }
  return false;
});

ipcMain.handle('dev-screen-status', () => {
  logIpc('dev-screen-status', { open: devWindow !== null });
  return devWindow !== null;
});

ipcMain.handle('send-to-dev-screen', (_event, action, data) => {
  logIpc('send-to-dev-screen', { action, data });
  if (devWindow && !devWindow.isDestroyed()) {
    devWindow.webContents.send('dev-screen-update', action, data);
    return true;
  }
  return false;
});

ipcMain.handle('select-on-main', (_event, action, data) => {
  logIpc('select-on-main', { action, data });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('main-screen-action', action, data);
    return true;
  }
  return false;
});

// ── App lifecycle ─────────────────────────────────────────────
app.on('window-all-closed', () => {
  log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  log('App quitting');
});

app.on('second-instance', () => {
  log('Second instance attempted — focusing main window');
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  log('App ready');
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      log('Activate — creating main window');
      createMainWindow();
    }
  });
});
