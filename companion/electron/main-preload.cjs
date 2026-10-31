// Ponte da janela principal: só o que a barra de título precisa.
// A página continua sem acesso a Node, sistema de arquivos ou token.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lumeWindow', {
  // Avisa a cor do tema para os botões nativos da janela acompanharem o app.
  setTheme(theme) {
    ipcRenderer.send('lume:theme', String(theme || 'dark'));
  },
});
