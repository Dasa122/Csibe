const { contextBridge, ipcRenderer } = require('electron');

const LOG_PREFIX = '[Renderer IPC]';
function logIpc(method, payload) {
  console.log(`${LOG_PREFIX} ${new Date().toLocaleTimeString()} │ ${method}`, payload);
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Screens
  getScreens: () => {
    logIpc('getScreens()');
    return ipcRenderer.invoke('get-screens');
  },
  moveMainWindow: (displayId) => {
    logIpc('moveMainWindow()', { displayId });
    return ipcRenderer.invoke('move-main-window', displayId);
  },
  toggleFullscreen: () => {
    logIpc('toggleFullscreen()');
    return ipcRenderer.invoke('toggle-fullscreen');
  },

  // Dev screen (persistent second-monitor operator/audience view)
  openDevScreen: (displayId) => {
    logIpc('openDevScreen()', { displayId });
    return ipcRenderer.invoke('open-dev-screen', displayId);
  },
  closeDevScreen: () => {
    logIpc('closeDevScreen()');
    return ipcRenderer.invoke('close-dev-screen');
  },
  devScreenStatus: () => {
    logIpc('devScreenStatus()');
    return ipcRenderer.invoke('dev-screen-status');
  },

  // Send card updates to dev screen
  sendToDevScreen: (action, data) => {
    logIpc('sendToDevScreen()', { action, data });
    return ipcRenderer.invoke('send-to-dev-screen', action, data);
  },

  // Listen for updates (used by dev screen window)
  onDevScreenUpdate: (callback) => {
    const handler = (_event, action, data) => callback(action, data);
    ipcRenderer.on('dev-screen-update', handler);
    return () => ipcRenderer.removeListener('dev-screen-update', handler);
  },

  // Reverse: dev screen controls main window
  selectOnMain: (action, data) => {
    logIpc('selectOnMain()', { action, data });
    return ipcRenderer.invoke('select-on-main', action, data);
  },

  // Listen for actions from dev screen (used by main window)
  onMainScreenAction: (callback) => {
    const handler = (_event, action, data) => callback(action, data);
    ipcRenderer.on('main-screen-action', handler);
    return () => ipcRenderer.removeListener('main-screen-action', handler);
  },
});
