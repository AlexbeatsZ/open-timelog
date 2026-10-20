const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('timelogDesktop', {
  onRequest(callback) {
    ipcRenderer.on('timelog:request', (_event, request) => callback(request));
  },
  respond(id, result) {
    ipcRenderer.send('timelog:response', { id, result });
  },
  ready() {
    ipcRenderer.send('timelog:ready');
  },
  connection() {
    return ipcRenderer.invoke('timelog:connection');
  },
  setTheme(preference) {
    ipcRenderer.send('timelog:theme', preference);
  },
});
