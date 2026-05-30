const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;
let subWindow = null;

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;

function createMainWindow(targetScreen = null) {
  const displays = screen.getAllDisplays();

  let displayToUse = displays[0];
  if (targetScreen !== null && targetScreen < displays.length) {
    displayToUse = displays[targetScreen];
  }

  const { x, y, width, height } = displayToUse.bounds;

  mainWindow = new BrowserWindow({
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

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createSubWindow(url, screenIndex = null) {
  if (subWindow) {
    subWindow.close();
    subWindow = null;
  }

  const displays = screen.getAllDisplays();
  let displayToUse = displays[1] || displays[0];
  if (screenIndex !== null && screenIndex < displays.length) {
    displayToUse = displays[screenIndex];
  }

  const { x, y, width, height } = displayToUse.bounds;

  subWindow = new BrowserWindow({
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

  if (isDev) {
    subWindow.loadURL(`http://localhost:5173/#${url}`);
  } else {
    subWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
      hash: url,
    });
  }

  subWindow.on('closed', () => {
    subWindow = null;
  });

  return subWindow;
}

// IPC handlers
ipcMain.handle('get-screens', () => {
  return screen.getAllDisplays().map((d, i) => ({
    id: i,
    label: d.label || `Screen ${i + 1}`,
    bounds: d.bounds,
    isPrimary: i === 0,
    size: `${d.size.width}x${d.size.height}`,
  }));
});

ipcMain.handle('open-subpage', (_event, url, screenIndex) => {
  createSubWindow(url, screenIndex);
  return true;
});

ipcMain.handle('close-subpage', () => {
  if (subWindow) {
    subWindow.close();
    subWindow = null;
  }
  return true;
});

ipcMain.handle('move-main-window', (_event, screenIndex) => {
  if (mainWindow) {
    const displays = screen.getAllDisplays();
    if (screenIndex < displays.length) {
      const { x, y } = displays[screenIndex].bounds;
      mainWindow.setPosition(x, y);
    }
  }
  return true;
});

ipcMain.handle('toggle-fullscreen', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
  return true;
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
