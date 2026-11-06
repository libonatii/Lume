export const MAX_SNAPSHOT_CHARS = 1500000;

// A sessão nunca sai do navegador: só a estrutura e os links copiados pela
// pessoa são enviados, com os atributos necessários às marcas de conclusão.
export function clipboardPage(event) {
  const html = event.clipboardData?.getData('text/html') || '';
  if (html.length < 1200 || !/<(html|body|main|section|div|ul|ol|li|a|h[1-6])\b/i.test(html)) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script:not([type="application/ld+json"]), style, link, svg, noscript, template, iframe, canvas, picture, img, video, audio').forEach((node) => node.remove());
    doc.querySelectorAll('*').forEach((node) => {
      if (node.tagName === 'META' || node.tagName === 'TITLE') return;
      for (const attribute of [...node.attributes]) {
        const name = attribute.name.toLowerCase();
        if (name === 'href') continue;
        if (['class', 'aria-label', 'aria-checked', 'aria-current', 'data-completed', 'data-done', 'data-status', 'data-state', 'data-progress', 'title', 'role'].includes(name)) continue;
        if (name === 'type' && /ld\+json/i.test(attribute.value)) continue;
        node.removeAttribute(attribute.name);
      }
    });
    return (doc.documentElement?.outerHTML || '').slice(0, MAX_SNAPSHOT_CHARS);
  } catch { return ''; }
}
