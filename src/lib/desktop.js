// Detecta a janela do app de desktop. O Electron usa um User-Agent próprio que
// inclui o nome do programa (`lume/0.5.0`) e `Electron/`. Exigir os dois evita
// esconder o convite de instalação em outros navegadores baseados em Electron,
// como o navegador embutido do OpenCode.
export function isDesktopApp(userAgent) {
  const value = userAgent === undefined
    ? (typeof navigator === 'undefined' ? '' : navigator.userAgent)
    : userAgent;
  const text = String(value || '');
  return /\bElectron\//i.test(text) && /\blume\//i.test(text);
}
