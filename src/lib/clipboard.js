// A API moderna de área de transferência exige documento em foco e permissão;
// em janelas embutidas ou com outro painel focado ela falha com NotAllowedError.
// O caminho antigo (textarea + execCommand) continua funcionando nesses casos.
export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Segue para o método antigo; a falha aqui não prova que a cópia é impossível.
    }
  }
  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '-1000px';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, text.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(field);
    return copied;
  } catch {
    return false;
  }
}

// Deixa o texto selecionado para quem precisar copiar com o teclado.
export function selectText(selector) {
  const node = document.querySelector(selector);
  const selection = window.getSelection();
  if (!node || !selection) return false;
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}
