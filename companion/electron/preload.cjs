// Ponte segura entre a janela e o processo principal. A janela não tem acesso
// a Node, ao sistema de arquivos nem ao token do dispositivo.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('companion', {
  onState(callback) {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('state', listener);
    return () => ipcRenderer.removeListener('state', listener);
  },
  action(name, payload) {
    return ipcRenderer.invoke('action', name, payload);
  },
});
