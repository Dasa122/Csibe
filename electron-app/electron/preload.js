const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Screens
  getScreens: () => ipcRenderer.invoke('get-screens'),
  moveMainWindow: (displayId) => ipcRenderer.invoke('move-main-window', displayId),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),

  // Dev screen (persistent second-monitor operator/audience view)
  openDevScreen: (displayId) => ipcRenderer.invoke('open-dev-screen', displayId),
  closeDevScreen: () => ipcRenderer.invoke('close-dev-screen'),
  devScreenStatus: () => ipcRenderer.invoke('dev-screen-status'),

  // Send card updates to dev screen
  sendToDevScreen: (action, data) => ipcRenderer.invoke('send-to-dev-screen', action, data),

  // Listen for updates (used by dev screen window)
  onDevScreenUpdate: (callback) => {
    const handler = (_event, action, data) => callback(action, data);
    ipcRenderer.on('dev-screen-update', handler);
    return () => ipcRenderer.removeListener('dev-screen-update', handler);
  },

  // Reverse: dev screen controls main window
  selectOnMain: (action, data) => ipcRenderer.invoke('select-on-main', action, data),

  // Listen for actions from dev screen (used by main window)
  onMainScreenAction: (callback) => {
    const handler = (_event, action, data) => callback(action, data);
    ipcRenderer.on('main-screen-action', handler);
    return () => ipcRenderer.removeListener('main-screen-action', handler);
  },
});
