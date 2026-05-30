const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getScreens: () => ipcRenderer.invoke('get-screens'),
  openSubpage: (url, screenIndex) => ipcRenderer.invoke('open-subpage', url, screenIndex),
  closeSubpage: () => ipcRenderer.invoke('close-subpage'),
  moveMainWindow: (screenIndex) => ipcRenderer.invoke('move-main-window', screenIndex),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
});
